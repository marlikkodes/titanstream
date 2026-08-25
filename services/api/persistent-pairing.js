/**
 * NOTE: Persistent pairing and socket management is handled directly by NestJS API
 * via BaileysAccountManagerService & usePrismaAuthState.
 * Running duplicate socket connections concurrently causes WhatsApp session revocations.
 */
console.log('----------------------------------------------------------------------');
console.log('📌 Baileys WebSocket transport is managed by NestJS API service.');
console.log('   Auth state is safely persisted in PostgreSQL (baileys_auth_keys).');
console.log('   Use Admin API endpoints (/api/admin/whatsapp/accounts) to manage sessions.');
console.log('----------------------------------------------------------------------');

