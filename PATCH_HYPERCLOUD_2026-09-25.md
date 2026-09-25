# APHRO — HyperCloudHost Stabilization Patch (2026-09-25)

## Tujuan
Menjadikan HyperCloudHost PostgreSQL sebagai satu-satunya sumber data online untuk data aplikasi utama dan mencegah aplikasi menampilkan data palsu/mock ketika PostgreSQL bermasalah.

## Perubahan utama

1. **Mock database dimatikan untuk runtime**
   - `server/database.ts` tidak lagi mengembalikan data `mock_db.json` jika koneksi PostgreSQL gagal.
   - Jika `HYPERCLOUD_DATABASE_URL` tidak ada atau query PostgreSQL gagal, API mengembalikan error nyata.
   - Ini mencegah kasus aplikasi terlihat "terisi" padahal database HyperCloud tidak terbaca.

2. **JWT diperbaiki**
   - Login membuat JWT HS256 bertanda tangan menggunakan `JWT_SECRET`.
   - Middleware `requireAuth` memverifikasi signature dan expiry.
   - Token lama `hc-jwt-*` tidak lagi dianggap valid.
   - Setelah deployment, semua pengguna perlu login ulang.

3. **Isolasi unit diperketat**
   - User non-Admin hanya dapat membaca/menulis data unit pada JWT-nya.
   - Admin/Adm/SuperAdmin dapat memilih unit lain atau ALL sesuai hak akses.
   - `unitId` dari URL tidak boleh digunakan user biasa untuk membaca unit lain.

4. **Endpoint data utama wajib autentikasi**
   - WORK_ORDER
   - REALISASI
   - ABSENSI
   - Detail REALISASI
   - Operasi POST/PUT REALISASI dan ABSENSI

5. **Normalisasi data diperbaiki**
   - REALISASI tidak lagi mengisi `petugasId` dengan hard-code `usr-1`.
   - ID Work Order/Realisasi tidak lagi dibuat-buat saat membaca data database.
   - ID ULP/Penyulang/Regu tidak lagi otomatis diisi dengan `UL1`, `PYL-1`, atau `REG-1`.
   - Tanggal tidak lagi otomatis berubah menjadi tanggal hari ini jika database tidak memiliki tanggal.

6. **Konfigurasi `.env.example` dibersihkan**
   - Tidak berisi password database produksi.
   - Menambahkan `JWT_SECRET`.
   - Menetapkan `VITE_API_URL=https://api.aphro-row.my.id`.

7. **Label UI**
   - Label database pada Sidebar/Navbar diarahkan ke HyperCloudHost PostgreSQL, bukan Supabase.

## Konfigurasi server yang wajib ada

```env
HYPERCLOUD_DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME
JWT_SECRET=SECRET_RANDOM_MINIMAL_32_KARAKTER
```

Jangan menaruh password database produksi di source/frontend/Vercel.

## Deployment

Backend:
```bash
npm run build
```

Lalu restart Node.js API di HyperCloudHost.

Frontend:
```bash
npm run build
```

Setelah backend baru aktif:
1. Hapus sesi/login lama pada browser.
2. Login ulang.
3. Periksa `/api/health`.
4. Periksa data WORK_ORDER, ABSENSI, REALISASI, dan Master Data.

## Catatan penting

File migrasi Supabase lama masih ada sebagai arsip/alat migrasi. Jalur data aplikasi utama yang diperbaiki dalam patch ini adalah:

`Frontend -> https://api.aphro-row.my.id -> Node.js -> PostgreSQL HyperCloudHost`

Bukan:

`Frontend -> Supabase`

