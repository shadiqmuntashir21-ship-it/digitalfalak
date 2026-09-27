# Digital Falak

Laboratorium ilmu falak digital berbasis koordinat. Engine hisab berjalan di aplikasi dan tidak bergantung pada database jadwal jadi.

## Fitur versi awal

- Waktu salat berdasarkan koordinat, tanggal, zona waktu, elevasi, dan parameter metode.
- Arah kiblat (bearing terhadap Utara Sejati) + jarak lingkaran besar.
- Rashdul kiblat lokal berbasis perpotongan azimut Matahari dan kiblat.
- Data Matahari: Julian Day, deklinasi, equation of time, solar noon.
- Kalender Hijriah sipil/tabular.
- Lab hilal dengan kerangka modul lunar (fase sinodik hanya estimasi prototipe).
- GPS atau koordinat manual.
- Parameter metode dapat disetel tanpa mengubah UI.
- PWA installable + service worker.
- Supabase sementara hanya untuk konfigurasi/metode dan fondasi data pengguna.

## Arsitektur

`lib/falak/*` adalah calculation engine independen. Supabase **bukan sumber jadwal salat**. Metode/rangkaian rumus yang diberikan kemudian dapat ditambahkan sebagai modul atau parameter baru tanpa membongkar tampilan.

## Supabase sementara

Project development saat ini memakai Supabase milik project lain secara sementara. Seluruh tabel Digital Falak memakai prefix `df_` supaya mudah dipisahkan/migrasikan:

- `df_falak_methods`
- `df_saved_locations`
- `df_calculation_history`
- `df_user_settings`

Tabel existing dari aplikasi lain tidak disentuh.

## Menjalankan

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Catatan metodologi

Parameter default saat ini adalah **metode uji**, bukan klaim sebagai rumus final/otoritatif. Sebelum digunakan sebagai rujukan ibadah, masukkan dan verifikasi rumus rujukan yang disepakati.
