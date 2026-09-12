import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://npeeobcpffmlyiknszhh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98'
);

async function testInsertAll() {
  // Test WORK_ORDER
  const wo = {
    unitId: 'UL1',
    WO_ID: 'WO-TEST-1',
    Nomor_WO: 'WO/BKT/001',
    PEKERJAAN: 'GOROW',
    Tanggal: '2026-09-08',
    ULP: 'ULP BUKITTINGGI',
    VOLUME: 5,
    SATUAN: 'KMS',
    TOTAL_REALISASI: 0,
    SATUAN_TOTAL_REALISASI: 'KMS',
    WO_AKHIR: '2026-09-15',
    STATUS: 'Belum Dikerjakan',
    Created_At: new Date().toISOString()
  };
  const woRes = await supabase.from('WORK_ORDER').insert([wo]).select();
  console.log('Insert WORK_ORDER:', woRes.error ? woRes.error.message : 'SUCCESS', woRes.data);

  // If success, test delete
  if (!woRes.error) {
    const delRes = await supabase.from('WORK_ORDER').delete().eq('WO_ID', 'WO-TEST-1');
    console.log('Delete WORK_ORDER:', delRes.error ? delRes.error.message : 'SUCCESS');
  }

  // Test REALISASI
  const rel = {
    ID: 'REL-TEST-1',
    unitId: 'UL1',
    WO_ID: 'WO-TEST-1',
    Nomor_WO: 'WO/BKT/001',
    ULP: 'ULP BUKITTINGGI',
    REGU_ROW: 'REGU ALPHA',
    PENYULANG: 'PENYULANG KOTA',
    NO_TIANG: 'T.01 - T.10',
    TANGGAL: '2026-09-08',
    Jenis_Tanaman: 'Kelapa, Bambu',
    Pertumbuhan_Tanaman: 'Cepat',
    Kendala: 'Tidak Ada',
    Lokasi_kerja: 'Jl. Sudirman',
    Latitude_Longitude: '-0.3055, 100.3692',
    Keterangan: 'Pekerjaan selesai',
    Foto_Sebelum: 'https://placehold.co/600x400',
    Foto_Sesudah: 'https://placehold.co/600x400',
    Timestamp: new Date().toISOString()
  };
  const relRes = await supabase.from('REALISASI').insert([rel]).select();
  console.log('Insert REALISASI:', relRes.error ? relRes.error.message : 'SUCCESS');
  if (!relRes.error) {
    await supabase.from('REALISASI').delete().eq('ID', 'REL-TEST-1');
  }

  // Test ABSENSI
  const abs = {
    ID: 'ABS-TEST-1',
    unitId: 'UL1',
    TANGGAL: '2026-09-08',
    NAMA_REGU: 'REGU ALPHA',
    ULP: 'ULP BUKITTINGGI',
    PETUGAS_1: 'Ahmad',
    KET_1: 'HADIR'
  };
  const absRes = await supabase.from('ABSENSI').insert([abs]).select();
  console.log('Insert ABSENSI:', absRes.error ? absRes.error.message : 'SUCCESS');
  if (!absRes.error) {
    await supabase.from('ABSENSI').delete().eq('ID', 'ABS-TEST-1');
  }

  // Test USERS
  const usr = {
    unitId: 'UL1',
    UserID: 'USR-001',
    Username: 'admin_bkt',
    Password: '123',
    Role: 'Admin',
    ULP: 'ULP BUKITTINGGI',
    Status: 'Aktif'
  };
  const usrRes = await supabase.from('USERS').insert([usr]).select();
  console.log('Insert USERS:', usrRes.error ? usrRes.error.message : 'SUCCESS');
  if (!usrRes.error) {
    await supabase.from('USERS').delete().eq('UserID', 'USR-001');
  }

  // Test ULP
  const ulp = {
    ID: 'ULP-1',
    unitId: 'UL1',
    Kode_ULP: 'BKT01',
    Nama_ULP: 'ULP BUKITTINGGI KOTA',
    Manajer: 'Budi Santoso',
    Kontak: '08123456789',
    Alamat: 'Bukittinggi',
    Status: 'Aktif'
  };
  const ulpRes = await supabase.from('ULP').insert([ulp]).select();
  console.log('Insert ULP:', ulpRes.error ? ulpRes.error.message : 'SUCCESS');
  if (!ulpRes.error) {
    await supabase.from('ULP').delete().eq('ID', 'ULP-1');
  }

  // Test PENYULANG
  const pyl = {
    ID: 'PYL-1',
    unitId: 'UL1',
    Nama_Penyulang: 'PENYULANG JAM GADANG',
    ULP: 'ULP BUKITTINGGI KOTA'
  };
  const pylRes = await supabase.from('PENYULANG').insert([pyl]).select();
  console.log('Insert PENYULANG:', pylRes.error ? pylRes.error.message : 'SUCCESS');
  if (!pylRes.error) {
    await supabase.from('PENYULANG').delete().eq('ID', 'PYL-1');
  }

  // Test REGU_ROW
  const regu = {
    ID: 'REG-1',
    unitId: 'UL1',
    Kode_Regu: 'REG-BKT-1',
    Nama_Regu: 'REGU ALPHA',
    Jumlah_Anggota: 5,
    Kontak: '08123456789',
    ULP: 'ULP BUKITTINGGI KOTA',
    Status: 'Aktif'
  };
  const reguRes = await supabase.from('REGU_ROW').insert([regu]).select();
  console.log('Insert REGU_ROW:', reguRes.error ? reguRes.error.message : 'SUCCESS');
  if (!reguRes.error) {
    await supabase.from('REGU_ROW').delete().eq('ID', 'REG-1');
  }

  // Test PETUGAS
  const ptg = {
    ID: 'PTG-1',
    unitId: 'UL1',
    Nama: 'Rian Pratama',
    Regu: 'REGU ALPHA',
    ULP: 'ULP BUKITTINGGI KOTA',
    Role: 'User',
    Status: 'Aktif'
  };
  const ptgRes = await supabase.from('PETUGAS').insert([ptg]).select();
  console.log('Insert PETUGAS:', ptgRes.error ? ptgRes.error.message : 'SUCCESS');
  if (!ptgRes.error) {
    await supabase.from('PETUGAS').delete().eq('ID', 'PTG-1');
  }
}

testInsertAll();
