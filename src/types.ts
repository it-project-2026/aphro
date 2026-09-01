export type UserRole = 'SuperAdmin' | 'Admin' | 'Adm' | 'User';

export interface User {
  id: string;
  nip: string;
  name: string;
  userName?: string;
  password?: string;
  email: string;
  role: UserRole;
  reguId?: string;
  reguName?: string;
  ulpId?: string;
  ulpName?: string;
  avatarUrl?: string;
  phone?: string;
  status?: 'Aktif' | 'Non-Aktif';
  lastLogin?: string;
  createdAt?: string;
}

export type WOStatus = 'Belum Dikerjakan' | 'Sedang Dikerjakan' | 'Selesai' | 'BELUM SELESAI' | 'SELESAI';
export type WOPriority = 'Tinggi' | 'Sedang' | 'Rendah';
export type WOType = 
  | 'Pemangkasan Pohon (ROW)'
  | 'Pembersihan Jalur Feeder'
  | 'Inspeksi Potensi Hazard'
  | 'Penanganan Pohon Rawan Rubuh'
  | 'Pemasangan Guard / Penghalang Hewan'
  | 'Perbaikan Konstruksi Asset';

export interface WorkOrder {
  id: string;
  pekerjaan?: 'NORMAL' | 'GOROW';
  nomorWO: string;
  tanggal: string; // YYYY-MM-DD
  ulpId: string;
  ulpName: string;
  penyulangId: string;
  penyulangName: string;
  lokasi?: string;
  alamat?: string;
  latitude?: number;
  longitude?: number;
  jenisPekerjaan?: WOType;
  prioritas?: WOPriority;
  deadline?: string;
  reguId: string;
  reguName: string;
  petugasId?: string;
  petugasName?: string;
  volumePekerjaan?: number;
  satuan?: 'KMS' | 'GAWANG';
  totalRealisasi?: number;
  satuanTotalRealisasi?: 'KMS' | 'GAWANG';
  lokasiStart?: string;
  lokasiFinish?: string;
  woKms?: number;
  woBatang?: number;
  woMulai?: string;
  woAkhir?: string;
  deskripsi?: string;
  status: WOStatus;
  progressPercent: number;
  lampiranUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WatermarkedPhoto {
  id: string;
  type: 'sebelum' | 'sesudah';
  slotIndex: 1 | 2 | 3;
  dataUrl: string; // base64 image with watermark burned in
  fileUrl?: string; // Google Drive direct link
  originalName: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  userName: string;
  ulpName: string;
}

export interface AbsensiPetugas {
  nama: string;
  keterangan: string; // Allow status or custom notes
}

export interface Absensi {
  id: string;
  tanggal: string; // YYYY-MM-DD
  reguName: string;
  penyulangName?: string;
  userName?: string;
  namaPetugas?: string;
  nip?: string;
  ulpName: string;
  petugasList: AbsensiPetugas[];
  fotoMasuk?: string;
  timestampMasuk?: string;
  fotoKeluar?: string;
  timestampKeluar?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Realisasi {
  id: string;
  workOrderId: string;
  nomorWO: string;
  ulpName?: string;
  reguName?: string;
  penyulangName?: string;
  noTiang?: string;
  tanggalRealisasi: string;
  petugasId: string;
  petugasName: string;
  jenisTanaman?: string;
  pertumbuhanTanaman?: string;
  kendala?: string;
  latitude: number;
  longitude: number;
  lokasiKerja?: string;
  keterangan: string;
  progressPercent: number;
  status: WOStatus;
  photosSebelum: WatermarkedPhoto[];
  photosSesudah: WatermarkedPhoto[];
  fotoSebelumUrl?: string;
  fotoSesudahUrl?: string;
  createdAt: string;
  isSynced?: boolean;
  syncId?: string;
}

export interface ULP {
  id: string;
  kodeULP: string;
  namaULP: string;
  manajer: string;
  kontak: string;
  alamat: string;
  status: 'Aktif' | 'Non-Aktif';
}

export interface Penyulang {
  id: string;
  kodePenyulang: string;
  namaPenyulang: string;
  ulpId: string;
  ulpName: string;
  panjangKms: number;
  jumlahTrafo: number;
  status: 'Normal' | 'Rawan Hazard' | 'Maintenance';
}

export interface ReguROW {
  id: string;
  kodeRegu: string;
  namaRegu: string;
  penanggungJawab: string;
  jumlahAnggota: number;
  kontak: string;
  status: 'Aktif' | 'Non-Aktif';
  ulpId?: string;
  ulpName?: string;
}

export interface Petugas {
  id: string;
  nip: string;
  nama: string;
  reguId: string;
  reguName: string;
  ulpId: string;
  ulpName: string;
  noHp: string;
  role: UserRole;
  status: 'Aktif' | 'Non-Aktif';
}

export interface InisiasiUnit {
  id: string;
  no?: number | string;
  kodeUL?: string;
  namaUL: string; // Kolom C (Nama_UL)
  idSpreadsheet: string; // id_Spreadsheet
  urlGas: string; // Url GAS
  folderIdSpreadsheet: string; // Folder_id_spreadsheet
  folderIdFoto: string; // Folder_id_Foto
  folderIdAbsensi: string; // Folder_id_absensi
  isCustom?: boolean;
  notes?: string;
}

export interface AppSettings {
  namaUnitLayanan: string;
  logoAplikasiUrl: string;
  logoInstansiUrl: string;
  loginBgUrl: string;
  themeColor: 'PLN Blue' | 'Cyan' | 'Emerald' | 'Royal Indigo';
  footerText: string;
  versiAplikasi: string;
  gasWebAppUrl?: string;
  spreadsheetId?: string;
  driveFolderId?: string;
  photoFolderId?: string;
  absensiFolderId?: string;
  syncInterval?: number;
  offlineMode?: boolean;
  theme?: 'light' | 'dark';
  fontSize?: 'small' | 'medium' | 'large';
  highContrast?: boolean;
  autoSyncOnStart?: boolean;
  kontakAdmin: {
    whatsapp: string;
    email: string;
    alamat: string;
  };
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName?: string;
  actorRole?: UserRole;
  userId?: string;
  action: string;
  details: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'danger';
  reguTarget?: string; // Target team name (optional, if empty shows to everyone/admin)
  ulpTarget?: string; // Target ULP name (optional)
}
