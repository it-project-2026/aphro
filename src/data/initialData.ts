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

export const INITIAL_USERS: User[] = [];

export const INITIAL_ULP: ULP[] = [];

export const INITIAL_PENYULANG: Penyulang[] = [];

export const INITIAL_REGU: ReguROW[] = [];

export const INITIAL_PETUGAS: Petugas[] = [
  // BUKITTINGGI
  // TIM ROW 01 Koto Tuo
  { id: 'ptg-bkt-1-1', nip: '1322701', nama: 'Rahmat Hidayat', reguId: 'rgu-bukittinggi-1', reguName: 'TIM ROW 01 Koto Tuo', ulpId: 'ulp-bkt-1', ulpName: 'ULP KOTO TUO', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711001' },
  { id: 'ptg-bkt-1-2', nip: '1322702', nama: 'Andi Wijaya', reguId: 'rgu-bukittinggi-1', reguName: 'TIM ROW 01 Koto Tuo', ulpId: 'ulp-bkt-1', ulpName: 'ULP KOTO TUO', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711002' },
  { id: 'ptg-bkt-1-3', nip: '1322703', nama: 'Hendra Putra', reguId: 'rgu-bukittinggi-1', reguName: 'TIM ROW 01 Koto Tuo', ulpId: 'ulp-bkt-1', ulpName: 'ULP KOTO TUO', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711003' },
  { id: 'ptg-bkt-1-4', nip: '1322704', nama: 'Doni Kurniawan', reguId: 'rgu-bukittinggi-1', reguName: 'TIM ROW 01 Koto Tuo', ulpId: 'ulp-bkt-1', ulpName: 'ULP KOTO TUO', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711004' },

  // TIM ROW 02 Baso
  { id: 'ptg-bkt-2-1', nip: '1322601', nama: 'Surya Ramadhan', reguId: 'rgu-bukittinggi-2', reguName: 'TIM ROW 02 Baso', ulpId: 'ulp-bkt-2', ulpName: 'ULP BASO', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126712001' },
  { id: 'ptg-bkt-2-2', nip: '1322602', nama: 'M. Rizky', reguId: 'rgu-bukittinggi-2', reguName: 'TIM ROW 02 Baso', ulpId: 'ulp-bkt-2', ulpName: 'ULP BASO', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126712002' },
  { id: 'ptg-bkt-2-3', nip: '1322603', nama: 'Taufik Hidayat', reguId: 'rgu-bukittinggi-2', reguName: 'TIM ROW 02 Baso', ulpId: 'ulp-bkt-2', ulpName: 'ULP BASO', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126712003' },
  { id: 'ptg-bkt-2-4', nip: '1322604', nama: 'Irfan Mansyur', reguId: 'rgu-bukittinggi-2', reguName: 'TIM ROW 02 Baso', ulpId: 'ulp-bkt-2', ulpName: 'ULP BASO', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126712004' },

  // TIM ROW 03 Bukittinggi Kota
  { id: 'ptg-bkt-3-1', nip: '1322101', nama: 'Budi Santoso', reguId: 'rgu-bukittinggi-3', reguName: 'TIM ROW 03 Bukittinggi Kota', ulpId: 'ulp-bkt-3', ulpName: 'ULP BUKITTINGGI', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126713001' },
  { id: 'ptg-bkt-3-2', nip: '1322102', nama: 'Ahmad Fauzi', reguId: 'rgu-bukittinggi-3', reguName: 'TIM ROW 03 Bukittinggi Kota', ulpId: 'ulp-bkt-3', ulpName: 'ULP BUKITTINGGI', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126713002' },
  { id: 'ptg-bkt-3-3', nip: '1322103', nama: 'Rizky Pratama', reguId: 'rgu-bukittinggi-3', reguName: 'TIM ROW 03 Bukittinggi Kota', ulpId: 'ulp-bkt-3', ulpName: 'ULP BUKITTINGGI', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126713003' },
  { id: 'ptg-bkt-3-4', nip: '1322104', nama: 'Fikri Ardiansyah', reguId: 'rgu-bukittinggi-3', reguName: 'TIM ROW 03 Bukittinggi Kota', ulpId: 'ulp-bkt-3', ulpName: 'ULP BUKITTINGGI', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126713004' },

  // TIM ROW 04 Padang Panjang
  { id: 'ptg-bkt-4-1', nip: '1322201', nama: 'Eko Prasetyo', reguId: 'rgu-bukittinggi-4', reguName: 'TIM ROW 04 Padang Panjang', ulpId: 'ulp-bkt-4', ulpName: 'ULP PADANG PANJANG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126714001' },
  { id: 'ptg-bkt-4-2', nip: '1322202', nama: 'Dedi Kurnia', reguId: 'rgu-bukittinggi-4', reguName: 'TIM ROW 04 Padang Panjang', ulpId: 'ulp-bkt-4', ulpName: 'ULP PADANG PANJANG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126714002' },
  { id: 'ptg-bkt-4-3', nip: '1322203', nama: 'Agus Setiawan', reguId: 'rgu-bukittinggi-4', reguName: 'TIM ROW 04 Padang Panjang', ulpId: 'ulp-bkt-4', ulpName: 'ULP PADANG PANJANG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126714003' },
  { id: 'ptg-bkt-4-4', nip: '1322204', nama: 'Bayu Nurhadi', reguId: 'rgu-bukittinggi-4', reguName: 'TIM ROW 04 Padang Panjang', ulpId: 'ulp-bkt-4', ulpName: 'ULP PADANG PANJANG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126714004' },

  // TIM ROW 05 Lubuk Basung 1
  { id: 'ptg-bkt-5-1', nip: '1322401', nama: 'Yudi Hermawan', reguId: 'rgu-bukittinggi-5', reguName: 'TIM ROW 05 Lubuk Basung 1', ulpId: 'ulp-bkt-5', ulpName: 'ULP LUBUK BASUNG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126715001' },
  { id: 'ptg-bkt-5-2', nip: '1322402', nama: 'Aris Munandar', reguId: 'rgu-bukittinggi-5', reguName: 'TIM ROW 05 Lubuk Basung 1', ulpId: 'ulp-bkt-5', ulpName: 'ULP LUBUK BASUNG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126715002' },
  { id: 'ptg-bkt-5-3', nip: '1322403', nama: 'Deni Saputra', reguId: 'rgu-bukittinggi-5', reguName: 'TIM ROW 05 Lubuk Basung 1', ulpId: 'ulp-bkt-5', ulpName: 'ULP LUBUK BASUNG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126715003' },
  { id: 'ptg-bkt-5-4', nip: '1322404', nama: 'Ferry Anugerah', reguId: 'rgu-bukittinggi-5', reguName: 'TIM ROW 05 Lubuk Basung 1', ulpId: 'ulp-bkt-5', ulpName: 'ULP LUBUK BASUNG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126715004' },

  // TIM ROW 06 Lubuk Basung 2
  { id: 'ptg-bkt-6-1', nip: '1322411', nama: 'Heri Susanto', reguId: 'rgu-bukittinggi-6', reguName: 'TIM ROW 06 Lubuk Basung 2', ulpId: 'ulp-bkt-5', ulpName: 'ULP LUBUK BASUNG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126716001' },
  { id: 'ptg-bkt-6-2', nip: '1322412', nama: 'Roni Pasla', reguId: 'rgu-bukittinggi-6', reguName: 'TIM ROW 06 Lubuk Basung 2', ulpId: 'ulp-bkt-5', ulpName: 'ULP LUBUK BASUNG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126716002' },
  { id: 'ptg-bkt-6-3', nip: '1322413', nama: 'Arief Budiman', reguId: 'rgu-bukittinggi-6', reguName: 'TIM ROW 06 Lubuk Basung 2', ulpId: 'ulp-bkt-5', ulpName: 'ULP LUBUK BASUNG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126716003' },
  { id: 'ptg-bkt-6-4', nip: '1322414', nama: 'M. Ilham', reguId: 'rgu-bukittinggi-6', reguName: 'TIM ROW 06 Lubuk Basung 2', ulpId: 'ulp-bkt-5', ulpName: 'ULP LUBUK BASUNG', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126716004' },

  // TIM ROW 07 Lubuk Sikaping 1
  { id: 'ptg-bkt-7-1', nip: '1322301', nama: 'Rudi Hartono', reguId: 'rgu-bukittinggi-7', reguName: 'TIM ROW 07 Lubuk Sikaping 1', ulpId: 'ulp-bkt-7', ulpName: 'ULP LUBUK SIKAPING', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126717001' },
  { id: 'ptg-bkt-7-2', nip: '1322302', nama: 'Ade Putra', reguId: 'rgu-bukittinggi-7', reguName: 'TIM ROW 07 Lubuk Sikaping 1', ulpId: 'ulp-bkt-7', ulpName: 'ULP LUBUK SIKAPING', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126717002' },
  { id: 'ptg-bkt-7-3', nip: '1322303', nama: 'Bambang Irawan', reguId: 'rgu-bukittinggi-7', reguName: 'TIM ROW 07 Lubuk Sikaping 1', ulpId: 'ulp-bkt-7', ulpName: 'ULP LUBUK SIKAPING', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126717003' },
  { id: 'ptg-bkt-7-4', nip: '1322304', nama: 'Diki Wahyudi', reguId: 'rgu-bukittinggi-7', reguName: 'TIM ROW 07 Lubuk Sikaping 1', ulpId: 'ulp-bkt-7', ulpName: 'ULP LUBUK SIKAPING', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126717004' },

  // TIM ROW 08 Lubuk Sikaping 2
  { id: 'ptg-bkt-8-1', nip: '1322311', nama: 'Syaiful Bahri', reguId: 'rgu-bukittinggi-8', reguName: 'TIM ROW 08 Lubuk Sikaping 2', ulpId: 'ulp-bkt-7', ulpName: 'ULP LUBUK SIKAPING', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126718001' },
  { id: 'ptg-bkt-8-2', nip: '1322312', nama: 'Zulfikar', reguId: 'rgu-bukittinggi-8', reguName: 'TIM ROW 08 Lubuk Sikaping 2', ulpId: 'ulp-bkt-7', ulpName: 'ULP LUBUK SIKAPING', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126718002' },
  { id: 'ptg-bkt-8-3', nip: '1322313', nama: 'Iwan Setiawan', reguId: 'rgu-bukittinggi-8', reguName: 'TIM ROW 08 Lubuk Sikaping 2', ulpId: 'ulp-bkt-7', ulpName: 'ULP LUBUK SIKAPING', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126718003' },
  { id: 'ptg-bkt-8-4', nip: '1322314', nama: 'Nanda Pratama', reguId: 'rgu-bukittinggi-8', reguName: 'TIM ROW 08 Lubuk Sikaping 2', ulpId: 'ulp-bkt-7', ulpName: 'ULP LUBUK SIKAPING', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126718004' },

  // TIM ROW 09 Simpang Empat 1
  { id: 'ptg-bkt-9-1', nip: '1322501', nama: 'Irwan Syahputra', reguId: 'rgu-bukittinggi-9', reguName: 'TIM ROW 09 Simpang Empat 1', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126719001' },
  { id: 'ptg-bkt-9-2', nip: '1322502', nama: 'Rio Ferdinand', reguId: 'rgu-bukittinggi-9', reguName: 'TIM ROW 09 Simpang Empat 1', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126719002' },
  { id: 'ptg-bkt-9-3', nip: '1322503', nama: 'Bobby Kurnia', reguId: 'rgu-bukittinggi-9', reguName: 'TIM ROW 09 Simpang Empat 1', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126719003' },
  { id: 'ptg-bkt-9-4', nip: '1322504', nama: 'Aulia Rahman', reguId: 'rgu-bukittinggi-9', reguName: 'TIM ROW 09 Simpang Empat 1', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126719004' },

  // TIM ROW 10 Simpang Empat 2
  { id: 'ptg-bkt-10-1', nip: '1322511', nama: 'Teguh Prasetyo', reguId: 'rgu-bukittinggi-10', reguName: 'TIM ROW 10 Simpang Empat 2', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711001' },
  { id: 'ptg-bkt-10-2', nip: '1322512', nama: 'Wahyu Hidayat', reguId: 'rgu-bukittinggi-10', reguName: 'TIM ROW 10 Simpang Empat 2', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711002' },
  { id: 'ptg-bkt-10-3', nip: '1322513', nama: 'Faisal Akbar', reguId: 'rgu-bukittinggi-10', reguName: 'TIM ROW 10 Simpang Empat 2', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711003' },
  { id: 'ptg-bkt-10-4', nip: '1322514', nama: 'Erwin Suherman', reguId: 'rgu-bukittinggi-10', reguName: 'TIM ROW 10 Simpang Empat 2', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711004' },

  // TIM ROW 11 Simpang Empat 3
  { id: 'ptg-bkt-11-1', nip: '1322521', nama: 'Ridwan Kamil', reguId: 'rgu-bukittinggi-11', reguName: 'TIM ROW 11 Simpang Empat 3', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711101' },
  { id: 'ptg-bkt-11-2', nip: '1322522', nama: 'Farhan Maulana', reguId: 'rgu-bukittinggi-11', reguName: 'TIM ROW 11 Simpang Empat 3', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711102' },
  { id: 'ptg-bkt-11-3', nip: '1322523', nama: 'Zaki Mubarak', reguId: 'rgu-bukittinggi-11', reguName: 'TIM ROW 11 Simpang Empat 3', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711103' },
  { id: 'ptg-bkt-11-4', nip: '1322524', nama: 'Indra Gunawan', reguId: 'rgu-bukittinggi-11', reguName: 'TIM ROW 11 Simpang Empat 3', ulpId: 'ulp-bkt-9', ulpName: 'ULP SIMPANG EMPAT', unitId: 'UL2', role: 'User', status: 'Aktif', noHp: '08126711104' },
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
