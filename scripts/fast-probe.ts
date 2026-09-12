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
  const inisiasiVariations = [
    'id', 'ID', 'Id', 'no', 'NO', 'No',
    'kodeUL', 'Kode_UL', 'kode_ul', 'KODE_UL', 'Kode',
    'namaUL', 'Nama_UL', 'nama_ul', 'NAMA_UL', 'Nama',
    'id_spreadsheet', 'id_Spreadsheet', 'idSpreadsheet', 'ID_SPREADSHEET', 'id_sheet', 'ID_Spreadsheet', 'Id_Spreadsheet',
    'url_GAS', 'url_gas', 'urlGas', 'URL_GAS', 'Url_GAS', 'Url_Gas', 'urlGAS',
    'Folder_id_spreadsheet', 'Folder_id_Spreadsheet', 'folder_id_spreadsheet', 'folder_id_Spreadsheet', 'folderIdSpreadsheet', 'Folder_Id_Spreadsheet', 'Folder_Spreadsheet', 'folder_spreadsheet',
    'Folder_id_Foto', 'Folder_id_foto', 'folder_id_foto', 'folderIdFoto', 'Folder_Id_Foto', 'folder_foto',
    'Folder_id_absensi', 'Folder_id_Absensi', 'folder_id_absensi', 'folderIdAbsensi', 'Folder_Id_Absensi', 'folder_absensi',
    'created_at', 'updated_at', 'notes', 'Notes'
  ];

  const woVariations = [
    'id', 'ID', 'unitId', 'unit_id', 'UNIT_ID', 'UnitId',
    'pekerjaan', 'PEKERJAAN', 'Pekerjaan',
    'nomorWO', 'NOMOR_WO', 'nomor_wo', 'Nomor_WO', 'WO_ID', 'wo_id', 'WO_Number',
    'tanggal', 'TANGGAL', 'Tanggal',
    'ulpId', 'ULP_ID', 'ulp_id', 'ulpName', 'NAMA_ULP', 'nama_ulp', 'Nama_ULP', 'ULP',
    'penyulangId', 'PENYULANG_ID', 'penyulang_id', 'penyulangName', 'NAMA_PENYULANG', 'nama_penyulang', 'Nama_Penyulang', 'PENYULANG',
    'reguId', 'REGU_ID', 'regu_id', 'reguName', 'NAMA_REGU', 'nama_regu', 'Nama_Regu', 'REGU_ROW', 'REGU',
    'volumePekerjaan', 'VOLUME', 'Volume', 'volume', 'satuan', 'SATUAN', 'Satuan',
    'totalRealisasi', 'TOTAL_REALISASI', 'total_realisasi', 'Total_Realisasi',
    'satuanTotalRealisasi', 'SATUAN_TOTAL_REALISASI', 'satuan_total_realisasi',
    'woMulai', 'WO_MULAI', 'wo_mulai', 'Wo_Mulai', 'woAkhir', 'WO_AKHIR', 'wo_akhir', 'Wo_Akhir',
    'status', 'STATUS', 'Status',
    'deskripsi', 'DESKRIPSI', 'Deskripsi',
    'jenisPekerjaan', 'JENIS_PEKERJAAN', 'jenis_pekerjaan', 'Jenis_Pekerjaan',
    'prioritas', 'PRIORITAS', 'Prioritas',
    'lokasi', 'LOKASI', 'Lokasi', 'alamat', 'ALAMAT',
    'petugasId', 'PETUGAS_ID', 'petugas_id', 'petugasName', 'PETUGAS', 'Petugas', 'NAMA_PETUGAS',
    'progressPercent', 'PROGRESS', 'progress', 'Progress',
    'latitude', 'LATITUDE', 'lat', 'longitude', 'LONGITUDE', 'lon', 'lng',
    'lampiranUrl', 'LAMPIRAN_URL', 'lampiran_url',
    'createdAt', 'CREATED_AT', 'created_at', 'updatedAt', 'UPDATED_AT', 'updated_at'
  ];

  const relVariations = [
    'id', 'ID', 'unitId', 'unit_id', 'UNIT_ID', 'UnitId',
    'workOrderId', 'WO_ID', 'wo_id', 'WorkOrderId',
    'nomorWO', 'NOMOR_WO', 'nomor_wo', 'Nomor_WO', 'NO_WO',
    'ulpName', 'NAMA_ULP', 'ULP', 'nama_ulp', 'ulpId', 'ULP_ID',
    'reguName', 'NAMA_REGU', 'REGU_ROW', 'REGU', 'regu_name', 'reguId',
    'penyulangName', 'NAMA_PENYULANG', 'PENYULANG', 'penyulang_name', 'penyulangId',
    'noTiang', 'NO_TIANG', 'no_tiang', 'No_Tiang',
    'tanggalRealisasi', 'TANGGAL', 'tanggal', 'Tanggal', 'tanggal_realisasi',
    'petugasId', 'PETUGAS_ID', 'petugas_id', 'petugasName', 'PETUGAS', 'Petugas', 'NAMA_PETUGAS',
    'jenisTanaman', 'JENIS_TANAMAN', 'Jenis_Tanaman', 'jenis_tanaman',
    'pertumbuhanTanaman', 'PERTUMBUHAN_TANAMAN', 'Pertumbuhan_Tanaman', 'pertumbuhan_tanaman',
    'kendala', 'KENDALA', 'Kendala',
    'lokasiKerja', 'LOKASI_KERJA', 'Lokasi_kerja', 'lokasi_kerja',
    'latitude', 'LATITUDE', 'lat', 'longitude', 'LONGITUDE', 'lon', 'lng', 'Latitude_Longitude', 'LATITUDE_LONGITUDE',
    'keterangan', 'KETERANGAN', 'Keterangan',
    'progressPercent', 'PROGRESS', 'progress',
    'status', 'STATUS', 'Status',
    'fotoSebelumUrl', 'FOTO_SEBELUM', 'Foto_Sebelum', 'foto_sebelum',
    'fotoSesudahUrl', 'FOTO_SESUDAH', 'Foto_Sesudah', 'foto_sesudah',
    'photosSebelum', 'photosSesudah',
    'timestamp', 'Timestamp', 'TIMESTAMP',
    'createdAt', 'CREATED_AT', 'created_at', 'updatedAt', 'UPDATED_AT', 'updated_at'
  ];

  const absVariations = [
    'id', 'ID', 'unitId', 'unit_id', 'UNIT_ID', 'UnitId',
    'tanggal', 'TANGGAL', 'Tanggal',
    'reguName', 'NAMA_REGU', 'Nama_Regu', 'Regu', 'REGU',
    'penyulangName', 'PENYULANG', 'NAMA_PENYULANG',
    'ulpName', 'NAMA_ULP', 'Nama_ULP', 'ULP',
    'userName', 'USER_NAME', 'Username', 'username',
    'namaPetugas', 'NAMA_PETUGAS', 'Nama_Petugas', 'Petugas', 'PETUGAS',
    'nip', 'NIP',
    'petugasList', 'PETUGAS_LIST', 'petugas_list',
    'fotoMasuk', 'FOTO_MASUK', 'FotoMasuk', 'foto_masuk',
    'timestampMasuk', 'TIMESTAMP_MASUK', 'timestamp_masuk',
    'fotoKeluar', 'FOTO_KELUAR', 'FotoKeluar', 'foto_keluar',
    'timestampKeluar', 'TIMESTAMP_KELUAR', 'timestamp_keluar',
    'latitude', 'LATITUDE', 'lat', 'longitude', 'LONGITUDE', 'lon',
    'createdAt', 'CREATED_AT', 'created_at', 'updatedAt', 'UPDATED_AT', 'updated_at'
  ];

  const userVariations = [
    'id', 'ID', 'unitId', 'unit_id', 'UNIT_ID', 'UnitId',
    'nip', 'NIP', 'UserID', 'User_ID', 'user_id',
    'name', 'NAMA', 'Nama', 'Name',
    'userName', 'username', 'Username', 'USER_NAME', 'user_name',
    'password', 'PASSWORD', 'Password', 'KataSandi', 'kata_sandi',
    'email', 'EMAIL', 'Email',
    'role', 'ROLE', 'Role',
    'reguId', 'REGU_ID', 'regu_id', 'reguName', 'NAMA_REGU', 'Nama_Regu', 'Regu_ROW', 'Regu',
    'ulpId', 'ULP_ID', 'ulp_id', 'ulpName', 'NAMA_ULP', 'Nama_ULP', 'ULP',
    'avatarUrl', 'avatar_url', 'phone', 'PHONE', 'No_HP', 'kontak', 'Kontak',
    'status', 'STATUS', 'Status',
    'lastLogin', 'last_login', 'createdAt', 'created_at'
  ];

  const ulpVariations = [
    'id', 'ID', 'unitId', 'unit_id', 'UNIT_ID', 'UnitId',
    'kodeULP', 'Kode_ULP', 'kode_ulp', 'KODE_ULP', 'Kode',
    'namaULP', 'Nama_ULP', 'nama_ulp', 'NAMA_ULP', 'ULP', 'Nama',
    'manajer', 'MANAJER', 'Manajer', 'kontak', 'KONTAK', 'Kontak',
    'alamat', 'ALAMAT', 'Alamat', 'status', 'STATUS', 'Status',
    'createdAt', 'created_at'
  ];

  const pylVariations = [
    'id', 'ID', 'unitId', 'unit_id', 'UNIT_ID', 'UnitId',
    'kodePenyulang', 'Kode_Penyulang', 'kode_penyulang', 'KODE_PENYULANG', 'Kode',
    'namaPenyulang', 'Nama_Penyulang', 'nama_penyulang', 'NAMA_PENYULANG', 'Penyulang', 'Nama',
    'ulpId', 'ULP_ID', 'ulp_id', 'ulpName', 'NAMA_ULP', 'Nama_ULP', 'ULP',
    'panjangKms', 'Panjang_Kms', 'panjang_kms', 'PANJANG_KMS',
    'jumlahTrafo', 'Jumlah_Trafo', 'jumlah_trafo', 'JUMLAH_TRAFO',
    'status', 'STATUS', 'Status',
    'createdAt', 'created_at'
  ];

  const reguVariations = [
    'id', 'ID', 'unitId', 'unit_id', 'UNIT_ID', 'UnitId',
    'kodeRegu', 'Kode_Regu', 'kode_regu', 'KODE_REGU', 'Kode',
    'namaRegu', 'Nama_Regu', 'nama_regu', 'NAMA_REGU', 'Regu_ROW', 'Regu',
    'penanggungJawab', 'PenanggungJawab', 'penanggung_jawab', 'PENANGGUNG_JAWAB',
    'jumlahAnggota', 'Jumlah_Anggota', 'jumlah_anggota', 'JUMLAH_ANGGOTA',
    'kontak', 'KONTAK', 'Kontak', 'ulpId', 'ulpName', 'ULP',
    'status', 'STATUS', 'Status',
    'createdAt', 'created_at'
  ];

  const ptgVariations = [
    'id', 'ID', 'unitId', 'unit_id', 'UNIT_ID', 'UnitId',
    'nip', 'NIP',
    'nama', 'NAMA', 'Nama', 'Petugas', 'NAMA_PETUGAS', 'Nama_Petugas', 'namaPetugas', 'name',
    'reguId', 'REGU_ID', 'regu_id', 'reguName', 'NAMA_REGU', 'Nama_Regu', 'Regu_ROW', 'Regu',
    'ulpId', 'ULP_ID', 'ulp_id', 'ulpName', 'NAMA_ULP', 'Nama_ULP', 'ULP',
    'noHp', 'No_HP', 'no_hp', 'Kontak', 'kontak', 'nomorHP',
    'role', 'ROLE', 'Role', 'status', 'STATUS', 'Status',
    'createdAt', 'created_at'
  ];

  console.log('INISIASI:', await probeCols('INISIASI', inisiasiVariations));
  console.log('WORK_ORDER:', await probeCols('WORK_ORDER', woVariations));
  console.log('REALISASI:', await probeCols('REALISASI', relVariations));
  console.log('ABSENSI:', await probeCols('ABSENSI', absVariations));
  console.log('USERS:', await probeCols('USERS', userVariations));
  console.log('ULP:', await probeCols('ULP', ulpVariations));
  console.log('PENYULANG:', await probeCols('PENYULANG', pylVariations));
  console.log('REGU_ROW:', await probeCols('REGU_ROW', reguVariations));
  console.log('PETUGAS:', await probeCols('PETUGAS', ptgVariations));
}

run();
