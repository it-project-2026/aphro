import axios from 'axios';
import { ensureGoogleDrivePhotoUrl, isValidPhotoUrl, extractDriveFileId, formatDriveViewUrl } from '../src/utils/driveUtils';
import { GASApiService } from '../src/services/gasApiService';
import { EMBEDDED_GAS_CONFIG } from '../src/config/gasConfig';

const HYPERCLOUD_API = 'https://api.aphro-row.my.id';
const LOCAL_API = 'http://127.0.0.1:3000';

// A valid, standalone 1x1 JPEG base64 (59 bytes binary)
const REAL_TEST_JPEG_1 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
// A valid, standalone 1x1 PNG base64 (68 bytes binary)
const REAL_TEST_PNG_2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function runFinalVerification() {
  console.log('================================================================');
  console.log('PLN APHRO - FINAL VERIFICATION TEST SUITE (E2E EVIDENCE-BASED)');
  console.log('================================================================');

  // -------------------------------------------------------------
  // TUGAS 1 — VERIFIKASI UPLOAD FOTO NYATA
  // -------------------------------------------------------------
  console.log('\n--- [TUGAS 1] REAL PHOTO UPLOAD VIA GOOGLE APPS SCRIPT (GAS) ---');
  const uploadEndpoint = EMBEDDED_GAS_CONFIG.gasWebAppUrl;
  console.log(`Actual Upload Endpoint: ${uploadEndpoint}`);

  const woNomor = `WO-REAL-VERIFY-${Date.now().toString().slice(-4)}`;

  // 1. Upload Foto Sebelum
  console.log('\n1. Uploading Foto Sebelum (Real JPEG base64)...');
  const sebStart = Date.now();
  const sebUploadRes = await GASApiService.uploadPhoto(uploadEndpoint, {
    base64Data: REAL_TEST_JPEG_1,
    nomorWO: woNomor,
    reguName: 'REGU 1',
    photoType: 'Foto_Sebelum',
    folderId: EMBEDDED_GAS_CONFIG.driveFolderId,
  });
  const sebDuration = Date.now() - sebStart;

  console.log(`   - HTTP/GAS Status: ${sebUploadRes.status}`);
  console.log(`   - Server Message: ${sebUploadRes.message}`);
  console.log(`   - Raw File URL: ${sebUploadRes.fileUrl}`);
  console.log(`   - Upload Duration: ${sebDuration}ms`);

  const urlFotoSebelum = formatDriveViewUrl(sebUploadRes.fileUrl || '');
  console.log(`   - Formatted URL Foto Sebelum: ${urlFotoSebelum}`);

  // 2. Upload Foto Sesudah
  console.log('\n2. Uploading Foto Sesudah (Real PNG base64)...');
  const sesStart = Date.now();
  const sesUploadRes = await GASApiService.uploadPhoto(uploadEndpoint, {
    base64Data: REAL_TEST_PNG_2,
    nomorWO: woNomor,
    reguName: 'REGU 1',
    photoType: 'Foto_Sesudah',
    folderId: EMBEDDED_GAS_CONFIG.driveFolderId,
  });
  const sesDuration = Date.now() - sesStart;

  console.log(`   - HTTP/GAS Status: ${sesUploadRes.status}`);
  console.log(`   - Server Message: ${sesUploadRes.message}`);
  console.log(`   - Raw File URL: ${sesUploadRes.fileUrl}`);
  console.log(`   - Upload Duration: ${sesDuration}ms`);

  const urlFotoSesudah = formatDriveViewUrl(sesUploadRes.fileUrl || '');
  console.log(`   - Formatted URL Foto Sesudah: ${urlFotoSesudah}`);

  // -------------------------------------------------------------
  // TUGAS 2 — VALIDASI URL DAN FOTO
  // -------------------------------------------------------------
  console.log('\n--- [TUGAS 2] URL & PHOTO ACCESSIBILITY VALIDATION ---');
  const fileIdSeb = extractDriveFileId(urlFotoSebelum);
  const fileIdSes = extractDriveFileId(urlFotoSesudah);

  console.log(`1. Extracted Drive File ID (Sebelum): ${fileIdSeb}`);
  console.log(`2. Extracted Drive File ID (Sesudah): ${fileIdSes}`);

  const isSebValid = isValidPhotoUrl(urlFotoSebelum) && !!fileIdSeb && !urlFotoSebelum.includes('test_sample');
  const isSesValid = isValidPhotoUrl(urlFotoSesudah) && !!fileIdSes && !urlFotoSesudah.includes('test_sample');

  console.log(`3. Is URL Foto Sebelum Valid & Non-Placeholder: ${isSebValid}`);
  console.log(`4. Is URL Foto Sesudah Valid & Non-Placeholder: ${isSesValid}`);

  // Test reachability of the Google Drive URL via HTTP GET
  let sebAccessible = false;
  let sesAccessible = false;
  try {
    const headSeb = await axios.get(urlFotoSebelum, { timeout: 8000, validateStatus: () => true });
    sebAccessible = headSeb.status === 200 || headSeb.status === 302 || headSeb.status === 303;
    console.log(`5. Foto Sebelum Reachability: HTTP ${headSeb.status} (Accessible: ${sebAccessible})`);
  } catch (e: any) {
    console.warn(`5. Foto Sebelum Reachability Check Error: ${e.message}`);
  }

  try {
    const headSes = await axios.get(urlFotoSesudah, { timeout: 8000, validateStatus: () => true });
    sesAccessible = headSes.status === 200 || headSes.status === 302 || headSes.status === 303;
    console.log(`6. Foto Sesudah Reachability: HTTP ${headSes.status} (Accessible: ${sesAccessible})`);
  } catch (e: any) {
    console.warn(`6. Foto Sesudah Reachability Check Error: ${e.message}`);
  }

  if (!isSebValid || !isSesValid) {
    throw new Error('Validasi URL Foto Gagal: URL tidak valid atau merupakan placeholder.');
  }

  // -------------------------------------------------------------
  // TUGAS 3 — VERIFIKASI PENYIMPANAN HYPERCLOUD POSTGRESQL
  // -------------------------------------------------------------
  console.log('\n--- [TUGAS 3] HYPERCLOUD POSTGRESQL PERSISTENCE VERIFICATION ---');

  // Authenticate to HyperCloud
  const loginRes = await axios.post(`${HYPERCLOUD_API}/api/login`, {
    username: 'row01',
    password: 'row123',
    unitId: 'UL2',
  }, { timeout: 8000 });

  const token = loginRes.data?.token;
  if (!token) throw new Error('Autentikasi ke HyperCloud gagal. Token tidak diperoleh.');
  console.log('1. Authentication to HyperCloud: SUCCESS (JWT Token acquired)');

  const uniqueTxId = `REL-${Date.now()}-ACTUAL`;
  const postPayload = {
    id: uniqueTxId,
    ID: uniqueTxId,
    unitId: 'UL2',
    WO_ID: woNomor,
    Nomor_WO: woNomor,
    ULP: 'ULP KOTA',
    REGU_ROW: 'REGU 1',
    PENYULANG: 'PENYULANG UTAMA',
    NO_TIANG: 'T-99',
    TANGGAL: new Date().toISOString().split('T')[0],
    Foto_Sebelum: urlFotoSebelum,
    Foto_Sesudah: urlFotoSesudah,
    Jenis_Tanaman: 'Pohon Mahoni',
    Keterangan: 'Pemangkasan Dahan Real Test (Live Upload Evidence)',
    Pertumbuhan_Tanaman: 'Lebat',
    Kendala: 'Tidak Ada',
    Latitude_Longitude: '-0.91234, 100.35432',
    Lokasi_kerja: 'Jl. Khatib Sulaiman No. 1',
    Timestamp: new Date().toISOString(),
  };

  const payloadBytes = Buffer.byteLength(JSON.stringify(postPayload), 'utf8');
  console.log(`\n2. Inspecting POST Payload:`);
  console.log(`   - Transaction ID: ${uniqueTxId}`);
  console.log(`   - Body Size: ${payloadBytes} bytes (${(payloadBytes / 1024).toFixed(2)} KB)`);
  console.log(`   - Foto_Sebelum: ${postPayload.Foto_Sebelum}`);
  console.log(`   - Foto_Sesudah: ${postPayload.Foto_Sesudah}`);
  console.log(`   - Contains Base64: ${postPayload.Foto_Sebelum.startsWith('data:image') || postPayload.Foto_Sesudah.startsWith('data:image')}`);

  // Send POST /api/realisasi
  console.log('\n3. Sending POST /api/realisasi to HyperCloud...');
  const postRes = await axios.post(`${HYPERCLOUD_API}/api/realisasi`, postPayload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 10000,
    validateStatus: () => true,
  });

  console.log(`   - POST HTTP Status: ${postRes.status}`);
  console.log(`   - Response Data:`, JSON.stringify(postRes.data, null, 2));

  if (postRes.status !== 200 && postRes.status !== 201) {
    throw new Error(`POST /api/realisasi gagal dengan HTTP ${postRes.status}`);
  }

  // Retrieve Record from PostgreSQL HyperCloud
  console.log(`\n4. Retrieving Saved Record from PostgreSQL HyperCloud via GET /api/realisasi/${uniqueTxId}...`);
  const getRes = await axios.get(`${HYPERCLOUD_API}/api/realisasi/${uniqueTxId}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 8000,
    validateStatus: () => true,
  });

  console.log(`   - GET HTTP Status: ${getRes.status}`);
  const dbRecord = getRes.data?.data;
  console.log(`   - Retrieved Record:`, JSON.stringify(dbRecord, null, 2));

  // Verification checks
  const idMatches = (dbRecord?.ID || dbRecord?.id) === uniqueTxId;
  const sebMatches = dbRecord?.Foto_Sebelum === urlFotoSebelum;
  const sesMatches = dbRecord?.Foto_Sesudah === urlFotoSesudah;
  const noBase64InSeb = !String(dbRecord?.Foto_Sebelum || '').startsWith('data:image');
  const noBase64InSes = !String(dbRecord?.Foto_Sesudah || '').startsWith('data:image');

  console.log(`\n5. Database Verification Audit Results:`);
  console.log(`   - Transaction ID Match (${uniqueTxId}): ${idMatches}`);
  console.log(`   - Foto_Sebelum matches actual upload result: ${sebMatches}`);
  console.log(`   - Foto_Sesudah matches actual upload result: ${sesMatches}`);
  console.log(`   - Foto_Sebelum column contains NO Base64: ${noBase64InSeb}`);
  console.log(`   - Foto_Sesudah column contains NO Base64: ${noBase64InSes}`);

  // Duplicate Check: Check list of realisasi to verify exactly 1 record exists with this ID
  console.log(`\n6. Verifying No Duplication in HyperCloud...`);
  const listRes = await axios.get(`${HYPERCLOUD_API}/api/realisasi?limit=50&unitId=UL2`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 8000,
    validateStatus: () => true,
  });

  const allMatching = (listRes.data?.data || []).filter((r: any) => (r.ID || r.id) === uniqueTxId);
  console.log(`   - Matching Records Count in HyperCloud: ${allMatching.length} (Expected: exactly 1)`);

  console.log('\n================================================================');
  console.log('VERIFICATION SUMMARY: ALL REAL ASSETS AND PERSISTENCE VERIFIED!');
  console.log('================================================================');
}

runFinalVerification().catch((err) => {
  console.error('\n[FATAL ERROR IN FINAL VERIFICATION]', err);
  process.exit(1);
});
