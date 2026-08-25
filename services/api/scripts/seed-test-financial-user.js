const { PrismaClient, SettlementType, SettlementStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Test User with Pending Deposit & Withdrawal Sessions...');

  const testTgId = BigInt(256770000099);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // 1. Create or Update Test User
  const user = await prisma.user.upsert({
    where: { telegramUserId: testTgId },
    update: {
      firstName: 'Test Operator',
      lastName: 'User',
      phoneNumber: '+256770000099',
      phoneVerified: true,
      state: 'ACTIVE_USER',
      readinessScore: 85,
    },
    create: {
      telegramUserId: testTgId,
      firstName: 'Test Operator',
      lastName: 'User',
      phoneNumber: '+256770000099',
      phoneVerified: true,
      state: 'ACTIVE_USER',
      readinessScore: 85,
      qualifiedReferrals: 5,
    },
  });

  // 2. Create Financial Account
  const finAccount = await prisma.financialAccount.upsert({
    where: { telegramUserId: testTgId },
    update: { status: 'ACTIVE' },
    create: { telegramUserId: testTgId, status: 'ACTIVE' },
  });

  // 3. Create Pending Deposit Session
  const deposit = await prisma.settlementSession.upsert({
    where: { referenceCode: 'DEP-TEST-9988' },
    update: {
      status: SettlementStatus.VERIFYING,
      requestedAmount: 50.0,
      expectedCryptoAmount: 50.0,
    },
    create: {
      referenceCode: 'DEP-TEST-9988',
      telegramUserId: testTgId,
      sessionType: SettlementType.DEPOSIT,
      status: SettlementStatus.VERIFYING,
      asset: 'USDT',
      requestedAmount: 50.0,
      expectedCryptoAmount: 50.0,
      exchangeRate: 3750,
      country: 'UG',
      mobileMoneyNetwork: 'MTN_UG',
      provider: 'PESAPAL',
      expiresAt,
      providerMetadata: { testMode: true },
    },
  });

  // 4. Create Pending Withdrawal Session
  const withdrawal = await prisma.settlementSession.upsert({
    where: { referenceCode: 'WTH-TEST-7766' },
    update: {
      status: SettlementStatus.WAITING_FOR_PAYMENT,
      requestedAmount: 25.0,
      expectedCryptoAmount: 25.0,
    },
    create: {
      referenceCode: 'WTH-TEST-7766',
      telegramUserId: testTgId,
      sessionType: SettlementType.PAYOUT,
      status: SettlementStatus.WAITING_FOR_PAYMENT,
      asset: 'USDT',
      requestedAmount: 25.0,
      expectedCryptoAmount: 25.0,
      exchangeRate: 3750,
      country: 'UG',
      mobileMoneyNetwork: 'AIRTEL_UG',
      provider: 'PESAPAL',
      verifiedRecipientAddress: '+256770000099',
      expiresAt,
      providerMetadata: { testMode: true },
    },
  });

  console.log('✅ Test User & Financial Sessions Seeded Successfully!');
  console.log(`- User ID: ${user.telegramUserId.toString()} (${user.firstName} ${user.lastName})`);
  console.log(`- Deposit Session: ${deposit.referenceCode} ($50.00 USDT - Status: ${deposit.status})`);
  console.log(`- Withdrawal Session: ${withdrawal.referenceCode} ($25.00 USDT - Status: ${withdrawal.status})`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
