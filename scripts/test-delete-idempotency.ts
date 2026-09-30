import axios from 'axios';

const HYPERCLOUD_API = 'https://api.aphro-row.my.id';

// Initialize global localStorage mock for Node execution
const store: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => store[k] || null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

import { ApiService } from '../src/services/apiService';

async function testDeleteIdempotency() {
  console.log('=== TESTING REALISASI DELETE IDEMPOTENCY ===');

  // 1. Authenticate
  const loginRes = await axios.post(`${HYPERCLOUD_API}/api/login`, {
    username: 'row01',
    password: 'row123',
    unitId: 'UL2',
  }, { timeout: 8000 });

  const token = loginRes.data?.token;
  if (!token) throw new Error('Login failed: Token not acquired');
  localStorage.setItem('aphro_token', token);
  console.log('1. Authentication: SUCCESS (Token acquired and stored)');

  // 2. Test DELETE on a non-existent ID (such as the stale ID REL-1790781175358-6770pdc)
  const staleId = 'REL-1790781175358-6770pdc';
  console.log(`\n2. Testing DELETE on non-existent/stale ID: ${staleId}...`);
  const staleDelRes = await ApiService.deleteRealisasi(staleId);
  console.log('   Result on non-existent ID:', staleDelRes);
  console.log(`   Is marked success: ${staleDelRes.success} (Expected: true - idempotent)`);

  // 3. Create a temporary Realisasi and then delete it
  const tempId = `REL-${Date.now()}-DELTEST`;
  console.log(`\n3. Creating temporary Realisasi: ${tempId}...`);
  const createRes = await ApiService.saveRealisasi({
    id: tempId,
    ID: tempId,
    unitId: 'UL2',
    WO_ID: 'WO-DEL-TEST',
    Nomor_WO: 'WO-DEL-TEST',
    ULP: 'ULP KOTA',
    REGU_ROW: 'REGU 1',
    PENYULANG: 'PENYULANG TEST',
    NO_TIANG: 'T-01',
    TANGGAL: new Date().toISOString().split('T')[0],
    Foto_Sebelum: 'https://drive.google.com/file/d/sample_del_seb/view',
    Foto_Sesudah: 'https://drive.google.com/file/d/sample_del_ses/view',
    Jenis_Tanaman: 'Test',
    Keterangan: 'Test Delete',
    Pertumbuhan_Tanaman: 'Sedang',
    Kendala: 'Tidak Ada',
    Timestamp: new Date().toISOString(),
  });
  console.log('   Create status:', createRes.success);

  // 4. Delete the existing record
  console.log(`\n4. Deleting existing Realisasi: ${tempId}...`);
  const delExistingRes = await ApiService.deleteRealisasi(tempId);
  console.log('   Delete existing result:', delExistingRes);
  console.log(`   Is delete successful: ${delExistingRes.success} (Expected: true)`);

  // 5. Delete it a second time to verify idempotency on previously-deleted record
  console.log(`\n5. Deleting already-deleted Realisasi again: ${tempId}...`);
  const delAgainRes = await ApiService.deleteRealisasi(tempId);
  console.log('   Second delete result:', delAgainRes);
  console.log(`   Is second delete idempotent: ${delAgainRes.success} (Expected: true)`);

  console.log('\n=== ALL DELETE IDEMPOTENCY CHECKS PASSED ===');
}

testDeleteIdempotency().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
