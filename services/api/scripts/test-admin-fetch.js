const { PrismaClient, AdminRole } = require('@prisma/client');
const http = require('http');
const prisma = new PrismaClient();

async function testFetch() {
  console.log('🔍 Testing Admin Endpoints with Valid Admin Session Token...');

  // 1. Ensure Admin User
  const admin = await prisma.adminUser.upsert({
    where: { username: 'test_admin_op' },
    update: { isActive: true, role: AdminRole.SUPER_ADMIN },
    create: {
      username: 'test_admin_op',
      email: 'test_admin_op@titanstream.internal',
      passwordHash: 'TEST_HASH',
      role: AdminRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  const token = 'test_token_secret_12345';
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 2. Create Admin Session
  await prisma.adminSession.create({
    data: {
      adminUserId: admin.id,
      tokenHash: token,
      expiresAt,
    },
  });

  function get(path) {
    return new Promise((resolve) => {
      http.get('http://localhost:3001/api/v1' + path, { headers: { authorization: `Bearer ${token}` } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      });
    });
  }

  const deposits = await get('/admin/financial/deposits');
  const withdrawals = await get('/admin/financial/withdrawals');
  const users = await get('/admin/users');

  console.log('✅ DEPOSITS ENDPOINT:', deposits.status);
  console.log(JSON.stringify(deposits.data, null, 2));

  console.log('\n✅ WITHDRAWALS ENDPOINT:', withdrawals.status);
  console.log(JSON.stringify(withdrawals.data, null, 2));

  console.log('\n✅ USERS ENDPOINT:', users.status);
  console.log(JSON.stringify(users.data.items?.filter(u => u.telegramUserId === '256770000099') || users.data, null, 2));
}

testFetch()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
