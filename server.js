const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const express = require('express');
const qrcode = require('qrcode');
const cors = require('cors');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const PORT = process.env.PORT || 3000;
// URL Webhook PHP di cPanel (diatur lewat environment variable di Render atau default)
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const API_SECRET = process.env.API_SECRET || 'secret123';
const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, 'auth_info');

let sock = null;
let currentQR = '';
let connectionStatus = 'DISCONNECTED'; // 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTED'

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['KMHS WhatsApp Business', 'Chrome', '1.0.0']
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = await qrcode.toDataURL(qr);
      connectionStatus = 'SCAN_QR';
      console.log('[WA] QR code baru dihasilkan, siap di-scan.');
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      connectionStatus = 'DISCONNECTED';
      currentQR = '';
      console.log(`[WA] Koneksi terputus. Kode: ${statusCode}. Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        connectToWhatsApp();
      } else {
        console.log('[WA] Sesi telah logout. Silakan scan QR ulang.');
        // Hapus folder auth jika logout
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      connectionStatus = 'CONNECTED';
      currentQR = '';
      console.log('[WA] Terhubung ke WhatsApp!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Menerima pesan masuk
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      // Abaikan pesan dari diri sendiri atau status broadcast
      if (msg.key.fromMe || msg.key.remoteJid === 'status@broadcast') continue;

      const remoteJid = msg.key.remoteJid;
      // Simpan JID asli lengkap (bisa @s.whatsapp.net atau @lid)
      const senderJid = remoteJid;
      // Nomor tampilan
      const senderNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
      const pushName = msg.pushName || 'Pengguna WA';

      // Ekstrak teks pesan
      let messageText = '';
      if (msg.message?.conversation) {
        messageText = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        messageText = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage?.caption) {
        messageText = msg.message.imageMessage.caption;
      }

      if (!messageText) continue;

      console.log(`[WA Masuk] Dari: ${senderNumber} (JID: ${senderJid}): ${messageText}`);

      // Kirim ke Webhook cPanel jika WEBHOOK_URL terkonfigurasi
      if (WEBHOOK_URL) {
        try {
          const payload = {
            secret: API_SECRET,
            from: senderNumber,
            from_jid: senderJid, // Kirim JID asli
            name: pushName,
            message: messageText,
            timestamp: msg.messageTimestamp,
            message_id: msg.key.id
          };

          // Native fetch (Node 18+)
          fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(err => console.error('[Webhook Error]', err.message));
        } catch (err) {
          console.error('[Forward Error]', err);
        }
      }
    }
  });
}

// ----------------- ROUTES ----------------- //

// Halaman Scan QR Code
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WhatsApp Gateway - KMHS</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; background: #f0f2f5; padding: 40px; }
        .card { background: white; max-width: 450px; margin: 0 auto; padding: 30px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        h2 { color: #075e54; margin-bottom: 8px; }
        .status { padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin-bottom: 20px; }
        .status.connected { background: #d4edda; color: #155724; }
        .status.disconnected { background: #f8d7da; color: #721c24; }
        .status.scan { background: #fff3cd; color: #856404; }
        img { width: 260px; height: 260px; border: 1px solid #ddd; border-radius: 8px; }
        .info { font-size: 14px; color: #666; margin-top: 15px; }
      </style>
      <script>
        setInterval(async () => {
          const res = await fetch('/status');
          const data = await res.json();
          if (data.status === 'CONNECTED' && document.getElementById('status-box').innerText !== 'TERHUBUNG') {
            location.reload();
          } else if (data.status === 'SCAN_QR' && document.getElementById('qr-img').src !== data.qr) {
            document.getElementById('qr-img').src = data.qr;
          }
        }, 3000);
      </script>
    </head>
    <body>
      <div class="card">
        <h2>WhatsApp Gateway</h2>
        <p style="color: #666; font-size: 14px; margin-top: 0;">Layanan KMHS Direktorat</p>
        <div id="status-box" class="status ${connectionStatus === 'CONNECTED' ? 'connected' : (connectionStatus === 'SCAN_QR' ? 'scan' : 'disconnected')}">
          ${connectionStatus === 'CONNECTED' ? '✅ TERHUBUNG' : (connectionStatus === 'SCAN_QR' ? '📷 SILAKAN SCAN QR' : '⏳ MENUNGGU QR / KONEKSI')}
        </div>
        <div>
          ${connectionStatus === 'CONNECTED' 
            ? '<p style="color: #28a745; font-size: 16px;">WhatsApp aktif dan siap mengirim/menerima pesan.</p>' 
            : (currentQR ? `<img id="qr-img" src="${currentQR}" alt="QR Code"/>` : '<p>Sedang membuat sesi QR...</p>')}
        </div>
        <div class="info">
          Buka WhatsApp di HP &gt; Perangkat Tertaut &gt; Tautkan Perangkat.
        </div>
      </div>
    </body>
    </html>
  `);
});

// Endpoint Cek Status JSON
app.get('/status', (req, res) => {
  res.json({
    status: connectionStatus,
    qr: currentQR,
    webhook: WEBHOOK_URL ? 'CONFIGURED' : 'NOT_SET'
  });
});

// Endpoint Kirim Pesan (Dipanggil oleh cPanel PHP)
app.post('/send-message', async (req, res) => {
  const { secret, to, message } = req.body;

  if (secret !== API_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized secret' });
  }

  if (connectionStatus !== 'CONNECTED' || !sock) {
    return res.status(503).json({ success: false, error: 'WhatsApp is not connected' });
  }

  if (!to || !message) {
    return res.status(400).json({ success: false, error: 'Parameter "to" dan "message" wajib diisi' });
  }

  try {
    let jid = to;
    if (!jid.includes('@')) {
      let cleanNumber = to.replace(/[^0-9]/g, '');
      if (cleanNumber.startsWith('0')) {
        cleanNumber = '62' + cleanNumber.substring(1);
      }
      jid = `${cleanNumber}@s.whatsapp.net`;
    }

    const sent = await sock.sendMessage(jid, { text: message });
    return res.json({ success: true, messageId: sent.key.id });
  } catch (err) {
    console.error('[Send Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Jalankan Gateway
connectToWhatsApp();
app.listen(PORT, () => {
  console.log(`[Gateway] Server berjalan di port ${PORT}`);
});
