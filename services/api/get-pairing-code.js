
const baileys = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

async function getPairingCode() {
  const phone = process.env.WHATSAPP_BOT_PHONE || '+18257320524';
  const cleanPhone = phone.replace(/\D/g, '');
  const authFolder = path.resolve(__dirname, 'baileys_auth_' + cleanPhone);
  
  if (fs.existsSync(authFolder)) {
    fs.rmSync(authFolder, { recursive: true, force: true });
  }

  const { state, saveCreds } = await baileys.useMultiFileAuthState(authFolder);
  
  const pinoLogger = {
    level: 'silent',
    info: () => {}, error: () => {}, warn: () => {}, trace: () => {}, debug: () => {},
    child: () => pinoLogger,
  };

  const socket = baileys.makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pinoLogger,
    browser: ['Ubuntu', 'Chrome', '120.0.0.0'],
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;
    if (qr && !state.creds.registered) {
      try {
        const code = await socket.requestPairingCode(cleanPhone);
        console.log('=== PAIRING CODE GENERATED SUCCESSFULLY ===');
        console.log('PHONE:', phone);
        console.log('CODE:', code);
        process.exit(0);
      } catch (err) {
        console.error('Pairing error:', err.message);
        process.exit(1);
      }
    }
  });
}

getPairingCode();
