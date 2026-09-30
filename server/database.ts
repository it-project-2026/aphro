import pg from 'pg';
import axios from 'axios';

const { Pool } = pg;

export const HYPERCLOUD_API_URL = (
  process.env.HYPERCLOUD_API_URL ||
  process.env.VITE_API_URL ||
  'https://api.aphro-row.my.id'
).replace(/\/+$/, '');

/**
 * Prioritas Variabel Lingkungan:
 * 1. HYPERCLOUD_DATABASE_URL
  * 2. DATABASE_URL
 */
function resolveDatabaseUrl(): string {
  const envUrl = String(
    process.env.HYPERCLOUD_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  return envUrl;
}

let dbUrl = resolveDatabaseUrl();
let poolInstance: pg.Pool | null = null;
let directPgFailed = false;
let lastPgFailTime = 0;
const PG_RECOVERY_COOLDOWN_MS = 60000; // 60 detik cooldown pemulihan otomatis

/**
 * Memeriksa apakah URL koneksi merujuk pada IP loopback / localhost
 */
export function isLocalhostDbUrl(url: string): boolean {
  if (!url) return true;
  return url.includes('127.0.0.1') || url.includes('localhost');
}

/**
 * Memeriksa secara spesifik apakah kesalahan merupakan kesalahan koneksi jaringan TCP murni
 * (Bukan kesalahan sintaks SQL, constraint violation, atau autentikasi).
 */
export function isNetworkConnectionError(err: any): boolean {
  const code = String(err?.code || '').toUpperCase();
  const msg = String(err?.message || err || '').toUpperCase();
  return (
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('CONNECT ETIMEDOUT') ||
    msg.includes('CONNECTION TIMEOUT') ||
    msg.includes('CONNECTION CLOSED') ||
    msg.includes('TERMINATING CONNECTION') ||
    msg.includes('57P01') ||
    msg.includes('57P02') ||
    msg.includes('57P03')
  );
}

/**
 * Mengembalikan atau menginisialisasi PostgreSQL Connection Pool.
 * Menggunakan pemulihan otomatis setelah cooldown 60 detik jika terjadi kegagalan sementara.
 */
export function getPool(): pg.Pool | null {
  // Cooldown Auto-Recovery: Jika sudah lewat 60 detik dari kegagalan terakhir, beri kesempatan coba ulang
  if (directPgFailed) {
    if (Date.now() - lastPgFailTime > PG_RECOVERY_COOLDOWN_MS) {
      console.log('[DB RECOVERY] Cooldown 60s selesai. Mencoba ulang koneksi Direct PostgreSQL...');
      directPgFailed = false;
    } else {
      return null;
    }
  }

  // Pada lingkungan preview/dev lokal (yang bukan VPS produksi), jika URL adalah localhost 127.0.0.1
  // dan port 5432 tidak aktif lokal, abaikan koneksi direct TCP agar tidak memicu log ECONNREFUSED berulang.
  if (process.env.NODE_ENV !== 'production' && isLocalhostDbUrl(dbUrl)) {
    return null;
  }

  if (!poolInstance) {
    if (!dbUrl) {
      return null;
    }

    // Masking kredensial rahasia untuk log keamanan
    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':*****@');
    console.log(`[DB] Menginisialisasi HyperCloudHost PostgreSQL Connection Pool (${maskedUrl})`);

    try {
      poolInstance = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 30000,
        max: 10,
        ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      });

      poolInstance.on('error', (err) => {
        if (isNetworkConnectionError(err)) {
          directPgFailed = true;
          lastPgFailTime = Date.now();
          console.warn('[DB WARNING] Kegagalan jaringan koneksi Direct PostgreSQL:', err.message);
        } else {
          console.warn('[DB CLIENT WARNING] Peringatan klien PostgreSQL:', err.message);
        }
      });
    } catch (e: any) {
      console.warn('[DB ERROR] Gagal mengonstruksi PostgreSQL Pool:', e.message);
      directPgFailed = true;
      lastPgFailTime = Date.now();
      return null;
    }
  }

  return poolInstance;
}

/**
 * Mengubah secara dinamis URL koneksi
 */
export function setDatabaseUrl(url: string): void {
  if (!url || typeof url !== 'string') return;
  const newClean = url.trim().replace(/^["']|["']$/g, '');
  if (newClean !== dbUrl) {
    dbUrl = newClean;
    directPgFailed = false;
    lastPgFailTime = 0;
    if (poolInstance) {
      console.log('[DB] Memuat ulang database connection pool dengan URL baru');
      poolInstance.end().catch(() => {});
      poolInstance = null;
    }
  }
}

export function getDatabaseUrl(): string {
  return dbUrl;
}

/**
 * Menjalankan SQL query melalui connection pool dengan klasifikasi kesalahan ketat
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<pg.QueryResult<T>> {
  const pool = getPool();

  if (pool && !directPgFailed) {
    const start = Date.now();
    try {
      const res = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      if (process.env.NODE_ENV !== 'production' && duration > 500) {
        console.log(`[DB SLOW QUERY] ${duration}ms | Query: ${text.slice(0, 160)}...`);
      }
      return res;
    } catch (err: any) {
      if (isNetworkConnectionError(err)) {
        directPgFailed = true;
        lastPgFailTime = Date.now();
        console.warn(`[DB QUERY WARNING] Direct query gagal karena koneksi jaringan (${err.message}), beralih ke Gateway.`);
      } else {
        console.error(`[DB SQL ERROR] Direct SQL query melempar kesalahan sintaks/data: ${err.message}`);
      }
      throw err;
    }
  }

  throw new Error('Koneksi langsung TCP PostgreSQL sedang tidak tersedia. Layanan dialihkan ke HyperCloudHost API Gateway.');
}

/**
 * Menguji status dan latensi koneksi database (Direct PG & API Gateway)
 */
export async function testConnection(): Promise<{
  connected: boolean;
  source: 'DIRECT_POSTGRESQL' | 'HYPERCLOUD_GATEWAY';
  latencyMs?: number;
  message: string;
  timestamp?: string;
  database?: string;
}> {
  const start = Date.now();

  // 1. Uji koneksi Direct PG jika pool dapat dibuat dan tidak dalam status failed
  const pool = getPool();
  if (pool && !directPgFailed) {
    try {
      const res = await pool.query('SELECT 1 as connected, NOW() as current_time');
      const duration = Date.now() - start;
      if (res && res.rows && res.rows.length > 0) {
        return {
          connected: true,
          source: 'DIRECT_POSTGRESQL',
          latencyMs: duration,
          message: `Terhubung langsung ke HyperCloudHost PostgreSQL via Direct TCP (${duration}ms)`,
          timestamp: String(res.rows[0].current_time),
          database: 'meysxysd_aphro',
        };
      }
    } catch (err: any) {
      if (isNetworkConnectionError(err)) {
        directPgFailed = true;
        lastPgFailTime = Date.now();
      }
    }
  }

  // 2. Uji ketersediaan API Gateway
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && HYPERCLOUD_API_URL && !HYPERCLOUD_API_URL.includes('localhost') && !HYPERCLOUD_API_URL.includes('127.0.0.1')) {
    try {
      const res = await axios.get(`${HYPERCLOUD_API_URL}/api/health`, {
        timeout: 4000,
        validateStatus: () => true,
      });
      const duration = Date.now() - start;
      if (res.status === 200 && (res.data?.status === 'ok' || res.data?.database === 'connected' || res.data?.ok)) {
        return {
          connected: true,
          source: 'HYPERCLOUD_GATEWAY',
          latencyMs: duration,
          message: `Terhubung ke Database HyperCloudHost PostgreSQL (${res.data.databaseName || 'meysxysd_aphro'}) via Gateway`,
          timestamp: res.data.timestamp || new Date().toISOString(),
          database: res.data.databaseName || 'meysxysd_aphro',
        };
      }
    } catch (err: any) {
      console.warn('[DB] Peringatan pemeriksaan kesehatan HyperCloudHost API Gateway:', err.message);
    }
  }

  return {
    connected: false,
    source: 'HYPERCLOUD_GATEWAY',
    message: 'Gagal terhubung ke HyperCloudHost Database atau API Gateway',
  };
}

/**
 * Menutup pool koneksi secara bersih
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    console.log('[DB] Mematikan HyperCloudHost PostgreSQL Pool');
    await poolInstance.end().catch(() => {});
    poolInstance = null;
  }
}
