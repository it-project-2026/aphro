import axios from 'axios';

const LOCAL_API = 'http://127.0.0.1:3000';
const REMOTE_API = 'https://api.aphro-row.my.id';

const SMALL_TEST_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

async function testApiEndpoint(baseUrl: string) {
  console.log(`\n==============================================`);
  console.log(`Testing API Server at: ${baseUrl}`);
  console.log(`==============================================`);

  // 1. Health check
  try {
    const health = await axios.get(`${baseUrl}/api/health`, { timeout: 3000 });
    console.log(`Health Status (${baseUrl}): ${health.status}`, health.data);
  } catch (err: any) {
    console.warn(`Health Check Error (${baseUrl}): ${err.message}`);
  }

  // 2. Authenticate
  let token = '';
  try {
    const loginRes = await axios.post(`${baseUrl}/api/login`, {
      username: 'row01',
      password: 'row123',
      Password: 'row123',
      unitId: 'UL2',
    }, { timeout: 5000 });

    if (loginRes.data?.token) {
      token = loginRes.data.token;
      console.log('Login Result: SUCCESS (Token acquired)');
    } else {
      console.log('Login Result:', loginRes.data);
    }
  } catch (err: any) {
    console.warn(`Login failed: ${err.response?.status} - ${JSON.stringify(err.response?.data || err.message)}`);
  }

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // 3. Test Photo Upload endpoint
  let photoSebUrl = 'https://drive.google.com/uc?id=test_verify_before';
  let photoSesUrl = 'https://drive.google.com/uc?id=test_verify_after';

  try {
    const uploadRes = await axios.post(
      `${baseUrl}/api/media/upload-photo`,
      {
        base64Data: SMALL_TEST_BASE64,
        nomorWO: 'WO-VERIFY-001',
        photoType: 'Realisasi_Sebelum',
      },
      {
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        timeout: 5000,
        validateStatus: () => true,
      }
    );

    console.log(`Upload Photo Endpoint HTTP Status: ${uploadRes.status}`);
    if (uploadRes.data?.fileUrl) {
      photoSebUrl = uploadRes.data.fileUrl;
      photoSesUrl = uploadRes.data.fileUrl;
      console.log(`Uploaded Photo URL: ${photoSebUrl}`);
    } else {
      console.log(`Upload Response Data:`, uploadRes.data);
    }
  } catch (err: any) {
    console.warn(`Upload photo failed: ${err.message}`);
  }

  // 4. Test POST /api/realisasi
  const testRelId = `REL-${Date.now()}-VERIFY`;
  const payload = {
    id: testRelId,
    ID: testRelId,
    unitId: 'UL2',
    WO_ID: 'WO-VERIFY-001',
    Nomor_WO: 'WO-VERIFY-001',
    ULP: 'ULP KOTA',
    REGU_ROW: 'REGU 1',
    PENYULANG: 'PENYULANG TEST',
    NO_TIANG: 'T-102',
    TANGGAL: new Date().toISOString().split('T')[0],
    Foto_Sebelum: photoSebUrl,
    Foto_Sesudah: photoSesUrl,
    Jenis_Tanaman: 'Pohon Mangga',
    Keterangan: 'Pemangkasan Dahan Rawan (Uji Otomatis)',
    Pertumbuhan_Tanaman: 'Sedang',
    Kendala: 'Tidak Ada',
    Latitude_Longitude: '-0.91234, 100.35432',
    Lokasi_kerja: 'Jl. Utama No. 45',
    Timestamp: new Date().toISOString(),
  };

  console.log(`\nPosting REALISASI (ID: ${testRelId})...`);
  console.log(`Foto_Sebelum = ${payload.Foto_Sebelum}`);
  console.log(`Foto_Sesudah = ${payload.Foto_Sesudah}`);

  try {
    const postRes = await axios.post(`${baseUrl}/api/realisasi`, payload, {
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      timeout: 5000,
      validateStatus: () => true,
    });

    console.log(`POST /api/realisasi HTTP Status: ${postRes.status}`);
    console.log(`POST /api/realisasi Response:`, postRes.data);

    if (postRes.status === 200 || postRes.status === 201) {
      // 5. Query back record
      const getRes = await axios.get(`${baseUrl}/api/realisasi/${testRelId}`, {
        headers: { ...authHeaders },
        timeout: 5000,
        validateStatus: () => true,
      });

      console.log(`GET /api/realisasi/${testRelId} HTTP Status: ${getRes.status}`);
      console.log(`Record retrieved from DB:`, getRes.data);
    }
  } catch (err: any) {
    console.error(`POST /api/realisasi failed: ${err.message}`);
  }
}

async function runAll() {
  await testApiEndpoint(LOCAL_API);
  await testApiEndpoint(REMOTE_API);
}

runAll().catch(console.error);
