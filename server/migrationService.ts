import { createClient } from "@supabase/supabase-js";
import pg from "pg";
const { Pool } = pg;

// Environment credentials for database connections
const SUPABASE_URL = process.env.SUPABASE_URL || "https://npeeobcpffmlyiknszhh.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98";
const SUPABASE_DATABASE_URL = process.env.SUPABASE_DATABASE_URL || "";
export let HYPERCLOUD_DATABASE_URL = process.env.HYPERCLOUD_DATABASE_URL || process.env.DATABASE_URL || "postgresql://meysxysd:Aphro)51074Db@127.0.0.1:5432/meysxysd_aphro";

export function setHypercloudDatabaseUrl(url: string) {
  if (url && typeof url === "string") {
    HYPERCLOUD_DATABASE_URL = url.trim();
    if (hypercloudPool) {
      hypercloudPool.end().catch(() => {});
      hypercloudPool = null;
    }
  }
}

export function getHypercloudDatabaseUrl(): string {
  return HYPERCLOUD_DATABASE_URL;
}

// Helper function to safely parse Postgres connection string including passwords with special characters
export function parsePgConfig(connStr: string): pg.PoolConfig {
  if (!connStr) return {};
  try {
    const match = connStr.match(/^postgres(?:ql)?:\/\/([^:]+):(.+)@([^:/]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/);
    if (match) {
      const [, user, password, host, portStr, database, queryStr] = match;
      const port = portStr ? parseInt(portStr, 10) : 5432;
      const ssl = queryStr?.includes("sslmode=require") || queryStr?.includes("ssl=true") ? { rejectUnauthorized: false } : undefined;
      return {
        user: decodeURIComponent(user),
        password: password, // preserved directly as plain password string
        host,
        port,
        database,
        ssl,
      };
    }
  } catch (e) {
    // fallback
  }
  return { connectionString: connStr };
}

// Table definitions and primary keys
export interface TableConfig {
  name: string;
  primaryKey: string;
  label: string;
  order: number;
  criticalFields: string[]; // Fields that trigger CONFLICT if changed (e.g., unitId)
  dateField?: string;
  unitField?: string;
  columns: string[];
}

export const SUPPORTED_TABLES: Record<string, TableConfig> = {
  WORK_ORDER: {
    name: "WORK_ORDER",
    primaryKey: "WO_ID",
    label: "Work Order",
    order: 1,
    criticalFields: ["unitId", "Nomor_WO"],
    dateField: "Tanggal",
    unitField: "unitId",
    columns: [
      "WO_ID", "unitId", "PEKERJAAN", "Nomor_WO", "Tanggal", "ULP",
      "PENYULANG", "REGU_ROW", "VOLUME", "SATUAN", "WO_AWAL", "WO_AKHIR",
      "STATUS", "LOKASI_START", "LOKASI_FINISH", "TOTAL_REALISASI",
      "SATUAN_TOTAL_REALISASI", "Created_At"
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
      "ID", "unitId", "TANGGAL", "NAMA_REGU", "ULP",
      "PETUGAS_1", "KET_1", "PETUGAS_2", "KET_2", "PETUGAS_3", "KET_3",
      "PETUGAS_4", "KET_4", "PETUGAS_5", "KET_5",
      "FOTO_MASUK", "TIMESTAMP_MASUK", "FOTO_KELUAR", "TIMESTAMP_KELUAR"
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
      "ID", "unitId", "WO_ID", "Nomor_WO", "ULP", "REGU_ROW",
      "PENYULANG", "NO_TIANG", "TANGGAL", "Foto_Sebelum", "Foto_Sesudah",
      "Jenis_Tanaman", "Keterangan", "Pertumbuhan_Tanaman", "Kendala",
      "Latitude_Longitude", "Lokasi_kerja", "Timestamp"
    ]
  }
};

export interface SyncDifferenceItem {
  id: string;
  tableName: string;
  unitId?: string;
  type: "INSERT" | "UPDATE" | "SKIP" | "CONFLICT" | "TARGET_ONLY";
  conflictReason?: string;
  differences?: {
    field: string;
    sourceVal: any;
    targetVal: any;
  }[];
  sourceData?: Record<string, any>;
  targetData?: Record<string, any>;
}

export interface TableDiffSummary {
  tableName: string;
  totalSource: number;
  totalTarget: number;
  insertCount: number;
  updateCount: number;
  skipCount: number;
  conflictCount: number;
  targetOnlyCount: number;
  errorCount: number;
  conflicts: SyncDifferenceItem[];
  sampleInserts: string[];
  sampleUpdates: string[];
  status: "VERIFIED" | "DIFFERENT" | "CONFLICT" | "ERROR" | "NOT_CHECKED";
}

export interface SyncLogEntry {
  sync_id: string;
  tanggal_mulai: string;
  tanggal_selesai?: string;
  source: string;
  target: string;
  table_name: string;
  total_source: number;
  total_target_before: number;
  insert_count: number;
  update_count: number;
  skip_count: number;
  conflict_count: number;
  error_count: number;
  status: "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  error_message?: string;
  operator: string;
  is_dry_run: boolean;
  batch_size: number;
  unit_filter?: string;
  date_filter?: string;
  created_at: string;
}

export interface SyncProgressState {
  syncId: string;
  status: "IDLE" | "RUNNING" | "PAUSED" | "COMPLETED" | "PARTIAL" | "FAILED";
  isDryRun: boolean;
  operator: string;
  currentTable: string;
  currentTableIndex: number;
  totalTables: number;
  processedRecords: number;
  totalRecordsToProcess: number;
  percent: number;
  currentBatch: number;
  totalBatches: number;
  tableSummaries: Record<string, TableDiffSummary>;
  logs: SyncLogEntry[];
  recentActivity: string[];
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

// In-Memory Storage for Active Sync Progress and Historical Audit Logs
let activeSyncState: SyncProgressState | null = null;
const migrationAuditLogs: SyncLogEntry[] = [];

// Reusable Connection Pools
let hypercloudPool: pg.Pool | null = null;
let supabasePgPool: pg.Pool | null = null;

export function getHypercloudPool(customUrl?: string): pg.Pool | null {
  const connStr = customUrl || HYPERCLOUD_DATABASE_URL;
  if (!connStr || connStr.includes("127.0.0.1") || connStr.includes("localhost")) return null;
  if (!hypercloudPool || (hypercloudPool as any)._connectionString !== connStr) {
    if (hypercloudPool) {
      hypercloudPool.end().catch(() => {});
    }
    const poolConfig = parsePgConfig(connStr);
    hypercloudPool = new Pool({
      ...poolConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    (hypercloudPool as any)._connectionString = connStr;
  }
  return hypercloudPool;
}

export function getSupabasePgPool(customUrl?: string): pg.Pool | null {
  const connStr = customUrl || SUPABASE_DATABASE_URL;
  if (!connStr) return null;
  if (!supabasePgPool || (supabasePgPool as any)._connectionString !== connStr) {
    if (supabasePgPool) {
      supabasePgPool.end().catch(() => {});
    }
    supabasePgPool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
      ssl: { rejectUnauthorized: false },
    });
    (supabasePgPool as any)._connectionString = connStr;
  }
  return supabasePgPool;
}

export function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

export interface TargetDbVerification {
  connected: boolean;
  database: string;
  schema: string;
  error?: string;
  counts: Record<string, number>;
}

export interface FullPreviewResponse {
  targetInfo: TargetDbVerification;
  tableSummaries: Record<string, TableDiffSummary>;
  realisasiDetail?: {
    totalSource: number;
    totalTarget: number;
    sourceOnlyCount: number;
    targetOnlyCount: number;
    inBothCount: number;
    sourceOnlyRecords: RealisasiPreviewItem[];
  };
  validationWarning?: string;
  isSyncAllowed: boolean;
}

export async function verifyTargetDatabase(customUrl?: string): Promise<TargetDbVerification> {
  const connStr = customUrl || HYPERCLOUD_DATABASE_URL;
  const pool = getHypercloudPool(connStr);

  if (pool) {
    try {
      const client = await pool.connect();
      try {
        const metaRes = await client.query(`
          SELECT current_database() as db, current_schema() as schema;
        `);
        const dbName = metaRes.rows[0]?.db || "meysxysd_aphro";
        const schemaName = metaRes.rows[0]?.schema || "public";

        const counts: Record<string, number> = {};
        for (const tbl of ["WORK_ORDER", "ABSENSI", "REALISASI"]) {
          const countRes = await client.query(`SELECT COUNT(*)::int as cnt FROM "${tbl}";`);
          counts[tbl] = parseInt(countRes.rows[0]?.cnt || "0", 10);
        }

        console.log(`[PREVIEW TARGET VERIFICATION] Database: '${dbName}', Schema: '${schemaName}'`);
        console.log(`[PREVIEW TARGET VERIFICATION] Counts: WORK_ORDER=${counts.WORK_ORDER}, ABSENSI=${counts.ABSENSI}, REALISASI=${counts.REALISASI}`);

        return {
          connected: true,
          database: dbName,
          schema: schemaName,
          counts
        };
      } finally {
        client.release();
      }
    } catch (pgErr: any) {
      console.warn(`[verifyTargetDatabase] Direct PG connection error:`, pgErr.message);
    }
  }

  // Fallback to REST API Gateway
  try {
    const pingRes = await fetch("https://api.aphro-row.my.id/api/health");
    const pingData = await pingRes.json().catch(() => ({}));

    if (!pingRes.ok || pingData.database !== "connected") {
      throw new Error("REST API HyperCloudHost tidak terhubung ke database");
    }

    const dbName = pingData.databaseName || "meysxysd_aphro";
    const schemaName = "public";

    const token = await getTargetAuthToken("UL1") || await getTargetAuthToken("UL2");
    if (!token) {
      throw new Error("Otentikasi token HyperCloudHost gagal");
    }

    const counts: Record<string, number> = {};
    for (const tbl of ["WORK_ORDER", "ABSENSI", "REALISASI"]) {
      const endpoint = tbl === "WORK_ORDER" ? "/api/work-orders" :
                       tbl === "ABSENSI" ? "/api/absensi" : "/api/realisasi";
      const fetchRes = await fetch(`https://api.aphro-row.my.id${endpoint}?limit=15000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resJson = await fetchRes.json();
      if (Array.isArray(resJson.data)) {
        counts[tbl] = resJson.data.length;
      } else {
        throw new Error(`Data REST API untuk '${tbl}' tidak valid`);
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
  } catch (apiErr: any) {
    console.error(`[verifyTargetDatabase ERROR]:`, apiErr.message);
    return {
      connected: false,
      database: "Gagal Terhubung",
      schema: "Gagal Terhubung",
      error: `Koneksi ke database HyperCloudHost gagal: ${apiErr.message}`,
      counts: {}
    };
  }
}

// Test Connection Helper
export async function testConnection(type: "supabase" | "hypercloud", customUrl?: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
  latencyMs: number;
}> {
  const start = Date.now();
  if (type === "supabase") {
    try {
      const sb = getSupabaseClient();
      const { count, error } = await sb.from("WORK_ORDER").select("*", { count: "exact", head: true });
      if (error) {
        return {
          success: false,
          message: `Supabase error: ${error.message}`,
          latencyMs: Date.now() - start,
        };
      }
      return {
        success: true,
        message: `Terkoneksi ke Supabase PostgreSQL (${SUPABASE_URL})`,
        details: { totalWorkOrders: count, mode: "REST Client (Port 443 HTTPS)" },
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Gagal menghubungkan ke Supabase: ${err.message}`,
        latencyMs: Date.now() - start,
      };
    }
  } else {
    // HyperCloudHost PostgreSQL
    const connStr = customUrl || HYPERCLOUD_DATABASE_URL;

    // Try Direct PostgreSQL Pool First
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
              latencyMs: Date.now() - start,
            };
          } finally {
            client.release();
          }
        }
      } catch (err: any) {
        console.warn(`[testConnection] Direct PG failed (${err.message}), trying API Gateway fallback...`);
      }
    }

    // Gateway / REST API Verification Fallback
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
            note: "Target database aktif dan siap disinkronkan via API & SQL Export.",
          },
          latencyMs: Date.now() - start,
        };
      }
    } catch (apiErr: any) {
      console.warn(`[testConnection] API Gateway test failed:`, apiErr);
    }

    // If both failed, return informative error
    return {
      success: false,
      message: `Koneksi ke database HyperCloudHost gagal. Server API maupun port direct 5432 tidak merespon.`,
      details: { connectionString: connStr ? connStr.replace(/:([^:@]+)@/, ":*****@") : "Belum diatur" },
      latencyMs: Date.now() - start,
    };
  }
}

// Data Normalizer
function normalizeValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    // Standardize ISO date string or trim
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      return trimmed.replace(/\.000Z$/, "Z").replace(/\+00:00$/, "Z");
    }
    return trimmed;
  }
  return JSON.stringify(val);
}

// Fetch all rows from Supabase with batching
export async function fetchSourceData(
  tableName: string,
  options: { unitFilter?: string; dateFrom?: string; dateTo?: string }
): Promise<Record<string, any>[]> {
  const sb = getSupabaseClient();
  const config = SUPPORTED_TABLES[tableName];
  if (!config) throw new Error(`Tabel tidak didukung: ${tableName}`);

  const results: Record<string, any>[] = [];
  const BATCH_SIZE = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = sb.from(tableName).select("*").range(from, from + BATCH_SIZE - 1);

    if (options.unitFilter && options.unitFilter !== "ALL" && config.unitField) {
      query = query.eq(config.unitField, options.unitFilter);
    }
    if (options.dateFrom && config.dateField) {
      query = query.gte(config.dateField, options.dateFrom);
    }
    if (options.dateTo && config.dateField) {
      query = query.lte(config.dateField, options.dateTo);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase query error (${tableName}): ${error.message}`);

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

// Cached login tokens to prevent rate limits
const targetTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getTargetAuthToken(unitId: string): Promise<string | null> {
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
        unitId: unitId
      })
    });
    const loginData = await loginRes.json();
    if (loginData?.token) {
      targetTokenCache.set(unitId, {
        token: loginData.token,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes cache
      });
      return loginData.token;
    }
  } catch (err: any) {
    console.warn(`Failed to login to target API for ${unitId}:`, err.message);
  }
  return null;
}

// Fetch all rows from Target (PostgreSQL or API fallback)
export async function fetchTargetData(
  tableName: string,
  options: { unitFilter?: string; dateFrom?: string; dateTo?: string },
  customHypercloudUrl?: string
): Promise<Record<string, any>[]> {
  const config = SUPPORTED_TABLES[tableName];
  if (!config) throw new Error(`Tabel tidak didukung: ${tableName}`);

  const connStr = customHypercloudUrl || HYPERCLOUD_DATABASE_URL;
  const pool = getHypercloudPool(connStr);

  if (pool) {
    try {
      const client = await pool.connect();
      try {
        let sql = `SELECT * FROM "${tableName}" WHERE 1=1`;
        const params: any[] = [];
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
    } catch (directConnErr: any) {
      console.warn(`Direct PG query to HyperCloudHost failed (${directConnErr.message}), falling back to REST API...`);
    }
  }

  // Fallback: fetch from HyperCloudHost REST API
  try {
    const endpoint = tableName === "WORK_ORDER" ? "/api/work-orders" :
                     tableName === "ABSENSI" ? "/api/absensi" :
                     "/api/realisasi";

    let url = `https://api.aphro-row.my.id${endpoint}?limit=15000`;
    if (options.dateFrom) url += `&tanggalDari=${options.dateFrom}`;
    if (options.dateTo) url += `&tanggalSampai=${options.dateTo}`;

    const units = options.unitFilter === "UL1" ? ["UL1"] :
                  options.unitFilter === "UL2" ? ["UL2"] : ["UL1", "UL2"];

    const allRecords: Record<string, any>[] = [];

    for (const u of units) {
      const token = await getTargetAuthToken(u);
      if (!token) {
        throw new Error(`Token autentikasi tidak tersedia untuk unit ${u}`);
      }
      const fetchRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resJson = await fetchRes.json();
      if (Array.isArray(resJson.data)) {
        allRecords.push(...resJson.data);
      } else {
        throw new Error(`Format data API ${endpoint} tidak valid`);
      }
    }

    return allRecords;
  } catch (err: any) {
    console.error(`[fetchTargetData ERROR] ${tableName}:`, err.message);
    throw new Error(`Gagal membaca data target '${tableName}': ${err.message}`);
  }
}

// Compare Data Algorithm
export function compareTableRecords(
  tableName: string,
  sourceRows: Record<string, any>[],
  targetRows: Record<string, any>[]
): TableDiffSummary {
  const config = SUPPORTED_TABLES[tableName];
  const pk = config.primaryKey;

  const targetMap = new Map<string, Record<string, any>>();
  for (const row of targetRows) {
    const key = String(row[pk] || "");
    if (key) targetMap.set(key, row);
  }

  const sourceMap = new Map<string, Record<string, any>>();
  for (const row of sourceRows) {
    const key = String(row[pk] || "");
    if (key) sourceMap.set(key, row);
  }

  let insertCount = 0;
  let updateCount = 0;
  let skipCount = 0;
  let conflictCount = 0;
  const conflicts: SyncDifferenceItem[] = [];
  const sampleInserts: string[] = [];
  const sampleUpdates: string[] = [];

  for (const [id, sRow] of sourceMap.entries()) {
    if (!targetMap.has(id)) {
      insertCount++;
      if (sampleInserts.length < 10) sampleInserts.push(id);
      continue;
    }

    const tRow = targetMap.get(id)!;
    const diffs: { field: string; sourceVal: any; targetVal: any }[] = [];
    let isConflict = false;
    let conflictReason = "";

    // Check critical fields
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

    // Check other columns
    for (const col of config.columns) {
      // Map potential alias names for absensi timestamps
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

  // Count target-only records
  let targetOnlyCount = 0;
  for (const [id] of targetMap.entries()) {
    if (!sourceMap.has(id)) {
      targetOnlyCount++;
    }
  }

  let status: TableDiffSummary["status"] = "VERIFIED";
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

// Preview / Dry Run Sync
export async function performPreviewSync(options: {
  tables?: string[];
  unitFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  customHypercloudUrl?: string;
}): Promise<FullPreviewResponse> {
  const targetInfo = await verifyTargetDatabase(options.customHypercloudUrl);

  let validationWarning: string | undefined = undefined;
  let isSyncAllowed = true;

  if (!targetInfo.connected) {
    isSyncAllowed = false;
    validationWarning = `COUNT DATABASE TARGET TIDAK SESUAI. SYNC DINONAKTIFKAN. (${targetInfo.error || "Gagal terhubung ke database target"})`;
  }

  const selectedTables = options.tables && options.tables.length > 0
    ? options.tables
    : Object.keys(SUPPORTED_TABLES);

  // Sort tables by defined relational order (WORK_ORDER -> ABSENSI -> REALISASI)
  selectedTables.sort((a, b) => (SUPPORTED_TABLES[a]?.order || 99) - (SUPPORTED_TABLES[b]?.order || 99));

  const summaries: Record<string, TableDiffSummary> = {};
  let realisasiDetail: FullPreviewResponse["realisasiDetail"] = undefined;

  for (const tbl of selectedTables) {
    try {
      const sourceRows = await fetchSourceData(tbl, options);
      let targetRows: Record<string, any>[] = [];

      if (targetInfo.connected) {
        targetRows = await fetchTargetData(tbl, options, options.customHypercloudUrl);
      }

      const diff = compareTableRecords(tbl, sourceRows, targetRows);

      if (!targetInfo.connected) {
        diff.status = "ERROR";
        diff.errorCount = sourceRows.length;
      }

      summaries[tbl] = diff;

      if (tbl === "REALISASI") {
        const sourceMap = new Map<string, Record<string, any>>();
        sourceRows.forEach(r => {
          const id = String(r.ID || r.id || "").trim();
          if (id) sourceMap.set(id, r);
        });

        const targetSet = new Set<string>();
        targetRows.forEach(r => {
          const id = String(r.ID || r.id || "").trim();
          if (id) targetSet.add(id);
        });

        let inBothCount = 0;
        let sourceOnlyCount = 0;
        let targetOnlyCount = 0;
        const sourceOnlyRecords: RealisasiPreviewItem[] = [];

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
      }
    } catch (err: any) {
      isSyncAllowed = false;
      validationWarning = `COUNT DATABASE TARGET TIDAK SESUAI. SYNC DINONAKTIFKAN. (Error pada '${tbl}': ${err.message})`;
      summaries[tbl] = {
        tableName: tbl,
        totalSource: 0,
        totalTarget: 0,
        insertCount: 0,
        updateCount: 0,
        skipCount: 0,
        conflictCount: 0,
        targetOnlyCount: 0,
        errorCount: 1,
        conflicts: [],
        sampleInserts: [],
        sampleUpdates: [],
        status: "ERROR"
      };
    }
  }

  // Validate counts against target verification
  if (targetInfo.connected) {
    for (const tbl of selectedTables) {
      const diff = summaries[tbl];
      const verifiedCount = targetInfo.counts[tbl];
      if (verifiedCount !== undefined && diff && diff.totalTarget !== verifiedCount) {
        isSyncAllowed = false;
        validationWarning = `COUNT DATABASE TARGET TIDAK SESUAI PADA TABEL '${tbl}' (Query DB: ${verifiedCount}, Data Fetched: ${diff.totalTarget}). SYNC DINONAKTIFKAN.`;
      }
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

// Execute Live Sync Batch into PostgreSQL
export async function executeLiveSync(options: {
  tables?: string[];
  unitFilter?: string;
  dateFrom?: string;
  dateTo?: string;
  batchSize?: number;
  operator: string;
  isDryRun?: boolean;
}): Promise<SyncProgressState> {
  const syncId = `SYNC-${Date.now()}`;
  const batchSize = Math.max(10, Math.min(options.batchSize || 100, 500));
  const isDryRun = !!options.isDryRun;

  const selectedTables = options.tables && options.tables.length > 0
    ? options.tables
    : Object.keys(SUPPORTED_TABLES);

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
    recentActivity: [`[${new Date().toLocaleTimeString()}] Memulai ${isDryRun ? "Dry-Run / Preview" : "Live Synchronization"} (${syncId})...`],
    startedAt: new Date().toISOString()
  };

  const pool = getHypercloudPool();

  // Run in background to prevent timeout
  (async () => {
    try {
      for (let tIdx = 0; tIdx < selectedTables.length; tIdx++) {
        const tbl = selectedTables[tIdx];
        const config = SUPPORTED_TABLES[tbl];
        const pk = config.primaryKey;

        activeSyncState!.currentTable = tbl;
        activeSyncState!.currentTableIndex = tIdx;
        activeSyncState!.recentActivity.unshift(`[${new Date().toLocaleTimeString()}] Mengambil data untuk tabel ${tbl}...`);

        const [sourceRows, targetRows] = await Promise.all([
          fetchSourceData(tbl, options),
          fetchTargetData(tbl, options)
        ]);

        const diffSummary = compareTableRecords(tbl, sourceRows, targetRows);
        activeSyncState!.tableSummaries[tbl] = diffSummary;

        const totalToSync = diffSummary.insertCount + diffSummary.updateCount;
        activeSyncState!.totalRecordsToProcess += totalToSync;

        const logEntry: SyncLogEntry = {
          sync_id: syncId,
          tanggal_mulai: new Date().toISOString(),
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
          date_filter: options.dateFrom ? `>= ${options.dateFrom}` : undefined,
          created_at: new Date().toISOString()
        };

        if (isDryRun) {
          // Dry Run mode
          logEntry.insert_count = diffSummary.insertCount;
          logEntry.update_count = diffSummary.updateCount;
          logEntry.status = diffSummary.conflictCount > 0 ? "PARTIAL" : "COMPLETED";
          logEntry.tanggal_selesai = new Date().toISOString();
          activeSyncState!.logs.push(logEntry);
          migrationAuditLogs.unshift(logEntry);
          activeSyncState!.recentActivity.unshift(`[${new Date().toLocaleTimeString()}] Selesai analisa ${tbl}: +${diffSummary.insertCount} Insert, ~${diffSummary.updateCount} Update, =${diffSummary.skipCount} Skip, !${diffSummary.conflictCount} Conflict.`);
          continue;
        }

        // Live Execution in Batches with PostgreSQL Transaction or API Fallback
        const rowsToProcess = sourceRows.filter(sRow => {
          const id = String(sRow[pk] || "");
          const isConflict = diffSummary.conflicts.some(c => c.id === id);
          return !isConflict; // Do not touch conflicts
        });

        // Test if direct PG pool is actually usable
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
          activeSyncState!.totalBatches += numBatches;

          for (let b = 0; b < numBatches; b++) {
            activeSyncState!.currentBatch++;
            const batchRows = rowsToProcess.slice(b * batchSize, (b + 1) * batchSize);
            
            const client = await pool.connect();
            try {
              await client.query("BEGIN");

              for (const row of batchRows) {
                const id = String(row[pk] || "");
                if (!id) continue;

                // Build Parameterized Insert on Conflict Update
                const cols = config.columns.filter(c => row[c] !== undefined || (c.includes("TIMESTAMP") && (row["TIMESTAMP MASUK"] || row["TIMESTAMP KELUAR"])));
                const values: any[] = [];
                const placeholders: string[] = [];
                const updateClauses: string[] = [];

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

                const colNames = cols.map(c => `"${c}"`).join(", ");
                const pNames = placeholders.join(", ");
                const updateSql = updateClauses.length > 0
                  ? `ON CONFLICT ("${pk}") DO UPDATE SET ${updateClauses.join(", ")}`
                  : `ON CONFLICT ("${pk}") DO NOTHING`;

                const insertSql = `INSERT INTO "${tbl}" (${colNames}) VALUES (${pNames}) ${updateSql}`;
                await client.query(insertSql, values);
              }

              await client.query("COMMIT");
              activeSyncState!.processedRecords += batchRows.length;
              logEntry.insert_count += batchRows.length;
              activeSyncState!.percent = Math.min(100, Math.round((activeSyncState!.processedRecords / Math.max(1, activeSyncState!.totalRecordsToProcess)) * 100));
            } catch (batchErr: any) {
              await client.query("ROLLBACK");
              logEntry.error_count += batchRows.length;
              logEntry.error_message = `Batch ${b + 1} error: ${batchErr.message}`;
              activeSyncState!.recentActivity.unshift(`[${new Date().toLocaleTimeString()}] ❌ Error pada batch ${b + 1} (${tbl}): ${batchErr.message}`);
            } finally {
              client.release();
            }
          }
        } else {
          // REST API Gateway Synchronization
          activeSyncState!.recentActivity.unshift(`[${new Date().toLocaleTimeString()}] Mengirim data ${tbl} melalui HyperCloudHost REST API Gateway...`);
          const endpoint = tbl === "WORK_ORDER" ? "/api/work-orders" :
                           tbl === "ABSENSI" ? "/api/absensi" :
                           "/api/realisasi";

          for (const row of rowsToProcess) {
            try {
              const res = await fetch(`https://api.aphro-row.my.id${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(row)
              });

              if (res.ok) {
                logEntry.insert_count++;
                activeSyncState!.processedRecords++;
              } else {
                logEntry.error_count++;
              }
            } catch {
              logEntry.error_count++;
            }
            activeSyncState!.percent = Math.min(100, Math.round((activeSyncState!.processedRecords / Math.max(1, activeSyncState!.totalRecordsToProcess)) * 100));
          }
        }

        logEntry.tanggal_selesai = new Date().toISOString();
        logEntry.status = logEntry.error_count > 0 ? "PARTIAL" : "COMPLETED";
        activeSyncState!.logs.push(logEntry);
        migrationAuditLogs.unshift(logEntry);
        activeSyncState!.recentActivity.unshift(`[${new Date().toLocaleTimeString()}] ✅ Selesai sync ${tbl}: ${logEntry.insert_count} berhasil, ${logEntry.error_count} error.`);
      }

      activeSyncState!.status = activeSyncState!.logs.some(l => l.status === "PARTIAL" || l.status === "FAILED") ? "PARTIAL" : "COMPLETED";
      activeSyncState!.percent = 100;
      activeSyncState!.completedAt = new Date().toISOString();
      activeSyncState!.recentActivity.unshift(`[${new Date().toLocaleTimeString()}] 🎉 Sinkronisasi selesai dengan status ${activeSyncState!.status}!`);
    } catch (err: any) {
      activeSyncState!.status = "FAILED";
      activeSyncState!.errorMessage = err.message;
      activeSyncState!.completedAt = new Date().toISOString();
      activeSyncState!.recentActivity.unshift(`[${new Date().toLocaleTimeString()}] ❌ Sinkronisasi gagal: ${err.message}`);
    }
  })();

  return activeSyncState;
}

export function getActiveSyncStatus(): SyncProgressState | null {
  return activeSyncState;
}

export function getMigrationAuditLogs(): SyncLogEntry[] {
  return migrationAuditLogs;
}

export interface RealisasiPreviewItem {
  ID: string;
  WO_ID: string;
  Nomor_WO: string;
  ULP: string;
  REGU_ROW: string;
  PENYULANG: string;
  NO_TIANG: string;
  TANGGAL: string;
  Timestamp: string;
  unitId?: string;
}

export interface RealisasiPreviewResult {
  tableName: "REALISASI";
  totalSource: number;
  totalTarget: number;
  inBothCount: number;
  sourceOnlyCount: number;
  targetOnlyCount: number;
  conflictCount: number;
  isExact555: boolean;
  validationMessage: string;
  sourceOnlyRecords: RealisasiPreviewItem[];
}

/**
 * Dedicated Preview / Dry Run for REALISASI table.
 * Strictly READ-ONLY: No INSERT, UPDATE, DELETE, or ALTER operations.
 * Fetches all 11,981+ records with pagination from Supabase and compares IDs with HyperCloudHost.
 */
export async function performRealisasiPreview(customHypercloudUrl?: string): Promise<RealisasiPreviewResult> {
  const sb = getSupabaseClient();

  // 1. Fetch ALL REALISASI records from Supabase with batching (no 1000 limit)
  const sourceRows: Record<string, any>[] = [];
  const BATCH_SIZE = 1000;
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await sb
      .from("REALISASI")
      .select("ID, WO_ID, Nomor_WO, ULP, REGU_ROW, PENYULANG, NO_TIANG, TANGGAL, Timestamp, unitId")
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      throw new Error(`Gagal mengambil data REALISASI dari Supabase: ${error.message}`);
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

  // 2. Fetch ALL REALISASI records / IDs from HyperCloudHost
  const targetRows: Record<string, any>[] = [];
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
    } catch (pgErr: any) {
      console.warn(`[performRealisasiPreview] Direct PG query failed (${pgErr.message}), falling back to REST API...`);
    }
  }

  if (targetRows.length === 0) {
    // Fallback to REST API Gateway
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
      } catch (e: any) {
        console.warn(`[performRealisasiPreview] REST API fetch failed for ${u}:`, e.message);
      }
    }
  }

  // 3. Build lookup maps and calculate difference
  const sourceMap = new Map<string, Record<string, any>>();
  for (const row of sourceRows) {
    const id = String(row.ID || row.id || "").trim();
    if (id) {
      sourceMap.set(id, row);
    }
  }

  const targetSet = new Set<string>();
  for (const row of targetRows) {
    const id = String(row.ID || row.id || "").trim();
    if (id) {
      targetSet.add(id);
    }
  }

  let inBothCount = 0;
  let sourceOnlyCount = 0;
  let targetOnlyCount = 0;
  const sourceOnlyRecords: RealisasiPreviewItem[] = [];

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
  const validationMessage = isExact555
    ? "555 kandidat REALISASI belum tersalin ke HyperCloudHost"
    : `Peringatan: Jumlah kandidat (${sourceOnlyCount}) berbeda dengan selisih COUNT(*) (11.981 - 11.426 = 555). Diperlukan pemeriksaan lebih lanjut.`;

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
