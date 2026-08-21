# Jadwal Shift Kasir

Tanggal: 2026-08-21
Status: terimplementasi di branch `feat/jadwal-shift-kasir`

> **Revisi 2026-08-21.** Versi pertama memakai jadwal per hari (`day_of_week`) dengan tabel penghubung `shift_assignments`, dan UI-nya tab terpisah. Setelah dilihat wujudnya, user menolak: jadwalnya harus menyatu di tabel Manajemen Kasir, dan sesi berlaku sama setiap hari. Dokumen ini sudah memuat model yang berlaku sekarang. Plan di `docs/superpowers/plans/2026-08-21-jadwal-shift-kasir.md` menggambarkan model pertama dan sudah tidak berlaku.

## Masalah

Kasir bisa login kapan saja. Tidak ada hubungan antara siapa yang sedang bertugas dan siapa yang bisa membuka aplikasi. Superadmin butuh cara menetapkan siapa jaga jam berapa, dan sistem harus menolak kasir yang mencoba masuk di luar jamnya.

## Keputusan

| Pertanyaan | Keputusan |
|---|---|
| Pola jadwal | Sesi berlaku sama setiap hari. Sesi 1 = 08:00-10:00 tiap hari, Sesi 2 = 10:00-12:00 tiap hari. |
| Berapa sesi per kasir | Satu. Kasir masuk satu sesi, atau tidak sama sekali. |
| Kasir sedang login lalu jam sesinya habis | Ditolak. Setiap request dicek ulang, di luar jam dapat 403 dan dilempar ke halaman login. |
| Toleransi jam | 15 menit sebelum mulai dan 15 menit setelah selesai. |
| Letak UI | Menyatu di tabel `/superadmin/cashiers`. Baris kasir dikelompokkan per sesi. Tidak ada tab, tidak ada halaman terpisah. |
| Kasir tanpa sesi | Tidak bisa login (fail-closed). |
| Sesi lintas tengah malam | Dilarang. Validasi `end_time > start_time`. |

## Data model

Satu kasir punya paling banyak satu sesi, jadi tidak perlu tabel penghubung. Cukup satu kolom di `users`.

```sql
CREATE TABLE IF NOT EXISTS shifts (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  label      VARCHAR(50) NOT NULL,        -- 'Sesi 1'
  start_time TIME NOT NULL,               -- jam dinding WIB, berlaku tiap hari
  end_time   TIME NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_shift_slot (start_time, end_time)
);

ALTER TABLE users
  ADD COLUMN shift_id INT NULL,
  ADD CONSTRAINT fk_users_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;
```

`ON DELETE SET NULL` dipilih supaya menghapus sesi tidak ikut menghapus kasirnya. Kasir yang sesinya dihapus jadi tanpa jadwal, dan otomatis tidak bisa login sampai ditempatkan lagi.

Tabel dan kolom dibuat lewat `models/shift.js` yang dipanggil dari `index.js`, mengikuti pola `models/*.js` yang sudah ada. Penambahan kolom dijaga pengecekan `information_schema` supaya aman dijalankan berulang.

## Waktu dan timezone

`start_time` dan `end_time` adalah jam dinding WIB.

Perbandingan waktu dilakukan di Node dengan konversi eksplisit ke `Asia/Jakarta`, tidak memakai `NOW()` atau `CURDATE()` MySQL. Pool MySQL diset `timezone: 'Z'` sementara jadwal berpikir dalam waktu lokal; mencampur keduanya adalah sumber bug diam-diam.

Karena sesi berlaku tiap hari, yang dibutuhkan cuma menit sejak tengah malam:

```
minutesNowInJakarta(date?) -> 0..1439
```

Catatan utang teknis di luar scope: `utils/dailyStockScheduler.js` mengaku berjalan "18:00 WIB" tetapi mengambil tanggal dengan `new Date().toISOString().split('T')[0]`, yang menghasilkan tanggal UTC. Antara 00:00 dan 07:00 WIB dia memproses tanggal kemarin.

## Penegakan

Satu fungsi jadi sumber kebenaran, di `utils/shiftAccess.js`:

```
isOnShift(userId, role, at?) -> { allowed: boolean, shift: Shift | null }
```

- Superadmin selalu `allowed: true` dan fungsi tidak menyentuh tabel jadwal sama sekali.
- Kasir `allowed: true` kalau punya sesi aktif dan jam sekarang ada di jendela efektifnya.
- Jendela efektif = `start_time - 15 menit` sampai `end_time + 15 menit`.
- Kasir tanpa `shift_id`: `allowed: false`, `shift: null`.

Dipanggil dari dua tempat:

1. `POST /api/auth/login`. Kasir di luar jam ditolak 403 dengan body `{ code: 'OUT_OF_SHIFT', message, shift }`. Pengecekan dilakukan **setelah** password diverifikasi, supaya jadwal tidak jadi kanal bocornya informasi username mana yang valid.
2. Middleware `authenticateToken`. Setelah token terverifikasi, kasir dicek ulang. Di luar jam dapat 403 `OUT_OF_SHIFT`.

Konstanta `SHIFT_GRACE_MINUTES = 15` tinggal di `utils/shiftWindow.js`.

## API

Semua endpoint khusus superadmin (`authorizeRole(["superadmin"])`).

| Method | Path | Guna |
|---|---|---|
| GET | `/api/shifts` | Semua sesi, diurutkan jam mulai. |
| POST | `/api/shifts` | Buat sesi: `{ label, start_time, end_time }`. |
| PUT | `/api/shifts/:id` | Ubah nama atau jam sesi. |
| DELETE | `/api/shifts/:id` | Hapus sesi. Kasir di dalamnya jadi `shift_id NULL`. |
| PUT | `/api/shifts/assign/:userId` | Pindahkan kasir: `{ shift_id }`, `null` untuk mengeluarkan. |

Validasi POST dan PUT:

- `end_time > start_time`.
- Nama sesi tidak kosong.
- Jam tidak boleh bertumpuk dengan sesi lain. Pengecekan memakai jam mentah, bukan jendela toleransi. Dua sesi yang bersentuhan persis (10:00 ketemu 10:00) boleh.

Konsekuensi toleransi yang disengaja: jendela efektif dua sesi berurutan memang saling menimpa 30 menit (09:45 sampai 10:15). Pada rentang itu kasir sesi 1 dan sesi 2 sama-sama bisa masuk. Itu memang gunanya, untuk serah terima.

`GET /api/users/cashiers` ikut mengembalikan `shift_id` supaya tabel bisa dikelompokkan tanpa request tambahan.

## Frontend

Semua di `/superadmin/cashiers`. Route-nya cangkang tipis (auth guard, judul), isinya `lib/components/cashiers/CashierList.svelte`.

Tabel kasir dikelompokkan per sesi. Tiap grup dibuka baris header yang membentang seluruh kolom:

```
Sesi 1   08:00 - 10:00 setiap hari   2 kasir        [edit] [hapus]
  1  kasir1   aktif  ...  [Sesi 1 v]
  2  kasir2   aktif  ...  [Sesi 1 v]

Sesi 2   10:00 - 12:00 setiap hari   0 kasir        [edit] [hapus]

Belum ada sesi   Kasir di sini tidak bisa login   1 kasir
  1  budi     aktif  ...  [Tanpa sesi v]
```

Memindah kasir = ganti dropdown di kolom "Sesi" pada barisnya. Satu request `PUT /api/shifts/assign/:userId`, daftar langsung diperbarui di tempat tanpa memuat ulang seluruh tabel.

Grup "Belum ada sesi" selalu ada di paling bawah supaya kasir yang terlewat kelihatan.

Pagination dibuang dari tabel ini. Pagination dan pengelompokan tidak bisa hidup bersama secara masuk akal, dan jumlah kasir satu toko tidak sampai butuh halaman. Pencarian dan pengurutan tetap ada.

`lib/apiConfig.ts` menangani 403 `OUT_OF_SHIFT` dengan menghapus token dan melempar ke `/login`, membawa pesannya lewat `sessionStorage` supaya halaman login bisa menampilkan alasannya.

## Testing

`utils/shiftWindow.js` berisi fungsi murni dan diuji dengan `node:test` bawaan Node, tanpa dependency baru: batas jam persis, toleransi di dua sisi, dan konversi UTC ke WIB termasuk kasus 17:30 UTC yang jatuh di hari berikutnya waktu WIB.

`isOnShift` butuh MySQL jadi diverifikasi manual: kasir di dalam jam, kasir di luar jam, kasir tanpa sesi, dan superadmin.

## Risiko yang diterima

**Transaksi bisa hilang.** Kasir yang sedang mengisi keranjang jam 09:59 lalu menekan simpan jam 10:16 kehilangan keranjangnya. Toleransi 15 menit mengurangi tapi tidak menghilangkan risiko ini.

**Tidak ada variasi per hari.** Kalau Senin butuh susunan kasir yang berbeda dari Selasa, model ini tidak bisa. Itu perubahan model, bukan tambalan.

**Sesi malam tidak didukung.** Jam yang melewati tengah malam butuh perubahan model.

## Di luar scope

- Absensi, jam masuk aktual, atau rekap kehadiran. Ini sistem izin akses, bukan sistem absensi.
- Satu kasir di lebih dari satu sesi.
- Notifikasi ke kasir sebelum jam sesinya habis.
- Perbaikan bug timezone di `dailyStockScheduler.js`.
