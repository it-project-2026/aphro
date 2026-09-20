import {
  User,
  ULP,
  Penyulang,
  ReguROW,
  Petugas,
  WorkOrder,
  Realisasi,
  AppSettings,
  AuditLog,
  NotificationItem,
  Absensi,
} from '../types';
import { createPlaceholderPhoto } from '../utils/watermark';
import { getActiveGasConfig } from '../config/gasConfig';

export const APP_LOGO_URL = '/icon.png';

export const INITIAL_ABSENSI: Absensi[] = [];

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-1',
    nip: '198503152010121001',
    userName: 'superadmin',
    password: 'admin123',
    name: 'Budi Santoso (SuperAdmin)',
    email: 'superadmin@pln.co.id',
    role: 'SuperAdmin',
    phone: '081234567890',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  }
];

export const INITIAL_ULP: ULP[] = [
  { id: 'ulp-1', kodeULP: 'KTO', namaULP: 'ULP BUKITTINGGI KOTA', manajer: 'Manajer UL BKT', kontak: '081234567891', alamat: 'Jl. Sudirman Bukittinggi', status: 'Aktif', unitId: 'UL2' },
  { id: 'ulp-2', kodeULP: 'PYK', namaULP: 'ULP PAYAKUMBUH', manajer: 'Manajer UL PYK', kontak: '081234567892', alamat: 'Jl. Soekarno-Hatta Payakumbuh', status: 'Aktif', unitId: 'UL4' },
  { id: 'ulp-3', kodeULP: 'SLK', namaULP: 'ULP SOLOK', manajer: 'Manajer UL SLK', kontak: '081234567893', alamat: 'Jl. Koto Baru Solok', status: 'Aktif', unitId: 'UL3' },
  { id: 'ulp-4', kodeULP: 'KRJ', namaULP: 'ULP KURANJI', manajer: 'Manajer UL PDG', kontak: '081234567894', alamat: 'Jl. Kuranji Padang', status: 'Aktif', unitId: 'UL1' },
  { id: 'ulp-5', kodeULP: 'PGB', namaULP: 'ULP PADANG BARAT', manajer: 'Manajer UL PDG', kontak: '081234567895', alamat: 'Jl. Belanti Padang', status: 'Aktif', unitId: 'UL1' },
  { id: 'ulp-6', kodeULP: 'IDR', namaULP: 'ULP INDARUNG', manajer: 'Manajer UL PDG', kontak: '081234567896', alamat: 'Jl. Raya Indarung Padang', status: 'Aktif', unitId: 'UL1' },
];

export const INITIAL_PENYULANG: Penyulang[] = [
  { id: 'pyl-1', kodePenyulang: 'PYL-AGM', namaPenyulang: 'AGAM', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', panjangKms: 45.2, jumlahTrafo: 32, status: 'Normal', unitId: 'UL2' },
  { id: 'pyl-2', kodePenyulang: 'PYL-JMB', namaPenyulang: 'JAMBEK', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', panjangKms: 38.6, jumlahTrafo: 28, status: 'Normal', unitId: 'UL2' },
  { id: 'pyl-3', kodePenyulang: 'PYL-GGK', namaPenyulang: 'GUGUK', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', panjangKms: 50.1, jumlahTrafo: 40, status: 'Normal', unitId: 'UL2' },
  { id: 'pyl-4', kodePenyulang: 'PYL-BIO', namaPenyulang: 'BIARO', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', panjangKms: 32.4, jumlahTrafo: 22, status: 'Normal', unitId: 'UL2' },
  { id: 'pyl-5', kodePenyulang: 'PYL-BSO', namaPenyulang: 'BASO', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', panjangKms: 41.0, jumlahTrafo: 30, status: 'Normal', unitId: 'UL2' },
  { id: 'pyl-6', kodePenyulang: 'PYL-MNJ', namaPenyulang: 'MANINJAU', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', panjangKms: 55.8, jumlahTrafo: 45, status: 'Normal', unitId: 'UL2' },
  { id: 'pyl-7', kodePenyulang: 'PYL-PDL', namaPenyulang: 'PADANG LUAR', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', panjangKms: 29.5, jumlahTrafo: 20, status: 'Normal', unitId: 'UL2' },
  { id: 'pyl-8', kodePenyulang: 'PYL-KRJ', namaPenyulang: 'KURANJI', ulpId: 'ulp-4', ulpName: 'ULP KURANJI', panjangKms: 48.0, jumlahTrafo: 35, status: 'Normal', unitId: 'UL1' },
  { id: 'pyl-9', kodePenyulang: 'PYL-PAU', namaPenyulang: 'PAUH', ulpId: 'ulp-4', ulpName: 'ULP KURANJI', panjangKms: 42.1, jumlahTrafo: 31, status: 'Normal', unitId: 'UL1' },
  { id: 'pyl-10', kodePenyulang: 'PYL-BLT', namaPenyulang: 'BELANTI', ulpId: 'ulp-5', ulpName: 'ULP PADANG BARAT', panjangKms: 36.7, jumlahTrafo: 26, status: 'Normal', unitId: 'UL1' },
  { id: 'pyl-11', kodePenyulang: 'PYL-TBG', namaPenyulang: 'TABING', ulpId: 'ulp-5', ulpName: 'ULP PADANG BARAT', panjangKms: 39.4, jumlahTrafo: 29, status: 'Normal', unitId: 'UL1' },
  { id: 'pyl-12', kodePenyulang: 'PYL-IDR', namaPenyulang: 'INDARUNG', ulpId: 'ulp-6', ulpName: 'ULP INDARUNG', panjangKms: 52.3, jumlahTrafo: 38, status: 'Normal', unitId: 'UL1' },
  { id: 'pyl-13', kodePenyulang: 'PYL-SLK', namaPenyulang: 'SOLOK KOTA', ulpId: 'ulp-3', ulpName: 'ULP SOLOK', panjangKms: 46.0, jumlahTrafo: 33, status: 'Normal', unitId: 'UL3' },
  { id: 'pyl-14', kodePenyulang: 'PYL-PYK', namaPenyulang: 'PAYAKUMBUH KOTA', ulpId: 'ulp-2', ulpName: 'ULP PAYAKUMBUH', panjangKms: 44.5, jumlahTrafo: 30, status: 'Normal', unitId: 'UL4' },
];

export const INITIAL_REGU: ReguROW[] = [
  { id: 'regu-1', kodeRegu: 'REG-01', namaRegu: 'REGU ALPHA', penanggungJawab: 'Budi Santoso', jumlahAnggota: 5, kontak: '081234567891', status: 'Aktif', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', unitId: 'UL2' },
  { id: 'regu-2', kodeRegu: 'REG-02', namaRegu: 'REGU BETA', penanggungJawab: 'Dedi Kurniawan', jumlahAnggota: 5, kontak: '081234567892', status: 'Aktif', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', unitId: 'UL2' },
  { id: 'regu-3', kodeRegu: 'REG-03', namaRegu: 'REGU GAMMA', penanggungJawab: 'Rizky Ramadhan', jumlahAnggota: 5, kontak: '081234567893', status: 'Aktif', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', unitId: 'UL2' },
  { id: 'regu-4', kodeRegu: 'REG-04', namaRegu: 'REGU KURANJI 01', penanggungJawab: 'Ferdiansyah', jumlahAnggota: 5, kontak: '081234567894', status: 'Aktif', ulpId: 'ulp-4', ulpName: 'ULP KURANJI', unitId: 'UL1' },
];

export const INITIAL_PETUGAS: Petugas[] = [
  { id: 'ptg-1', nip: '1988010101', nama: 'BUDI SANTOSO', reguId: 'regu-1', reguName: 'REGU ALPHA', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', noHp: '081234567891', role: 'User', status: 'Aktif', unitId: 'UL2' },
  { id: 'ptg-2', nip: '1988010102', nama: 'ANDI PRATAMA', reguId: 'regu-1', reguName: 'REGU ALPHA', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', noHp: '081234567892', role: 'User', status: 'Aktif', unitId: 'UL2' },
  { id: 'ptg-3', nip: '1988010103', nama: 'EKO SAPUTRA', reguId: 'regu-1', reguName: 'REGU ALPHA', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', noHp: '081234567893', role: 'User', status: 'Aktif', unitId: 'UL2' },
  { id: 'ptg-4', nip: '1988010104', nama: 'DEDI KURNIAWAN', reguId: 'regu-2', reguName: 'REGU BETA', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', noHp: '081234567894', role: 'User', status: 'Aktif', unitId: 'UL2' },
  { id: 'ptg-5', nip: '1988010105', nama: 'HENDRA WIJAYA', reguId: 'regu-2', reguName: 'REGU BETA', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', noHp: '081234567895', role: 'User', status: 'Aktif', unitId: 'UL2' },
  { id: 'ptg-6', nip: '1988010106', nama: 'RIZKY RAMADHAN', reguId: 'regu-3', reguName: 'REGU GAMMA', ulpId: 'ulp-1', ulpName: 'ULP BUKITTINGGI KOTA', noHp: '081234567896', role: 'User', status: 'Aktif', unitId: 'UL2' },
  { id: 'ptg-7', nip: '1988010107', nama: 'FERDIANSYAH', reguId: 'regu-4', reguName: 'REGU KURANJI 01', ulpId: 'ulp-4', ulpName: 'ULP KURANJI', noHp: '081234567897', role: 'User', status: 'Aktif', unitId: 'UL1' },
];

export const INITIAL_WORK_ORDERS: WorkOrder[] = [];

export const INITIAL_REALISASI: Realisasi[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  namaUnitLayanan: 'UL BUKITTINGGI',
  logoAplikasiUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80',
  logoInstansiUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_PLN.png',
  loginBgUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1600&q=80',
  themeColor: 'PLN Blue',
  footerText: '© 13307BKT - 2026 APHRO - Asset Protection & Hazard Response Operations. PLN ES UP4 Sumatera Barat UL BUKITTINGGI. All Rights Reserved.',
  versiAplikasi: 'v2.4.0 Enterprise',
  gasWebAppUrl: getActiveGasConfig().gasWebAppUrl,
  kontakAdmin: {
    whatsapp: '6281234567890',
    email: 'helpdesk.aphro@pln.co.id',
    alamat: 'Kantor PLN UL BUKITTINGGI',
  },
};

export const INITIAL_LOGS: AuditLog[] = [];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
