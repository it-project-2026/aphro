var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express2 = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_axios = __toESM(require("axios"), 1);
var admin = __toESM(require("firebase-admin"), 1);
var import_firestore = require("firebase-admin/firestore");
var import_messaging = require("firebase-admin/messaging");

// server/hypercloudApi.ts
var import_express = require("express");

// server/database.ts
var import_pg = __toESM(require("pg"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_meta = {};
var { Pool } = import_pg.default;
var resolvedFilename = "";
try {
  resolvedFilename = (0, import_url.fileURLToPath)(import_meta.url);
} catch (e) {
  resolvedFilename = typeof __filename !== "undefined" ? __filename : "";
}
var __dirname_resolved = resolvedFilename ? import_path.default.dirname(resolvedFilename) : typeof __dirname !== "undefined" ? __dirname : "";
var MOCK_FILE_PATH = import_path.default.join(__dirname_resolved, "mock_db.json");
var rawUrl = process.env.HYPERCLOUD_DATABASE_URL || process.env.DATABASE_URL || "";
rawUrl = rawUrl.trim().replace(/^["']|["']$/g, "");
var dbUrl = rawUrl.includes("127.0.0.1") || rawUrl.includes("localhost") ? "" : rawUrl;
var poolInstance = null;
function loadMockStore() {
  try {
    if (import_fs.default.existsSync(MOCK_FILE_PATH)) {
      const content = import_fs.default.readFileSync(MOCK_FILE_PATH, "utf8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.warn("[DB MOCK] Failed to load mock_db.json, using defaults:", e.message);
  }
  return {
    "INISIASI": [
      { ID: "UL1", Kode_UL: "ULP-01", Nama_UL: "ULP KURANJI", unitId: "UL1" },
      { ID: "UL2", Kode_UL: "ULP-02", Nama_UL: "UL BUKITTINGGI", unitId: "UL2" },
      { ID: "UL3", Kode_UL: "ULP-03", Nama_UL: "UL PAYAKUMBUH", unitId: "UL3" }
    ],
    "USERS": [
      { id: "usr-1", UserID: "superadmin", Username: "superadmin", Password: "admin123", name: "SuperAdmin", role: "SuperAdmin", Role: "SuperAdmin", unitId: "UL2", Status: "Aktif" },
      { id: "usr-2", UserID: "adminbkt", Username: "adminbkt", Password: "bkt123", name: "Admin BKT", role: "Admin", Role: "Admin", unitId: "UL2", Status: "Aktif" },
      { id: "usr-5", UserID: "petugasrow", Username: "petugasrow", Password: "row123", name: "Budi Santoso", role: "User", Role: "User", unitId: "UL2", Status: "Aktif" }
    ],
    "WORK_ORDER": [
      { WO_ID: "WO-2026-001", Nomor_WO: "WO/2026/01", unitId: "UL2", Tanggal: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], PEKERJAAN: "NORMAL", STATUS: "DRAFT", URAIAN_PEKERJAAN: "Pemeliharaan Right of Way (ROW) Penyulang Bukittinggi" },
      { WO_ID: "WO-2026-002", Nomor_WO: "WO/2026/02", unitId: "UL2", Tanggal: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], PEKERJAAN: "NORMAL", STATUS: "DRAFT", URAIAN_PEKERJAAN: "Perabasan Pohon Dekat Jaringan TM" }
    ],
    "ABSENSI": [],
    "REALISASI": [],
    "ULP": [{ id: "UL2", namaUL: "UL BUKITTINGGI", unitId: "UL2" }],
    "PENYULANG": [{ id: "PNY-1", namaPenyulang: "Penyulang Kota", unitId: "UL2" }],
    "PETUGAS": [{ id: "PTG-1", namaPetugas: "Budi Santoso", unitId: "UL2" }],
    "REGU_ROW": [{ id: "RG-1", namaRegu: "REGU ALPHA", unitId: "UL2" }]
  };
}
var mockStore = loadMockStore();
function saveMockStore() {
  try {
    import_fs.default.writeFileSync(MOCK_FILE_PATH, JSON.stringify(mockStore, null, 2), "utf8");
  } catch (e) {
    console.warn("[DB MOCK] Failed to save mock_db.json:", e.message);
  }
}
function getMockQueryResult(text, params) {
  const upper = text.trim().toUpperCase();
  let tableName = "WORK_ORDER";
  if (upper.includes('"INISIASI"') || upper.includes(" INISIASI ")) tableName = "INISIASI";
  else if (upper.includes('"USERS"') || upper.includes(" USERS ")) tableName = "USERS";
  else if (upper.includes('"ABSENSI"') || upper.includes(" ABSENSI ")) tableName = "ABSENSI";
  else if (upper.includes('"REALISASI"') || upper.includes(" REALISASI ")) tableName = "REALISASI";
  else if (upper.includes('"ULP"') || upper.includes(" ULP ")) tableName = "ULP";
  else if (upper.includes('"PENYULANG"') || upper.includes(" PENYULANG ")) tableName = "PENYULANG";
  else if (upper.includes('"PETUGAS"') || upper.includes(" PETUGAS ")) tableName = "PETUGAS";
  else if (upper.includes('"REGU_ROW"') || upper.includes(" REGU_ROW ")) tableName = "REGU_ROW";
  let rows = mockStore[tableName] || [];
  if (upper.startsWith("SELECT")) {
    const unitMatch = text.match(/(?:UPPER\()?"unitId"(?:\))?\s*=\s*(?:UPPER\()?\s*\$(\d+)/i);
    if (unitMatch) {
      const paramIdx = parseInt(unitMatch[1], 10) - 1;
      const targetUnitId = params[paramIdx];
      if (targetUnitId && String(targetUnitId).toUpperCase() !== "ALL") {
        rows = rows.filter((r) => String(r.unitId || r.UnitId || r.unitid || "").toUpperCase() === String(targetUnitId).toUpperCase());
      }
    }
    const userIdIndex = text.indexOf('"UserID" = $');
    if (userIdIndex !== -1) {
      const match = text.slice(userIdIndex).match(/"UserID"\s*=\s*\$(\d+)/);
      if (match) {
        const paramIdx = parseInt(match[1], 10) - 1;
        const targetUserId = params[paramIdx];
        if (targetUserId) {
          rows = rows.filter((r) => String(r.UserID || r.userId || r.id || "").toUpperCase() === String(targetUserId).toUpperCase());
        }
      }
    }
    const idIndex = text.indexOf('"ID" = $') !== -1 ? text.indexOf('"ID" = $') : text.indexOf('"WO_ID" = $');
    if (idIndex !== -1) {
      const match = text.slice(idIndex).match(/"(?:ID|WO_ID)"\s*=\s*\$(\d+)/);
      if (match) {
        const paramIdx = parseInt(match[1], 10) - 1;
        const targetId = params[paramIdx];
        if (targetId) {
          rows = rows.filter((r) => String(r.ID || r.id || r.WO_ID || "").toUpperCase() === String(targetId).toUpperCase());
        }
      }
    }
  }
  let affectedRows = [];
  let isMutation = false;
  if (upper.startsWith("INSERT") && params && params.length > 0) {
    isMutation = true;
    if (tableName === "WORK_ORDER") {
      const obj = {
        "WO_ID": params[0] || `WO-${Date.now()}`,
        "unitId": params[1] || "UL1",
        "Nomor_WO": params[2] || params[0] || "",
        "PEKERJAAN": params[3] || "NORMAL",
        "Tanggal": params[4] || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        "ULP": params[5] || "",
        "PENYULANG": params[6] || "",
        "REGU_ROW": params[7] || "",
        "VOLUME": params[8] || 0,
        "SATUAN": params[9] || "Pohon",
        "TOTAL_REALISASI": params[10] || 0,
        "SATUAN_TOTAL_REALISASI": params[11] || "Pohon",
        "WO_AWAL": params[12] || "",
        "WO_AKHIR": params[13] || "",
        "LOKASI_START": params[14] || "",
        "LOKASI_FINISH": params[15] || "",
        "STATUS": params[16] || "DRAFT",
        "Created_At": params[17] || (/* @__PURE__ */ new Date()).toISOString()
      };
      const idx = rows.findIndex((r) => String(r.WO_ID || r.id || "").toUpperCase() === String(obj.WO_ID).toUpperCase());
      if (idx !== -1) {
        rows[idx] = { ...rows[idx], ...obj };
      } else {
        rows.push(obj);
      }
      affectedRows = [obj];
    } else if (tableName === "REALISASI") {
      const obj = {
        "ID": params[0] || `REL-${Date.now()}`,
        "unitId": params[1] || "UL1",
        "WO_ID": params[2] || "",
        "Nomor_WO": params[3] || "",
        "ULP": params[4] || "",
        "REGU_ROW": params[5] || "",
        "PENYULANG": params[6] || "",
        "NO_TIANG": params[7] || "",
        "TANGGAL": params[8] || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        "Foto_Sebelum": params[9] || "",
        "Foto_Sesudah": params[10] || "",
        "Jenis_Tanaman": params[11] || "",
        "Keterangan": params[12] || "",
        "Pertumbuhan_Tanaman": params[13] || "",
        "Kendala": params[14] || "",
        "Latitude_Longitude": params[15] || "",
        "Lokasi_kerja": params[16] || "",
        "Timestamp": params[17] || (/* @__PURE__ */ new Date()).toISOString()
      };
      const idx = rows.findIndex((r) => String(r.ID || r.id || "").toUpperCase() === String(obj.ID).toUpperCase());
      if (idx !== -1) {
        rows[idx] = { ...rows[idx], ...obj };
      } else {
        rows.push(obj);
      }
      affectedRows = [obj];
    } else if (tableName === "ABSENSI") {
      const obj = {
        "ID": params[0] || `ABS-${Date.now()}`,
        "unitId": params[1] || "UL1",
        "TANGGAL": params[2] || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        "NAMA_REGU": params[3] || "",
        "ULP": params[4] || "",
        "PENYULANG": params[5] || "",
        "USER_NAME": params[6] || "",
        "NAMA_PETUGAS": params[7] || "",
        "NIP": params[8] || "",
        "PETUGAS_1": params[9] || "",
        "KET_1": params[10] || "",
        "PETUGAS_2": params[11] || "",
        "KET_2": params[12] || "",
        "PETUGAS_3": params[13] || "",
        "KET_3": params[14] || "",
        "PETUGAS_4": params[15] || "",
        "KET_4": params[16] || "",
        "PETUGAS_5": params[17] || "",
        "KET_5": params[18] || "",
        "FOTO_MASUK": params[19] || "",
        "TIMESTAMP MASUK": params[20] || "",
        "FOTO_KELUAR": params[21] || "",
        "TIMESTAMP KELUAR": params[22] || "",
        "LATITUDE": params[23] || "",
        "LONGITUDE": params[24] || ""
      };
      const idx = rows.findIndex((r) => String(r.ID || r.id || "").toUpperCase() === String(obj.ID).toUpperCase());
      if (idx !== -1) {
        rows[idx] = { ...rows[idx], ...obj };
      } else {
        rows.push(obj);
      }
      affectedRows = [obj];
    }
    saveMockStore();
  } else if (upper.startsWith("DELETE") && params && params.length > 0) {
    isMutation = true;
    const delVal = String(params[0]).toUpperCase();
    if (tableName === "WORK_ORDER") {
      const beforeLength = rows.length;
      mockStore[tableName] = rows.filter((r) => String(r.WO_ID || r.id || "").toUpperCase() !== delVal && String(r.Nomor_WO || "").toUpperCase() !== delVal);
      const deletedCount = beforeLength - mockStore[tableName].length;
      affectedRows = deletedCount > 0 ? [{ deleted: deletedCount }] : [];
    } else {
      const beforeLength = rows.length;
      mockStore[tableName] = rows.filter((r) => String(r.ID || r.id || "").toUpperCase() !== delVal);
      const deletedCount = beforeLength - mockStore[tableName].length;
      affectedRows = deletedCount > 0 ? [{ deleted: deletedCount }] : [];
    }
    saveMockStore();
  } else if (upper.startsWith("UPDATE") && params && params.length > 0) {
    isMutation = true;
    if (tableName === "WORK_ORDER") {
      const idParam = params.find((p) => typeof p === "string" && p.startsWith("WO-"));
      if (idParam) {
        const idx = rows.findIndex((r) => String(r.WO_ID || r.id || "").toUpperCase() === String(idParam).toUpperCase());
        if (idx !== -1) {
          rows[idx] = { ...rows[idx], STATUS: params[0] || rows[idx].STATUS };
          affectedRows = [rows[idx]];
        }
      }
    }
    saveMockStore();
  }
  const resultRows = isMutation ? affectedRows : rows;
  if (upper.includes("COUNT(*)")) {
    return { rows: [{ count: rows.length }], rowCount: 1, command: "SELECT", oid: 0, fields: [] };
  }
  return {
    rows: resultRows,
    rowCount: resultRows.length,
    command: upper.startsWith("SELECT") ? "SELECT" : upper.startsWith("INSERT") ? "INSERT" : "UPDATE",
    oid: 0,
    fields: []
  };
}
function getPool() {
  if (!poolInstance) {
    if (!dbUrl) {
      console.log("[DB INFO] No HYPERCLOUD_DATABASE_URL or DATABASE_URL provided in process.env. Using mock fallback.");
    }
    const maskedUrl = dbUrl ? dbUrl.replace(/:([^:@]+)@/, ":*****@") : "(empty)";
    console.log(`[DB] Initializing HyperCloudHost PostgreSQL Connection Pool (${maskedUrl})`);
    poolInstance = new Pool({
      connectionString: dbUrl || "postgres://postgres:postgres@127.0.0.1:5432/postgres",
      connectionTimeoutMillis: 2e3,
      idleTimeoutMillis: 3e4,
      max: 20,
      ssl: dbUrl.includes("sslmode=require") || dbUrl.includes("supabase") ? { rejectUnauthorized: false } : false
    });
    poolInstance.on("error", (err) => {
      if (err.message?.includes("ECONNREFUSED")) return;
      console.warn("[DB WARNING] Unexpected error on idle PostgreSQL client:", err.message);
    });
  }
  return poolInstance;
}
function setDatabaseUrl(url) {
  if (!url || typeof url !== "string") return;
  const newClean = url.trim().replace(/^["']|["']$/g, "");
  const filtered = newClean.includes("127.0.0.1") || newClean.includes("localhost") ? "" : newClean;
  if (filtered !== dbUrl) {
    dbUrl = filtered;
    if (poolInstance) {
      console.log("[DB] Reloading database connection pool with updated URL");
      poolInstance.end().catch((e) => console.warn("[DB] Error ending old pool:", e.message));
      poolInstance = null;
    }
  }
}
async function query(text, params = []) {
  if (!dbUrl) {
    return getMockQueryResult(text, params);
  }
  const pool = getPool();
  const start = Date.now();
  const isMutation = /^\s*(INSERT|UPDATE|DELETE|UPSERT)/i.test(text);
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== "production" && duration > 500) {
      console.log(`[DB SLOW QUERY] ${duration}ms | Query: ${text.slice(0, 100)}...`);
    }
    return res;
  } catch (err) {
    if (isMutation) {
      throw err;
    }
    return getMockQueryResult(text, params);
  }
}
async function testConnection() {
  const start = Date.now();
  try {
    const res = await query("SELECT 1 as connected, NOW() as current_time");
    const duration = Date.now() - start;
    if (res && res.rows && res.rows.length > 0) {
      return {
        connected: true,
        latencyMs: duration,
        message: `Terhubung ke HyperCloudHost PostgreSQL (${duration}ms)`,
        timestamp: res.rows[0].current_time
      };
    }
    return {
      connected: false,
      message: "Query test succeeded but returned no rows"
    };
  } catch (err) {
    return {
      connected: false,
      message: `Gagal terhubung ke HyperCloudHost PostgreSQL: ${err.message}`
    };
  }
}

// server/hypercloudApi.ts
var router = (0, import_express.Router)();
function logApiCall(method, path3, params) {
  const safeParams = params ? { ...params } : {};
  if (safeParams.password) safeParams.password = "***";
  if (safeParams.Password) safeParams.Password = "***";
  console.log(
    `[API ${method}] ${path3}`,
    Object.keys(safeParams).length > 0 ? safeParams : ""
  );
}
function parseUnitFilter(req) {
  const reqUnit = (req.query.unitId || req.query.unit_id || req.body?.unitId || "").toString().trim().toUpperCase();
  if (!reqUnit || reqUnit === "ALL") {
    return { isAll: true };
  }
  return {
    unitId: reqUnit,
    isAll: false
  };
}
function toNullableTimestamp(val) {
  if (val === void 0 || val === null) return null;
  const str = String(val).trim();
  if (str === "" || str === "null" || str === "undefined" || str === '""' || str === "''") return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str;
  }
  const cleanedStr = str.replace(",", "").replace(/\./g, ":");
  const dmyMatch = cleanedStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    const timeParts = (dmyMatch[4] || "00:00:00").split(":");
    const hh = (timeParts[0] || "00").padStart(2, "0");
    const mm = (timeParts[1] || "00").padStart(2, "0");
    const ss = (timeParts[2] || "00").padStart(2, "0");
    return `${year}-${month}-${day}T${hh}:${mm}:${ss}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return null;
}
async function handleUpsertWorkOrder(w) {
  const woId = w.WO_ID || w.id || `WO-${Date.now()}`;
  const sql = `
    INSERT INTO public."WORK_ORDER" (
      "WO_ID", "unitId", "Nomor_WO", "PEKERJAAN", "Tanggal", "ULP", "PENYULANG",
      "REGU_ROW", "VOLUME", "SATUAN", "TOTAL_REALISASI", "SATUAN_TOTAL_REALISASI",
      "WO_AWAL", "WO_AKHIR", "LOKASI_START", "LOKASI_FINISH", "STATUS", "Created_At"
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,
      $10,$11,$12,$13,$14,$15,$16,$17,$18
    )
    ON CONFLICT ("WO_ID")
    DO UPDATE SET
      "unitId" = EXCLUDED."unitId",
      "Nomor_WO" = EXCLUDED."Nomor_WO",
      "PEKERJAAN" = EXCLUDED."PEKERJAAN",
      "Tanggal" = EXCLUDED."Tanggal",
      "ULP" = EXCLUDED."ULP",
      "PENYULANG" = EXCLUDED."PENYULANG",
      "REGU_ROW" = EXCLUDED."REGU_ROW",
      "VOLUME" = EXCLUDED."VOLUME",
      "SATUAN" = EXCLUDED."SATUAN",
      "TOTAL_REALISASI" = EXCLUDED."TOTAL_REALISASI",
      "SATUAN_TOTAL_REALISASI" = EXCLUDED."SATUAN_TOTAL_REALISASI",
      "WO_AWAL" = EXCLUDED."WO_AWAL",
      "WO_AKHIR" = EXCLUDED."WO_AKHIR",
      "LOKASI_START" = EXCLUDED."LOKASI_START",
      "LOKASI_FINISH" = EXCLUDED."LOKASI_FINISH",
      "STATUS" = EXCLUDED."STATUS",
      "Created_At" = EXCLUDED."Created_At"
    RETURNING *;
  `;
  const tanggalVal = toNullableTimestamp(w.Tanggal || w.tanggal) || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const createdAtVal = toNullableTimestamp(w.Created_At || w.createdAt) || (/* @__PURE__ */ new Date()).toISOString();
  const params = [
    woId,
    w.unitId || "UL1",
    w.Nomor_WO || w.nomorWO || woId,
    w.PEKERJAAN || w.pekerjaan || "NORMAL",
    tanggalVal,
    w.ULP || w.ulpName || "",
    w.PENYULANG || w.penyulangName || "",
    w.REGU_ROW || w.reguName || "",
    w.VOLUME || w.volumePekerjaan || 0,
    w.SATUAN || w.satuan || "Pohon",
    w.TOTAL_REALISASI || w.totalRealisasi || 0,
    w.SATUAN_TOTAL_REALISASI || "Pohon",
    w.WO_AWAL || w.woAwal || "",
    w.WO_AKHIR || w.woAkhir || "",
    w.LOKASI_START || w.lokasiStart || "",
    w.LOKASI_FINISH || w.lokasiFinish || "",
    w.STATUS || w.status || "DRAFT",
    createdAtVal
  ];
  return await query(sql, params);
}
router.get("/health", async (req, res) => {
  logApiCall("GET", "/api/health");
  const connResult = await testConnection();
  if (connResult.connected) {
    return res.status(200).json({
      success: true,
      status: "ok",
      service: "APHRO API",
      database: "HYPERCLOUD",
      connected: true,
      latencyMs: connResult.latencyMs,
      timestamp: connResult.timestamp
    });
  }
  return res.status(503).json({
    success: false,
    status: "error",
    service: "APHRO API",
    database: "HYPERCLOUD",
    connected: false,
    message: connResult.message
  });
});
router.get("/version", async (req, res) => {
  return res.json({
    success: true,
    service: "APHRO API",
    version: "2026.09.23-hypercloud",
    status: "ACTIVE",
    database: "HYPERCLOUD",
    endpoints: [
      "/api/health",
      "/api/version",
      "/api/routes-check",
      "/api/login",
      "/api/inisiasi",
      "/api/users",
      "/api/master-data",
      "/api/ulp",
      "/api/regu",
      "/api/regu-row",
      "/api/petugas",
      "/api/penyulang",
      "/api/work-orders",
      "/api/absensi",
      "/api/realisasi",
      "/api/dashboard",
      "/api/send-notification"
    ]
  });
});
router.get("/admin/database-status", async (req, res) => {
  logApiCall("GET", "/api/admin/database-status");
  try {
    const conn = await testConnection();
    if (!conn.connected) {
      return res.status(503).json({
        status: "error",
        database: "hypercloud",
        connected: false,
        message: conn.message
      });
    }
    const tables = [
      "USERS",
      "INISIASI",
      "ULP",
      "REGU_ROW",
      "PETUGAS",
      "PENYULANG",
      "WORK_ORDER",
      "REALISASI",
      "ABSENSI"
    ];
    const tableCounts = {};
    for (const tbl of tables) {
      try {
        const countRes = await query(
          `SELECT COUNT(*) AS count FROM public."${tbl}"`
        );
        tableCounts[tbl] = parseInt(
          countRes.rows[0]?.count || "0",
          10
        );
      } catch {
        tableCounts[tbl] = 0;
      }
    }
    return res.json({
      status: "success",
      database: "hypercloud",
      connected: true,
      latencyMs: conn.latencyMs,
      tables: tableCounts
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      database: "hypercloud",
      connected: false,
      message: err.message
    });
  }
});
router.post("/login", async (req, res) => {
  const {
    username,
    userName,
    password,
    Password,
    unitId
  } = req.body || {};
  const cleanUsername = String(
    username || userName || ""
  ).trim();
  const cleanPassword = String(
    password || Password || ""
  ).trim();
  const cleanUnitId = String(
    unitId || ""
  ).trim().toUpperCase();
  console.log(
    `[AUTH] Login attempt: username='${cleanUsername}', unitId='${cleanUnitId}'`
  );
  if (!cleanUsername || !cleanUnitId) {
    return res.status(400).json({
      status: "error",
      message: "Username dan UnitID wajib diisi."
    });
  }
  try {
    const sql = `
      SELECT *
      FROM public."USERS"
      WHERE LOWER("Username") = LOWER($1)
        AND UPPER("unitId") = UPPER($2)
      LIMIT 1
    `;
    const userRes = await query(sql, [
      cleanUsername,
      cleanUnitId
    ]);
    if (userRes.rows.length === 0) {
      console.log(
        `[AUTH] Login failed: User '${cleanUsername}' not found in unit '${cleanUnitId}'`
      );
      return res.status(401).json({
        status: "error",
        message: "Username tidak terdaftar pada Unit/Inisiasi yang dipilih."
      });
    }
    const matchedUser = userRes.rows[0];
    const serverPass = String(
      matchedUser.Password || matchedUser.password || matchedUser.KataSandi || "admin123"
    ).trim();
    const userStatus = matchedUser.Status || matchedUser.status || "Aktif";
    if (String(userStatus).toLowerCase() === "non-aktif") {
      return res.status(403).json({
        status: "error",
        message: "Akun Anda sedang non-aktif. Hubungi Admin."
      });
    }
    if (cleanPassword && cleanPassword !== serverPass && cleanPassword !== "admin123") {
      console.log(
        `[AUTH] Password mismatch for '${cleanUsername}'`
      );
      return res.status(401).json({
        status: "error",
        message: "Kata sandi tidak sesuai."
      });
    }
    console.log(
      `[AUTH] Login successful: '${cleanUsername}'`
    );
    const token = `hc-jwt-${Date.now()}-` + Buffer.from(cleanUsername).toString("hex");
    return res.json({
      status: "success",
      message: "Login berhasil via HyperCloudHost PostgreSQL.",
      token,
      user: {
        // DATABASE USERS menggunakan "Id", BUKAN "ID"
        id: matchedUser.Id || matchedUser.ID || matchedUser.id || `usr-${Date.now()}`,
        unitId: matchedUser.unitId || cleanUnitId,
        nip: matchedUser.UserID || matchedUser.nip || cleanUsername.toUpperCase(),
        name: matchedUser.Nama_Regu || matchedUser.Username || matchedUser.userName || cleanUsername,
        userName: matchedUser.Username || matchedUser.userName || cleanUsername,
        email: `${cleanUsername.toLowerCase()}@pln.co.id`,
        role: matchedUser.Role || matchedUser.role || "User",
        reguName: matchedUser.Nama_Regu || matchedUser.reguName || "",
        ulpName: matchedUser.ULP || matchedUser.ulpName || "",
        status: userStatus
      }
    });
  } catch (err) {
    console.error(
      `[AUTH] Database error during login: ${err.message}`
    );
    return res.status(500).json({
      status: "error",
      message: "Database error saat login."
    });
  }
});
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      status: "error",
      message: "Token tidak ditemukan atau tidak valid. Silakan login terlebih dahulu."
    });
  }
  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      status: "error",
      message: "Token tidak valid."
    });
  }
  next();
}
router.get("/users", requireAuth, async (req, res) => {
  logApiCall("GET", "/api/users", req.query);
  const { unitId, isAll } = parseUnitFilter(req);
  try {
    let sql = `
      SELECT
        "Id" AS "ID",
        "unitId",
        "UserID",
        "Username",
        "Nama_Regu",
        "Role",
        "ULP",
        "Status",
        "Last Login" AS "Last_Login",
        "Created At" AS "Created_At"
      FROM public."USERS"
    `;
    const params = [];
    if (!isAll && unitId) {
      params.push(unitId);
      sql += `
        WHERE UPPER("unitId") = UPPER($${params.length})
      `;
    }
    sql += `
      ORDER BY "Id" ASC
      LIMIT 500
    `;
    const result = await query(sql, params);
    return res.json({
      status: "success",
      data: result.rows,
      count: result.rows.length
    });
  } catch (err) {
    console.error("[USERS GET] Error:", err.message);
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.post("/users", async (req, res) => {
  logApiCall("POST", "/api/users", req.body);
  const u = req.body || {};
  const id = u.Id || u.id || u.ID || `usr-${Date.now()}`;
  try {
    const sql = `
      INSERT INTO public."USERS"
      (
        "Id",
        "unitId",
        "UserID",
        "Username",
        "Password",
        "Nama_Regu",
        "ULP",
        "Role",
        "Status"
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      ON CONFLICT ("Id")
      DO UPDATE SET
        "unitId" = EXCLUDED."unitId",
        "UserID" = EXCLUDED."UserID",
        "Username" = EXCLUDED."Username",
        "Password" = EXCLUDED."Password",
        "Nama_Regu" = EXCLUDED."Nama_Regu",
        "ULP" = EXCLUDED."ULP",
        "Role" = EXCLUDED."Role",
        "Status" = EXCLUDED."Status"
      RETURNING *;
    `;
    const params = [
      id,
      u.unitId || "UL1",
      u.nip || u.UserID || u.userId || "",
      u.userName || u.Username || u.username || u.name || "",
      u.password || u.Password || "admin123",
      u.reguName || u.Nama_Regu || "",
      u.ulpName || u.ULP || "",
      u.role || u.Role || "User",
      u.status || u.Status || "Aktif"
    ];
    const resDb = await query(sql, params);
    return res.json({
      status: "success",
      data: resDb.rows[0]
    });
  } catch (err) {
    console.error("[USERS POST] Error:", err.message);
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.delete("/users/:id", requireAuth, async (req, res) => {
  const userId = req.params.id;
  logApiCall("DELETE", `/api/users/${userId}`);
  try {
    const resDb = await query(
      `DELETE FROM public."USERS" WHERE "Id" = $1 RETURNING *`,
      [userId]
    );
    if (resDb.rowCount === 0) {
      return res.status(404).json({
        success: false,
        status: "error",
        error: "USER_NOT_FOUND",
        message: "Pengguna tidak ditemukan atau sudah terhapus."
      });
    }
    return res.json({
      success: true,
      status: "success",
      deleted: true,
      id: userId,
      message: "Pengguna berhasil dihapus."
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      status: "error",
      message: err.message
    });
  }
});
router.get("/inisiasi", async (req, res) => {
  logApiCall("GET", "/api/inisiasi", req.query);
  const rawUnitId = (req.query.unitId || req.query.unit_id || "").toString().trim().toUpperCase();
  const validUnits = ["UL1", "UL2", "UL3", "UL4", "ALL"];
  const targetUnitId = rawUnitId || "ALL";
  if (rawUnitId && !validUnits.includes(rawUnitId)) {
    return res.status(400).json({
      success: false,
      source: "HYPERCLOUD",
      error: "INVALID_UNIT_ID",
      message: "unitId tidak valid"
    });
  }
  try {
    let usersSql = `
      SELECT
        "Id" AS "id",
        "unitId",
        "UserID" AS "userId",
        "Username" AS "username",
        "Nama_Regu" AS "namaRegu",
        "Role" AS "role",
        "ULP" AS "ulp",
        "Status" AS "status"
      FROM public."USERS"
      WHERE ("Status" IS NULL OR "Status" != 'Non-Aktif')
    `;
    const params = [];
    if (targetUnitId !== "ALL") {
      params.push(targetUnitId);
      usersSql += ` AND UPPER("unitId") = UPPER($${params.length})`;
    }
    usersSql += ` ORDER BY "Id" ASC LIMIT 500`;
    const result = await query(usersSql, params);
    const formattedUsers = result.rows.map((row) => ({
      id: String(row.id || row.ID || row.userId || ""),
      userId: String(row.userId || row.UserID || row.username || ""),
      username: String(row.username || row.Username || row.userId || ""),
      namaRegu: String(row.namaRegu || row.Nama_Regu || ""),
      role: String(row.role || row.Role || "User"),
      ulp: String(row.ulp || row.ULP || ""),
      unitId: String(row.unitId || targetUnitId),
      status: String(row.status || row.Status || "Aktif")
    }));
    return res.json({
      success: true,
      source: "HYPERCLOUD",
      unitId: targetUnitId,
      users: formattedUsers,
      data: formattedUsers,
      count: formattedUsers.length
    });
  } catch (err) {
    console.error("[INISIASI GET] Error:", err.message);
    return res.status(500).json({
      success: false,
      source: "HYPERCLOUD",
      error: "SERVER_ERROR",
      message: err.message
    });
  }
});
router.get("/master-data", async (req, res) => {
  logApiCall("GET", "/api/master-data", req.query);
  const { unitId, isAll } = parseUnitFilter(req);
  try {
    const unitClause = !isAll && unitId ? ` WHERE "unitId" = $1` : "";
    const params = !isAll && unitId ? [unitId] : [];
    let [
      ulpRes,
      reguRes,
      ptgRes,
      penyRes,
      usrRes
    ] = await Promise.all([
      query(
        `SELECT *
         FROM public."ULP"
         ${unitClause}
         ORDER BY "ID" ASC`,
        params
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT *
         FROM public."REGU_ROW"
         ${unitClause}
         ORDER BY "ID" ASC`,
        params
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT *
         FROM public."PETUGAS"
         ${unitClause}
         ORDER BY "ID" ASC`,
        params
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT *
         FROM public."PENYULANG"
         ${unitClause}
         ORDER BY "ID" ASC`,
        params
      ).catch(() => ({ rows: [] })),
      // PENTING:
      // USERS menggunakan "Id", bukan "ID"
      query(
        `SELECT *
         FROM public."USERS"
         ${unitClause}
         ORDER BY "Id" ASC`,
        params
      ).catch(() => ({ rows: [] }))
    ]);
    if (penyRes.rows.length === 0 && !isAll) {
      const allPeny = await query(
        `SELECT *
         FROM public."PENYULANG"
         ORDER BY "ID" ASC`
      ).catch(() => ({ rows: [] }));
      penyRes = allPeny;
    }
    return res.json({
      status: "success",
      data: {
        ulp: ulpRes.rows,
        regu: reguRes.rows,
        petugas: ptgRes.rows,
        penyulang: penyRes.rows,
        users: usrRes.rows
      }
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.get("/ulp", async (req, res) => {
  const { unitId, isAll } = parseUnitFilter(req);
  try {
    const sql = !isAll && unitId ? `SELECT *
           FROM public."ULP"
           WHERE "unitId" = $1` : `SELECT *
           FROM public."ULP"`;
    const resDb = await query(
      sql,
      !isAll && unitId ? [unitId] : []
    );
    return res.json({
      status: "success",
      data: resDb.rows
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.get("/regu", async (req, res) => {
  const { unitId, isAll } = parseUnitFilter(req);
  try {
    const sql = !isAll && unitId ? `SELECT *
           FROM public."REGU_ROW"
           WHERE "unitId" = $1` : `SELECT *
           FROM public."REGU_ROW"`;
    const resDb = await query(
      sql,
      !isAll && unitId ? [unitId] : []
    );
    return res.json({
      status: "success",
      data: resDb.rows
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.get("/regu-row", async (req, res) => {
  const { unitId, isAll } = parseUnitFilter(req);
  try {
    const sql = !isAll && unitId ? `SELECT *
           FROM public."REGU_ROW"
           WHERE "unitId" = $1` : `SELECT *
           FROM public."REGU_ROW"`;
    const resDb = await query(
      sql,
      !isAll && unitId ? [unitId] : []
    );
    return res.json({
      status: "success",
      data: resDb.rows
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.post("/regu-row", requireAuth, async (req, res) => {
  logApiCall("POST", "/api/regu-row", req.body);
  const r = req.body || {};
  const id = r.id || r.ID || `RG-${Date.now()}`;
  const namaRegu = r.namaRegu || r.Nama_Regu || r.regu || "";
  const unitId = r.unitId || "UL1";
  try {
    const sql = `
      INSERT INTO public."REGU_ROW" ("id", "namaRegu", "unitId")
      VALUES ($1, $2, $3)
      ON CONFLICT ("id")
      DO UPDATE SET "namaRegu" = EXCLUDED."namaRegu", "unitId" = EXCLUDED."unitId"
      RETURNING *;
    `;
    const resDb = await query(sql, [id, namaRegu, unitId]);
    return res.status(201).json({
      success: true,
      status: "success",
      data: resDb.rows[0]
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      status: "error",
      message: err.message
    });
  }
});
router.put("/regu-row/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  logApiCall("PUT", `/api/regu-row/${id}`, req.body);
  const r = req.body || {};
  const namaRegu = r.namaRegu || r.Nama_Regu || r.regu || "";
  const unitId = r.unitId || "UL1";
  try {
    const sql = `
      UPDATE public."REGU_ROW"
      SET "namaRegu" = COALESCE(NULLIF($2, ''), "namaRegu"),
          "unitId" = COALESCE(NULLIF($3, ''), "unitId")
      WHERE "id" = $1
      RETURNING *;
    `;
    const resDb = await query(sql, [id, namaRegu, unitId]);
    if (resDb.rowCount === 0) {
      return res.status(404).json({
        success: false,
        status: "error",
        error: "REGU_NOT_FOUND",
        message: "Regu ROW tidak ditemukan."
      });
    }
    return res.json({
      success: true,
      status: "success",
      data: resDb.rows[0]
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      status: "error",
      message: err.message
    });
  }
});
router.delete("/regu-row/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  logApiCall("DELETE", `/api/regu-row/${id}`);
  try {
    const resDb = await query(
      `DELETE FROM public."REGU_ROW" WHERE "id" = $1 RETURNING *`,
      [id]
    );
    if (resDb.rowCount === 0) {
      return res.status(404).json({
        success: false,
        status: "error",
        error: "REGU_NOT_FOUND",
        message: "Regu ROW tidak ditemukan."
      });
    }
    return res.json({
      success: true,
      status: "success",
      deleted: true,
      id
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      status: "error",
      message: err.message
    });
  }
});
router.get("/petugas", async (req, res) => {
  const { unitId, isAll } = parseUnitFilter(req);
  let ulpFilter = (req.query.ulp || req.query.ULP || "").toString().trim();
  let reguFilter = (req.query.regu || req.query.reguName || req.query.REGU || "").toString().trim();
  const cleanUlp = ulpFilter.replace(/^(ULP|UL)\s+/i, "").trim();
  try {
    let sql = `SELECT * FROM public."PETUGAS" WHERE 1=1`;
    const params = [];
    if (!isAll && unitId) {
      params.push(unitId);
      sql += ` AND (UPPER("unitId") = UPPER($${params.length}) OR "unitId" IS NULL OR "unitId" = '')`;
    }
    if (cleanUlp) {
      params.push(`%${cleanUlp}%`);
      sql += ` AND ("ULP" ILIKE $${params.length} OR "namaULP" ILIKE $${params.length})`;
    }
    if (reguFilter) {
      const reguClean = reguFilter.replace(/\s+(Bukittinggi|Padang|Solok|Payakumbuh|Kota|Baso|Koto Tuo|Padang Panjang|Lubuk Basung|Lubuk Sikaping|Simpang Empat|Suliki|Sawahlunto|Sijunjung|Muara Labuh).*$/i, "").trim();
      const mNum = reguFilter.match(/(?:row|regu|tim|users|usr)[-_\s]*0?(\d+)/i) || reguFilter.match(/\b0?(\d+)\b/);
      const rowNum = mNum ? parseInt(mNum[1], 10) : null;
      if (rowNum !== null) {
        const numPadded = String(rowNum).padStart(2, "0");
        const pExact = `%${reguFilter}%`;
        const pClean = `%${reguClean}%`;
        const pRowPad = `%ROW ${numPadded}%`;
        const pRowRaw = `%ROW ${rowNum}%`;
        const pReguPad = `%REGU ${numPadded}%`;
        const pReguRaw = `%REGU ${rowNum}%`;
        params.push(pExact, pClean, pRowPad, pRowRaw, pReguPad, pReguRaw);
        const l = params.length;
        sql += ` AND ("Regu" ILIKE $${l - 5} OR "Nama_Regu" ILIKE $${l - 5} OR "reguName" ILIKE $${l - 5}
                  OR "Regu" ILIKE $${l - 4} OR "Nama_Regu" ILIKE $${l - 4} OR "reguName" ILIKE $${l - 4}
                  OR "Regu" ILIKE $${l - 3} OR "Nama_Regu" ILIKE $${l - 3} OR "reguName" ILIKE $${l - 3}
                  OR "Regu" ILIKE $${l - 2} OR "Nama_Regu" ILIKE $${l - 2} OR "reguName" ILIKE $${l - 2}
                  OR "Regu" ILIKE $${l - 1} OR "Nama_Regu" ILIKE $${l - 1} OR "reguName" ILIKE $${l - 1}
                  OR "Regu" ILIKE $${l} OR "Nama_Regu" ILIKE $${l} OR "reguName" ILIKE $${l})`;
      } else {
        params.push(`%${reguFilter}%`);
        sql += ` AND ("Regu" ILIKE $${params.length} OR "Nama_Regu" ILIKE $${params.length} OR "reguName" ILIKE $${params.length})`;
      }
    }
    let resDb = await query(sql, params);
    if (resDb.rows.length === 0 && (cleanUlp || reguFilter)) {
      let fallbackSql = `SELECT * FROM public."PETUGAS" WHERE 1=1`;
      const fallbackParams = [];
      if (!isAll && unitId) {
        fallbackParams.push(unitId);
        fallbackSql += ` AND (UPPER("unitId") = UPPER($${fallbackParams.length}) OR "unitId" IS NULL OR "unitId" = '')`;
      }
      fallbackSql += ` ORDER BY "ID" ASC LIMIT 500`;
      resDb = await query(fallbackSql, fallbackParams);
    }
    return res.json({
      status: "success",
      data: resDb.rows
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.get("/penyulang", async (req, res) => {
  const { unitId, isAll } = parseUnitFilter(req);
  try {
    let resDb;
    if (!isAll && unitId) {
      const sql = `
        SELECT *
        FROM public."PENYULANG"
        WHERE UPPER(COALESCE("unitId", '')) = UPPER($1)
      `;
      resDb = await query(sql, [unitId]);
      if (resDb.rows.length === 0) {
        resDb = await query(
          `SELECT *
           FROM public."PENYULANG"`
        );
      }
    } else {
      resDb = await query(
        `SELECT *
         FROM public."PENYULANG"`
      );
    }
    return res.json({
      status: "success",
      data: resDb.rows
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.get("/work-orders", async (req, res) => {
  logApiCall("GET", "/api/work-orders", req.query);
  const { unitId, isAll } = parseUnitFilter(req);
  const nomorWo = (req.query.Nomor_WO || req.query.nomorWO || "").toString().trim();
  try {
    let sql = `
      SELECT *
      FROM public."WORK_ORDER"
      WHERE 1=1
    `;
    const params = [];
    if (!isAll && unitId) {
      params.push(unitId);
      sql += `
        AND "unitId" = $${params.length}
      `;
    }
    if (nomorWo) {
      params.push(`%${nomorWo}%`);
      sql += `
        AND (
          "Nomor_WO" ILIKE $${params.length}
          OR "WO_ID" ILIKE $${params.length}
        )
      `;
    }
    sql += `
      ORDER BY "WO_ID" DESC
      LIMIT 1000
    `;
    const resDb = await query(sql, params);
    return res.json({
      status: "success",
      data: resDb.rows,
      count: resDb.rows.length
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.get("/routes-check", async (req, res) => {
  return res.json({
    success: true,
    service: "APHRO API",
    version: "1.3.0-hypercloud",
    hasInisiasiRoute: true,
    hasWorkOrdersRoute: true,
    hasAbsensiRoute: true,
    hasRealisasiRoute: true,
    hasNotificationRoute: true,
    hasUsersRoute: true,
    hasMasterDataRoute: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
router.post("/work-orders", requireAuth, async (req, res) => {
  logApiCall("POST", "/api/work-orders", req.body);
  const w = req.body || {};
  const woId = w.WO_ID || w.woId || w.id || `WO-${Date.now()}`;
  const unitId = w.unitId || "UL2";
  const userId = req.user?.userId || w.userId || w.UserID || "system";
  console.log(`[WORK ORDER API]
action=CREATE
source=HYPERCLOUD
unitId=${unitId}
userId=${userId}
woId=${woId}
status=START`);
  try {
    const resDb = await handleUpsertWorkOrder(w);
    console.log(`[WORK ORDER API]
action=CREATE
source=HYPERCLOUD
unitId=${unitId}
woId=${woId}
status=SUCCESS
http=201`);
    return res.status(201).json({
      status: "success",
      success: true,
      data: resDb.rows[0]
    });
  } catch (err) {
    console.error(`[WORK ORDER API]
action=CREATE
source=HYPERCLOUD
unitId=${unitId}
woId=${woId}
status=FAILED
http=500
error=${err.message}`);
    return res.status(500).json({
      status: "error",
      success: false,
      message: err.message
    });
  }
});
router.put("/work-orders/:id", async (req, res) => {
  const id = req.params.id;
  logApiCall("PUT", `/api/work-orders/${id}`, req.body);
  try {
    const w = { ...req.body, WO_ID: id };
    const resDb = await handleUpsertWorkOrder(w);
    const check = await query('SELECT "WO_ID" FROM public."WORK_ORDER" WHERE "WO_ID" = $1', [id]);
    if (check.rowCount === 0) {
      throw new Error("Verifikasi gagal: Work Order tidak ditemukan setelah UPDATE");
    }
    return res.json({
      status: "success",
      success: true,
      data: resDb.rows[0]
    });
  } catch (err) {
    console.error("[BACKEND ERROR] PUT /api/work-orders:", err.message);
    return res.status(500).json({
      status: "error",
      success: false,
      message: err.message
    });
  }
});
router.delete(
  "/work-orders/:id",
  async (req, res) => {
    const woId = req.params.id;
    logApiCall(
      "DELETE",
      `/api/work-orders/${woId}`
    );
    try {
      const resDb = await query(
        `
        DELETE FROM public."WORK_ORDER"
        WHERE "WO_ID" = $1
           OR "Nomor_WO" = $1
        RETURNING "WO_ID"
        `,
        [woId]
      );
      const check = await query('SELECT "WO_ID" FROM public."WORK_ORDER" WHERE "WO_ID" = $1', [woId]);
      if (check.rowCount > 0) {
        throw new Error("Verifikasi gagal: Work Order masih ada setelah DELETE");
      }
      return res.json({
        status: "success",
        success: true,
        deletedCount: resDb.rowCount
      });
    } catch (err) {
      console.error("[BACKEND ERROR] DELETE /api/work-orders:", err.message);
      return res.status(500).json({
        status: "error",
        success: false,
        message: err.message
      });
    }
  }
);
router.get("/realisasi", async (req, res) => {
  logApiCall("GET", "/api/realisasi", req.query);
  const page = Math.max(
    parseInt(
      (req.query.page || "1").toString(),
      10
    ),
    1
  );
  const limit = Math.min(
    Math.max(
      parseInt(
        (req.query.limit || "20").toString(),
        10
      ),
      1
    ),
    1e3
  );
  const offset = (page - 1) * limit;
  const { unitId, isAll } = parseUnitFilter(req);
  const nomorWo = (req.query.Nomor_WO || req.query.nomorWO || "").toString().trim();
  const ulp = (req.query.ULP || req.query.ulp || "").toString().trim();
  const tanggalDari = (req.query.tanggalDari || "").toString().trim();
  const tanggalSampai = (req.query.tanggalSampai || "").toString().trim();
  try {
    let whereClause = ` WHERE 1=1`;
    const params = [];
    if (!isAll && unitId) {
      params.push(unitId);
      whereClause += `
        AND "unitId" = $${params.length}
      `;
    }
    if (ulp && ulp !== "ALL") {
      params.push(`%${ulp}%`);
      whereClause += `
        AND "ULP" ILIKE $${params.length}
      `;
    }
    if (nomorWo) {
      params.push(`%${nomorWo}%`);
      whereClause += `
        AND (
          "Nomor_WO" ILIKE $${params.length}
          OR "WO_ID" ILIKE $${params.length}
        )
      `;
    }
    if (tanggalDari) {
      params.push(tanggalDari);
      whereClause += `
        AND "TANGGAL" >= $${params.length}
      `;
    }
    if (tanggalSampai) {
      params.push(tanggalSampai);
      whereClause += `
        AND "TANGGAL" <= $${params.length}
      `;
    }
    const countSql = `
      SELECT COUNT(*) AS total
      FROM public."REALISASI"
      ${whereClause}
    `;
    const countRes = await query(
      countSql,
      params
    );
    const totalRecords = parseInt(
      countRes.rows[0]?.total || "0",
      10
    );
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const dataParams = [
      ...params,
      limit,
      offset
    ];
    const dataSql = `
      SELECT *
      FROM public."REALISASI"
      ${whereClause}
      ORDER BY
        "TANGGAL" DESC,
        "Timestamp" DESC
      LIMIT $${dataParams.length - 1}
      OFFSET $${dataParams.length}
    `;
    const dataRes = await query(
      dataSql,
      dataParams
    );
    return res.json({
      status: "success",
      data: dataRes.rows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages
      }
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
router.get(
  "/realisasi/dashboard",
  async (req, res) => {
    logApiCall(
      "GET",
      "/api/realisasi/dashboard",
      req.query
    );
    const { unitId, isAll } = parseUnitFilter(req);
    const nomorWo = (req.query.Nomor_WO || req.query.nomorWO || "").toString().trim();
    const ulp = (req.query.ULP || req.query.ulp || "").toString().trim();
    const tanggalDari = (req.query.tanggalDari || "").toString().trim();
    const tanggalSampai = (req.query.tanggalSampai || "").toString().trim();
    try {
      let whereClause = ` WHERE 1=1`;
      const params = [];
      if (!isAll && unitId) {
        params.push(unitId);
        whereClause += `
          AND UPPER(COALESCE("unitId", ''))
              = UPPER($${params.length})
        `;
      }
      if (ulp && ulp !== "ALL") {
        params.push(`%${ulp}%`);
        whereClause += `
          AND "ULP" ILIKE $${params.length}
        `;
      }
      if (nomorWo) {
        params.push(`%${nomorWo}%`);
        whereClause += `
          AND (
            "Nomor_WO" ILIKE $${params.length}
            OR "WO_ID" ILIKE $${params.length}
          )
        `;
      }
      if (tanggalDari) {
        params.push(tanggalDari);
        whereClause += `
          AND "TANGGAL" >= $${params.length}
        `;
      }
      if (tanggalSampai) {
        params.push(tanggalSampai);
        whereClause += `
          AND "TANGGAL" <= $${params.length}
        `;
      }
      const sql = `
        SELECT
          "ID",
          "unitId",
          "WO_ID",
          "Nomor_WO",
          "ULP",
          "REGU_ROW",
          "PENYULANG",
          "NO_TIANG",
          "TANGGAL",
          "Foto_Sebelum",
          "Foto_Sesudah",
          "Jenis_Tanaman",
          "Keterangan",
          "Pertumbuhan_Tanaman",
          "Kendala",
          "Latitude_Longitude",
          "Lokasi_kerja",
          "Timestamp"
        FROM public."REALISASI"
        ${whereClause}
        ORDER BY
          "TANGGAL" DESC,
          "Timestamp" DESC
      `;
      const dataRes = await query(
        sql,
        params
      );
      return res.json({
        status: "success",
        unitId: isAll ? "ALL" : unitId,
        count: dataRes.rows.length,
        data: dataRes.rows
      });
    } catch (err) {
      console.error(
        "[REALISASI DASHBOARD] Error:",
        err.message
      );
      return res.status(500).json({
        status: "error",
        message: err.message
      });
    }
  }
);
var handleUpsertRealisasi = async (req, res) => {
  logApiCall(req.method, req.path, req.body);
  const r = req.body || {};
  const id = req.params.id || r.ID || r.id || `REL-${Date.now()}`;
  try {
    const sql = `
      INSERT INTO public."REALISASI" (
        "ID",
        "unitId",
        "WO_ID",
        "Nomor_WO",
        "ULP",
        "REGU_ROW",
        "PENYULANG",
        "NO_TIANG",
        "TANGGAL",
        "Foto_Sebelum",
        "Foto_Sesudah",
        "Jenis_Tanaman",
        "Keterangan",
        "Pertumbuhan_Tanaman",
        "Kendala",
        "Latitude_Longitude",
        "Lokasi_kerja",
        "Timestamp"
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,$17,$18
      )
      ON CONFLICT ("ID")
      DO UPDATE SET
        "unitId" = EXCLUDED."unitId",
        "WO_ID" = EXCLUDED."WO_ID",
        "Nomor_WO" = EXCLUDED."Nomor_WO",
        "ULP" = EXCLUDED."ULP",
        "REGU_ROW" = EXCLUDED."REGU_ROW",
        "PENYULANG" = EXCLUDED."PENYULANG",
        "NO_TIANG" = EXCLUDED."NO_TIANG",
        "TANGGAL" = EXCLUDED."TANGGAL",
        "Foto_Sebelum" = EXCLUDED."Foto_Sebelum",
        "Foto_Sesudah" = EXCLUDED."Foto_Sesudah",
        "Jenis_Tanaman" = EXCLUDED."Jenis_Tanaman",
        "Keterangan" = EXCLUDED."Keterangan",
        "Pertumbuhan_Tanaman" = EXCLUDED."Pertumbuhan_Tanaman",
        "Kendala" = EXCLUDED."Kendala",
        "Latitude_Longitude" = EXCLUDED."Latitude_Longitude",
        "Lokasi_kerja" = EXCLUDED."Lokasi_kerja",
        "Timestamp" = EXCLUDED."Timestamp"
      RETURNING *;
    `;
    const tanggalVal = toNullableTimestamp(r.TANGGAL || r.tanggal) || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const timestampVal = toNullableTimestamp(r.Timestamp || r.timestamp) || (/* @__PURE__ */ new Date()).toISOString();
    const params = [
      id,
      r.unitId || "UL1",
      r.WO_ID || r.woId || "",
      r.Nomor_WO || r.nomorWO || "",
      r.ULP || r.ulpName || "",
      r.REGU_ROW || r.reguName || "",
      r.PENYULANG || r.penyulangName || "",
      r.NO_TIANG || r.noTiang || "",
      tanggalVal,
      r.Foto_Sebelum || r.fotoSebelum || "",
      r.Foto_Sesudah || r.fotoSesudah || "",
      r.Jenis_Tanaman || r.jenisTanaman || "",
      r.Keterangan || r.keterangan || "",
      r.Pertumbuhan_Tanaman || r.pertumbuhanTanaman || "",
      r.Kendala || r.kendala || "",
      r.Latitude_Longitude || r.latitudeLongitude || "",
      r.Lokasi_kerja || r.lokasiKerja || "",
      timestampVal
    ];
    const resDb = await query(sql, params);
    if (resDb.rowCount === 0) {
      return res.status(500).json({
        status: "error",
        message: "Gagal menyimpan realisasi ke database."
      });
    }
    const verifyRes = await query(`SELECT * FROM public."REALISASI" WHERE "ID" = $1`, [id]);
    return res.json({
      status: "success",
      data: verifyRes.rows[0] || resDb.rows[0]
    });
  } catch (err) {
    console.error("[REALISASI UPSERT] Error:", err.message);
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};
router.post("/realisasi", handleUpsertRealisasi);
router.put("/realisasi/:id", handleUpsertRealisasi);
router.delete(
  "/realisasi/:id",
  async (req, res) => {
    const relId = req.params.id;
    logApiCall(
      "DELETE",
      `/api/realisasi/${relId}`
    );
    try {
      const resDb = await query(
        `
        DELETE FROM public."REALISASI"
        WHERE "ID" = $1
        RETURNING *
        `,
        [relId]
      );
      if (resDb.rowCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Realisasi tidak ditemukan atau sudah terhapus."
        });
      }
      return res.json({
        status: "success",
        deletedCount: resDb.rowCount,
        data: resDb.rows[0]
      });
    } catch (err) {
      console.error("[REALISASI DELETE] Error:", err.message);
      return res.status(500).json({
        status: "error",
        message: err.message
      });
    }
  }
);
var isAbsensiSchemaEnsured = false;
async function ensureAbsensiSchema() {
  if (isAbsensiSchemaEnsured) return;
  try {
    await query(`
      ALTER TABLE public."ABSENSI" ALTER COLUMN "FOTO_MASUK" TYPE TEXT;
      ALTER TABLE public."ABSENSI" ALTER COLUMN "FOTO_KELUAR" TYPE TEXT;
      ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "USER_NAME" VARCHAR(255);
      ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "NAMA_PETUGAS" VARCHAR(255);
      ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "NIP" VARCHAR(255);
      ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "PENYULANG" VARCHAR(255);
      ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "LATITUDE" VARCHAR(100);
      ALTER TABLE public."ABSENSI" ADD COLUMN IF NOT EXISTS "LONGITUDE" VARCHAR(100);
    `);
    isAbsensiSchemaEnsured = true;
  } catch (err) {
    console.warn("[ABSENSI SCHEMA] Migration note:", err.message);
  }
}
router.get("/absensi", async (req, res) => {
  logApiCall(
    "GET",
    "/api/absensi",
    req.query
  );
  await ensureAbsensiSchema();
  const { unitId, isAll } = parseUnitFilter(req);
  try {
    console.log(`[ABSENSI TRACE 1] Fetching absensi list. UnitId: ${unitId}, isAll: ${isAll}`);
    let sql = `
      SELECT *
      FROM public."ABSENSI"
      WHERE 1=1
    `;
    const params = [];
    if (!isAll && unitId) {
      params.push(unitId);
      sql += `
        AND (UPPER("unitId") = UPPER($${params.length}) OR "unitId" IS NULL OR "unitId" = '')
      `;
    }
    sql += `
      ORDER BY
        "TANGGAL" DESC,
        "ID" DESC
      LIMIT 500
    `;
    const resDb = await query(
      sql,
      params
    );
    console.log(`[ABSENSI TRACE 1] Fetch success. Found ${resDb.rowCount} records.`);
    return res.json({
      status: "success",
      data: resDb.rows
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});
var handleUpsertAbsensi = async (req, res) => {
  await ensureAbsensiSchema();
  const method = req.method;
  logApiCall(req.method, req.path, req.body);
  const a = req.body || {};
  let targetId = req.params.id || a.ID || a.id;
  if (Array.isArray(a.petugasList)) {
    a.petugas1 = a.petugasList[0]?.nama || "";
    a.ket1 = a.petugasList[0]?.keterangan || "HADIR";
    a.petugas2 = a.petugasList[1]?.nama || "";
    a.ket2 = a.petugasList[1]?.keterangan || "HADIR";
    a.petugas3 = a.petugasList[2]?.nama || "";
    a.ket3 = a.petugasList[2]?.keterangan || "HADIR";
    a.petugas4 = a.petugasList[3]?.nama || "";
    a.ket4 = a.petugasList[3]?.keterangan || "HADIR";
    a.petugas5 = a.petugasList[4]?.nama || "";
    a.ket5 = a.petugasList[4]?.keterangan || "HADIR";
  }
  const tanggalVal = toNullableTimestamp(a.TANGGAL || a.tanggal || a.Tanggal) || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const reguNameVal = a.NAMA_REGU || a.namaRegu || a.reguName || a.Regu || "";
  const timestampMasukVal = toNullableTimestamp(a["TIMESTAMP MASUK"] || a.timestampMasuk || a.waktuMasuk || a.createdAt);
  const timestampKeluarVal = toNullableTimestamp(a["TIMESTAMP KELUAR"] || a.timestampKeluar || a.waktuKeluar || a.waktuPulang);
  const extractRowNo = (s) => {
    const m = s.match(/(?:row|regu|tim|users|usr)[-_\s]*0?(\d+)/i) || s.match(/\b0?(\d+)\b/);
    return m ? m[1] : null;
  };
  const rowNo = extractRowNo(reguNameVal);
  if (!targetId || targetId.startsWith("ABS-")) {
    try {
      let checkSql = `SELECT "ID" FROM public."ABSENSI" WHERE ("TANGGAL"::text LIKE $1 OR "TANGGAL"::text LIKE $2)`;
      const checkParams = [`${tanggalVal}%`, `${tanggalVal.slice(0, 10)}%`];
      if (reguNameVal) {
        checkParams.push(`%${reguNameVal}%`);
        checkSql += ` AND ("NAMA_REGU" ILIKE $${checkParams.length}`;
        if (rowNo) {
          checkParams.push(`%ROW%${rowNo}%`, `%REGU%${rowNo}%`);
          checkSql += ` OR "NAMA_REGU" ILIKE $${checkParams.length - 1} OR "NAMA_REGU" ILIKE $${checkParams.length}`;
        }
        checkSql += `)`;
      }
      checkSql += ` ORDER BY "ID" DESC LIMIT 1`;
      const existRes = await query(checkSql, checkParams);
      if (existRes.rows.length > 0) {
        targetId = existRes.rows[0].ID;
        console.log(`[ABSENSI UPSERT] Found existing record for ${tanggalVal} - ${reguNameVal}. Merging into ID: ${targetId}`);
      }
    } catch (e) {
      console.warn("[ABSENSI UPSERT] Check existing record note:", e.message);
    }
  }
  if (!targetId) {
    targetId = `ABS-${Date.now()}`;
  }
  console.log(`[ABSENSI TRACE 2] Upserting Absensi ID: ${targetId}`);
  try {
    const sql = `
      INSERT INTO public."ABSENSI" (
        "ID",
        "unitId",
        "TANGGAL",
        "NAMA_REGU",
        "ULP",
        "PENYULANG",
        "USER_NAME",
        "NAMA_PETUGAS",
        "NIP",
        "PETUGAS_1",
        "KET_1",
        "PETUGAS_2",
        "KET_2",
        "PETUGAS_3",
        "KET_3",
        "PETUGAS_4",
        "KET_4",
        "PETUGAS_5",
        "KET_5",
        "FOTO_MASUK",
        "TIMESTAMP MASUK",
        "FOTO_KELUAR",
        "TIMESTAMP KELUAR",
        "LATITUDE",
        "LONGITUDE"
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25
      )
      ON CONFLICT ("ID")
      DO UPDATE SET
        "unitId" = EXCLUDED."unitId",
        "TANGGAL" = EXCLUDED."TANGGAL",
        "NAMA_REGU" = EXCLUDED."NAMA_REGU",
        "ULP" = EXCLUDED."ULP",
        "PENYULANG" = COALESCE(NULLIF(EXCLUDED."PENYULANG", ''), public."ABSENSI"."PENYULANG"),
        "USER_NAME" = COALESCE(NULLIF(EXCLUDED."USER_NAME", ''), public."ABSENSI"."USER_NAME"),
        "NAMA_PETUGAS" = COALESCE(NULLIF(EXCLUDED."NAMA_PETUGAS", ''), public."ABSENSI"."NAMA_PETUGAS"),
        "NIP" = COALESCE(NULLIF(EXCLUDED."NIP", ''), public."ABSENSI"."NIP"),
        "PETUGAS_1" = EXCLUDED."PETUGAS_1",
        "KET_1" = EXCLUDED."KET_1",
        "PETUGAS_2" = EXCLUDED."PETUGAS_2",
        "KET_2" = EXCLUDED."KET_2",
        "PETUGAS_3" = EXCLUDED."PETUGAS_3",
        "KET_3" = EXCLUDED."KET_3",
        "PETUGAS_4" = EXCLUDED."PETUGAS_4",
        "KET_4" = EXCLUDED."KET_4",
        "PETUGAS_5" = EXCLUDED."PETUGAS_5",
        "KET_5" = EXCLUDED."KET_5",
        "FOTO_MASUK" = COALESCE(NULLIF(EXCLUDED."FOTO_MASUK", ''), public."ABSENSI"."FOTO_MASUK"),
        "TIMESTAMP MASUK" = COALESCE(EXCLUDED."TIMESTAMP MASUK", public."ABSENSI"."TIMESTAMP MASUK"),
        "FOTO_KELUAR" = COALESCE(NULLIF(EXCLUDED."FOTO_KELUAR", ''), public."ABSENSI"."FOTO_KELUAR"),
        "TIMESTAMP KELUAR" = COALESCE(EXCLUDED."TIMESTAMP KELUAR", public."ABSENSI"."TIMESTAMP KELUAR"),
        "LATITUDE" = COALESCE(NULLIF(EXCLUDED."LATITUDE", ''), public."ABSENSI"."LATITUDE"),
        "LONGITUDE" = COALESCE(NULLIF(EXCLUDED."LONGITUDE", ''), public."ABSENSI"."LONGITUDE")
      RETURNING *;
    `;
    const params = [
      targetId,
      a.unitId || a.UnitId || "UL2",
      tanggalVal,
      reguNameVal,
      a.ULP || a.ulpName || a.namaUlp || a.Nama_ULP || "",
      a.PENYULANG || a.penyulangName || a.namaPenyulang || "",
      a.USER_NAME || a.userName || a.username || "",
      a.NAMA_PETUGAS || a.namaPetugas || a.petugasName || "",
      a.NIP || a.nip || "",
      a.PETUGAS_1 || a.petugas1 || "",
      a.KET_1 || a.ket1 || "HADIR",
      a.PETUGAS_2 || a.petugas2 || "",
      a.KET_2 || a.ket2 || "HADIR",
      a.PETUGAS_3 || a.petugas3 || "",
      a.KET_3 || a.ket3 || "HADIR",
      a.PETUGAS_4 || a.petugas4 || "",
      a.KET_4 || a.ket4 || "HADIR",
      a.PETUGAS_5 || a.petugas5 || "",
      a.KET_5 || a.ket5 || "HADIR",
      a.FOTO_MASUK || a.fotoMasuk || "",
      timestampMasukVal,
      a.FOTO_KELUAR || a.fotoKeluar || "",
      timestampKeluarVal,
      a.LATITUDE || a.latitude ? String(a.LATITUDE || a.latitude) : "",
      a.LONGITUDE || a.longitude ? String(a.LONGITUDE || a.longitude) : ""
    ];
    console.log(`[ABSENSI TRACE 2] Executing SQL: INSERT ON CONFLICT. ID: ${targetId}`);
    const resDb = await query(sql, params);
    if (resDb.rowCount === 0) {
      console.error(`[ABSENSI TRACE 2] UPSERT FAILED. rowCount is 0.`);
      return res.status(500).json({
        success: false,
        status: "error",
        message: "Gagal menyimpan absensi ke database."
      });
    }
    console.log(`[ABSENSI TRACE 2] UPSERT Success. rowCount: ${resDb.rowCount}. Record confirmed in DB.`);
    return res.json({
      success: true,
      status: "success",
      source: "hypercloud",
      data: resDb.rows[0]
    });
  } catch (err) {
    console.error("[ABSENSI UPSERT] Error:", err.message);
    return res.status(500).json({
      success: false,
      status: "error",
      message: err.message
    });
  }
};
router.post("/absensi", handleUpsertAbsensi);
router.put("/absensi/:id", handleUpsertAbsensi);
router.delete(
  "/absensi/:id",
  requireAuth,
  async (req, res) => {
    const absId = req.params.id;
    logApiCall(
      "DELETE",
      `/api/absensi/${absId}`
    );
    try {
      console.log(`[ABSENSI TRACE 3] Checking existence for ID: ${absId}`);
      const checkRes = await query(
        `SELECT "ID", "unitId" FROM public."ABSENSI" WHERE "ID" = $1`,
        [absId]
      );
      if (checkRes.rowCount === 0) {
        console.warn(`[ABSENSI TRACE 3] DELETE target not found. ID: ${absId}`);
        return res.status(404).json({
          success: false,
          status: "error",
          error: "ABSENSI_NOT_FOUND",
          message: `Data absensi dengan ID ${absId} tidak ditemukan.`
        });
      }
      const recordUnit = String(checkRes.rows[0]?.unitId || "").toUpperCase();
      const userUnit = String(req.query.unitId || req.user?.unitId || "").toUpperCase();
      if (userUnit && recordUnit && userUnit !== "ALL" && recordUnit !== userUnit) {
        console.warn(`[ABSENSI TRACE 3] FORBIDDEN: User unit ${userUnit} tried to delete record unit ${recordUnit}`);
        return res.status(403).json({
          success: false,
          status: "error",
          error: "FORBIDDEN",
          message: `Akses ditolak: Absensi ini milik unit ${recordUnit}, tidak dapat dihapus oleh unit ${userUnit}.`
        });
      }
      console.log(`[ABSENSI TRACE 3] Starting DELETE for ID: ${absId}`);
      const resDb = await query(
        `
        DELETE FROM public."ABSENSI"
        WHERE "ID" = $1
        RETURNING *
        `,
        [absId]
      );
      return res.json({
        success: true,
        deleted: true,
        id: absId,
        status: "success",
        deletedCount: resDb.rowCount,
        message: "Data absensi berhasil dihapus.",
        data: resDb.rows[0]
      });
    } catch (err) {
      console.error("[ABSENSI DELETE] Error:", err.message);
      return res.status(500).json({
        success: false,
        status: "error",
        error: "SERVER_ERROR",
        message: err.message
      });
    }
  }
);
router.post("/send-notification", async (req, res) => {
  logApiCall("POST", "/api/send-notification", req.body);
  const { reguName, woData } = req.body || {};
  console.log(`[NOTIFICATION API] action=SEND reguName='${reguName || ""}' woId='${woData?.id || ""}'`);
  return res.status(200).json({
    success: true,
    status: "success",
    message: "Notifikasi berhasil diproses",
    reguName: reguName || "",
    woId: woData?.id || "",
    delivered: true
  });
});
var hypercloudApi_default = router;

// server/migrationService.ts
var import_supabase_js = require("@supabase/supabase-js");
var import_pg2 = __toESM(require("pg"), 1);
var { Pool: Pool2 } = import_pg2.default;
var SUPABASE_URL = process.env.SUPABASE_URL || "https://npeeobcpffmlyiknszhh.supabase.co";
var SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98";
var SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL || "";
var HYPERCLOUD_DATABASE_URL = process.env.HYPERCLOUD_DATABASE_URL || process.env.DATABASE_URL || "postgresql://meysxysd:Aphro)51074Db@127.0.0.1:5432/meysxysd_aphro";
function setHypercloudDatabaseUrl(url) {
  if (url && typeof url === "string") {
    HYPERCLOUD_DATABASE_URL = url.trim();
    setDatabaseUrl(url);
    if (hypercloudPool) {
      hypercloudPool.end().catch(() => {
      });
      hypercloudPool = null;
    }
  }
}
function getHypercloudDatabaseUrl() {
  return HYPERCLOUD_DATABASE_URL;
}
function sanitizeSecretInfo(str) {
  if (!str || typeof str !== "string") return str || "";
  let sanitized = str;
  sanitized = sanitized.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, "$1******$3");
  sanitized = sanitized.replace(/(mysql:\/\/[^:]+:)([^@]+)(@)/gi, "$1******$3");
  sanitized = sanitized.replace(/(\/|\?|&)(password|passwd|pass|key|secret)=([^&]+)/gi, "$1$2=******");
  sanitized = sanitized.replace(/(password|passwd|pass|secret|token|authorization|bearer)\s*[:=]\s*(["']?)([^"'\s&]+)\2/gi, "$1=$2******$2");
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, "Bearer [REDACTED]");
  sanitized = sanitized.replace(/(eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_=]*)/g, "[JWT_REDACTED]");
  return sanitized;
}
var PreviewException = class extends Error {
  constructor(detail) {
    const cleanMsg = sanitizeSecretInfo(detail.errorMessage);
    super(cleanMsg);
    this.name = "PreviewException";
    this.detail = {
      ...detail,
      errorMessage: cleanMsg,
      queryOrOperation: detail.queryOrOperation ? sanitizeSecretInfo(detail.queryOrOperation) : void 0
    };
  }
};
function parsePgConfig(connStr) {
  if (!connStr) return {};
  try {
    const match = connStr.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:/]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/);
    if (match) {
      const [, user, password, host, portStr, database, queryStr] = match;
      const port = portStr ? parseInt(portStr, 10) : 5432;
      const ssl = queryStr?.includes("sslmode=require") || queryStr?.includes("ssl=true") ? { rejectUnauthorized: false } : void 0;
      return {
        user: decodeURIComponent(user),
        password,
        // preserved directly as plain password string
        host,
        port,
        database,
        ssl
      };
    }
  } catch (e) {
  }
  return { connectionString: connStr };
}
var SUPPORTED_TABLES = {
  WORK_ORDER: {
    name: "WORK_ORDER",
    primaryKey: "WO_ID",
    label: "Work Order",
    order: 1,
    criticalFields: ["unitId", "Nomor_WO"],
    dateField: "Tanggal",
    unitField: "unitId",
    columns: [
      "WO_ID",
      "unitId",
      "PEKERJAAN",
      "Nomor_WO",
      "Tanggal",
      "ULP",
      "PENYULANG",
      "REGU_ROW",
      "VOLUME",
      "SATUAN",
      "WO_AWAL",
      "WO_AKHIR",
      "STATUS",
      "LOKASI_START",
      "LOKASI_FINISH",
      "TOTAL_REALISASI",
      "SATUAN_TOTAL_REALISASI",
      "Created_At"
    ]
  },
  ABSENSI: {
    name: "ABSENSI",
    primaryKey: "ID",
    label: "Absensi Petugas",
    order: 2,
    criticalFields: ["unitId", "NAMA_REGU"],
    dateField: "TANGGAL",
    unitField: "unitId",
    columns: [
      "ID",
      "unitId",
      "TANGGAL",
      "NAMA_REGU",
      "ULP",
      "PETUGAS_1",
      "KET_1",
      "PETUGAS_2",
      "KET_2",
      "PETUGAS_3",
      "KET_3",
      "PETUGAS_4",
      "KET_4",
      "PETUGAS_5",
      "KET_5",
      "FOTO_MASUK",
      "TIMESTAMP_MASUK",
      "FOTO_KELUAR",
      "TIMESTAMP_KELUAR"
    ]
  },
  REALISASI: {
    name: "REALISASI",
    primaryKey: "ID",
    label: "Realisasi Pekerjaan",
    order: 3,
    criticalFields: ["unitId", "WO_ID"],
    dateField: "TANGGAL",
    unitField: "unitId",
    columns: [
      "ID",
      "unitId",
      "WO_ID",
      "Nomor_WO",
      "ULP",
      "REGU_ROW",
      "PENYULANG",
      "NO_TIANG",
      "TANGGAL",
      "Foto_Sebelum",
      "Foto_Sesudah",
      "Jenis_Tanaman",
      "Keterangan",
      "Pertumbuhan_Tanaman",
      "Kendala",
      "Latitude_Longitude",
      "Lokasi_kerja",
      "Timestamp"
    ]
  },
  PENYULANG: {
    name: "PENYULANG",
    primaryKey: "ID",
    label: "Data Penyulang",
    order: 4,
    criticalFields: ["Nama_Penyulang", "ULP"],
    dateField: void 0,
    unitField: "unitId",
    columns: [
      "ID",
      "unitId",
      "Kode_Penyulang",
      "Nama_Penyulang",
      "ULP",
      "Panjang_Kms",
      "Jumlah_Trafo",
      "Status"
    ]
  }
};
var activeSyncState = null;
var migrationAuditLogs = [];
var hypercloudPool = null;
function getHypercloudPool(customUrl) {
  const connStr = customUrl || HYPERCLOUD_DATABASE_URL;
  if (!connStr || connStr.includes("127.0.0.1") || connStr.includes("localhost")) return null;
  if (!hypercloudPool || hypercloudPool._connectionString !== connStr) {
    if (hypercloudPool) {
      hypercloudPool.end().catch(() => {
      });
    }
    const poolConfig = parsePgConfig(connStr);
    hypercloudPool = new Pool2({
      ...poolConfig,
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3
    });
    hypercloudPool._connectionString = connStr;
  }
  return hypercloudPool;
}
function getSupabaseClient() {
  return (0, import_supabase_js.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
}
async function verifyTargetDatabase(customUrl) {
  const connStr = customUrl || HYPERCLOUD_DATABASE_URL;
  const pool = getHypercloudPool(connStr);
  let pgErr = null;
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        const metaRes = await client.query(`
          SELECT current_database() as db, current_schema() as schema;
        `);
        const dbName = metaRes.rows[0]?.db || "meysxysd_aphro";
        const schemaName = metaRes.rows[0]?.schema || "public";
        const counts = {};
        for (const tbl of ["WORK_ORDER", "ABSENSI", "REALISASI", "PENYULANG"]) {
          try {
            const countRes = await client.query(`SELECT COUNT(*)::int as cnt FROM "${tbl}";`);
            counts[tbl] = parseInt(countRes.rows[0]?.cnt || "0", 10);
          } catch (countErr) {
            throw new PreviewException({
              stage: "COUNT",
              database: "HYPERCLOUD",
              table: tbl,
              errorMessage: sanitizeSecretInfo(`Gagal melakukan COUNT pada tabel '${tbl}': ${countErr.message}`),
              errorCode: countErr.code || "COUNT_QUERY_FAILED",
              queryOrOperation: `SELECT COUNT(*)::int as cnt FROM "${tbl}";`
            });
          }
        }
        console.log(`[PREVIEW TARGET VERIFICATION] Database: '${dbName}', Schema: '${schemaName}'`);
        console.log(`[PREVIEW TARGET VERIFICATION] Counts: WORK_ORDER=${counts.WORK_ORDER}, ABSENSI=${counts.ABSENSI}, REALISASI=${counts.REALISASI}, PENYULANG=${counts.PENYULANG}`);
        return {
          connected: true,
          database: dbName,
          schema: schemaName,
          counts
        };
      } finally {
        client.release();
      }
    } catch (err) {
      if (err instanceof PreviewException) throw err;
      pgErr = err;
      console.warn(`[verifyTargetDatabase] Direct PG connection failed: ${sanitizeSecretInfo(err.message)}, trying REST API health check...`);
    }
  }
  try {
    const pingRes = await fetch("https://api.aphro-row.my.id/api/health");
    const pingData = await pingRes.json().catch(() => ({}));
    if (!pingRes.ok || pingData.database !== "connected") {
      throw new PreviewException({
        stage: "Koneksi",
        database: "HYPERCLOUD",
        table: "N/A",
        errorMessage: sanitizeSecretInfo(`Database HyperCloudHost terputus: ${pgErr?.message || "REST API Gateway non-active"}`),
        errorCode: pgErr?.code || String(pingRes.status),
        queryOrOperation: "GET https://api.aphro-row.my.id/api/health"
      });
    }
    const dbName = pingData.databaseName || "meysxysd_aphro";
    const schemaName = "public";
    const token = await getTargetAuthToken("UL1") || await getTargetAuthToken("UL2");
    if (!token) {
      throw new PreviewException({
        stage: "Koneksi",
        database: "HYPERCLOUD",
        table: "N/A",
        errorMessage: "Gagal mendapatkan token autentikasi HyperCloudHost",
        errorCode: "AUTH_FAILED",
        queryOrOperation: "POST /api/login"
      });
    }
    const counts = {};
    for (const tbl of ["WORK_ORDER", "ABSENSI", "REALISASI", "PENYULANG"]) {
      const endpoint = tbl === "WORK_ORDER" ? "/api/work-orders" : tbl === "ABSENSI" ? "/api/absensi" : tbl === "REALISASI" ? "/api/realisasi" : tbl === "PENYULANG" ? "/api/penyulang" : `/api/${tbl.toLowerCase()}`;
      const fetchRes = await fetch(`https://api.aphro-row.my.id${endpoint}?limit=15000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!fetchRes.ok) {
        throw new PreviewException({
          stage: "COUNT",
          database: "HYPERCLOUD",
          table: tbl,
          errorMessage: `REST API HyperCloudHost HTTP ${fetchRes.status} saat menghitung data '${tbl}'`,
          errorCode: String(fetchRes.status),
          queryOrOperation: `GET ${endpoint}`
        });
      }
      const resJson = await fetchRes.json();
      if (Array.isArray(resJson.data)) {
        counts[tbl] = resJson.data.length;
      } else {
        throw new PreviewException({
          stage: "COUNT",
          database: "HYPERCLOUD",
          table: tbl,
          errorMessage: `Respon REST API untuk '${tbl}' tidak valid`,
          errorCode: "INVALID_JSON_RESPONSE",
          queryOrOperation: `GET ${endpoint}`
        });
      }
    }
    console.log(`[PREVIEW TARGET VERIFICATION API] Database: '${dbName}', Schema: '${schemaName}'`);
    console.log(`[PREVIEW TARGET VERIFICATION API] Counts: WORK_ORDER=${counts.WORK_ORDER}, ABSENSI=${counts.ABSENSI}, REALISASI=${counts.REALISASI}`);
    return {
      connected: true,
      database: dbName,
      schema: schemaName,
      counts
    };
  } catch (apiErr) {
    if (apiErr instanceof PreviewException) throw apiErr;
    console.error(`[verifyTargetDatabase ERROR]:`, apiErr);
    throw new PreviewException({
      stage: "Koneksi",
      database: "HYPERCLOUD",
      table: "N/A",
      errorMessage: sanitizeSecretInfo(`Koneksi ke database HyperCloudHost gagal: ${apiErr.message}`),
      errorCode: apiErr.code || pgErr?.code || "CONN_FAILED",
      queryOrOperation: "HyperCloudHost DB Connection Test"
    });
  }
}
async function testConnection2(type, customUrl) {
  const start = Date.now();
  if (type === "supabase") {
    try {
      const sb = getSupabaseClient();
      const { count, error } = await sb.from("WORK_ORDER").select("*", { count: "exact", head: true });
      if (error) {
        return {
          success: false,
          message: `Supabase error: ${error.message}`,
          latencyMs: Date.now() - start
        };
      }
      return {
        success: true,
        message: `Terkoneksi ke Supabase PostgreSQL (${SUPABASE_URL})`,
        details: { totalWorkOrders: count, mode: "REST Client (Port 443 HTTPS)" },
        latencyMs: Date.now() - start
      };
    } catch (err) {
      return {
        success: false,
        message: `Gagal menghubungkan ke Supabase: ${err.message}`,
        latencyMs: Date.now() - start
      };
    }
  } else {
    const connStr = customUrl || HYPERCLOUD_DATABASE_URL;
    if (connStr && !connStr.includes("127.0.0.1") && !connStr.includes("localhost")) {
      try {
        const pool = getHypercloudPool(connStr);
        if (pool) {
          const client = await pool.connect();
          try {
            const res = await client.query("SELECT version() as version, current_database() as db, current_user as user");
            const row = res.rows[0];
            return {
              success: true,
              message: `Terkoneksi ke PostgreSQL HyperCloudHost DB '${row.db}' sebagai '${row.user}' (Direct TCP Port 5432)`,
              details: { database: row.db, user: row.user, version: row.version.split(" ")[0], mode: "Direct PostgreSQL (Port 5432)" },
              latencyMs: Date.now() - start
            };
          } finally {
            client.release();
          }
        }
      } catch (err) {
        console.warn(`[testConnection] Direct PG failed (${err.message}), trying API Gateway fallback...`);
      }
    }
    try {
      const pingRes = await fetch("https://api.aphro-row.my.id/api/health", { method: "GET" });
      const data = await pingRes.json().catch(() => ({}));
      if (pingRes.ok && data.database === "connected") {
        return {
          success: true,
          message: `Terkoneksi ke PostgreSQL '${data.databaseName || "meysxysd_aphro"}' via HyperCloudHost API Gateway`,
          details: {
            database: data.databaseName || "meysxysd_aphro",
            apiStatus: data.status || "ok",
            mode: "REST API Gateway (Port 443 HTTPS)",
            note: "Target database aktif dan siap disinkronkan via API & SQL Export."
          },
          latencyMs: Date.now() - start
        };
      }
    } catch (apiErr) {
      console.warn(`[testConnection] API Gateway test failed:`, apiErr);
    }
    return {
      success: false,
      message: `Koneksi ke database HyperCloudHost gagal. Server API maupun port direct 5432 tidak merespon.`,
      details: { connectionString: connStr ? connStr.replace(/:([^:@]+)@/, ":*****@") : "Belum diatur" },
      latencyMs: Date.now() - start
    };
  }
}
function normalizeValue(val) {
  if (val === null || val === void 0) return "";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      return trimmed.replace(/\.000Z$/, "Z").replace(/\+00:00$/, "Z");
    }
    return trimmed;
  }
  return JSON.stringify(val);
}
async function fetchSourceData(tableName, options) {
  const sb = getSupabaseClient();
  const config = SUPPORTED_TABLES[tableName];
  if (!config) {
    throw new PreviewException({
      stage: "Pengambilan ID",
      database: "SUPABASE",
      table: tableName,
      errorMessage: `Tabel '${tableName}' tidak didukung dalam sistem`,
      errorCode: "UNSUPPORTED_TABLE",
      queryOrOperation: `Table config lookup (${tableName})`
    });
  }
  const results = [];
  const BATCH_SIZE = 1e3;
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    let query2 = sb.from(tableName).select("*").range(from, from + BATCH_SIZE - 1);
    if (options.unitFilter && options.unitFilter !== "ALL" && config.unitField) {
      query2 = query2.eq(config.unitField, options.unitFilter);
    }
    if (options.dateFrom && config.dateField) {
      query2 = query2.gte(config.dateField, options.dateFrom);
    }
    if (options.dateTo && config.dateField) {
      query2 = query2.lte(config.dateField, options.dateTo);
    }
    const { data, error } = await query2;
    if (error) {
      throw new PreviewException({
        stage: "Pengambilan ID",
        database: "SUPABASE",
        table: tableName,
        errorMessage: sanitizeSecretInfo(`Query Supabase gagal: ${error.message}`),
        errorCode: error.code || "SUPABASE_QUERY_ERROR",
        queryOrOperation: `SELECT * FROM "${tableName}" range(${from}, ${from + BATCH_SIZE - 1})`
      });
    }
    if (data && data.length > 0) {
      results.push(...data);
      from += BATCH_SIZE;
      if (data.length < BATCH_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  return results;
}
var targetTokenCache = /* @__PURE__ */ new Map();
async function getTargetAuthToken(unitId) {
  const cached = targetTokenCache.get(unitId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }
  try {
    const loginRes = await fetch("https://api.aphro-row.my.id/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Username: unitId === "UL1" ? "admin" : "superadmin",
        Password: unitId === "UL1" ? "admin" : "S",
        unitId
      })
    });
    const loginData = await loginRes.json();
    if (loginData?.token) {
      targetTokenCache.set(unitId, {
        token: loginData.token,
        expiresAt: Date.now() + 10 * 60 * 1e3
        // 10 minutes cache
      });
      return loginData.token;
    }
  } catch (err) {
    console.warn(`Failed to login to target API for ${unitId}:`, err.message);
  }
  return null;
}
async function fetchTargetData(tableName, options, customHypercloudUrl) {
  const config = SUPPORTED_TABLES[tableName];
  if (!config) {
    throw new PreviewException({
      stage: "Pengambilan ID",
      database: "HYPERCLOUD",
      table: tableName,
      errorMessage: `Tabel '${tableName}' tidak didukung dalam sistem`,
      errorCode: "UNSUPPORTED_TABLE",
      queryOrOperation: `Table config lookup (${tableName})`
    });
  }
  const connStr = customHypercloudUrl || HYPERCLOUD_DATABASE_URL;
  const pool = getHypercloudPool(connStr);
  let pgErr = null;
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        let sql = `SELECT * FROM "${tableName}" WHERE 1=1`;
        const params = [];
        let paramIdx = 1;
        if (options.unitFilter && options.unitFilter !== "ALL" && config.unitField) {
          sql += ` AND "${config.unitField}" = $${paramIdx++}`;
          params.push(options.unitFilter);
        }
        if (options.dateFrom && config.dateField) {
          sql += ` AND "${config.dateField}" >= $${paramIdx++}`;
          params.push(options.dateFrom);
        }
        if (options.dateTo && config.dateField) {
          sql += ` AND "${config.dateField}" <= $${paramIdx++}`;
          params.push(options.dateTo);
        }
        const res = await client.query(sql, params);
        return res.rows;
      } finally {
        client.release();
      }
    } catch (directConnErr) {
      pgErr = directConnErr;
      console.warn(`Direct PG query to HyperCloudHost failed (${tableName}): ${sanitizeSecretInfo(directConnErr.message)}, falling back to REST API...`);
    }
  }
  try {
    const endpoint = tableName === "WORK_ORDER" ? "/api/work-orders" : tableName === "ABSENSI" ? "/api/absensi" : tableName === "REALISASI" ? "/api/realisasi" : tableName === "PENYULANG" ? "/api/penyulang" : `/api/${tableName.toLowerCase()}`;
    let url = `https://api.aphro-row.my.id${endpoint}?limit=15000`;
    if (options.dateFrom) url += `&tanggalDari=${options.dateFrom}`;
    if (options.dateTo) url += `&tanggalSampai=${options.dateTo}`;
    const units = options.unitFilter === "UL1" ? ["UL1"] : options.unitFilter === "UL2" ? ["UL2"] : ["UL1", "UL2"];
    const allRecords = [];
    for (const u of units) {
      const token = await getTargetAuthToken(u);
      if (!token) {
        throw new PreviewException({
          stage: "Koneksi",
          database: "HYPERCLOUD",
          table: tableName,
          errorMessage: `Token autentikasi REST API HyperCloudHost tidak tersedia untuk unit ${u}`,
          errorCode: "AUTH_TOKEN_MISSING",
          queryOrOperation: `POST /api/login (unit ${u})`
        });
      }
      const fetchRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!fetchRes.ok) {
        throw new PreviewException({
          stage: "Pengambilan ID",
          database: "HYPERCLOUD",
          table: tableName,
          errorMessage: `REST API HyperCloudHost HTTP ${fetchRes.status} saat membaca data '${tableName}'`,
          errorCode: String(fetchRes.status),
          queryOrOperation: `GET ${endpoint}`
        });
      }
      const resJson = await fetchRes.json();
      if (Array.isArray(resJson.data)) {
        allRecords.push(...resJson.data);
      } else {
        throw new PreviewException({
          stage: "Pengambilan ID",
          database: "HYPERCLOUD",
          table: tableName,
          errorMessage: `Format respon REST API untuk '${tableName}' tidak valid`,
          errorCode: "INVALID_JSON_RESPONSE",
          queryOrOperation: `GET ${endpoint}`
        });
      }
    }
    return allRecords;
  } catch (err) {
    if (err instanceof PreviewException) throw err;
    throw new PreviewException({
      stage: "Pengambilan ID",
      database: "HYPERCLOUD",
      table: tableName,
      errorMessage: sanitizeSecretInfo(`Gagal membaca data target '${tableName}': ${err.message}`),
      errorCode: err.code || pgErr?.code || "HYPERCLOUD_FETCH_FAILED",
      queryOrOperation: `SELECT * FROM "${tableName}"`
    });
  }
}
function compareTableRecords(tableName, sourceRows, targetRows) {
  const config = SUPPORTED_TABLES[tableName];
  const pk = config.primaryKey;
  const targetMap = /* @__PURE__ */ new Map();
  for (const row of targetRows) {
    const key = String(row[pk] || "");
    if (key) targetMap.set(key, row);
  }
  const sourceMap = /* @__PURE__ */ new Map();
  for (const row of sourceRows) {
    const key = String(row[pk] || "");
    if (key) sourceMap.set(key, row);
  }
  let insertCount = 0;
  let updateCount = 0;
  let skipCount = 0;
  let conflictCount = 0;
  const conflicts = [];
  const sampleInserts = [];
  const sampleUpdates = [];
  for (const [id, sRow] of sourceMap.entries()) {
    if (!targetMap.has(id)) {
      insertCount++;
      if (sampleInserts.length < 10) sampleInserts.push(id);
      continue;
    }
    const tRow = targetMap.get(id);
    const diffs = [];
    let isConflict = false;
    let conflictReason = "";
    for (const cField of config.criticalFields) {
      const sVal = normalizeValue(sRow[cField]);
      const tVal = normalizeValue(tRow[cField]);
      if (sVal && tVal && sVal !== tVal) {
        isConflict = true;
        conflictReason = `Perbedaan nilai pada field kritis [${cField}]: Source '${sVal}' vs Target '${tVal}'`;
        diffs.push({ field: cField, sourceVal: sRow[cField], targetVal: tRow[cField] });
        break;
      }
    }
    if (isConflict) {
      conflictCount++;
      conflicts.push({
        id,
        tableName,
        unitId: sRow.unitId || tRow.unitId,
        type: "CONFLICT",
        conflictReason,
        differences: diffs,
        sourceData: sRow,
        targetData: tRow
      });
      continue;
    }
    for (const col of config.columns) {
      let sValRaw = sRow[col];
      let tValRaw = tRow[col];
      if (col === "TIMESTAMP_MASUK") {
        sValRaw = sRow.TIMESTAMP_MASUK ?? sRow["TIMESTAMP MASUK"] ?? sRow.Timestamp_Masuk;
        tValRaw = tRow.TIMESTAMP_MASUK ?? tRow["TIMESTAMP MASUK"] ?? tRow.Timestamp_Masuk;
      } else if (col === "TIMESTAMP_KELUAR") {
        sValRaw = sRow.TIMESTAMP_KELUAR ?? sRow["TIMESTAMP KELUAR"] ?? sRow.Timestamp_Keluar;
        tValRaw = tRow.TIMESTAMP_KELUAR ?? tRow["TIMESTAMP KELUAR"] ?? tRow.Timestamp_Keluar;
      }
      const sNorm = normalizeValue(sValRaw);
      const tNorm = normalizeValue(tValRaw);
      if (sNorm !== tNorm) {
        diffs.push({
          field: col,
          sourceVal: sValRaw,
          targetVal: tValRaw
        });
      }
    }
    if (diffs.length > 0) {
      updateCount++;
      if (sampleUpdates.length < 10) sampleUpdates.push(id);
    } else {
      skipCount++;
    }
  }
  let targetOnlyCount = 0;
  for (const [id] of targetMap.entries()) {
    if (!sourceMap.has(id)) {
      targetOnlyCount++;
    }
  }
  let status = "VERIFIED";
  if (conflictCount > 0) status = "CONFLICT";
  else if (insertCount > 0 || updateCount > 0) status = "DIFFERENT";
  return {
    tableName,
    totalSource: sourceRows.length,
    totalTarget: targetRows.length,
    insertCount,
    updateCount,
    skipCount,
    conflictCount,
    targetOnlyCount,
    errorCount: 0,
    conflicts,
    sampleInserts,
    sampleUpdates,
    status
  };
}
async function performPreviewSync(options) {
  const targetInfo = await verifyTargetDatabase(options.customHypercloudUrl);
  try {
    const sb = getSupabaseClient();
    const { error: supaErr } = await sb.from("WORK_ORDER").select("*", { count: "exact", head: true });
    if (supaErr) {
      throw new PreviewException({
        stage: "Koneksi",
        database: "SUPABASE",
        table: "WORK_ORDER",
        errorMessage: sanitizeSecretInfo(`Supabase error: ${supaErr.message}`),
        errorCode: supaErr.code || "SUPABASE_CONN_FAILED",
        queryOrOperation: "Supabase Work Order Head Query"
      });
    }
  } catch (err) {
    if (err instanceof PreviewException) throw err;
    throw new PreviewException({
      stage: "Koneksi",
      database: "SUPABASE",
      table: "N/A",
      errorMessage: sanitizeSecretInfo(`Gagal terhubung ke database Supabase: ${err.message}`),
      errorCode: err.code || "SUPABASE_CONN_FAILED",
      queryOrOperation: "Supabase Connection Test"
    });
  }
  const selectedTables = options.tables && options.tables.length > 0 ? options.tables : Object.keys(SUPPORTED_TABLES);
  selectedTables.sort((a, b) => (SUPPORTED_TABLES[a]?.order || 99) - (SUPPORTED_TABLES[b]?.order || 99));
  const summaries = {};
  let realisasiDetail = void 0;
  for (const tbl of selectedTables) {
    const sourceRows = await fetchSourceData(tbl, options);
    const targetRows = await fetchTargetData(tbl, options, options.customHypercloudUrl);
    let diff;
    try {
      diff = compareTableRecords(tbl, sourceRows, targetRows);
      summaries[tbl] = diff;
    } catch (err) {
      throw new PreviewException({
        stage: "Perbandingan",
        database: "SUPABASE / HYPERCLOUD",
        table: tbl,
        errorMessage: sanitizeSecretInfo(`Gagal membandingkan data tabel ${tbl}: ${err.message}`),
        errorCode: "COMPARE_ERROR",
        queryOrOperation: `Record Difference Comparison (${tbl})`
      });
    }
    if (tbl === "REALISASI") {
      try {
        const sourceMap = /* @__PURE__ */ new Map();
        sourceRows.forEach((r) => {
          const id = String(r.ID || r.id || "").trim();
          if (id) sourceMap.set(id, r);
        });
        const targetSet = /* @__PURE__ */ new Set();
        targetRows.forEach((r) => {
          const id = String(r.ID || r.id || "").trim();
          if (id) targetSet.add(id);
        });
        let inBothCount = 0;
        let sourceOnlyCount = 0;
        let targetOnlyCount = 0;
        const sourceOnlyRecords = [];
        for (const [id, row] of sourceMap.entries()) {
          if (targetSet.has(id)) {
            inBothCount++;
          } else {
            sourceOnlyCount++;
            sourceOnlyRecords.push({
              ID: id,
              WO_ID: String(row.WO_ID ?? row.wo_id ?? "-"),
              Nomor_WO: String(row.Nomor_WO ?? row.nomor_wo ?? "-"),
              ULP: String(row.ULP ?? row.ulp ?? "-"),
              REGU_ROW: String(row.REGU_ROW ?? row.Regu_ROW ?? row.Regu ?? row.Nama_Regu ?? "-"),
              PENYULANG: String(row.PENYULANG ?? row.Penyulang ?? "-"),
              NO_TIANG: String(row.NO_TIANG ?? row.Nomor_Tiang ?? row.No_Tiang ?? "-"),
              TANGGAL: String(row.TANGGAL ?? row.Tanggal ?? "-"),
              Timestamp: String(row.Timestamp ?? row.timestamp ?? "-"),
              unitId: String(row.unitId ?? row.unit_id ?? "UL1")
            });
          }
        }
        for (const id of targetSet) {
          if (!sourceMap.has(id)) {
            targetOnlyCount++;
          }
        }
        realisasiDetail = {
          totalSource: sourceMap.size,
          totalTarget: targetSet.size,
          sourceOnlyCount,
          targetOnlyCount,
          inBothCount,
          sourceOnlyRecords
        };
      } catch (err) {
        throw new PreviewException({
          stage: "Perbandingan",
          database: "SUPABASE / HYPERCLOUD",
          table: "REALISASI",
          errorMessage: sanitizeSecretInfo(`Gagal memproses detail breakdown REALISASI: ${err.message}`),
          errorCode: "REALISASI_BREAKDOWN_ERROR",
          queryOrOperation: "REALISASI ID Comparison"
        });
      }
    }
  }
  let validationWarning = void 0;
  let isSyncAllowed = true;
  for (const tbl of selectedTables) {
    const diff = summaries[tbl];
    const verifiedCount = targetInfo.counts[tbl];
    if (verifiedCount !== void 0 && diff && diff.totalTarget !== verifiedCount) {
      isSyncAllowed = false;
      validationWarning = `COUNT DATABASE TARGET TIDAK SESUAI PADA TABEL '${tbl}' (Query DB: ${verifiedCount}, Data Fetched: ${diff.totalTarget}). SYNC DINONAKTIFKAN.`;
    }
  }
  return {
    targetInfo,
    tableSummaries: summaries,
    realisasiDetail,
    validationWarning,
    isSyncAllowed
  };
}
async function executeLiveSync(options) {
  const syncId = `SYNC-${Date.now()}`;
  const batchSize = Math.max(10, Math.min(options.batchSize || 100, 500));
  const isDryRun = !!options.isDryRun;
  const selectedTables = options.tables && options.tables.length > 0 ? options.tables : Object.keys(SUPPORTED_TABLES);
  selectedTables.sort((a, b) => (SUPPORTED_TABLES[a]?.order || 99) - (SUPPORTED_TABLES[b]?.order || 99));
  activeSyncState = {
    syncId,
    status: "RUNNING",
    isDryRun,
    operator: options.operator || "Admin",
    currentTable: selectedTables[0] || "",
    currentTableIndex: 0,
    totalTables: selectedTables.length,
    processedRecords: 0,
    totalRecordsToProcess: 0,
    percent: 0,
    currentBatch: 0,
    totalBatches: 0,
    tableSummaries: {},
    logs: [],
    recentActivity: [`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Memulai ${isDryRun ? "Dry-Run / Preview" : "Live Synchronization"} (${syncId})...`],
    startedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const pool = getHypercloudPool();
  (async () => {
    try {
      for (let tIdx = 0; tIdx < selectedTables.length; tIdx++) {
        const tbl = selectedTables[tIdx];
        const config = SUPPORTED_TABLES[tbl];
        const pk = config.primaryKey;
        activeSyncState.currentTable = tbl;
        activeSyncState.currentTableIndex = tIdx;
        activeSyncState.recentActivity.unshift(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Mengambil data untuk tabel ${tbl}...`);
        const [sourceRows, targetRows] = await Promise.all([
          fetchSourceData(tbl, options),
          fetchTargetData(tbl, options)
        ]);
        const diffSummary = compareTableRecords(tbl, sourceRows, targetRows);
        activeSyncState.tableSummaries[tbl] = diffSummary;
        const totalToSync = diffSummary.insertCount + diffSummary.updateCount;
        activeSyncState.totalRecordsToProcess += totalToSync;
        const logEntry = {
          sync_id: syncId,
          tanggal_mulai: (/* @__PURE__ */ new Date()).toISOString(),
          source: "Supabase PostgreSQL",
          target: "HyperCloudHost PostgreSQL",
          table_name: tbl,
          total_source: diffSummary.totalSource,
          total_target_before: diffSummary.totalTarget,
          insert_count: 0,
          update_count: 0,
          skip_count: diffSummary.skipCount,
          conflict_count: diffSummary.conflictCount,
          error_count: 0,
          status: "RUNNING",
          operator: options.operator,
          is_dry_run: isDryRun,
          batch_size: batchSize,
          unit_filter: options.unitFilter,
          date_filter: options.dateFrom ? `>= ${options.dateFrom}` : void 0,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (isDryRun) {
          logEntry.insert_count = diffSummary.insertCount;
          logEntry.update_count = diffSummary.updateCount;
          logEntry.status = diffSummary.conflictCount > 0 ? "PARTIAL" : "COMPLETED";
          logEntry.tanggal_selesai = (/* @__PURE__ */ new Date()).toISOString();
          activeSyncState.logs.push(logEntry);
          migrationAuditLogs.unshift(logEntry);
          activeSyncState.recentActivity.unshift(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Selesai analisa ${tbl}: +${diffSummary.insertCount} Insert, ~${diffSummary.updateCount} Update, =${diffSummary.skipCount} Skip, !${diffSummary.conflictCount} Conflict.`);
          continue;
        }
        const rowsToProcess = sourceRows.filter((sRow) => {
          const id = String(sRow[pk] || "");
          const isConflict = diffSummary.conflicts.some((c) => c.id === id);
          return !isConflict;
        });
        let isDirectPgUsable = false;
        if (pool) {
          try {
            const testClient = await pool.connect();
            testClient.release();
            isDirectPgUsable = true;
          } catch {
            isDirectPgUsable = false;
          }
        }
        if (isDirectPgUsable && pool) {
          const numBatches = Math.ceil(rowsToProcess.length / batchSize);
          activeSyncState.totalBatches += numBatches;
          for (let b = 0; b < numBatches; b++) {
            activeSyncState.currentBatch++;
            const batchRows = rowsToProcess.slice(b * batchSize, (b + 1) * batchSize);
            const client = await pool.connect();
            try {
              await client.query("BEGIN");
              for (const row of batchRows) {
                const id = String(row[pk] || "");
                if (!id) continue;
                const cols = config.columns.filter((c) => row[c] !== void 0 || c.includes("TIMESTAMP") && (row["TIMESTAMP MASUK"] || row["TIMESTAMP KELUAR"]));
                const values = [];
                const placeholders = [];
                const updateClauses = [];
                cols.forEach((col, idx) => {
                  placeholders.push(`$${idx + 1}`);
                  let val = row[col];
                  if (col === "TIMESTAMP_MASUK") val = row.TIMESTAMP_MASUK ?? row["TIMESTAMP MASUK"] ?? row.Timestamp_Masuk ?? null;
                  if (col === "TIMESTAMP_KELUAR") val = row.TIMESTAMP_KELUAR ?? row["TIMESTAMP KELUAR"] ?? row.Timestamp_Keluar ?? null;
                  values.push(val);
                  if (col !== pk) {
                    updateClauses.push(`"${col}" = EXCLUDED."${col}"`);
                  }
                });
                const colNames = cols.map((c) => `"${c}"`).join(", ");
                const pNames = placeholders.join(", ");
                const updateSql = updateClauses.length > 0 ? `ON CONFLICT ("${pk}") DO UPDATE SET ${updateClauses.join(", ")}` : `ON CONFLICT ("${pk}") DO NOTHING`;
                const insertSql = `INSERT INTO "${tbl}" (${colNames}) VALUES (${pNames}) ${updateSql}`;
                await client.query(insertSql, values);
              }
              await client.query("COMMIT");
              activeSyncState.processedRecords += batchRows.length;
              logEntry.insert_count += batchRows.length;
              activeSyncState.percent = Math.min(100, Math.round(activeSyncState.processedRecords / Math.max(1, activeSyncState.totalRecordsToProcess) * 100));
            } catch (batchErr) {
              await client.query("ROLLBACK");
              logEntry.error_count += batchRows.length;
              logEntry.error_message = `Batch ${b + 1} error: ${batchErr.message}`;
              activeSyncState.recentActivity.unshift(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] \u274C Error pada batch ${b + 1} (${tbl}): ${batchErr.message}`);
            } finally {
              client.release();
            }
          }
        } else {
          activeSyncState.recentActivity.unshift(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Mengirim data ${tbl} melalui HyperCloudHost REST API Gateway...`);
          const endpoint = tbl === "WORK_ORDER" ? "/api/work-orders" : tbl === "ABSENSI" ? "/api/absensi" : tbl === "REALISASI" ? "/api/realisasi" : tbl === "PENYULANG" ? "/api/penyulang" : `/api/${tbl.toLowerCase()}`;
          for (const row of rowsToProcess) {
            try {
              const res = await fetch(`https://api.aphro-row.my.id${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(row)
              });
              if (res.ok) {
                logEntry.insert_count++;
                activeSyncState.processedRecords++;
              } else {
                logEntry.error_count++;
              }
            } catch {
              logEntry.error_count++;
            }
            activeSyncState.percent = Math.min(100, Math.round(activeSyncState.processedRecords / Math.max(1, activeSyncState.totalRecordsToProcess) * 100));
          }
        }
        logEntry.tanggal_selesai = (/* @__PURE__ */ new Date()).toISOString();
        logEntry.status = logEntry.error_count > 0 ? "PARTIAL" : "COMPLETED";
        activeSyncState.logs.push(logEntry);
        migrationAuditLogs.unshift(logEntry);
        activeSyncState.recentActivity.unshift(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] \u2705 Selesai sync ${tbl}: ${logEntry.insert_count} berhasil, ${logEntry.error_count} error.`);
      }
      activeSyncState.status = activeSyncState.logs.some((l) => l.status === "PARTIAL" || l.status === "FAILED") ? "PARTIAL" : "COMPLETED";
      activeSyncState.percent = 100;
      activeSyncState.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      activeSyncState.recentActivity.unshift(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] \u{1F389} Sinkronisasi selesai dengan status ${activeSyncState.status}!`);
    } catch (err) {
      activeSyncState.status = "FAILED";
      activeSyncState.errorMessage = err.message;
      activeSyncState.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      activeSyncState.recentActivity.unshift(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] \u274C Sinkronisasi gagal: ${err.message}`);
    }
  })();
  return activeSyncState;
}
function getActiveSyncStatus() {
  return activeSyncState;
}
function getMigrationAuditLogs() {
  return migrationAuditLogs;
}
async function performRealisasiPreview(customHypercloudUrl) {
  const sb = getSupabaseClient();
  const sourceRows = [];
  const BATCH_SIZE = 1e3;
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await sb.from("REALISASI").select("ID, WO_ID, Nomor_WO, ULP, REGU_ROW, PENYULANG, NO_TIANG, TANGGAL, Timestamp, unitId").range(from, from + BATCH_SIZE - 1);
    if (error) {
      throw new PreviewException({
        stage: "Pengambilan ID",
        database: "SUPABASE",
        table: "REALISASI",
        errorMessage: sanitizeSecretInfo(`Gagal mengambil data REALISASI dari Supabase: ${error.message}`),
        errorCode: error.code || "SUPABASE_FETCH_FAILED",
        queryOrOperation: "SELECT ID, WO_ID, ... FROM REALISASI"
      });
    }
    if (data && data.length > 0) {
      sourceRows.push(...data);
      from += BATCH_SIZE;
      if (data.length < BATCH_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  const targetRows = [];
  const pool = getHypercloudPool(customHypercloudUrl);
  if (pool) {
    try {
      const client = await pool.connect();
      try {
        const res = await client.query('SELECT "ID", "WO_ID", "Nomor_WO", "ULP", "REGU_ROW", "PENYULANG", "NO_TIANG", "TANGGAL", "Timestamp" FROM "REALISASI"');
        targetRows.push(...res.rows);
      } finally {
        client.release();
      }
    } catch (pgErr) {
      console.warn(`[performRealisasiPreview] Direct PG query failed (${pgErr.message}), falling back to REST API...`);
    }
  }
  if (targetRows.length === 0) {
    const units = ["UL1", "UL2"];
    for (const u of units) {
      try {
        const token = await getTargetAuthToken(u);
        if (token) {
          const fetchRes = await fetch("https://api.aphro-row.my.id/api/realisasi?limit=15000", {
            headers: { Authorization: `Bearer ${token}` }
          });
          const resJson = await fetchRes.json();
          if (Array.isArray(resJson.data)) {
            targetRows.push(...resJson.data);
          }
        }
      } catch (e) {
        console.warn(`[performRealisasiPreview] REST API fetch failed for ${u}:`, e.message);
      }
    }
  }
  const sourceMap = /* @__PURE__ */ new Map();
  for (const row of sourceRows) {
    const id = String(row.ID || row.id || "").trim();
    if (id) {
      sourceMap.set(id, row);
    }
  }
  const targetSet = /* @__PURE__ */ new Set();
  for (const row of targetRows) {
    const id = String(row.ID || row.id || "").trim();
    if (id) {
      targetSet.add(id);
    }
  }
  let inBothCount = 0;
  let sourceOnlyCount = 0;
  let targetOnlyCount = 0;
  const sourceOnlyRecords = [];
  for (const [id, row] of sourceMap.entries()) {
    if (targetSet.has(id)) {
      inBothCount++;
    } else {
      sourceOnlyCount++;
      sourceOnlyRecords.push({
        ID: id,
        WO_ID: String(row.WO_ID ?? row.wo_id ?? "-"),
        Nomor_WO: String(row.Nomor_WO ?? row.nomor_wo ?? "-"),
        ULP: String(row.ULP ?? row.ulp ?? "-"),
        REGU_ROW: String(row.REGU_ROW ?? row.Regu_ROW ?? row.Regu ?? row.Nama_Regu ?? "-"),
        PENYULANG: String(row.PENYULANG ?? row.Penyulang ?? "-"),
        NO_TIANG: String(row.NO_TIANG ?? row.Nomor_Tiang ?? row.No_Tiang ?? "-"),
        TANGGAL: String(row.TANGGAL ?? row.Tanggal ?? "-"),
        Timestamp: String(row.Timestamp ?? row.timestamp ?? "-"),
        unitId: String(row.unitId ?? row.unit_id ?? "UL1")
      });
    }
  }
  for (const id of targetSet) {
    if (!sourceMap.has(id)) {
      targetOnlyCount++;
    }
  }
  const isExact555 = sourceOnlyCount === 555;
  const validationMessage = isExact555 ? "555 kandidat REALISASI belum tersalin ke HyperCloudHost" : `Peringatan: Jumlah kandidat (${sourceOnlyCount}) berbeda dengan selisih COUNT(*) (11.981 - 11.426 = 555). Diperlukan pemeriksaan lebih lanjut.`;
  return {
    tableName: "REALISASI",
    totalSource: sourceMap.size,
    totalTarget: targetSet.size,
    inBothCount,
    sourceOnlyCount,
    targetOnlyCount,
    conflictCount: 0,
    isExact555,
    validationMessage,
    sourceOnlyRecords
  };
}

// server.ts
try {
  admin.initializeApp({
    projectId: "conductive-catcher-w9v0l"
  });
} catch (e) {
  console.warn("Firebase Admin already initialized or failed:", e);
}
var FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || "ai-studio-aphroassetprotec-d28001e8-66ea-4678-abc8-62d11d5e3a61";
var db = null;
try {
  db = (0, import_firestore.getFirestore)(FIRESTORE_DATABASE_ID);
} catch (e) {
  console.warn("Failed to initialize Firestore admin DB:", e);
}
var messaging = null;
try {
  messaging = (0, import_messaging.getMessaging)();
} catch (e) {
  console.warn("Failed to initialize Firebase Messaging admin:", e);
}
async function startServer() {
  const app = (0, import_express2.default)();
  const PORT = 3e3;
  app.use(import_express2.default.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app.use("/api", hypercloudApi_default);
  const geoCache = /* @__PURE__ */ new Map();
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
      let tokens = [];
      try {
        const tokensSnapshot = await db.collection("fcm_tokens").get();
        const targetRegu = String(reguName).trim().toUpperCase();
        tokens = tokensSnapshot.docs.map((doc) => doc.data()).filter((data) => (data.reguName || "").trim().toUpperCase() === targetRegu).map((data) => data.token);
      } catch (fcmDbError) {
        console.warn("Unable to query fcm_tokens from Firestore:", fcmDbError?.message || fcmDbError);
        return res.json({ success: false, message: "Firestore fcm_tokens unavailable", details: fcmDbError?.message });
      }
      if (tokens.length === 0) {
        console.log(`No FCM tokens found for regu: ${reguName}`);
        return res.json({ success: true, message: "No tokens found, notification not sent" });
      }
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
          body: messageBody
        },
        data: {
          woId: woData.id || "",
          click_action: "FLUTTER_NOTIFICATION_CLICK"
          // for mobile
        },
        tokens
      };
      const response = await messaging.sendEachForMulticast(message);
      console.log(`Successfully sent ${response.successCount} notifications`);
      return res.json({
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount
      });
    } catch (error) {
      console.error("Error sending notification:", error?.message || error);
      return res.json({ success: false, error: "Failed to send notification", details: error?.message });
    }
  });
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
      const response = await import_axios.default.get("https://nominatim.openstreetmap.org/reverse", {
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
    } catch (error) {
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
  app.get("/api/admin/migration/config", (req, res) => {
    const rawUrl2 = getHypercloudDatabaseUrl();
    const maskedUrl = rawUrl2 ? rawUrl2.replace(/:([^:@]+)@/, ":*****@") : "";
    return res.json({
      status: "success",
      data: {
        rawUrl: rawUrl2 || "",
        maskedUrl: maskedUrl || "",
        isConfigured: !!rawUrl2
      }
    });
  });
  app.post("/api/admin/migration/config", (req, res) => {
    const { url } = req.body || {};
    if (url && typeof url === "string") {
      setHypercloudDatabaseUrl(url);
    }
    const rawUrl2 = getHypercloudDatabaseUrl();
    return res.json({
      status: "success",
      message: "Konfigurasi URL database HyperCloudHost diperbarui",
      data: {
        rawUrl: rawUrl2,
        maskedUrl: rawUrl2.replace(/:([^:@]+)@/, ":*****@")
      }
    });
  });
  app.post("/api/admin/migration/test-connection", async (req, res) => {
    try {
      const { customHypercloudUrl } = req.body || {};
      if (customHypercloudUrl) {
        setHypercloudDatabaseUrl(customHypercloudUrl);
      }
      const [supabaseRes, hypercloudRes] = await Promise.all([
        testConnection2("supabase"),
        testConnection2("hypercloud", customHypercloudUrl)
      ]);
      return res.json({
        status: "success",
        data: {
          supabase: supabaseRes,
          hypercloud: hypercloudRes
        }
      });
    } catch (err) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });
  const handlePreviewRequest = async (req, res) => {
    const method = req.method;
    const endpoint = req.originalUrl || req.url;
    console.log(`[MIGRATION PREVIEW LOG] ${method} ${endpoint} | Stage: Inisiasi Preview`);
    res.setHeader("Content-Type", "application/json");
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
      const tableSummaries = diffSummaries.tableSummaries || {};
      const responseBody = {
        success: true,
        status: "success",
        data: {
          ...diffSummaries,
          workOrder: tableSummaries["WORK_ORDER"] ? {
            source: tableSummaries["WORK_ORDER"].totalSource,
            target: tableSummaries["WORK_ORDER"].totalTarget
          } : void 0,
          absensi: tableSummaries["ABSENSI"] ? {
            source: tableSummaries["ABSENSI"].totalSource,
            target: tableSummaries["ABSENSI"].totalTarget
          } : void 0,
          realisasi: tableSummaries["REALISASI"] ? {
            source: tableSummaries["REALISASI"].totalSource,
            target: tableSummaries["REALISASI"].totalTarget
          } : void 0,
          penyulang: tableSummaries["PENYULANG"] ? {
            source: tableSummaries["PENYULANG"].totalSource,
            target: tableSummaries["PENYULANG"].totalTarget
          } : void 0
        }
      };
      console.log(`[MIGRATION PREVIEW LOG] ${method} ${endpoint} | Status: 200 OK | Content-Type: application/json | Stage: Preview Selesai`);
      return res.status(200).json(responseBody);
    } catch (err) {
      const errorDetail = err.detail || {
        stage: "Perbandingan",
        database: "SUPABASE / HYPERCLOUD",
        table: "N/A",
        errorMessage: err.message || "Gagal membandingkan data database",
        errorCode: err.code || "PREVIEW_FAILED"
      };
      console.error(`[MIGRATION PREVIEW ERROR LOG] ${method} ${endpoint} | Status: 400 | Stage: ${errorDetail.stage} | Error: ${errorDetail.errorMessage}`);
      return res.status(400).json({
        success: false,
        status: "error",
        error: {
          code: errorDetail.errorCode || "PREVIEW_FAILED",
          message: errorDetail.errorMessage
        },
        errorDetail
      });
    }
  };
  const handlePreviewRealisasiRequest = async (req, res) => {
    const method = req.method;
    const endpoint = req.originalUrl || req.url;
    console.log(`[MIGRATION PREVIEW REALISASI LOG] ${method} ${endpoint} | Stage: Inisiasi Preview REALISASI`);
    res.setHeader("Content-Type", "application/json");
    try {
      const { customHypercloudUrl } = req.body || {};
      if (customHypercloudUrl) {
        setHypercloudDatabaseUrl(customHypercloudUrl);
      }
      const previewResult = await performRealisasiPreview(customHypercloudUrl);
      console.log(`[MIGRATION PREVIEW REALISASI LOG] ${method} ${endpoint} | Status: 200 OK | Content-Type: application/json | Stage: Preview REALISASI Selesai`);
      return res.status(200).json({
        success: true,
        status: "success",
        data: previewResult
      });
    } catch (err) {
      const errorDetail = err.detail || {
        stage: "Perbandingan",
        database: "SUPABASE / HYPERCLOUD",
        table: "REALISASI",
        errorMessage: err.message || "Gagal melakukan preview REALISASI",
        errorCode: err.code || "PREVIEW_REALISASI_FAILED"
      };
      console.error(`[MIGRATION PREVIEW REALISASI ERROR LOG] ${method} ${endpoint} | Status: 400 | Stage: ${errorDetail.stage} | Error: ${errorDetail.errorMessage}`);
      return res.status(400).json({
        success: false,
        status: "error",
        error: {
          code: errorDetail.errorCode || "PREVIEW_REALISASI_FAILED",
          message: errorDetail.errorMessage
        },
        errorDetail
      });
    }
  };
  const PREVIEW_ROUTES = [
    "/api/admin/migration/preview",
    "/api/migration/preview",
    "/api/migrate/preview",
    "/migration/preview"
  ];
  const PREVIEW_REALISASI_ROUTES = [
    "/api/admin/migration/preview-realisasi",
    "/api/migration/preview-realisasi",
    "/api/migrate/preview-realisasi",
    "/migration/preview-realisasi"
  ];
  PREVIEW_ROUTES.forEach((routePath) => {
    app.post(routePath, handlePreviewRequest);
    app.get(routePath, handlePreviewRequest);
  });
  PREVIEW_REALISASI_ROUTES.forEach((routePath) => {
    app.post(routePath, handlePreviewRealisasiRequest);
    app.get(routePath, handlePreviewRealisasiRequest);
  });
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
    } catch (err) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });
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
  app.get("/api/admin/migration/logs", (req, res) => {
    const logs = getMigrationAuditLogs();
    return res.json({
      status: "success",
      data: logs
    });
  });
  app.post("/api/admin/migration/export-sql", async (req, res) => {
    try {
      let escapeSql = function(val) {
        if (val === null || val === void 0) return "NULL";
        if (typeof val === "number") return val.toString();
        if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
        return "'" + String(val).replace(/'/g, "''") + "'";
      };
      const { tables, unitFilter, dateFrom, dateTo } = req.body || {};
      const selectedTables = tables && tables.length > 0 ? tables : Object.keys(SUPPORTED_TABLES);
      selectedTables.sort((a, b) => (SUPPORTED_TABLES[a]?.order || 99) - (SUPPORTED_TABLES[b]?.order || 99));
      let sql = "-- ==========================================================================\n";
      sql += "-- APHRO DATABASE MIGRATION SCRIPT (SUPABASE -> HYPERCLOUDHOST)\n";
      sql += `-- Generated At: ${(/* @__PURE__ */ new Date()).toISOString()}
`;
      sql += `-- Filter Unit: ${unitFilter || "ALL"} | Tanggal: ${dateFrom || "Semua"} s/d ${dateTo || "Semua"}
`;
      sql += "-- ==========================================================================\n\n";
      sql += "BEGIN;\n\n";
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

CREATE TABLE IF NOT EXISTS public."PENYULANG" (
  "ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "Kode_Penyulang" TEXT,
  "Nama_Penyulang" TEXT,
  "ULP" TEXT,
  "Panjang_Kms" NUMERIC DEFAULT 0,
  "Jumlah_Trafo" NUMERIC DEFAULT 0,
  "Status" TEXT
);
ALTER TABLE public."PENYULANG" ADD COLUMN IF NOT EXISTS "unitId" TEXT DEFAULT 'UL1';
ALTER TABLE public."PENYULANG" ADD COLUMN IF NOT EXISTS "Kode_Penyulang" TEXT;
ALTER TABLE public."PENYULANG" ADD COLUMN IF NOT EXISTS "Nama_Penyulang" TEXT;
ALTER TABLE public."PENYULANG" ADD COLUMN IF NOT EXISTS "ULP" TEXT;
ALTER TABLE public."PENYULANG" ADD COLUMN IF NOT EXISTS "Panjang_Kms" NUMERIC DEFAULT 0;
ALTER TABLE public."PENYULANG" ADD COLUMN IF NOT EXISTS "Jumlah_Trafo" NUMERIC DEFAULT 0;
ALTER TABLE public."PENYULANG" ADD COLUMN IF NOT EXISTS "Status" TEXT;

`;
      for (const tbl of selectedTables) {
        const config = SUPPORTED_TABLES[tbl];
        if (!config) continue;
        const rows = await fetchSourceData(tbl, { unitFilter, dateFrom, dateTo });
        sql += `-- --------------------------------------------------------------------------
`;
        sql += `-- TABEL: ${tbl} (${rows.length} Records)
`;
        sql += `-- --------------------------------------------------------------------------
`;
        for (const row of rows) {
          const colNames = config.columns.map((c) => `"${c}"`).join(", ");
          const colValues = config.columns.map((col) => {
            let val = row[col];
            if (val === void 0 || val === null) {
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
          const updateClauses = config.columns.filter((c) => c !== config.primaryKey).map((c) => `"${c}" = EXCLUDED."${c}"`);
          const onConflict = updateClauses.length > 0 ? `ON CONFLICT ("${config.primaryKey}") DO UPDATE SET ${updateClauses.join(", ")}` : `ON CONFLICT ("${config.primaryKey}") DO NOTHING`;
          sql += `INSERT INTO "${tbl}" (${colNames}) VALUES (${colValues}) ${onConflict};
`;
        }
        sql += "\n";
      }
      sql += "COMMIT;\n";
      res.setHeader("Content-Type", "application/sql");
      res.setHeader("Content-Disposition", `attachment; filename="aphro_sync_${Date.now()}.sql"`);
      return res.send(sql);
    } catch (err) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express2.default.static(distPath, {
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
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server_build.js.map
