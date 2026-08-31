import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Initialize Firebase Admin
try {
  admin.initializeApp({
    projectId: "conductive-catcher-w9v0l",
  });
} catch (e) {
  console.warn("Firebase Admin already initialized or failed:", e);
}

const db = getFirestore();
const messaging = getMessaging();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple in-memory cache for Nominatim
  const geoCache = new Map();

  // Notification endpoint
  app.post("/api/send-notification", async (req, res) => {
    const { reguName, woData } = req.body;
    
    if (!reguName || !woData) {
      return res.status(400).json({ error: "Missing reguName or woData" });
    }

    try {
      // 1. Get FCM tokens for this regu
      // We'll fetch all tokens and filter in code to handle case-insensitivity more easily
      // OR we can store them in uppercase. Let's fetch all and filter for now as it's more robust.
      const tokensSnapshot = await db.collection("fcm_tokens").get();
      
      const targetRegu = String(reguName).trim().toUpperCase();
      const tokens = tokensSnapshot.docs
        .map(doc => doc.data())
        .filter(data => (data.reguName || "").trim().toUpperCase() === targetRegu)
        .map(data => data.token);

      if (tokens.length === 0) {
        console.log(`No FCM tokens found for regu: ${reguName}`);
        return res.json({ success: true, message: "No tokens found, notification not sent" });
      }

      // 2. Format message
      const messageBody = `Ada Work Order untuk Team ${reguName}
No. Work ORDER : ${woData.nomorWO}
Tanggal WORK ORDER : ${woData.tanggal}
PENYULANG : ${woData.penyulangName}
START : ${woData.woMulai || "-"}
AKHIR : ${woData.woAkhir || "-"}
TARGET : ${woData.volumePekerjaan} ${woData.satuan}`;

      const message = {
        notification: {
          title: "Work Order Baru",
          body: messageBody,
        },
        data: {
          woId: woData.id || "",
          click_action: "FLUTTER_NOTIFICATION_CLICK", // for mobile
        },
        tokens: tokens,
      };

      // 3. Send notification
      const response = await messaging.sendEachForMulticast(message);
      
      console.log(`Successfully sent ${response.successCount} notifications`);
      res.json({ 
        success: true, 
        successCount: response.successCount, 
        failureCount: response.failureCount 
      });
    } catch (error: any) {
      console.error("Error sending notification:", error);
      res.status(500).json({ error: "Failed to send notification", details: error.message });
    }
  });

  // Proxy endpoint for Nominatim to avoid CORS issues
  app.get("/api/reverse-geocode", async (req, res) => {
    const { lat, lon } = req.query;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: "Missing lat or lon parameters" });
    }

    const cacheKey = `${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`;
    if (geoCache.has(cacheKey)) {
      return res.json(geoCache.get(cacheKey));
    }

    try {
      const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
        params: {
          format: "json",
          lat,
          lon,
          zoom: 18,
          addressdetails: 1
        },
        headers: {
          "User-Agent": "APHRO-Asset-Protection-App-Proxy/1.0 (deddy.data74@gmail.com)",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
        }
      });
      
      geoCache.set(cacheKey, response.data);
      res.json(response.data);
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn("Nominatim Rate Limit Hit (429)");
        return res.status(429).json({ error: "Rate limit hit" });
      }
      
      console.error("Nominatim Proxy Error:", error.message);
      res.status(error.response?.status || 500).json({ 
        error: "Failed to fetch from Nominatim",
        details: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
