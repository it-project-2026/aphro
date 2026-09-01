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

export const INITIAL_ULP: ULP[] = [];

export const INITIAL_PENYULANG: Penyulang[] = [];

export const INITIAL_REGU: ReguROW[] = [];

export const INITIAL_PETUGAS: Petugas[] = [];

export const INITIAL_WORK_ORDERS: WorkOrder[] = [];

export const INITIAL_REALISASI: Realisasi[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  namaUnitLayanan: 'PLN Electricity Services UP3 Padang',
  logoAplikasiUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80',
  logoInstansiUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_PLN.png',
  loginBgUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1600&q=80',
  themeColor: 'PLN Blue',
  footerText: '© 13307BKT- 2026 APHRO - Asset Protection & Hazard Response Operations. PLN ES UP4 Sumatera Barat. All Rights Reserved.',
  versiAplikasi: 'v2.4.0 Enterprise',
  gasWebAppUrl: getActiveGasConfig().gasWebAppUrl,
  kontakAdmin: {
    whatsapp: '6281234567890',
    email: 'helpdesk.aphro@pln.co.id',
    alamat: 'Gedung Utama PLN UP3 Padang, Jl. Jend. A. Yani No. 19, Padang',
  },
};

export const INITIAL_LOGS: AuditLog[] = [];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
