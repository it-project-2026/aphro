import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import {
  testConnection,
  performPreviewSync,
  performRealisasiPreview,
  executeLiveSync,
  getActiveSyncStatus,
  getMigrationAuditLogs,
  SUPPORTED_TABLES,
  fetchSourceData,
  setHypercloudDatabaseUrl,
  getHypercloudDatabaseUrl
} from "./server/migrationService";

// Initialize Firebase Admin
try {
  admin.initializeApp({
    projectId: "conductive-catcher-w9v0l",
  });
} catch (e) {
  console.warn("Firebase Admin already initialized or failed:", e);
}

const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "ai-studio-aphroassetprotec-d28001e8-66ea-4678-abc8-62d11d5e3a61";

let db: ReturnType<typeof getFirestore> | null = null;
try {
  db = getFirestore(FIRESTORE_DATABASE_ID);
} catch (e) {
  console.warn("Failed to initialize Firestore admin DB:", e);
}

let messaging: ReturnType<typeof getMessaging> | null = null;
try {
  messaging = getMessaging();
} catch (e) {
  console.warn("Failed to initialize Firebase Messaging admin:", e);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS middleware for internal preview
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // HyperCloudHost API Health Check Proxy
  app.get("/api/hypercloud/health", async (req, res) => {
    try {
      const response = await axios.get("https://api.aphro-row.my.id/api/health", {
        timeout: 10000,
        headers: { Accept: "application/json" }
      });
      return res.json(response.data);
    } catch (err: any) {
      return res.status(err.response?.status || 502).json({
        status: "error",
        message: err.message,
        details: err.response?.data || null
      });
    }
  });

  // Generic HyperCloudHost API Reverse Proxy
  app.all("/api/hypercloud-proxy/*", async (req, res) => {
    try {
      const subPath = req.params[0] || "";
      const targetUrl = `https://api.aphro-row.my.id/${subPath}`;
      
      const forwardHeaders: Record<string, string> = {
        accept: "application/json",
        "content-type": "application/json"
      };
      if (req.headers.authorization) {
        forwardHeaders.authorization = req.headers.authorization as string;
      }

      const response = await axios({
        method: req.method as any,
        url: targetUrl,
        params: req.query,
        data: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
        headers: forwardHeaders,
        timeout: 20000,
        validateStatus: () => true
      });

      return res.status(response.status).json(response.data);
    } catch (err: any) {
      return res.status(502).json({
        status: "error",
        message: `HyperCloudHost Proxy error: ${err.message}`
      });
    }
  });

  // Simple in-memory cache for Nominatim
  const geoCache = new Map();

  // Notification endpoint
  app.post("/api/send-notification", async (req, res) => {
    const { reguName, woData } = req.body;
    
    if (!reguName || !woData) {
      return res.status(400).json({ error: "Missing reguName or woData" });
    }

    try {
      if (!db || !messaging) {
        console.warn("Firebase Admin DB or Messaging not available.");
        return res.json({ success: false, message: "Firebase Messaging not configured" });
      }

      // 1. Get FCM tokens for this regu
      // We'll fetch all tokens and filter in code to handle case-insensitivity more easily
      let tokens: string[] = [];
      try {
        const tokensSnapshot = await db.collection("fcm_tokens").get();
        const targetRegu = String(reguName).trim().toUpperCase();
        tokens = tokensSnapshot.docs
          .map(doc => doc.data())
          .filter(data => (data.reguName || "").trim().toUpperCase() === targetRegu)
          .map(data => data.token);
      } catch (fcmDbError: any) {
        console.warn("Unable to query fcm_tokens from Firestore:", fcmDbError?.message || fcmDbError);
        return res.json({ success: false, message: "Firestore fcm_tokens unavailable", details: fcmDbError?.message });
      }

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
      return res.json({ 
        success: true, 
        successCount: response.successCount, 
        failureCount: response.failureCount 
      });
    } catch (error: any) {
      console.error("Error sending notification:", error?.message || error);
      return res.json({ success: false, error: "Failed to send notification", details: error?.message });
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

  // ==========================================
  // DATABASE MIGRATION ENGINE (SUPABASE -> HYPERCLOUDHOST)
  // ==========================================

  // 0. Get / Set Target Database Config
  app.get("/api/admin/migration/config", (req, res) => {
    const rawUrl = getHypercloudDatabaseUrl();
    const maskedUrl = rawUrl ? rawUrl.replace(/:([^:@]+)@/, ":*****@") : "";
    return res.json({
      status: "success",
      data: {
        rawUrl: rawUrl || "",
        maskedUrl: maskedUrl || "",
        isConfigured: !!rawUrl
      }
    });
  });

  app.post("/api/admin/migration/config", (req, res) => {
    const { url } = req.body || {};
    if (url && typeof url === "string") {
      setHypercloudDatabaseUrl(url);
    }
    const rawUrl = getHypercloudDatabaseUrl();
    return res.json({
      status: "success",
      message: "Konfigurasi URL database HyperCloudHost diperbarui",
      data: {
        rawUrl: rawUrl,
        maskedUrl: rawUrl.replace(/:([^:@]+)@/, ":*****@")
      }
    });
  });

  // 1. Test Connections
  app.post("/api/admin/migration/test-connection", async (req, res) => {
    try {
      const { customHypercloudUrl } = req.body || {};
      if (customHypercloudUrl) {
        setHypercloudDatabaseUrl(customHypercloudUrl);
      }
      const [supabaseRes, hypercloudRes] = await Promise.all([
        testConnection("supabase"),
        testConnection("hypercloud", customHypercloudUrl)
      ]);
      return res.json({
        status: "success",
        data: {
          supabase: supabaseRes,
          hypercloud: hypercloudRes
        }
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // 2. Preview / Dry Run Sync (Cek Perbedaan)
  app.post("/api/admin/migration/preview", async (req, res) => {
    try {
      const { tables, unitFilter, dateFrom, dateTo, customHypercloudUrl } = req.body || {};
      if (customHypercloudUrl) {
        setHypercloudDatabaseUrl(customHypercloudUrl);
      }
      const diffSummaries = await performPreviewSync({
        tables,
        unitFilter,
        dateFrom,
        dateTo,
        customHypercloudUrl
      });
      return res.json({
        status: "success",
        data: diffSummaries
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // 2.1 Dedicated Preview Realisasi (ReadOnly Dry Run - No Mutations)
  app.post("/api/admin/migration/preview-realisasi", async (req, res) => {
    try {
      const { customHypercloudUrl } = req.body || {};
      if (customHypercloudUrl) {
        setHypercloudDatabaseUrl(customHypercloudUrl);
      }
      const previewResult = await performRealisasiPreview(customHypercloudUrl);
      return res.json({
        status: "success",
        data: previewResult
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // 3. Start Live Sync or Dry Run
  app.post("/api/admin/migration/start", async (req, res) => {
    try {
      const { tables, unitFilter, dateFrom, dateTo, batchSize, operator, isDryRun, customHypercloudUrl } = req.body || {};
      if (customHypercloudUrl) {
        setHypercloudDatabaseUrl(customHypercloudUrl);
      }
      
      const currentActive = getActiveSyncStatus();
      if (currentActive && currentActive.status === "RUNNING") {
        return res.status(409).json({
          status: "conflict",
          message: "Proses sinkronisasi sedang berjalan. Harap tunggu hingga selesai.",
          data: currentActive
        });
      }

      const syncState = await executeLiveSync({
        tables,
        unitFilter,
        dateFrom,
        dateTo,
        batchSize,
        operator: operator || "Admin",
        isDryRun: !!isDryRun
      });

      return res.json({
        status: "success",
        message: isDryRun ? "Dry-run sinkronisasi dimulai" : "Sinkronisasi live dimulai",
        data: syncState
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // 4. Get Current Active Sync Status
  app.get("/api/admin/migration/status", (req, res) => {
    const status = getActiveSyncStatus();
    return res.json({
      status: "success",
      data: status || {
        status: "IDLE",
        percent: 0,
        recentActivity: [],
        tableSummaries: {}
      }
    });
  });

  // 5. Get Migration Audit Logs
  app.get("/api/admin/migration/logs", (req, res) => {
    const logs = getMigrationAuditLogs();
    return res.json({
      status: "success",
      data: logs
    });
  });

  // 6. Generate Downloadable SQL Script On-Demand
  app.post("/api/admin/migration/export-sql", async (req, res) => {
    try {
      const { tables, unitFilter, dateFrom, dateTo } = req.body || {};
      const selectedTables = tables && tables.length > 0 ? tables : Object.keys(SUPPORTED_TABLES);
      selectedTables.sort((a: string, b: string) => (SUPPORTED_TABLES[a]?.order || 99) - (SUPPORTED_TABLES[b]?.order || 99));

      let sql = "-- ==========================================================================\n";
      sql += "-- APHRO DATABASE MIGRATION SCRIPT (SUPABASE -> HYPERCLOUDHOST)\n";
      sql += `-- Generated At: ${new Date().toISOString()}\n`;
      sql += `-- Filter Unit: ${unitFilter || "ALL"} | Tanggal: ${dateFrom || "Semua"} s/d ${dateTo || "Semua"}\n`;
      sql += "-- ==========================================================================\n\n";
      sql += "BEGIN;\n\n";

      // 0. Inject Schema DDL (Ensure tables and all columns exist before inserting)
      sql += "-- ==========================================================================\n";
      sql += "-- 0. SCHEMA INITIALIZATION & COLUMN ALIGNMENT\n";
      sql += "-- ==========================================================================\n";
      sql += `
CREATE TABLE IF NOT EXISTS public."WORK_ORDER" (
  "WO_ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "Nomor_WO" TEXT,
  "PEKERJAAN" TEXT DEFAULT 'NORMAL',
  "Tanggal" TEXT,
  "ULP" TEXT,
  "PENYULANG" TEXT,
  "REGU_ROW" TEXT,
  "VOLUME" NUMERIC DEFAULT 0,
  "SATUAN" TEXT DEFAULT 'Pohon',
  "TOTAL_REALISASI" NUMERIC DEFAULT 0,
  "SATUAN_TOTAL_REALISASI" TEXT DEFAULT 'Pohon',
  "WO_AWAL" TEXT,
  "WO_AKHIR" TEXT,
  "LOKASI_START" TEXT,
  "LOKASI_FINISH" TEXT,
  "STATUS" TEXT DEFAULT 'DRAFT',
  "Created_At" TEXT
);
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "unitId" TEXT DEFAULT 'UL1';
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "PEKERJAAN" TEXT DEFAULT 'NORMAL';
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "Nomor_WO" TEXT;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "Tanggal" TEXT;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "ULP" TEXT;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "PENYULANG" TEXT;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "REGU_ROW" TEXT;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "VOLUME" NUMERIC DEFAULT 0;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "SATUAN" TEXT DEFAULT 'Pohon';
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "TOTAL_REALISASI" NUMERIC DEFAULT 0;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "SATUAN_TOTAL_REALISASI" TEXT DEFAULT 'Pohon';
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "WO_AWAL" TEXT;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "WO_AKHIR" TEXT;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "LOKASI_START" TEXT;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "LOKASI_FINISH" TEXT;
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "STATUS" TEXT DEFAULT 'DRAFT';
ALTER TABLE public."WORK_ORDER" ADD COLUMN IF NOT EXISTS "Created_At" TEXT;

CREATE TABLE IF NOT EXISTS public."ABSENSI" (
  "ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "TANGGAL" TEXT,
  "NAMA_REGU" TEXT,
  "ULP" TEXT,
  "PETUGAS_1" TEXT,
  "KET_1" TEXT,
  "PETUGAS_2" TEXT,
  "KET_2" TEXT,
  "PETUGAS_3" TEXT,
  "KET_3" TEXT,
  "PETUGAS_4" TEXT,
  "KET_4" TEXT,
  "PETUGAS_5" TEXT,
  "KET_5" TEXT,
  "FOTO_MASUK" TEXT,
  "TIMESTAMP MASUK" TEXT,
  "FOTO_KELUAR" TEXT,
  "TIMESTAMP KELUAR" TEXT
);
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "unitId" TEXT DEFAULT 'UL1';
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "TANGGAL" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "NAMA_REGU" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "ULP" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "PETUGAS_1" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "KET_1" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "PETUGAS_2" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "KET_2" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "PETUGAS_3" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "KET_3" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "PETUGAS_4" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "KET_4" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "PETUGAS_5" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "KET_5" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "FOTO_MASUK" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "TIMESTAMP MASUK" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "FOTO_KELUAR" TEXT;
ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "TIMESTAMP KELUAR" TEXT;

CREATE TABLE IF NOT EXISTS public."REALISASI" (
  "ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "WO_ID" TEXT,
  "Nomor_WO" TEXT,
  "ULP" TEXT,
  "REGU_ROW" TEXT,
  "PENYULANG" TEXT,
  "NO_TIANG" TEXT,
  "TANGGAL" TEXT,
  "Foto_Sebelum" TEXT,
  "Foto_Sesudah" TEXT,
  "Jenis_Tanaman" TEXT,
  "Keterangan" TEXT,
  "Pertumbuhan_Tanaman" TEXT,
  "Kendala" TEXT,
  "Latitude_Longitude" TEXT,
  "Lokasi_kerja" TEXT,
  "Timestamp" TEXT
);
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "unitId" TEXT DEFAULT 'UL1';
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "WO_ID" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Nomor_WO" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "ULP" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "REGU_ROW" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "PENYULANG" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "NO_TIANG" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "TANGGAL" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Foto_Sebelum" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Foto_Sesudah" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Jenis_Tanaman" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Keterangan" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Pertumbuhan_Tanaman" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Kendala" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Latitude_Longitude" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Lokasi_kerja" TEXT;
ALTER TABLE public."REALISASI" ADD COLUMN IF NOT EXISTS "Timestamp" TEXT;
\n`;

      function escapeSql(val: any) {
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "number") return val.toString();
        if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
        return "'" + String(val).replace(/'/g, "''") + "'";
      }

      for (const tbl of selectedTables) {
        const config = SUPPORTED_TABLES[tbl];
        if (!config) continue;
        const rows = await fetchSourceData(tbl, { unitFilter, dateFrom, dateTo });
        
        sql += `-- --------------------------------------------------------------------------\n`;
        sql += `-- TABEL: ${tbl} (${rows.length} Records)\n`;
        sql += `-- --------------------------------------------------------------------------\n`;

        for (const row of rows) {
          const colNames = config.columns.map(c => `"${c}"`).join(", ");
          const colValues = config.columns.map(col => {
            let val = row[col];
            if (val === undefined || val === null) {
              if (col === "REGU_ROW") val = row.REGU_ROW ?? row.Regu_ROW ?? row.Regu ?? row.Nama_Regu ?? null;
              else if (col === "PENYULANG") val = row.PENYULANG ?? row.Penyulang ?? null;
              else if (col === "PEKERJAAN") val = row.PEKERJAAN ?? row.Pekerjaan ?? "NORMAL";
              else if (col === "STATUS") val = row.STATUS ?? row.Status ?? "DRAFT";
              else if (col === "WO_AWAL") val = row.WO_AWAL ?? row.WO_MULAI ?? row.woAwal ?? null;
              else if (col === "Created_At") val = row.Created_At ?? row.created_at ?? null;
              else if (col === "TANGGAL") val = row.TANGGAL ?? row.Tanggal ?? null;
              else if (col === "NAMA_REGU") val = row.NAMA_REGU ?? row.Nama_Regu ?? row.Regu ?? null;
              else if (col === "TIMESTAMP MASUK") val = row["TIMESTAMP MASUK"] ?? row.TIMESTAMP_MASUK ?? row.Timestamp_Masuk ?? null;
              else if (col === "TIMESTAMP KELUAR") val = row["TIMESTAMP KELUAR"] ?? row.TIMESTAMP_KELUAR ?? row.Timestamp_Keluar ?? null;
              else if (col === "NO_TIANG") val = row.NO_TIANG ?? row.Nomor_Tiang ?? row.No_Tiang ?? null;
              else if (col === "Foto_Sebelum") val = row.Foto_Sebelum ?? row.FOTO_SEBELUM ?? null;
              else if (col === "Foto_Sesudah") val = row.Foto_Sesudah ?? row.FOTO_SETELAH ?? row.FOTO_SESUDAH ?? null;
              else if (col === "Jenis_Tanaman") val = row.Jenis_Tanaman ?? row.TIPE_POHON ?? row.Nama_Pohon ?? null;
              else if (col === "Latitude_Longitude") val = row.Latitude_Longitude ?? (row.LATITUDE && row.LONGITUDE ? `${row.LATITUDE},${row.LONGITUDE}` : null);
            }
            return escapeSql(val);
          }).join(", ");

          const updateClauses = config.columns
            .filter(c => c !== config.primaryKey)
            .map(c => `"${c}" = EXCLUDED."${c}"`);

          const onConflict = updateClauses.length > 0
            ? `ON CONFLICT ("${config.primaryKey}") DO UPDATE SET ${updateClauses.join(", ")}`
            : `ON CONFLICT ("${config.primaryKey}") DO NOTHING`;

          sql += `INSERT INTO "${tbl}" (${colNames}) VALUES (${colValues}) ${onConflict};\n`;
        }
        sql += "\n";
      }

      sql += "COMMIT;\n";

      res.setHeader("Content-Type", "application/sql");
      res.setHeader("Content-Disposition", `attachment; filename="aphro_sync_${Date.now()}.sql"`);
      return res.send(sql);
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Proxy endpoint for HyperCloudHost API to prevent browser CORS and support all methods (GET, POST, PUT, DELETE)
  app.all([
    "/api/login*",
    "/api/health*",
    "/api/realisasi*",
    "/api/work-orders*",
    "/api/absensi*",
    "/api/master-data*",
    "/api/users*",
    "/api/auth*",
    "/api/inisiasi*"
  ], async (req, res) => {
    try {
      const targetUrl = `https://api.aphro-row.my.id${req.originalUrl}`;
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: {
          Authorization: req.headers.authorization || "",
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        timeout: 10000
      });
      return res.status(response.status).json(response.data);
    } catch (error: any) {
      if (error.response) {
        return res.status(error.response.status).json(error.response.data);
      }
      console.warn(`Proxy ${req.originalUrl} network error:`, error.message);
      return res.status(502).json({
        status: "error",
        message: "Proxy request to external HyperCloudHost API failed",
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
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html") || filePath.endsWith("version.json") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
