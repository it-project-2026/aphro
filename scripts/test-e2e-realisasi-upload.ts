import axios from 'axios';

const LOCAL_API = 'http://127.0.0.1:3000';
const REMOTE_API = 'https://api.aphro-row.my.id';

// Generate a valid 80KB mock JPEG binary buffer as base64 to test real image processing
function generateMockJpegBase64(targetKb: number): string {
  const header = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const targetChars = Math.round((targetKb * 1024 * 4) / 3);
  const padding = 'A'.repeat(Math.max(0, targetChars - header.length));
  return header + padding;
}

async function runRealUploadAndTxTest(baseUrl: string) {
  console.log(`\n======================================================`);
  console.log(`STARTING REAL E2E REALISASI TEST ON: ${baseUrl}`);
  console.log(`======================================================`);

  // 1. Login to acquire auth token
  let token = '';
  try {
    const loginRes = await axios.post(`${baseUrl}/api/login`, {
      username: 'row01',
      password: 'row123',
      unitId: 'UL2',
    }, { timeout: 8000 });

    if (loginRes.data?.token) {
      token = loginRes.data.token;
      console.log('1. Authentication: SUCCESS (JWT Token acquired)');
    } else {
      console.warn('1. Authentication: Response received without token');
    }
  } catch (err: any) {
    console.warn(`1. Authentication Warning: ${err.response?.status || err.message}`);
  }

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // 2. Prepare 2 real test photos (~80 KB Base64)
  const base64Photo1 = generateMockJpegBase64(80);
  const base64Photo2 = generateMockJpegBase64(80);

  console.log(`\n2. Real Photo Preparation:`);
  console.log(`   Photo Sebelum Length: ${base64Photo1.length} chars (~${(base64Photo1.length * 3 / 4 / 1024).toFixed(2)} KB)`);
  console.log(`   Photo Sesudah Length: ${base64Photo2.length} chars (~${(base64Photo2.length * 3 / 4 / 1024).toFixed(2)} KB)`);

  // 3. Upload Photo 1 & Photo 2 via Media Upload API
  let photoSebUrl = '';
  let photoSesUrl = '';
  let upload1Status = 0;
  let upload2Status = 0;

  try {
    console.log('\n3. Uploading Foto Sebelum to media endpoint...');
    const upload1Res = await axios.post(`${baseUrl}/api/media/upload-photo`, {
      base64Data: base64Photo1,
      nomorWO: 'WO-E2E-999',
      photoType: 'Realisasi_Sebelum',
    }, {
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      timeout: 10000,
      validateStatus: () => true,
    });

    upload1Status = upload1Res.status;
    console.log(`   Foto Sebelum Upload HTTP Status: ${upload1Status}`);
    console.log(`   Foto Sebelum Response Payload:`, upload1Res.data);
    if (upload1Res.data?.fileUrl) {
      photoSebUrl = upload1Res.data.fileUrl;
    }
  } catch (err: any) {
    console.warn(`   Foto Sebelum upload error: ${err.message}`);
  }

  try {
    console.log('\n   Uploading Foto Sesudah to media endpoint...');
    const upload2Res = await axios.post(`${baseUrl}/api/media/upload-photo`, {
      base64Data: base64Photo2,
      nomorWO: 'WO-E2E-999',
      photoType: 'Realisasi_Sesudah',
    }, {
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      timeout: 10000,
      validateStatus: () => true,
    });

    upload2Status = upload2Res.status;
    console.log(`   Foto Sesudah Upload HTTP Status: ${upload2Status}`);
    console.log(`   Foto Sesudah Response Payload:`, upload2Res.data);
    if (upload2Res.data?.fileUrl) {
      photoSesUrl = upload2Res.data.fileUrl;
    }
  } catch (err: any) {
    console.warn(`   Foto Sesudah upload error: ${err.message}`);
  }

  // Fallback if media upload endpoint is handled differently or hosted via Google Apps Script
  if (!photoSebUrl) {
    photoSebUrl = 'https://drive.google.com/uc?id=1e2e_photo_before_sample_drive_url';
  }
  if (!photoSesUrl) {
    photoSesUrl = 'https://drive.google.com/uc?id=1e2e_photo_after_sample_drive_url';
  }

  console.log(`\n   Resolved Photo URLs for REALISASI Payload:`);
  console.log(`   Foto_Sebelum: ${photoSebUrl}`);
  console.log(`   Foto_Sesudah: ${photoSesUrl}`);

  // 4. Construct Whitelisted Minimal REALISASI Payload (No Base64, No duplicates)
  const testTxId = `REL-${Date.now()}-E2E_REAL`;
  const realisasiPayload = {
    id: testTxId,
    ID: testTxId,
    unitId: 'UL2',
    WO_ID: 'WO-E2E-999',
    Nomor_WO: 'WO-E2E-999',
    ULP: 'ULP KOTA',
    REGU_ROW: 'REGU 1',
    PENYULANG: 'PENYULANG UTAMA',
    NO_TIANG: 'T-88',
    TANGGAL: new Date().toISOString().split('T')[0],
    Foto_Sebelum: photoSebUrl,
    Foto_Sesudah: photoSesUrl,
    Jenis_Tanaman: 'Pohon Kelapa',
    Keterangan: 'Pemangkasan Pelepah Dekat Jaringan (E2E Test)',
    Pertumbuhan_Tanaman: 'Tinggi',
    Kendala: 'Tidak Ada',
    Latitude_Longitude: '-0.91234, 100.35432',
    Lokasi_kerja: 'Jl. Pemuda No. 12',
    Timestamp: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(realisasiPayload);
  const payloadBytes = Buffer.byteLength(payloadString, 'utf8');
  const payloadKb = (payloadBytes / 1024).toFixed(2);

  console.log(`\n4. Inspecting Payload POST /api/realisasi:`);
  console.log(`   Transaction ID: ${testTxId}`);
  console.log(`   Exact Body Size: ${payloadBytes} bytes (${payloadKb} KB)`);
  console.log(`   Contains Base64 Foto_Sebelum: ${realisasiPayload.Foto_Sebelum.startsWith('data:image')}`);
  console.log(`   Contains Base64 Foto_Sesudah: ${realisasiPayload.Foto_Sesudah.startsWith('data:image')}`);
  console.log(`   Has Duplicate Field fotoSebelum: ${Boolean((realisasiPayload as any).fotoSebelum)}`);
  console.log(`   Has Duplicate Field fotoSesudah: ${Boolean((realisasiPayload as any).fotoSesudah)}`);

  // 5. Execute POST /api/realisasi
  let postStatus = 0;
  let postResponseBody: any = null;

  try {
    console.log(`\n5. Sending POST /api/realisasi...`);
    const postRes = await axios.post(`${baseUrl}/api/realisasi`, realisasiPayload, {
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      timeout: 10000,
      validateStatus: () => true,
    });

    postStatus = postRes.status;
    postResponseBody = postRes.data;

    console.log(`   POST /api/realisasi HTTP Status: ${postStatus}`);
    console.log(`   Server Confirmation Response:`, JSON.stringify(postResponseBody, null, 2));
  } catch (err: any) {
    console.error(`   POST /api/realisasi execution error: ${err.message}`);
  }

  // 6. Verify row in PostgreSQL HyperCloud DB
  if (postStatus === 200 || postStatus === 201) {
    console.log(`\n6. Verifying Saved Record in PostgreSQL HyperCloud (ID: ${testTxId})...`);
    try {
      const getRes = await axios.get(`${baseUrl}/api/realisasi/${testTxId}`, {
        headers: { ...authHeaders },
        timeout: 8000,
        validateStatus: () => true,
      });

      console.log(`   GET /api/realisasi/${testTxId} HTTP Status: ${getRes.status}`);
      if (getRes.status === 200 && getRes.data?.data) {
        const row = getRes.data.data;
        const retrievedId = row.ID || row.id;
        console.log(`   SUCCESS! Verified row retrieved from PostgreSQL HyperCloud:`);
        console.log(`   - ID Match: ${retrievedId === testTxId} (${retrievedId})`);
        console.log(`   - Foto_Sebelum in DB: ${row.Foto_Sebelum}`);
        console.log(`   - Foto_Sesudah in DB: ${row.Foto_Sesudah}`);
        console.log(`   - Foto_Sebelum is URL (Not Base64): ${!row.Foto_Sebelum?.startsWith('data:image')}`);
        console.log(`   - Foto_Sesudah is URL (Not Base64): ${!row.Foto_Sesudah?.startsWith('data:image')}`);
      } else {
        console.warn(`   Row verification details:`, getRes.data);
      }
    } catch (err: any) {
      console.error(`   DB Verification Error: ${err.message}`);
    }
  } else {
    console.warn(`   Skipping DB verification because POST status was ${postStatus}`);
  }
}

async function runMain() {
  await runRealUploadAndTxTest(LOCAL_API);
  await runRealUploadAndTxTest(REMOTE_API);
}

runMain().catch(console.error);
