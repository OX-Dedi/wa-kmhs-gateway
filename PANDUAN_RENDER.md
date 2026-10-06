# Petunjuk Deploy WhatsApp Gateway ke Render.com (100% Gratis)

## Langkah 1: Buat Repository Baru di GitHub
1. Buat repository baru di GitHub (misal: `wa-kmhs-gateway`), pilih Private atau Public.
2. Masukkan isi folder `gateway-render` ini ke dalam repo GitHub tersebut:
   ```bash
   cd gateway-render
   git init
   git add .
   git commit -m "Initial commit WA Gateway"
   git remote add origin https://github.com/USERNAME/wa-kmhs-gateway.git
   git push -u origin main
   ```

## Langkah 2: Deploy di Render.com
1. Buka [https://render.com](https://render.com) dan login (bisa pakai akun GitHub).
2. Klik tombol **New +** > Pilih **Web Service**.
3. Pilih repository GitHub Anda (`wa-kmhs-gateway`).
4. Pada bagian pengaturan:
   - **Name**: `wa-kmhs-gateway` (bebas)
   - **Language / Environment**: `Docker` atau `Node`
   - **Region**: Singapore (paling dekat dengan Indonesia)
   - **Instance Type**: **Free**
5. Pada bagian **Environment Variables** (Tambahkan variable berikut):
   - `API_SECRET` : `secretKMHS2024` (atau password rahasia pilihan Anda)
   - `WEBHOOK_URL` : `https://domain-cpanel-anda.com/webhook.php` (URL webhook PHP cPanel Anda)
6. Klik **Create Web Service**.

## Langkah 3: Scan QR Code
1. Tunggu 1-2 menit hingga proses build selesai dan statusnya **Live**.
2. Render akan memberikan URL publik (misal: `https://wa-kmhs-gateway.onrender.com`).
3. Buka URL tersebut di browser.
4. Anda akan melihat QR Code.
5. Buka WhatsApp di HP > **Perangkat Tertaut** > **Tautkan Perangkat** > Scan QR tersebut.
6. Status akan berubah menjadi **✅ TERHUBUNG**. Selesai!
