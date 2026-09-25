import axios from 'axios';
import { testConnection, getDatabaseUrl, HYPERCLOUD_API_URL, query, isLocalhostDbUrl } from '../server/database';

const TABLES = [
  'ABSENSI',
  'INISIASI',
  'LOG_ACTIVITY',
  'PENYULANG',
  'PETUGAS',
  'REALISASI',
  'REGU_ROW',
  'ULP',
  'USERS',
  'WORK_ORDER'
];

async function main() {
  console.log('=== APHRO HYPERCLOUD RUNTIME CHECK ===');
  const url = getDatabaseUrl();
  console.log('Database URL configured:', url ? 'YES' : 'NO');
  console.log('HyperCloudHost Gateway:', HYPERCLOUD_API_URL);

  const health = await testConnection();
  console.log('Health Check:', JSON.stringify(health, null, 2));
  if (!health.connected) {
    process.exitCode = 1;
    return;
  }

  // 1. If direct non-local PG is active, test SQL queries
  if (url && !isLocalhostDbUrl(url)) {
    console.log('\n--- Checking Direct PostgreSQL Tables ---');
    for (const table of TABLES) {
      try {
        const result = await query(
          `SELECT COUNT(*)::int AS count FROM public."${table}"`,
        );
        console.log(`${table}: ${result.rows[0]?.count ?? 0} records`);
      } catch (err: any) {
        console.warn(`${table}: Direct PG query failed (${err.message})`);
      }
    }
  }

  // 2. Check live HyperCloudHost API Gateway
  console.log('\n--- Checking HyperCloudHost Live API Gateway ---');
  try {
    const loginRes = await axios.post(`${HYPERCLOUD_API_URL}/api/login`, {
      Username: 'row01',
      Password: 'row123',
      unitId: 'UL2'
    }, { timeout: 6000 });

    const token = loginRes.data?.token;
    console.log('HyperCloudHost Auth: OK (Token acquired)');

    const tableEndpoints: Record<string, string> = {
      ABSENSI: '/api/absensi',
      INISIASI: '/api/inisiasi',
      PENYULANG: '/api/penyulang',
      PETUGAS: '/api/petugas',
      REALISASI: '/api/realisasi',
      REGU_ROW: '/api/regu-row',
      ULP: '/api/ulp',
      USERS: '/api/users',
      WORK_ORDER: '/api/work-orders',
    };

    for (const [tbl, ep] of Object.entries(tableEndpoints)) {
      try {
        const res = await axios.get(`${HYPERCLOUD_API_URL}${ep}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 5000,
          validateStatus: () => true
        });
        const count = res.data?.data?.length ?? res.data?.count ?? 0;
        console.log(`${tbl} (${ep}): status ${res.status} | ${count} records`);
      } catch (err: any) {
        console.error(`${tbl} (${ep}): ERROR - ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error('HyperCloudHost Live Gateway check error:', err.message);
  }
}

main().catch((err) => {
  console.error('[HYPERCLOUD CHECK FAILED]', err.message);
  process.exit(1);
});
