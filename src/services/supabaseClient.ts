import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://npeeobcpffmlyiknszhh.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZWVvYmNwZmZtbHlpa25zemhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzQ0MzAsImV4cCI6MjEwNDQxMDQzMH0.-48iDwqMfKHBfVcJx6A_McxWl2StzFjzyHFPaKMZq98';
export const SUPABASE_DATABASE_NAME = 'APHRO-Database';

// Get active configuration (from localStorage or defaults)
export function getSupabaseConfig(): { url: string; key: string } {
  try {
    const customUrl = localStorage.getItem('aphro_supabase_url');
    const customKey = localStorage.getItem('aphro_supabase_key');
    return {
      url: (customUrl && customUrl.trim()) || DEFAULT_SUPABASE_URL,
      key: (customKey && customKey.trim()) || DEFAULT_SUPABASE_ANON_KEY,
    };
  } catch {
    return {
      url: DEFAULT_SUPABASE_URL,
      key: DEFAULT_SUPABASE_ANON_KEY,
    };
  }
}

export const SUPABASE_URL = getSupabaseConfig().url;
export const SUPABASE_ANON_KEY = getSupabaseConfig().key;

// Standard Supabase Table Names in APHRO-Database
export const SUPABASE_TABLES = {
  INISIASI: 'INISIASI',
  WORK_ORDER: 'WORK_ORDER',
  REALISASI: 'REALISASI',
  ABSENSI: 'ABSENSI',
  USERS: 'USERS',
  ULP: 'ULP',
  PENYULANG: 'PENYULANG',
  REGU_ROW: 'REGU_ROW',
  PETUGAS: 'PETUGAS',
} as const;

let activeClient: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const supabase = activeClient;

export function reinitSupabaseClient(url: string, key: string): SupabaseClient {
  activeClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  try {
    localStorage.setItem('aphro_supabase_url', url);
    localStorage.setItem('aphro_supabase_key', key);
  } catch {
    // Ignore storage err
  }
  return activeClient;
}

export function getClient(): SupabaseClient {
  return activeClient;
}

export const SUPABASE_SETUP_SQL = `-- ========================================================
-- APHRO-Database Complete SQL Setup Script (Supabase PostgreSQL)
-- Jalankan skrip ini di: Supabase Dashboard > SQL Editor > Run (Ctrl+Enter)
-- Skrip ini akan membuat 9 Tabel lengkap dengan PRIMARY KEY dan menonaktifkan RLS
-- ========================================================

-- 1. TABEL INISIASI (Master Unit Layanan)
CREATE TABLE IF NOT EXISTS public."INISIASI" (
  "ID" TEXT PRIMARY KEY,
  "Kode_UL" TEXT,
  "Nama_UL" TEXT,
  "Folder_id_Foto" TEXT,
  "Folder_id_absensi" TEXT
);

-- 2. TABEL ULP (Unit Layanan Pelanggan)
CREATE TABLE IF NOT EXISTS public."ULP" (
  "ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "Kode_ULP" TEXT,
  "Nama_ULP" TEXT,
  "Manajer" TEXT,
  "Kontak" TEXT,
  "Alamat" TEXT,
  "Status" TEXT DEFAULT 'Aktif'
);

-- 3. TABEL PENYULANG (Data Penyulang)
CREATE TABLE IF NOT EXISTS public."PENYULANG" (
  "ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "Kode_Penyulang" TEXT,
  "Nama_Penyulang" TEXT,
  "ULP" TEXT
);

-- 4. TABEL REGU_ROW (Regu Pemeliharaan ROW)
CREATE TABLE IF NOT EXISTS public."REGU_ROW" (
  "ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "Kode_Regu" TEXT,
  "Nama_Regu" TEXT,
  "Jumlah_Anggota" INTEGER DEFAULT 4,
  "Kontak" TEXT,
  "ULP" TEXT,
  "Status" TEXT DEFAULT 'Aktif'
);

-- 5. TABEL PETUGAS (Daftar Personel / Petugas)
CREATE TABLE IF NOT EXISTS public."PETUGAS" (
  "ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "Nama" TEXT,
  "Regu" TEXT,
  "ULP" TEXT,
  "Role" TEXT DEFAULT 'Anggota',
  "Status" TEXT DEFAULT 'Aktif'
);

-- 6. TABEL USERS (Daftar Akun Login Pengguna)
CREATE TABLE IF NOT EXISTS public."USERS" (
  "UserID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "Username" TEXT,
  "Password" TEXT DEFAULT 'admin123',
  "Role" TEXT DEFAULT 'User',
  "ULP" TEXT,
  "Status" TEXT DEFAULT 'Aktif'
);

-- 7. TABEL WORK_ORDER (Perintah Kerja Pemotongan/Penebangan)
CREATE TABLE IF NOT EXISTS public."WORK_ORDER" (
  "WO_ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "Nomor_WO" TEXT,
  "PEKERJAAN" TEXT DEFAULT 'NORMAL',
  "Tanggal" TEXT,
  "ULP" TEXT,
  "PENYULANG" TEXT,
  "REGU_ROW" TEXT,
  "PETUGAS" TEXT,
  "VOLUME" NUMERIC DEFAULT 0,
  "SATUAN" TEXT DEFAULT 'Pohon',
  "TOTAL_REALISASI" NUMERIC DEFAULT 0,
  "SATUAN_TOTAL_REALISASI" TEXT DEFAULT 'Pohon',
  "WO_MULAI" TEXT,
  "WO_AKHIR" TEXT,
  "STATUS" TEXT DEFAULT 'DRAFT',
  "Created_At" TEXT
);

-- 8. TABEL REALISASI (Hasil Eksekusi Pekerjaan ROW)
CREATE TABLE IF NOT EXISTS public."REALISASI" (
  "REALISASI_ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "WO_ID" TEXT,
  "Nomor_WO" TEXT,
  "Tanggal" TEXT,
  "ULP" TEXT,
  "PENYULANG" TEXT,
  "REGU_ROW" TEXT,
  "PETUGAS" TEXT,
  "TIPE_POHON" TEXT,
  "LATITUDE" NUMERIC,
  "LONGITUDE" NUMERIC,
  "JUMLAH_POHON" NUMERIC DEFAULT 0,
  "SATUAN" TEXT DEFAULT 'Pohon',
  "FOTO_SEBELUM" TEXT,
  "FOTO_PROSES" TEXT,
  "FOTO_SETELAH" TEXT,
  "STATUS" TEXT DEFAULT 'SELESAI',
  "WAKTU" TEXT
);

-- 9. TABEL ABSENSI (Absensi Masuk & Pulang Petugas)
CREATE TABLE IF NOT EXISTS public."ABSENSI" (
  "ID" TEXT PRIMARY KEY,
  "unitId" TEXT DEFAULT 'UL1',
  "Tanggal" TEXT,
  "Petugas" TEXT,
  "Regu" TEXT,
  "ULP" TEXT,
  "Status_Masuk" TEXT,
  "Waktu_Masuk" TEXT,
  "Foto_Masuk" TEXT,
  "Lat_Masuk" NUMERIC,
  "Long_Masuk" NUMERIC,
  "Status_Pulang" TEXT,
  "Waktu_Pulang" TEXT,
  "Foto_Pulang" TEXT,
  "Lat_Pulang" NUMERIC,
  "Long_Pulang" NUMERIC
);

-- ========================================================
-- 10. DISABLE ROW LEVEL SECURITY (RLS) UNTUK SEMUA TABEL
-- ========================================================
ALTER TABLE IF EXISTS public."INISIASI" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."ULP" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."PENYULANG" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."REGU_ROW" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."PETUGAS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."USERS" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."WORK_ORDER" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."REALISASI" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."ABSENSI" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."LOG_ACTIVITY" DISABLE ROW LEVEL SECURITY;

-- 11. BERIKAN HAK AKSES LENGKAP KEPADA ROLE anon & authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 12. JIKA TABEL SUDAH ADA SEBELUMNYA TANPA PRIMARY KEY, TAMBAHKAN PRIMARY KEY SECARA AMAN:
DO $$
BEGIN
  -- INISIASI
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."INISIASI"'::regclass AND contype = 'p') THEN
    BEGIN
      ALTER TABLE public."INISIASI" ADD PRIMARY KEY ("ID");
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- ULP
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."ULP"'::regclass AND contype = 'p') THEN
    BEGIN
      ALTER TABLE public."ULP" ADD PRIMARY KEY ("ID");
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- PENYULANG
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."PENYULANG"'::regclass AND contype = 'p') THEN
    BEGIN
      ALTER TABLE public."PENYULANG" ADD PRIMARY KEY ("ID");
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- REGU_ROW
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."REGU_ROW"'::regclass AND contype = 'p') THEN
    BEGIN
      ALTER TABLE public."REGU_ROW" ADD PRIMARY KEY ("ID");
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- PETUGAS
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."PETUGAS"'::regclass AND contype = 'p') THEN
    BEGIN
      ALTER TABLE public."PETUGAS" ADD PRIMARY KEY ("ID");
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- USERS
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."USERS"'::regclass AND contype = 'p') THEN
    BEGIN
      ALTER TABLE public."USERS" ADD PRIMARY KEY ("UserID");
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- WORK_ORDER
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."WORK_ORDER"'::regclass AND contype = 'p') THEN
    BEGIN
      ALTER TABLE public."WORK_ORDER" ADD PRIMARY KEY ("WO_ID");
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- REALISASI
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."REALISASI"'::regclass AND contype = 'p') THEN
    BEGIN
      ALTER TABLE public."REALISASI" ADD PRIMARY KEY ("REALISASI_ID");
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- ABSENSI
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public."ABSENSI"'::regclass AND contype = 'p') THEN
    BEGIN
      ALTER TABLE public."ABSENSI" ADD PRIMARY KEY ("ID");
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
`;

