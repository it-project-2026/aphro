import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple in-memory cache for Nominatim
  const geoCache = new Map();

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
