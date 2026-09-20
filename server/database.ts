import pg from 'pg';

const { Pool } = pg;

// Priority: HYPERCLOUD_DATABASE_URL || DATABASE_URL
let dbUrl = process.env.HYPERCLOUD_DATABASE_URL || process.env.DATABASE_URL || '';

// Clean up quotes or whitespace
dbUrl = dbUrl.trim().replace(/^["']|["']$/g, '');

// Internal reference to pool instance
let poolInstance: pg.Pool | null = null;

/**
 * Get or initialize the reusable PostgreSQL Connection Pool
 */
export function getPool(): pg.Pool {
  if (!poolInstance) {
    if (!dbUrl) {
      console.warn('[DB WARNING] No HYPERCLOUD_DATABASE_URL or DATABASE_URL provided in process.env');
    }

    // Masked log for security
    const maskedUrl = dbUrl ? dbUrl.replace(/:([^:@]+)@/, ':*****@') : '(empty)';
    console.log(`[DB] Initializing HyperCloudHost PostgreSQL Connection Pool (${maskedUrl})`);

    poolInstance = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      max: 20,
      ssl: dbUrl.includes('sslmode=require') || dbUrl.includes('supabase')
        ? { rejectUnauthorized: false }
        : false,
    });

    poolInstance.on('error', (err) => {
      console.error('[DB ERROR] Unexpected error on idle PostgreSQL client:', err.message);
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
  if (newClean && newClean !== dbUrl) {
    dbUrl = newClean;
    if (poolInstance) {
      console.log('[DB] Closing existing pool to reload with new DATABASE_URL');
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
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production' && duration > 500) {
      console.log(`[DB SLOW QUERY] ${duration}ms | Query: ${text.slice(0, 100)}...`);
    }
    return res;
  } catch (err: any) {
    console.error(`[DB QUERY ERROR] Query failed: ${err.message} | Query: ${text.slice(0, 100)}...`);
    throw err;
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
