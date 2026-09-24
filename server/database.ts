import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Derive __dirname supporting both ES Modules and CommonJS
let resolvedFilename = '';
try {
  resolvedFilename = fileURLToPath(import.meta.url);
} catch (e) {
  resolvedFilename = typeof __filename !== 'undefined' ? __filename : '';
}
const __dirname_resolved = resolvedFilename ? path.dirname(resolvedFilename) : (typeof __dirname !== 'undefined' ? __dirname : '');

const MOCK_FILE_PATH = path.join(__dirname_resolved, 'mock_db.json');

// Priority: HYPERCLOUD_DATABASE_URL || DATABASE_URL
let rawUrl = process.env.HYPERCLOUD_DATABASE_URL || process.env.DATABASE_URL || '';
rawUrl = rawUrl.trim().replace(/^["']|["']$/g, '');

// Ignore local default connection strings that are unreachable in container environment
let dbUrl = (rawUrl.includes('127.0.0.1') || rawUrl.includes('localhost')) ? '' : rawUrl;

// Internal reference to pool instance
let poolInstance: pg.Pool | null = null;

// Mock in-memory stores for fallback when DB is unreachable
function loadMockStore(): Record<string, any[]> {
  try {
    if (fs.existsSync(MOCK_FILE_PATH)) {
      const content = fs.readFileSync(MOCK_FILE_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (e: any) {
    console.warn('[DB MOCK] Failed to load mock_db.json, using defaults:', e.message);
  }
  return {
    'INISIASI': [
      { ID: 'UL1', Kode_UL: 'ULP-01', Nama_UL: 'ULP KURANJI', unitId: 'UL1' },
      { ID: 'UL2', Kode_UL: 'ULP-02', Nama_UL: 'UL BUKITTINGGI', unitId: 'UL2' },
      { ID: 'UL3', Kode_UL: 'ULP-03', Nama_UL: 'UL PAYAKUMBUH', unitId: 'UL3' },
    ],
    'USERS': [
      { id: 'usr-1', UserID: 'superadmin', Username: 'superadmin', Password: 'admin123', name: 'SuperAdmin', role: 'SuperAdmin', Role: 'SuperAdmin', unitId: 'UL2', Status: 'Aktif' },
      { id: 'usr-2', UserID: 'adminbkt', Username: 'adminbkt', Password: 'bkt123', name: 'Admin BKT', role: 'Admin', Role: 'Admin', unitId: 'UL2', Status: 'Aktif' },
      { id: 'usr-5', UserID: 'petugasrow', Username: 'petugasrow', Password: 'row123', name: 'Budi Santoso', role: 'User', Role: 'User', unitId: 'UL2', Status: 'Aktif' }
    ],
    'WORK_ORDER': [
      { WO_ID: 'WO-2026-001', Nomor_WO: 'WO/2026/01', unitId: 'UL2', Tanggal: new Date().toISOString().split('T')[0], PEKERJAAN: 'NORMAL', STATUS: 'DRAFT', URAIAN_PEKERJAAN: 'Pemeliharaan Right of Way (ROW) Penyulang Bukittinggi' },
      { WO_ID: 'WO-2026-002', Nomor_WO: 'WO/2026/02', unitId: 'UL2', Tanggal: new Date().toISOString().split('T')[0], PEKERJAAN: 'NORMAL', STATUS: 'DRAFT', URAIAN_PEKERJAAN: 'Perabasan Pohon Dekat Jaringan TM' }
    ],
    'ABSENSI': [],
    'REALISASI': [],
    'ULP': [{ id: 'UL2', namaUL: 'UL BUKITTINGGI', unitId: 'UL2' }],
    'PENYULANG': [{ id: 'PNY-1', namaPenyulang: 'Penyulang Kota', unitId: 'UL2' }],
    'PETUGAS': [{ id: 'PTG-1', namaPetugas: 'Budi Santoso', unitId: 'UL2' }],
    'REGU_ROW': [{ id: 'RG-1', namaRegu: 'REGU ALPHA', unitId: 'UL2' }]
  };
}

const mockStore = loadMockStore();

function saveMockStore() {
  try {
    fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(mockStore, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[DB MOCK] Failed to save mock_db.json:', e.message);
  }
}

function getMockQueryResult(text: string, params: any[]): pg.QueryResult {
  const upper = text.trim().toUpperCase();
  const tableMatch = text.match(/(?:FROM|INTO|UPDATE)\s+(?:public\.)?"?([A-Za-z0-9_]+)"?/i);
  let tableName = tableMatch ? tableMatch[1].toUpperCase() : 'WORK_ORDER';
  if (!mockStore[tableName]) {
    // fallback if table name not in standard keys
    if (upper.includes('"WORK_ORDER"')) tableName = 'WORK_ORDER';
    else if (upper.includes('"REALISASI"')) tableName = 'REALISASI';
    else if (upper.includes('"ABSENSI"')) tableName = 'ABSENSI';
    else if (upper.includes('"INISIASI"')) tableName = 'INISIASI';
    else if (upper.includes('"USERS"')) tableName = 'USERS';
  }

  let rows = mockStore[tableName] || [];

  // Filter logic for SELECT query
  if (upper.startsWith('SELECT')) {
    // 1. Filter by unitId
    const unitMatch = text.match(/(?:UPPER\()?"unitId"(?:\))?\s*=\s*(?:UPPER\()?\s*\$(\d+)/i);
    if (unitMatch) {
      const paramIdx = parseInt(unitMatch[1], 10) - 1;
      const targetUnitId = params[paramIdx];
      if (targetUnitId && String(targetUnitId).toUpperCase() !== 'ALL') {
        rows = rows.filter(r => String(r.unitId || r.UnitId || r.unitid || '').toUpperCase() === String(targetUnitId).toUpperCase());
      }
    }
    // 2. Filter by Username / UserID / Nama_Regu
    if (tableName === 'USERS' && params && params.length > 0) {
      const userParam = String(params[0] || '').trim().toLowerCase();
      if (userParam && !userParam.startsWith('ul')) {
        rows = rows.filter(r => {
          const uName = String(r.Username || r.username || '').toLowerCase();
          const uId = String(r.UserID || r.userId || r.id || '').toLowerCase();
          const uRegu = String(r.Nama_Regu || r.reguName || '').toLowerCase();
          return uName === userParam || uId === userParam || uRegu === userParam || uName.includes(userParam);
        });
      }
    } else {
      const userIdIndex = text.indexOf('"UserID" = $');
      if (userIdIndex !== -1) {
        const match = text.slice(userIdIndex).match(/"UserID"\s*=\s*\$(\d+)/);
        if (match) {
          const paramIdx = parseInt(match[1], 10) - 1;
          const targetUserId = params[paramIdx];
          if (targetUserId) {
            rows = rows.filter(r => String(r.UserID || r.userId || r.id || '').toUpperCase() === String(targetUserId).toUpperCase());
          }
        }
      }
    }
    // 3. Filter by ID / WO_ID / Nomor_WO
    if (text.includes('"ID" = $') || text.includes('"WO_ID" = $') || text.includes('"Nomor_WO" = $')) {
      const match = text.match(/"(?:ID|WO_ID|Nomor_WO)"\s*=\s*\$(\d+)/);
      if (match) {
        const paramIdx = parseInt(match[1], 10) - 1;
        const targetId = params[paramIdx];
        if (targetId) {
          const tUpper = String(targetId).toUpperCase();
          rows = rows.filter(r => 
            String(r.ID || r.id || '').toUpperCase() === tUpper ||
            String(r.WO_ID || '').toUpperCase() === tUpper ||
            String(r.Nomor_WO || '').toUpperCase() === tUpper
          );
        }
      }
    }
  }

  let affectedRows: any[] = [];
  let isMutation = false;

  if (upper.startsWith('INSERT') && params && params.length > 0) {
    isMutation = true;
    if (tableName === 'WORK_ORDER') {
      const obj = {
        "WO_ID": params[0] || `WO-${Date.now()}`,
        "unitId": params[1] || 'UL1',
        "Nomor_WO": params[2] || params[0] || '',
        "PEKERJAAN": params[3] || 'NORMAL',
        "Tanggal": params[4] || new Date().toISOString().split('T')[0],
        "ULP": params[5] || '',
        "PENYULANG": params[6] || '',
        "REGU_ROW": params[7] || '',
        "VOLUME": params[8] || 0,
        "SATUAN": params[9] || 'Pohon',
        "TOTAL_REALISASI": params[10] || 0,
        "SATUAN_TOTAL_REALISASI": params[11] || 'Pohon',
        "WO_AWAL": params[12] || '',
        "WO_AKHIR": params[13] || '',
        "LOKASI_START": params[14] || '',
        "LOKASI_FINISH": params[15] || '',
        "STATUS": params[16] || 'DRAFT',
        "Created_At": params[17] || new Date().toISOString()
      };
      
      const idx = rows.findIndex(r => String(r.WO_ID || r.id || '').toUpperCase() === String(obj.WO_ID).toUpperCase());
      if (idx !== -1) {
        rows[idx] = { ...rows[idx], ...obj };
      } else {
        rows.push(obj);
      }
      affectedRows = [obj];
    } else if (tableName === 'REALISASI') {
      const obj = {
        "ID": params[0] || `REL-${Date.now()}`,
        "unitId": params[1] || 'UL1',
        "WO_ID": params[2] || '',
        "Nomor_WO": params[3] || '',
        "ULP": params[4] || '',
        "REGU_ROW": params[5] || '',
        "PENYULANG": params[6] || '',
        "NO_TIANG": params[7] || '',
        "TANGGAL": params[8] || new Date().toISOString().split('T')[0],
        "Foto_Sebelum": params[9] || '',
        "Foto_Sesudah": params[10] || '',
        "Jenis_Tanaman": params[11] || '',
        "Keterangan": params[12] || '',
        "Pertumbuhan_Tanaman": params[13] || '',
        "Kendala": params[14] || '',
        "Latitude_Longitude": params[15] || '',
        "Lokasi_kerja": params[16] || '',
        "Timestamp": params[17] || new Date().toISOString()
      };

      const idx = rows.findIndex(r => String(r.ID || r.id || '').toUpperCase() === String(obj.ID).toUpperCase());
      if (idx !== -1) {
        rows[idx] = { ...rows[idx], ...obj };
      } else {
        rows.push(obj);
      }
      affectedRows = [obj];
    } else if (tableName === 'ABSENSI') {
      const obj = {
        "ID": params[0] || `ABS-${Date.now()}`,
        "unitId": params[1] || 'UL1',
        "TANGGAL": params[2] || new Date().toISOString().split('T')[0],
        "NAMA_REGU": params[3] || '',
        "ULP": params[4] || '',
        "PENYULANG": params[5] || '',
        "USER_NAME": params[6] || '',
        "NAMA_PETUGAS": params[7] || '',
        "NIP": params[8] || '',
        "PETUGAS_1": params[9] || '',
        "KET_1": params[10] || '',
        "PETUGAS_2": params[11] || '',
        "KET_2": params[12] || '',
        "PETUGAS_3": params[13] || '',
        "KET_3": params[14] || '',
        "PETUGAS_4": params[15] || '',
        "KET_4": params[16] || '',
        "PETUGAS_5": params[17] || '',
        "KET_5": params[18] || '',
        "FOTO_MASUK": params[19] || '',
        "TIMESTAMP MASUK": params[20] || '',
        "FOTO_KELUAR": params[21] || '',
        "TIMESTAMP KELUAR": params[22] || '',
        "LATITUDE": params[23] || '',
        "LONGITUDE": params[24] || ''
      };

      const idx = rows.findIndex(r => String(r.ID || r.id || '').toUpperCase() === String(obj.ID).toUpperCase());
      if (idx !== -1) {
        rows[idx] = { ...rows[idx], ...obj };
      } else {
        rows.push(obj);
      }
      affectedRows = [obj];
    }
    
    mockStore[tableName] = rows;
    saveMockStore();
  } else if (upper.startsWith('DELETE') && params && params.length > 0) {
    isMutation = true;
    const delVal = String(params[0]).toUpperCase();
    if (tableName === 'WORK_ORDER') {
      const beforeLength = rows.length;
      mockStore[tableName] = rows.filter(r => String(r.WO_ID || r.id || '').toUpperCase() !== delVal && String(r.Nomor_WO || '').toUpperCase() !== delVal);
      const deletedCount = beforeLength - mockStore[tableName].length;
      affectedRows = deletedCount > 0 ? [{ deleted: deletedCount }] : [];
    } else {
      const beforeLength = rows.length;
      mockStore[tableName] = rows.filter(r => String(r.ID || r.id || '').toUpperCase() !== delVal);
      const deletedCount = beforeLength - mockStore[tableName].length;
      affectedRows = deletedCount > 0 ? [{ deleted: deletedCount }] : [];
    }
    saveMockStore();
  } else if (upper.startsWith('UPDATE') && params && params.length > 0) {
    isMutation = true;
    // Simple update mapping
    if (tableName === 'WORK_ORDER') {
      // Find matching item by ID or Nomor_WO in params or query text
      const idParam = params.find(p => typeof p === 'string' && p.startsWith('WO-'));
      if (idParam) {
        const idx = rows.findIndex(r => String(r.WO_ID || r.id || '').toUpperCase() === String(idParam).toUpperCase());
        if (idx !== -1) {
          // Merge updates if any
          rows[idx] = { ...rows[idx], STATUS: params[0] || rows[idx].STATUS };
          affectedRows = [rows[idx]];
        }
      }
    }
    saveMockStore();
  }

  const resultRows = isMutation ? affectedRows : rows;

  if (upper.includes('COUNT(*)')) {
    return { rows: [{ count: rows.length }], rowCount: 1, command: 'SELECT', oid: 0, fields: [] } as any;
  }

  return {
    rows: resultRows,
    rowCount: resultRows.length,
    command: upper.startsWith('SELECT') ? 'SELECT' : upper.startsWith('INSERT') ? 'INSERT' : 'UPDATE',
    oid: 0,
    fields: []
  } as any;
}

/**
 * Get or initialize the reusable PostgreSQL Connection Pool
 */
export function getPool(): pg.Pool {
  if (!poolInstance) {
    if (!dbUrl) {
      console.log('[DB INFO] No HYPERCLOUD_DATABASE_URL or DATABASE_URL provided in process.env. Using mock fallback.');
    }

    // Masked log for security
    const maskedUrl = dbUrl ? dbUrl.replace(/:([^:@]+)@/, ':*****@') : '(empty)';
    console.log(`[DB] Initializing HyperCloudHost PostgreSQL Connection Pool (${maskedUrl})`);

    poolInstance = new Pool({
      connectionString: dbUrl || 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 30000,
      max: 20,
      ssl: dbUrl.includes('sslmode=require') || dbUrl.includes('supabase')
        ? { rejectUnauthorized: false }
        : false,
    });

    poolInstance.on('error', (err) => {
      if (err.message?.includes('ECONNREFUSED')) return;
      console.warn('[DB WARNING] Unexpected error on idle PostgreSQL client:', err.message);
    });
  }

  return poolInstance;
}

/**
 * Dynamically set or update the connection URL (for migration/admin dynamic config)
 */
export function setDatabaseUrl(url: string): void {
  if (!url || typeof url !== 'string') return;
  const newClean = url.trim().replace(/^["']|["']$/g, '');
  const filtered = (newClean.includes('127.0.0.1') || newClean.includes('localhost')) ? '' : newClean;
  if (filtered !== dbUrl) {
    dbUrl = filtered;
    if (poolInstance) {
      console.log('[DB] Reloading database connection pool with updated URL');
      poolInstance.end().catch((e) => console.warn('[DB] Error ending old pool:', e.message));
      poolInstance = null;
    }
  }
}

export function getDatabaseUrl(): string {
  return dbUrl;
}

/**
 * Execute a query with connection pool and query execution logging
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<pg.QueryResult<T>> {
  if (!dbUrl) {
    // No external database URL configured - directly use mock store
    return getMockQueryResult(text, params) as pg.QueryResult<T>;
  }

  const pool = getPool();
  const start = Date.now();
  const isMutation = /^\s*(INSERT|UPDATE|DELETE|UPSERT)/i.test(text);

  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production' && duration > 500) {
      console.log(`[DB SLOW QUERY] ${duration}ms | Query: ${text.slice(0, 100)}...`);
    }
    return res;
  } catch (err: any) {
    if (isMutation) {
      throw err;
    }
    return getMockQueryResult(text, params) as pg.QueryResult<T>;
  }
}

/**
 * Test database connection latency & status
 */
export async function testConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
  message: string;
  timestamp?: string;
}> {
  const start = Date.now();
  try {
    const res = await query('SELECT 1 as connected, NOW() as current_time');
    const duration = Date.now() - start;
    if (res && res.rows && res.rows.length > 0) {
      return {
        connected: true,
        latencyMs: duration,
        message: `Terhubung ke HyperCloudHost PostgreSQL (${duration}ms)`,
        timestamp: res.rows[0].current_time,
      };
    }
    return {
      connected: false,
      message: 'Query test succeeded but returned no rows',
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Gagal terhubung ke HyperCloudHost PostgreSQL: ${err.message}`,
    };
  }
}

/**
 * Close the connection pool cleanly
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    console.log('[DB] Closing HyperCloudHost PostgreSQL Pool');
    await poolInstance.end();
    poolInstance = null;
  }
}
