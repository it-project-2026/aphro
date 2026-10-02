# Audit Mapping: Real-time & Filtering Strategy

## 1. Tabel Target Real-Time
Berdasarkan audit fungsi aplikasi:
* **WORK_ORDER**: Ditampilkan di dashboard petugas & admin. Perubahan status harus live.
* **REALISASI**: Ditampilkan di daftar riwayat. Update/Input baru harus live.
* **ABSENSI**: Gate utama aplikasi. Perubahan status harus live untuk mengaktifkan/menonaktifkan gate.
* **USERS**: Sesekali, terutama untuk perubahan role/status aktif.

## 2. Struktur Filter Server-Side (Isolasi Data)
Akses data akan dikunci berdasarkan `unitId` dan `reguName` dari token JWT:
* **Role USER**: Filter ketat `WHERE "unitId" = jwt.unitId AND "REGU_ROW" ~ jwt.canonicalReguId`.
* **Role ADMIN/SUPERADMIN**: Filter unitId saja (akses penuh dalam unit).

## 3. Strategi NOTIFY
Trigger akan mengirim payload minimal:
```json
{ "table": "TabelName", "operation": "INSERT/UPDATE/DELETE", "id": "uuid", "unitId": "ULx" }
```

## 4. Rencana Trigger PostgreSQL
Tabel yang di-support: `WORK_ORDER`, `REALISASI`, `ABSENSI`, `USERS`.
Fungsi `notify_aphro_change` akan dibuat untuk mengolah trigger dari tabel-tabel tersebut.
