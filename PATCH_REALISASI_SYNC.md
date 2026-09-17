# Patch Realisasi Sync

Perbaikan khusus sinkronisasi Realisasi:

- Payload Supabase sebelumnya mengirim `FOTO_SEBELUM_URL` dan `FOTO_SETELAH_URL`.
- Skema REALISASI aplikasi menggunakan `Foto_Sebelum` dan `Foto_Sesudah`.
- Payload sekarang menggunakan nama kolom yang sesuai sehingga upsert tidak ditolak PostgREST karena kolom tidak ditemukan.
- Error Supabase dibuat lebih informatif (message/code/details/hint) untuk diagnosis jika masih ada masalah.
- Modul lain tidak diubah.
