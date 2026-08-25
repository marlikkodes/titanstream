
const http = require('http');

async function getPairingCode() {
  const phone = process.env.WHATSAPP_BOT_PHONE || '+18257320524';
  console.log(`[PAIRING_CODE_HELPER] Requesting live pairing code for ${phone} from NestJS API...`);

  const req = http.request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/whatsapp/accounts',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
    (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const account = (parsed.data || []).find((a) => a.phone === phone || a.accountId.includes(phone.replace(/\D/g, '')));
          if (account && account.pairingCode) {
            console.log('=== PAIRING CODE RETRIEVED FROM ACTIVE GATEWAY ===');
            console.log('PHONE:', account.phone);
            console.log('CODE:', account.pairingCode);
            console.log('STATE:', account.state);
            process.exit(0);
          } else {
            console.log('[PAIRING_CODE_HELPER] Account state:', account?.state || 'UNKNOWN');
            console.log('[PAIRING_CODE_HELPER] Check server logs or use /api/admin/whatsapp/accounts to inspect code.');
            process.exit(0);
          }
        } catch (err) {
          console.error('[PAIRING_CODE_HELPER_ERR] Parse error:', err.message);
          process.exit(1);
        }
      });
    }
  );

  req.on('error', (err) => {
    console.error('[PAIRING_CODE_HELPER_ERR] Could not connect to API server:', err.message);
    process.exit(1);
  });

  req.end();
}

getPairingCode();
