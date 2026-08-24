const baileys = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

async function run() {
  const phone = '18257320524';
  const authFolder = path.resolve(process.cwd(), 'baileys_auth_' + phone);

  while (true) {
    try {
      console.log('[PAIRING_SERVICE] Starting socket...');
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

      let codeRequested = false;

      await new Promise((resolve) => {
        socket.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr } = update;
          
          if (qr && !state.creds.registered && !codeRequested) {
            codeRequested = true;
            try {
              const code = await socket.requestPairingCode(phone);
              console.log('====================================');
              console.log('LIVE PAIRING CODE FOR +18257320524:');
              console.log('CODE: ' + code);
              console.log('====================================');
            } catch (err) {
              console.error('Pairing Code Error:', err.message);
              codeRequested = false;
            }
          }

          if (connection === 'open') {
            console.log('====================================');
            console.log('🎉 SUCCESS! WHATSAPP LINKED & CONNECTED!');
            console.log('====================================');
          }

          if (connection === 'close') {
            const statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output ? lastDisconnect.error.output.statusCode : 'unknown';
            console.log('[PAIRING_SERVICE] Connection closed (statusCode: ' + statusCode + '). Retrying in 3s...');
            resolve();
          }
        });
      });

    } catch (err) {
      console.error('[PAIRING_SERVICE_ERROR]', err.message);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}

run();
