# Digital Falak

Digital Falak adalah aplikasi ilmu falak berbasis **koordinat nyata + engine astronomi + metode hisab yang dapat dikelola**. Aplikasi tidak mengambil jadwal salat jadi dari tabel Kemenag.

## Arsitektur perhitungan

### Waktu salat
- Primary engine online: **NREL Solar Position Algorithm (SPA)** melalui `/api/hisab`.
- Input: tanggal, latitude, longitude, elevasi, zona waktu, tekanan, suhu, refraksi, dan parameter metode.
- Offline fallback: engine solar lokal agar PWA tetap dapat memberi estimasi saat jaringan putus.
- Parameter fikih/metode dipisahkan dari engine astronomi.

### Kiblat
- Target azimut: **GeographicLib WGS84 inverse geodesic** dari titik pengguna menuju Ka'bah.
- Sensor HP hanya menentukan heading perangkat.
- UI membedakan sensor absolut vs sensor relatif dan memberi peringatan saat sensor tidak layak dianggap presisi.
- Rashdul kiblat production dihitung server dengan azimut Matahari NREL SPA.

### Hilal
Masih berstatus laboratorium. Fase Bulan yang tampil hanyalah indikator sederhana. Tinggi hilal, elongasi, ijtimak, moonset, dan kriteria imkan rukyat belum dijadikan hasil final sampai metode ahli dimasukkan.

## Metode referensi saat ini

Metode published awal: **Kemenag RI — Referensi Falak** (belum diberi status “terverifikasi ahli”).

Parameter awal:
- Subuh: Matahari -20°
- Isya: Matahari -18°
- Dhuha: altitude +4.5°
- Asar: faktor bayangan 1x
- Ihtiyat: configurable per waktu
- Terbit: configurable correction
- Atmosfer: suhu, tekanan, refraksi configurable

Metode ini adalah baseline untuk diskusi dengan ahli falak, bukan keputusan final.

## Admin / Method Studio

Buka `/admin`.

Fitur:
- signup/login Supabase Auth
- role admin terpisah di `df_admin_users`
- metode: draft / published / archived
- nama, versi, sumber, referensi, engine
- parameter waktu salat
- status verifikasi ahli
- Formula Lab
- uji formula sebelum disimpan
- formula published otomatis dibaca aplikasi

Akun baru **tidak otomatis menjadi admin**. Setelah akun dibuat, owner perlu memasukkan user ke `df_admin_users`. Ini sengaja untuk mencegah orang luar mengubah rumus.

Contoh otorisasi setelah ahli membuat akun:

```sql
insert into public.df_admin_users (user_id, display_name, role)
select id, 'Nama Ahli Falak', 'falak_expert'
from auth.users
where email = 'email-ahli@example.com'
on conflict (user_id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    is_active = true,
    updated_at = now();
```

## Formula engine

Formula custom tidak menerima JavaScript bebas. Ekspresi dibatasi ke angka, operator, variabel yang didefinisikan, dan fungsi matematika whitelist.

Fungsi:
`sind`, `cosd`, `tand`, `cotd`, `asind`, `acosd`, `atand`, `atan2d`, `sqrt`, `abs`, `min`, `max`, `round`, `floor`, `ceil`.

Formula slot yang tersedia saat ini:
- `hour_angle`: referensi persamaan sudut waktu (NREL tetap menghitung crossing utama di internal SPA).
- `asr_target_altitude`: **dipakai engine** untuk menentukan target altitude Asar.

## Supabase sementara

Seluruh data Digital Falak memakai prefix `df_`, terisolasi dari tabel Teman Digital:

- `df_falak_methods`
- `df_formula_definitions`
- `df_admin_users`
- `df_admin_requests`
- `df_saved_locations`
- `df_calculation_history`
- `df_user_settings`

Semua tabel exposed menggunakan RLS.

## PWA

Aplikasi memiliki manifest + service worker dan tetap memiliki perhitungan fallback lokal. Perhitungan NREL SPA presisi membutuhkan koneksi ke route server.

## Menjalankan

```bash
npm install
cp .env.example .env.local
npm run dev
```

Tidak pernah masukkan `service_role` ke `NEXT_PUBLIC_*`.
