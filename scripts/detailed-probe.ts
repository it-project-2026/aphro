import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://npeeobcpffmlyiknszhh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98'
);

async function probeCols(table: string, cols: string[]) {
  const results = await Promise.all(
    cols.map(async (col) => {
      const { error } = await supabase.from(table).select(col).limit(0);
      return { col, ok: !error };
    })
  );
  return results.filter(r => r.ok).map(r => r.col);
}

async function run() {
  const inisiasiCheck = [
    'ID', 'Kode_UL', 'Nama_UL', 'id_spreadsheet', 'ID_Spreadsheet', 'id_Spreadsheet', 'ID_SPREADSHEET', 'idSpreadsheet', 'spreadsheet_id', 'Spreadsheet_ID', 'SpreadsheetId', 'id_sheet',
    'url_GAS', 'Url_GAS', 'url_gas', 'Url_Gas', 'URL_GAS', 'urlGas', 'gas_url', 'gasUrl', 'GAS_URL', 'URL', 'url',
    'Folder_id_spreadsheet', 'Folder_id_Spreadsheet', 'Folder_ID_Spreadsheet', 'folder_id_spreadsheet', 'folderIdSpreadsheet', 'folder_spreadsheet', 'Folder_Spreadsheet', 'Folder_Drive', 'Drive_Folder',
    'Folder_id_Foto', 'Folder_id_foto', 'folder_id_foto', 'Folder_Foto', 'folder_foto', 'photo_folder_id',
    'Folder_id_absensi', 'Folder_id_Absensi', 'folder_id_absensi', 'Folder_Absensi', 'folder_absensi', 'absensi_folder_id',
    'created_at', 'updated_at', 'keterangan', 'notes', 'status', 'Status'
  ];

  const woCheck = [
    'ID', 'id', 'unitId', 'unit_id', 'PEKERJAAN', 'Pekerjaan', 'pekerjaan',
    'Nomor_WO', 'nomorWO', 'NOMOR_WO', 'nomor_wo', 'WO_ID', 'wo_id', 'WO_Number',
    'Tanggal', 'tanggal', 'TANGGAL',
    'ULP', 'ulp', 'ulpName', 'NAMA_ULP', 'Nama_ULP', 'ULP_ID', 'ulpId',
    'PENYULANG', 'penyulang', 'penyulangName', 'NAMA_PENYULANG', 'Nama_Penyulang', 'PENYULANG_ID', 'penyulangId',
    'REGU', 'regu', 'REGU_ROW', 'reguName', 'NAMA_REGU', 'Nama_Regu', 'REGU_ID', 'reguId',
    'VOLUME', 'volume', 'Volume', 'volumePekerjaan',
    'SATUAN', 'satuan', 'Satuan',
    'TOTAL_REALISASI', 'Total_Realisasi', 'total_realisasi', 'totalRealisasi',
    'SATUAN_TOTAL_REALISASI', 'Satuan_Total_Realisasi', 'satuan_total_realisasi', 'satuanTotalRealisasi',
    'WO_MULAI', 'Wo_Mulai', 'wo_mulai', 'woMulai',
    'WO_AKHIR', 'Wo_Akhir', 'wo_akhir', 'woAkhir',
    'STATUS', 'Status', 'status',
    'DESKRIPSI', 'Deskripsi', 'deskripsi',
    'JENIS_PEKERJAAN', 'Jenis_Pekerjaan', 'jenis_pekerjaan', 'jenisPekerjaan', 'Kategori', 'kategori',
    'PRIORITAS', 'Prioritas', 'prioritas',
    'LOKASI', 'Lokasi', 'lokasi', 'ALAMAT', 'Alamat', 'alamat',
    'PETUGAS', 'Petugas', 'petugas', 'NAMA_PETUGAS', 'Nama_Petugas', 'petugasName', 'PETUGAS_ID', 'petugasId',
    'PROGRESS', 'Progress', 'progress', 'progressPercent',
    'LATITUDE', 'Latitude', 'latitude', 'lat',
    'LONGITUDE', 'Longitude', 'longitude', 'lon', 'lng',
    'created_at', 'Created_At', 'createdAt', 'updated_at', 'Updated_At', 'updatedAt'
  ];

  const absCheck = [
    'ID', 'id', 'unitId', 'unit_id', 'TANGGAL', 'Tanggal', 'tanggal',
    'NAMA_REGU', 'Nama_Regu', 'REGU_ROW', 'Regu', 'REGU', 'reguName',
    'PENYULANG', 'penyulang', 'NAMA_PENYULANG', 'Nama_Penyulang',
    'ULP', 'ulp', 'NAMA_ULP', 'Nama_ULP',
    'USER_NAME', 'Username', 'username', 'userName',
    'NAMA_PETUGAS', 'Nama_Petugas', 'Petugas', 'PETUGAS', 'namaPetugas',
    'NIP', 'nip',
    'FOTO_MASUK', 'Foto_Masuk', 'FotoMasuk', 'foto_masuk',
    'TIMESTAMP_MASUK', 'Timestamp_Masuk', 'timestampMasuk', 'TIMESTAMP MASUK',
    'FOTO_KELUAR', 'Foto_Keluar', 'FotoKeluar', 'foto_keluar',
    'TIMESTAMP_KELUAR', 'Timestamp_Keluar', 'timestampKeluar', 'TIMESTAMP KELUAR',
    'LATITUDE', 'Latitude', 'latitude', 'lat',
    'LONGITUDE', 'Longitude', 'longitude', 'lon',
    'PETUGAS_1', 'PETUGAS_2', 'PETUGAS_3', 'PETUGAS_4', 'PETUGAS_5', 'PETUGAS_6', 'PETUGAS_7', 'PETUGAS_8', 'PETUGAS_9', 'PETUGAS_10',
    'KET_1', 'KET_2', 'KET_3', 'KET_4', 'KET_5', 'KET_6', 'KET_7', 'KET_8', 'KET_9', 'KET_10',
    'Petugas_1', 'Petugas_2', 'Petugas_3', 'Ket_1', 'Ket_2', 'Ket_3',
    'petugasList', 'petugas_list',
    'created_at', 'updated_at'
  ];

  const usersCheck = [
    'ID', 'id', 'unitId', 'unit_id',
    'UserID', 'User_ID', 'user_id', 'NIP', 'nip',
    'NAMA', 'Nama', 'name', 'Name',
    'Username', 'username', 'USER_NAME', 'user_name', 'userName',
    'Password', 'password', 'PASSWORD', 'KataSandi', 'kata_sandi',
    'Email', 'email', 'EMAIL',
    'Role', 'role', 'ROLE',
    'NAMA_REGU', 'Nama_Regu', 'Regu_ROW', 'Regu', 'regu', 'reguName', 'REGU_ID', 'reguId',
    'ULP', 'ulp', 'NAMA_ULP', 'Nama_ULP', 'ulpName', 'ULP_ID', 'ulpId',
    'No_HP', 'no_hp', 'Kontak', 'kontak', 'phone', 'Phone',
    'Status', 'status', 'STATUS',
    'Avatar', 'avatar', 'avatarUrl', 'created_at', 'updated_at'
  ];

  const pylCheck = [
    'ID', 'id', 'unitId', 'unit_id',
    'Kode_Penyulang', 'kode_penyulang', 'KODE_PENYULANG', 'Kode', 'kode',
    'Nama_Penyulang', 'nama_penyulang', 'NAMA_PENYULANG', 'Penyulang', 'Nama',
    'ULP', 'ulp', 'NAMA_ULP', 'Nama_ULP', 'ulpId', 'ULP_ID',
    'Panjang_Kms', 'panjang_kms', 'PANJANG_KMS', 'panjang',
    'Jumlah_Trafo', 'jumlah_trafo', 'JUMLAH_TRAFO', 'trafo',
    'Status', 'status', 'STATUS',
    'created_at', 'updated_at'
  ];

  const ptgCheck = [
    'ID', 'id', 'unitId', 'unit_id',
    'NIP', 'nip', 'ID_Petugas',
    'Nama', 'nama', 'NAMA', 'Petugas', 'NAMA_PETUGAS', 'Nama_Petugas', 'namaPetugas',
    'Regu', 'regu', 'REGU', 'Nama_Regu', 'NAMA_REGU', 'reguId', 'REGU_ID',
    'ULP', 'ulp', 'NAMA_ULP', 'Nama_ULP', 'ulpId', 'ULP_ID',
    'No_HP', 'no_hp', 'Kontak', 'kontak', 'nomorHP', 'Phone',
    'Role', 'role', 'ROLE',
    'Status', 'status', 'STATUS',
    'created_at', 'updated_at'
  ];

  console.log('--- INISIASI ---', await probeCols('INISIASI', inisiasiCheck));
  console.log('--- WORK_ORDER ---', await probeCols('WORK_ORDER', woCheck));
  console.log('--- ABSENSI ---', await probeCols('ABSENSI', absCheck));
  console.log('--- USERS ---', await probeCols('USERS', usersCheck));
  console.log('--- PENYULANG ---', await probeCols('PENYULANG', pylCheck));
  console.log('--- PETUGAS ---', await probeCols('PETUGAS', ptgCheck));
}

run();
