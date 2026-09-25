import pg from 'pg';
import axios from 'axios';

const { Pool } = pg;

export const HYPERCLOUD_API_URL = (
  process.env.HYPERCLOUD_API_URL ||
  process.env.VITE_API_URL ||
  'https://api.aphro-row.my.id'
).replace(/\/+$/, '');

let rawUrl = String(
  process.env.HYPERCLOUD_DATABASE_URL ||
  process.env.DATABASE_URL ||
  ''
).trim().replace(/^["']|["']$/g, '');

let dbUrl = rawUrl;
let poolInstance: pg.Pool | null = null;
let directPgFailed = false;

/**
 * Check if the database URL points to a local host where pg might not be listening
 */
export function isLocalhostDbUrl(url: string): boolean {
  if (!url) return true;
  return url.includes('127.0.0.1') || url.includes('localhost');
}

/**
 * Get or initialize the reusable PostgreSQL Connection Pool
 */
export function getPool(): pg.Pool | null {
  if (directPgFailed) return null;

  if (!poolInstance) {
    if (!dbUrl) {
      return null;
    }

    // Masked log for security
    const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':*****@');
    console.log(`[DB] Initializing HyperCloudHost PostgreSQL Connection Pool (${maskedUrl})`);

    try {
      poolInstance = new Pool({
        connectionString: dbUrl,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 30000,
        max: 10,
        ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
      });

      poolInstance.on('error', (err) => {
        if (err.message?.includes('ECONNREFUSED')) {
          directPgFailed = true;
          return;
        }
        console.warn('[DB WARNING] Error on PostgreSQL client:', err.message);
      });
    } catch (e: any) {
      console.warn('[DB] Failed to construct PostgreSQL Pool:', e.message);
      directPgFailed = true;
      return null;
    }
  }

  return poolInstance;
}

/**
 * Dynamically set or update the connection URL
 */
export function setDatabaseUrl(url: string): void {
  if (!url || typeof url !== 'string') return;
  const newClean = url.trim().replace(/^["']|["']$/g, '');
  if (newClean !== dbUrl) {
    dbUrl = newClean;
    directPgFailed = false;
    if (poolInstance) {
      console.log('[DB] Reloading database connection pool with updated URL');
      poolInstance.end().catch(() => {});
      poolInstance = null;
    }
  }
}

export function getDatabaseUrl(): string {
  return dbUrl;
}

/**
 * Execute a query with connection pool
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
      if (err.message?.includes('ECONNREFUSED')) {
        directPgFailed = true;
      } else {
        console.error(`[DB QUERY ERROR] ${err.message}`);
      }
      throw err;
    }
  }

  throw new Error('Database direct TCP connection is unavailable. Operations are serviced via HyperCloudHost API Gateway.');
}

/**
 * Test database connection latency & status across Direct PG and HyperCloudHost Gateway
 */
export async function testConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
  message: string;
  timestamp?: string;
  database?: string;
}> {
  const start = Date.now();

  // 1. If direct external DB URL is provided and not flagged as failed, try direct PG query
  if (dbUrl && !isLocalhostDbUrl(dbUrl) && !directPgFailed) {
    try {
      const res = await query('SELECT 1 as connected, NOW() as current_time');
      const duration = Date.now() - start;
      if (res && res.rows && res.rows.length > 0) {
        return {
          connected: true,
          latencyMs: duration,
          message: `Terhubung ke HyperCloudHost PostgreSQL (${duration}ms)`,
          timestamp: res.rows[0].current_time,
          database: 'meysxysd_aphro',
        };
      }
    } catch {
      directPgFailed = true;
    }
  }

  // 2. Check HyperCloudHost live API Gateway
  try {
    const res = await axios.get(`${HYPERCLOUD_API_URL}/api/health`, {
      timeout: 4000,
      validateStatus: () => true,
    });
    const duration = Date.now() - start;
    if (res.status === 200 && (res.data?.status === 'ok' || res.data?.database === 'connected' || res.data?.ok)) {
      return {
        connected: true,
        latencyMs: duration,
        message: `Terhubung ke Database HyperCloudHost PostgreSQL (${res.data.databaseName || 'meysxysd_aphro'}) via Gateway`,
        timestamp: res.data.timestamp || new Date().toISOString(),
        database: res.data.databaseName || 'meysxysd_aphro',
      };
    }
  } catch (err: any) {
    console.warn('[DB] HyperCloudHost API Gateway health check error:', err.message);
  }

  return {
    connected: false,
    message: 'Gagal terhubung ke HyperCloudHost Database atau API Gateway',
  };
}

/**
 * Close the connection pool cleanly
 */
export async function closePool(): Promise<void> {
  if (poolInstance) {
    console.log('[DB] Closing HyperCloudHost PostgreSQL Pool');
    await poolInstance.end().catch(() => {});
    poolInstance = null;
  }
}
