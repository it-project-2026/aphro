import axios from 'axios';
import { GASApiService } from '../src/services/gasApiService';
import { EMBEDDED_GAS_CONFIG } from '../src/config/gasConfig';
import { ensureGoogleDrivePhotoUrl } from '../src/utils/driveUtils';

const HYPERCLOUD_API = 'https://api.aphro-row.my.id';
const gasUrl = EMBEDDED_GAS_CONFIG.gasWebAppUrl;
const folderId = EMBEDDED_GAS_CONFIG.driveFolderId;

// Standard 1x1 test image base64 (59 bytes)
const REAL_TEST_JPEG_1 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const REAL_TEST_PNG_2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runPerformanceAudit() {
  console.log('================================================================');
  console.log('PLN APHRO - DETAILED REALISASI PERFORMANCE AUDIT BENCHMARK');
  console.log('================================================================');

  // 1. Authenticate
  const loginStart = performance.now();
  const loginRes = await axios.post(`${HYPERCLOUD_API}/api/login`, {
    username: 'row01',
    password: 'row123',
    unitId: 'UL2',
  }, { timeout: 8000 });
  const loginTime = (performance.now() - loginStart).toFixed(2);
  const token = loginRes.data?.token;
  console.log(`1. HyperCloud Authentication Time: ${loginTime}ms (Token acquired)`);

  // 2. Measure /api/media/upload-photo (Strategy A fallback check)
  console.log('\n2. Testing /api/media/upload-photo endpoint latency:');
  const mediaStart = performance.now();
  try {
    const mediaRes = await axios.post(`${HYPERCLOUD_API}/api/media/upload-photo`, {
      base64Data: REAL_TEST_JPEG_1,
      nomorWO: 'WO-PERF-TEST',
      photoType: 'Realisasi_Sebelum',
    }, {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
      timeout: 5000,
    });
    const mediaTime = (performance.now() - mediaStart).toFixed(2);
    console.log(`   - Status: HTTP ${mediaRes.status}`);
    console.log(`   - Time wasted if Strategy A is queried first: ${mediaTime}ms`);
  } catch (err: any) {
    const mediaTime = (performance.now() - mediaStart).toFixed(2);
    console.log(`   - Error: ${err.message} (${mediaTime}ms)`);
  }

  // 3. Measure SEQUENTIAL Google Apps Script Upload (Current flow)
  console.log('\n3. Measuring SEQUENTIAL Google Apps Script Upload:');
  const seqStart = performance.now();

  const sebStart = performance.now();
  const sebUploadRes = await GASApiService.uploadPhoto(gasUrl, {
    base64Data: REAL_TEST_JPEG_1,
    nomorWO: 'WO-PERF-TEST',
    reguName: 'REGU 1',
    photoType: 'Realisasi_Sebelum',
    folderId,
  });
  const sebUploadTime = performance.now() - sebStart;
  console.log(`   - Upload Foto Sebelum (GAS): ${sebUploadTime.toFixed(2)}ms (URL: ${sebUploadRes.fileUrl})`);

  const sesStart = performance.now();
  const sesUploadRes = await GASApiService.uploadPhoto(gasUrl, {
    base64Data: REAL_TEST_PNG_2,
    nomorWO: 'WO-PERF-TEST',
    reguName: 'REGU 1',
    photoType: 'Realisasi_Sesudah',
    folderId,
  });
  const sesUploadTime = performance.now() - sesStart;
  console.log(`   - Upload Foto Sesudah (GAS): ${sesUploadTime.toFixed(2)}ms (URL: ${sesUploadRes.fileUrl})`);

  const totalSequentialUploadTime = performance.now() - seqStart;
  console.log(`   >>> TOTAL SEQUENTIAL UPLOAD TIME: ${totalSequentialUploadTime.toFixed(2)}ms <<<`);

  // 4. Measure PARALLEL Google Apps Script Upload (Optimized flow)
  console.log('\n4. Measuring PARALLEL Google Apps Script Upload (Promise.all):');
  const parStart = performance.now();
  const [parSebRes, parSesRes] = await Promise.all([
    GASApiService.uploadPhoto(gasUrl, {
      base64Data: REAL_TEST_JPEG_1,
      nomorWO: 'WO-PERF-TEST-PAR',
      reguName: 'REGU 1',
      photoType: 'Realisasi_Sebelum',
      folderId,
    }),
    GASApiService.uploadPhoto(gasUrl, {
      base64Data: REAL_TEST_PNG_2,
      nomorWO: 'WO-PERF-TEST-PAR',
      reguName: 'REGU 1',
      photoType: 'Realisasi_Sesudah',
      folderId,
    }),
  ]);
  const totalParallelUploadTime = performance.now() - parStart;
  console.log(`   - Parallel Upload Foto Sebelum: URL=${parSebRes.fileUrl}`);
  console.log(`   - Parallel Upload Foto Sesudah: URL=${parSesRes.fileUrl}`);
  console.log(`   >>> TOTAL PARALLEL UPLOAD TIME: ${totalParallelUploadTime.toFixed(2)}ms <<<`);
  console.log(`   >>> TIME SAVED BY PARALLELIZATION: ${(totalSequentialUploadTime - totalParallelUploadTime).toFixed(2)}ms <<<`);

  // 5. Measure HyperCloud POST /api/realisasi Latency
  console.log('\n5. Measuring HyperCloud POST /api/realisasi Latency:');
  const testRelId = `REL-${Date.now()}-PERFAUDIT`;
  const postPayload = {
    id: testRelId,
    ID: testRelId,
    unitId: 'UL2',
    WO_ID: 'WO-PERF-TEST',
    Nomor_WO: 'WO-PERF-TEST',
    ULP: 'ULP KOTA',
    REGU_ROW: 'REGU 1',
    PENYULANG: 'PENYULANG UTAMA',
    NO_TIANG: 'T-01',
    TANGGAL: new Date().toISOString().split('T')[0],
    Foto_Sebelum: parSebRes.fileUrl,
    Foto_Sesudah: parSesRes.fileUrl,
    Jenis_Tanaman: 'Pohon Sawit',
    Keterangan: 'Penebangan Performance Audit',
    Pertumbuhan_Tanaman: 'Sedang',
    Kendala: 'Tidak Ada',
    Timestamp: new Date().toISOString(),
  };

  const postStart = performance.now();
  const postRes = await axios.post(`${HYPERCLOUD_API}/api/realisasi`, postPayload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 8000,
  });
  const postTime = (performance.now() - postStart).toFixed(2);
  console.log(`   - POST /api/realisasi HTTP Status: ${postRes.status}`);
  console.log(`   - POST /api/realisasi Duration: ${postTime}ms`);

  // Clean up the created test record
  await axios.delete(`${HYPERCLOUD_API}/api/realisasi/${testRelId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log('\n================================================================');
  console.log('SUMMARY OF PERFORMANCE BREAKDOWN (ACTUAL MEASURED TIMINGS):');
  console.log(`- Upload Foto Sebelum (GAS): ${sebUploadTime.toFixed(2)}ms`);
  console.log(`- Upload Foto Sesudah (GAS): ${sesUploadTime.toFixed(2)}ms`);
  console.log(`- Total Upload Sequential: ${totalSequentialUploadTime.toFixed(2)}ms`);
  console.log(`- Total Upload Parallel: ${totalParallelUploadTime.toFixed(2)}ms`);
  console.log(`- POST /api/realisasi HyperCloud: ${postTime}ms`);
  console.log('================================================================');
}

runPerformanceAudit().catch(console.error);
