import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';
import fs from 'fs';

const USERS_DB_PATH = resolve(__dirname, '.admin_users_db.json');
const MERCHANTS_DB_PATH = resolve(__dirname, '.admin_merchants_db.json');
const MACHINES_DB_PATH = resolve(__dirname, '.admin_machines_db.json');

function adminMockMiddleware(): Plugin {
  let mockWithdrawalsList = [
    {
      id: 'wth_001',
      referenceCode: 'PAY-HALT-001',
      userName: 'Devon Vance',
      userHandle: '@crypto_farmer_bot99',
      phoneNumber: '+18255551234',
      requestedAmount: 150.00,
      amount: 150.00,
      asset: 'USDT',
      paymentMethod: 'TRC20',
      mobileMoneyNetwork: 'TRON TRC-20',
      destinationAddress: 'TQ8wMv7PzX29184kL8otSzgjLj6t',
      status: 'SUSPENDED_REVIEW',
      riskScore: 'MEDIUM',
      flagReason: 'IP Geolocation Delta detected (>1200km)',
      createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    {
      id: 'wth_002',
      referenceCode: 'PAY-TRC-4419',
      userName: 'Bitris Omolo',
      userHandle: '@bitris_titan',
      phoneNumber: '+256701234567',
      requestedAmount: 450.00,
      amount: 450.00,
      asset: 'USDT',
      paymentMethod: 'TRC20',
      mobileMoneyNetwork: 'TRON TRC-20',
      destinationAddress: 'TQjDxUq571994xLm8otSzgjLj4v9L',
      status: 'COMPLETED',
      riskScore: 'LOW',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 'wth_003',
      referenceCode: 'PAY-MPESA-88',
      userName: 'Amina Nakato',
      userHandle: '+254712987654',
      phoneNumber: '+254712987654',
      requestedAmount: 220.00,
      amount: 220.00,
      asset: 'USDT',
      paymentMethod: 'MPESA_KE',
      mobileMoneyNetwork: 'Safaricom M-Pesa',
      destinationAddress: '+254712987654',
      status: 'COMPLETED',
      riskScore: 'LOW',
      createdAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
    },
  ];

  let mockGamesCatalog = [
    {
      gameId: 'lucky-wheel',
      code: 'WHEEL',
      name: 'Lucky Wheel',
      description: 'Spin to win crystals, daily mystery boxes, and temporary hash rate multipliers.',
      category: 'chance',
      icon: '🎡',
      accentColor: '#00e676',
      crystalCost: 5,
      dailyLimit: 10,
      estimatedDurationSec: 30,
      difficulty: 'EASY',
      enabled: true,
      rewardConfig: {},
      updatedAt: new Date().toISOString(),
    },
    {
      gameId: 'hoop-masters',
      code: 'HOOPS',
      name: 'Hoop Masters',
      description: 'Swipe to launch. Chain baskets to build combo streaks and earn crystals.',
      category: 'skill',
      icon: '🏀',
      accentColor: '#0088cc',
      crystalCost: 3,
      dailyLimit: 15,
      estimatedDurationSec: 60,
      difficulty: 'MEDIUM',
      enabled: true,
      rewardConfig: {},
      updatedAt: new Date().toISOString(),
    },
    {
      gameId: 'memory-matrix',
      code: 'MEMORY',
      name: 'Memory Matrix',
      description: 'Pattern-recognition challenge. Memorize the light sequence and repeat it.',
      category: 'skill',
      icon: '🧠',
      accentColor: '#00e5ff',
      crystalCost: 3,
      dailyLimit: 10,
      estimatedDurationSec: 75,
      difficulty: 'MEDIUM',
      enabled: true,
      rewardConfig: {},
      updatedAt: new Date().toISOString(),
    },
    {
      gameId: 'titan-core-reactor',
      code: 'REACTOR',
      name: 'Titan Reactor',
      description: 'Energy nodes overload across the grid. Tap them before they fail — speed and combos rule the core.',
      category: 'skill',
      icon: '⚛️',
      accentColor: '#ffb300',
      crystalCost: 5,
      dailyLimit: 12,
      estimatedDurationSec: 45,
      difficulty: 'HARD',
      enabled: true,
      rewardConfig: {},
      updatedAt: new Date().toISOString(),
    },
  ];

  let mockChallenges = [
    {
      id: 'ch_1',
      code: 'REACTOR_SCORE_100',
      gameId: 'titan-core-reactor',
      title: 'Core Overload Master',
      description: 'Survive the grid and score 100+ points on Titan Reactor',
      objectiveType: 'SCORE',
      target: 100,
      rewardCrystals: 25,
      rewardXp: 50,
      enabled: true,
    },
    {
      id: 'ch_2',
      code: 'HOOPS_CHAIN_5',
      gameId: 'hoop-masters',
      title: 'Precision Shooter',
      description: 'Sink 5 consecutive baskets without a miss in Hoop Masters',
      objectiveType: 'COMBO',
      target: 5,
      rewardCrystals: 20,
      rewardXp: 35,
      enabled: true,
    },
    {
      id: 'ch_3',
      code: 'MEMORY_ROUND_5',
      gameId: 'memory-matrix',
      title: 'Matrix Overdrive',
      description: 'Successfully replicate the light sequence up to Round 5',
      objectiveType: 'ROUND',
      target: 5,
      rewardCrystals: 20,
      rewardXp: 40,
      enabled: true,
    },
    {
      id: 'ch_4',
      code: 'LUCKY_SPIN_3',
      gameId: 'lucky-wheel',
      title: 'Fortune Seeker',
      description: 'Spin the Lucky Wheel 3 times in a single calendar day',
      objectiveType: 'PLAYS',
      target: 3,
      rewardCrystals: 15,
      rewardXp: 20,
      enabled: true,
    },
  ];

  let mockPlatformSwitches = {
    maintenanceMode: false,
    readOnlyMode: false,
    disableWithdrawals: false,
    disablePurchases: false,
    emergencyShutdown: false,
    maxDailyPayoutUsdt: 25000,
  };

  let mockRegisteredUsers = [
    {
      id: '5387655307',
      telegramId: '5387655307',
      titanId: 'titan_5387655307_apex',
      phoneNumber: '+256701234567',
      primaryIdentifier: '@bitris_titan',
      joinChannel: 'TELEGRAM',
      activityStatus: 'ACTIVE',
      hasSharedDevice: false,
      lastActiveIp: '102.218.42.10',
      name: 'Bitris Omolo',
      username: '@bitris_titan',
      state: 'ACTIVE_USER',
      totalVolume: 1700,
      moneyIn: 1250,
      moneyOut: 450,
      totalDeposits: 1250,
      totalWithdrawals: 450,
      netBalance: 800,
      riskScore: 12,
      flags: [],
      wallets: ['fin_acc_5387655307'],
      activeMachinesCount: 4,
      crystalBalance: 15200,
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '8921471029',
      telegramId: '8921471029',
      titanId: 'titan_8921471029_wa',
      phoneNumber: '+254712987654',
      primaryIdentifier: '+254712987654',
      joinChannel: 'WHATSAPP',
      activityStatus: 'ACTIVE',
      hasSharedDevice: false,
      lastActiveIp: '196.201.214.55',
      name: 'Amina Nakato',
      username: '+254712987654',
      state: 'ACTIVE_USER',
      totalVolume: 620,
      moneyIn: 400,
      moneyOut: 220,
      totalDeposits: 400,
      totalWithdrawals: 220,
      netBalance: 180,
      riskScore: 28,
      flags: [],
      wallets: ['fin_acc_8921471029'],
      activeMachinesCount: 2,
      crystalBalance: 4350,
      createdAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '6719823451',
      telegramId: '6719823451',
      titanId: 'titan_6719823451_suspect',
      phoneNumber: '+18255551234',
      primaryIdentifier: '@crypto_farmer_bot99',
      joinChannel: 'TELEGRAM',
      activityStatus: 'FROZEN',
      hasSharedDevice: true,
      lastActiveIp: '197.239.4.12',
      name: 'Devon Vance',
      username: '@crypto_farmer_bot99',
      state: 'SUSPENDED_USER',
      totalVolume: 10,
      moneyIn: 10,
      moneyOut: 0,
      totalDeposits: 10,
      totalWithdrawals: 0,
      netBalance: 10,
      riskScore: 85,
      flags: ['FROZEN', 'SHARED_DEVICE_IP'],
      wallets: ['fin_acc_6719823451'],
      activeMachinesCount: 1,
      crystalBalance: 200,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  // Disk persistence for mock database so all browser windows/sessions share registered users
  function loadUsersFromDisk() {
    try {
      if (fs.existsSync(USERS_DB_PATH)) {
        const raw = fs.readFileSync(USERS_DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return mockRegisteredUsers;
  }

  function saveUsersToDisk(users: any[]) {
    try {
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
    } catch (e) {}
  }

  function findRequestUser(req: any, allUsers: any[]) {
    const userIdHeader = String(req.headers['x-user-id'] || '').trim();
    const authHeader = String(req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();

    if (userIdHeader) {
      const cleanHeader = userIdHeader.replace(/[^0-9]/g, '');
      const u = allUsers.find((x: any) =>
        String(x.id) === userIdHeader ||
        String(x.telegramId) === userIdHeader ||
        String(x.titanId) === userIdHeader ||
        (cleanHeader && String(x.phoneNumber || '').replace(/[^0-9]/g, '') === cleanHeader) ||
        (cleanHeader && String(x.id || '').replace(/[^0-9]/g, '') === cleanHeader)
      );
      if (u) return u;
    }

    if (authHeader) {
      const tokenClean = authHeader.replace(/^tg_token_|^wa_token_|^mirror_auth_/, '').trim();
      const tokenDigits = tokenClean.replace(/[^0-9]/g, '');
      const u = allUsers.find((x: any) =>
        String(x.id) === tokenClean ||
        String(x.telegramId) === tokenClean ||
        String(x.titanId) === tokenClean ||
        (tokenDigits && String(x.phoneNumber || '').replace(/[^0-9]/g, '') === tokenDigits) ||
        (tokenDigits && String(x.id || '').replace(/[^0-9]/g, '') === tokenDigits)
      );
      if (u) return u;
    }

    return allUsers[0];
  }

  // Ensure initial disk database is created
  if (!fs.existsSync(USERS_DB_PATH)) {
    saveUsersToDisk(mockRegisteredUsers);
  }

  // ─── Persistent Merchant Code Store ──────────────────────────────
  const defaultMerchants = [
    {
      id: 'mm_mtn_ug_1',
      network: 'MTN',
      merchantName: 'TitanStream Escrow MTN',
      merchantNumber: '234654',
      country: 'UG',
      currency: 'UGX',
      dailyLimit: 50000000,
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'mm_airtel_ug_1',
      network: 'AIRTEL',
      merchantName: 'TitanStream Escrow Airtel',
      merchantNumber: '7183443',
      country: 'UG',
      currency: 'UGX',
      dailyLimit: 50000000,
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'mm_safaricom_ke_1',
      network: 'SAFARICOM_MPESA',
      merchantName: 'TetherStream Kenya Ops',
      merchantNumber: '445910',
      country: 'KE',
      currency: 'KES',
      dailyLimit: 500000,
      status: 'ACTIVE',
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  function loadMerchantsFromDisk(): any[] {
    try {
      if (fs.existsSync(MERCHANTS_DB_PATH)) {
        const raw = fs.readFileSync(MERCHANTS_DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return defaultMerchants;
  }

  function saveMerchantsToDisk(merchants: any[]) {
    try {
      fs.writeFileSync(MERCHANTS_DB_PATH, JSON.stringify(merchants, null, 2), 'utf-8');
    } catch (e) {}
  }

  if (!fs.existsSync(MERCHANTS_DB_PATH)) {
    saveMerchantsToDisk(defaultMerchants);
  }

  // ─── Persistent Machine Catalog Store ────────────────────────────
  const defaultMachines = [
    {
      id: 'free-trial',
      tierCode: 'TS_TRIAL',
      name: 'Titan Core',
      description: 'Free starter machine that earns daily money automatically as soon as you open the app.',
      category: 'Free Starter Machine',
      priceUsdt: '0.00',
      capacityGhs: '1.0',
      dailyYieldEstimateUsdt: '2.00',
      status: 'ACTIVE',
      displayOrder: 1,
      outputs: [
        { id: 'out_free-trial_usdt', assetCode: 'USDT', baseYieldRate: '1.0', multiplier: '1.0', status: 'ACTIVE' },
      ],
    },
    {
      id: 'ripple-x14',
      tierCode: 'TS_C10',
      name: 'Ripple X14',
      description: 'Great starter machine designed to earn steady daily money with low power.',
      category: 'Tier 1 Machine',
      priceUsdt: '10.99',
      capacityGhs: '5.0',
      dailyYieldEstimateUsdt: '0.27',
      status: 'ACTIVE',
      displayOrder: 2,
      outputs: [
        { id: 'out_ripple-x14_usdt', assetCode: 'USDT', baseYieldRate: '1.0', multiplier: '1.0', status: 'ACTIVE' },
      ],
    },
    {
      id: 'surge-r28',
      tierCode: 'TS_A50',
      name: 'Surge R28',
      description: 'Designed for growing daily earnings with high stability.',
      category: 'Tier 2 Machine',
      priceUsdt: '50.00',
      capacityGhs: '25.0',
      dailyYieldEstimateUsdt: '1.35',
      status: 'ACTIVE',
      displayOrder: 3,
      outputs: [
        { id: 'out_surge-r28_usdt', assetCode: 'USDT', baseYieldRate: '1.0', multiplier: '1.0', status: 'ACTIVE' },
      ],
    },
    {
      id: 'torrent-v63',
      tierCode: 'TS_Q250',
      name: 'Torrent V63',
      description: 'Heavy duty compute node engineered for steady high daily returns.',
      category: 'Tier 3 Machine',
      priceUsdt: '250.00',
      capacityGhs: '150.0',
      dailyYieldEstimateUsdt: '7.50',
      status: 'ACTIVE',
      displayOrder: 4,
      outputs: [
        { id: 'out_torrent-v63_usdt', assetCode: 'USDT', baseYieldRate: '1.0', multiplier: '1.0', status: 'ACTIVE' },
      ],
    },
    {
      id: 'cascade-m91',
      tierCode: 'TS_X1000',
      name: 'Cascade M91',
      description: 'Industrial high-capacity processor with multi-stream TON reward output.',
      category: 'Tier 4 Machine',
      priceUsdt: '1000.00',
      capacityGhs: '750.0',
      dailyYieldEstimateUsdt: '35.00',
      status: 'ACTIVE',
      displayOrder: 5,
      outputs: [
        { id: 'out_cascade-m91_usdt', assetCode: 'USDT', baseYieldRate: '1.0', multiplier: '1.0', status: 'ACTIVE' },
        { id: 'out_cascade-m91_ton', assetCode: 'TON', baseYieldRate: '0.05', multiplier: '1.2', status: 'ACTIVE' },
      ],
    },
    {
      id: 'stream-titan-2028',
      tierCode: 'TS_Q2500',
      name: 'StreamTitan 2028',
      description: 'Flagship cluster computing platform with maximal network throughput and dual yields.',
      category: 'Tier 5 Machine',
      priceUsdt: '2500.00',
      capacityGhs: '2200.0',
      dailyYieldEstimateUsdt: '110.00',
      status: 'ACTIVE',
      displayOrder: 6,
      outputs: [
        { id: 'out_stream-titan-2028_usdt', assetCode: 'USDT', baseYieldRate: '1.0', multiplier: '1.0', status: 'ACTIVE' },
        { id: 'out_stream-titan-2028_ton', assetCode: 'TON', baseYieldRate: '0.05', multiplier: '1.2', status: 'ACTIVE' },
      ],
    },
  ];

  function loadMachinesFromDisk(): any[] {
    try {
      if (fs.existsSync(MACHINES_DB_PATH)) {
        const raw = fs.readFileSync(MACHINES_DB_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return defaultMachines;
  }

  function saveMachinesToDisk(machines: any[]) {
    try {
      fs.writeFileSync(MACHINES_DB_PATH, JSON.stringify(machines, null, 2), 'utf-8');
    } catch (e) {}
  }

  if (!fs.existsSync(MACHINES_DB_PATH)) {
    saveMachinesToDisk(defaultMachines);
  }

  let mockSettings = {
    autoApproveLimitUsdt: 50,
    dualAuthThresholdUsdt: 250,
    dailyMaxPayoutUsdt: 25000,
    requireAmlCheck: true,
    maxDailyVelocityPerUser: 3,
  };

  return {
    name: 'admin-mock-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        // CRITICAL: Only intercept API requests. Let browser HTML/SPA navigation pass through!
        if (!url.startsWith('/api/')) {
          return next();
        }

        // 00a. Telegram Auth Handler (User App)
        if ((url.includes('/auth/telegram') || url.includes('/auth/telegram-login')) && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', () => {
            const body = JSON.parse(bodyStr || '{}');
            const allUsers = loadUsersFromDisk();
            const tgId = String(body.id || body.telegramUserId || body.user?.id || '5387655307');
            const firstName = body.first_name || body.user?.first_name || 'Operator';
            const username = body.username || body.user?.username || `user_${tgId}`;

            let user = allUsers.find((u: any) => u.telegramId === tgId || u.id === tgId);
            if (!user) {
              user = {
                id: tgId,
                telegramId: tgId,
                titanId: `titan_tg_${tgId}`,
                phoneNumber: null,
                primaryIdentifier: `@${username}`,
                joinChannel: 'TELEGRAM',
                activityStatus: 'ACTIVE',
                hasSharedDevice: false,
                lastActiveIp: '102.218.42.10',
                name: firstName,
                username: `@${username}`,
                state: 'ACTIVE_USER',
                totalVolume: 0,
                moneyIn: 0,
                moneyOut: 0,
                totalDeposits: 0,
                totalWithdrawals: 0,
                netBalance: 0,
                riskScore: 10,
                flags: [],
                wallets: [`fin_acc_${tgId}`],
                activeMachinesCount: 0,
                crystalBalance: 50,
                createdAt: new Date().toISOString(),
              };
              allUsers.unshift(user);
              saveUsersToDisk(allUsers);
            }

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: {
                accessToken: `tg_token_${tgId}`,
                refreshToken: `tg_refresh_${tgId}`,
                user: {
                  id: user.id,
                  identityId: user.titanId,
                  telegramUserId: Number(user.telegramId) || 0,
                  telegramUsername: user.username?.replace(/^@/, '') || null,
                  firstName: user.name,
                  lastName: null,
                  photoUrl: null,
                  languageCode: 'en',
                  state: 'ACTIVE_USER',
                  isReady: true,
                  createdAt: user.createdAt,
                },
                onboarding: { currentStep: 'COMPLETED', isCompleted: true },
                isNewUser: false,
              },
            }));
          });
          return;
        }

        // 00b. WhatsApp Login Challenge & OTP Handlers
        if (url.includes('/auth/whatsapp/login-challenge') && req.method === 'POST') {
          const challengeId = 'wa_chal_' + Date.now();
          const shortPin = String(Math.floor(100000 + Math.random() * 900000));
          const botPhone = (process.env.WHATSAPP_BOT_PHONE || '18257320524').replace(/\D/g, '');
          const deepLink = `https://wa.me/${botPhone}?text=${encodeURIComponent(`START ${shortPin}`)}`;
          const expiresAt = new Date(Date.now() + 600 * 1000).toISOString();

          // Write to shared challenges file for Baileys bot
          try {
            const sharedPath = resolve('/home/wendy/Desktop/tetherstream/.whatsapp_active_challenges.json');
            let shared: Record<string, any> = {};
            if (fs.existsSync(sharedPath)) {
              shared = JSON.parse(fs.readFileSync(sharedPath, 'utf-8'));
            }
            const chalData = {
              challengeId,
              shortPin,
              status: 'PENDING',
              deviceInfo: 'Browser Session',
              createdAt: new Date().toISOString(),
              expiresAt,
            };
            shared[challengeId] = chalData;
            shared[`pin_${shortPin}`] = challengeId;
            fs.writeFileSync(sharedPath, JSON.stringify(shared, null, 2), 'utf-8');
          } catch (e) {}

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              challengeId,
              shortPin,
              waDeepLink: deepLink,
              deepLinkUrl: deepLink,
              qrPayload: deepLink,
              expiresAt,
              transportReady: true,
              expiresIn: 120,
            },
          }));
          return;
        }

        if (url.includes('/auth/whatsapp/request-otp') && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', () => {
            const body = JSON.parse(bodyStr || '{}');
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: {
                message: `6-digit verification code dispatched to WhatsApp on ${body.phone || 'your phone'}`,
                challengeId: 'wa_chal_' + Date.now(),
              },
            }));
          });
          return;
        }

        if (url.includes('/auth/whatsapp/verify-otp') && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', () => {
            const body = JSON.parse(bodyStr || '{}');
            const phone = body.phone || '+18257320524';
            const phoneClean = phone.replace(/[^0-9]/g, '');
            const userId = phoneClean || String(Date.now());
            const allUsers = loadUsersFromDisk();

            // Check if user already exists or create new
            const existingUser = allUsers.find((u: any) => u.phoneNumber === phone || u.id === userId || (u.phoneNumber && u.phoneNumber.replace(/[^0-9]/g, '') === phoneClean));
            const isNewUser = !existingUser;
            let activeUser = existingUser;

            if (!activeUser) {
              activeUser = {
                id: userId,
                telegramId: userId,
                titanId: `titan_wa_${userId}`,
                phoneNumber: phone,
                primaryIdentifier: phone,
                joinChannel: 'WHATSAPP',
                activityStatus: 'ACTIVE',
                hasSharedDevice: false,
                lastActiveIp: '102.218.42.10',
                name: `WhatsApp Operator (${phone})`,
                username: phone,
                state: 'ACTIVE_USER',
                totalVolume: 0,
                moneyIn: 0,
                moneyOut: 0,
                totalDeposits: 0,
                totalWithdrawals: 0,
                netBalance: 0,
                riskScore: 10,
                flags: [],
                wallets: [`fin_acc_${userId}`],
                activeMachinesCount: 0,
                crystalBalance: 50,
                createdAt: new Date().toISOString(),
              };
              allUsers.unshift(activeUser);
              saveUsersToDisk(allUsers);
            }

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: {
                accessToken: `wa_token_${userId}`,
                refreshToken: `wa_refresh_${userId}`,
                user: {
                  id: activeUser.id,
                  identityId: activeUser.titanId,
                  telegramUserId: Number(activeUser.telegramId) || 0,
                  telegramUsername: null,
                  firstName: activeUser.name,
                  lastName: null,
                  photoUrl: null,
                  languageCode: 'en',
                  state: 'ACTIVE_USER',
                  isReady: true,
                  createdAt: activeUser.createdAt,
                },
                onboarding: { currentStep: 'COMPLETED', isCompleted: true },
                isNewUser,
              },
            }));
          });
          return;
        }

        if (url.includes('/auth/whatsapp/simulate-inbound') && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', () => {
            let text = '';
            let senderPhone = '+18257320524';
            try {
              const body = JSON.parse(bodyStr || '{}');
              text = body.text || '';
              senderPhone = body.senderPhone || senderPhone;
            } catch (e) {}

            const pinMatch = text.match(/\d{6}/);
            const pin = pinMatch ? pinMatch[0] : '';
            const sharedPath = resolve('/home/wendy/Desktop/tetherstream/.whatsapp_active_challenges.json');

            if (fs.existsSync(sharedPath)) {
              try {
                const shared = JSON.parse(fs.readFileSync(sharedPath, 'utf-8'));
                const chalId = shared[`pin_${pin}`] || Object.keys(shared).find(k => shared[k]?.shortPin === pin);
                if (chalId && shared[chalId]) {
                  const cleanDigits = senderPhone.replace(/\D/g, '') || '18257320524';
                  const userId = cleanDigits;
                  const allUsers = loadUsersFromDisk();
                  const existingUser = allUsers.find((u: any) => u.phoneNumber === senderPhone || u.id === userId);
                  const isNewUser = !existingUser;
                  let activeUser = existingUser;

                  if (!activeUser) {
                    activeUser = {
                      id: userId,
                      telegramId: userId,
                      titanId: `titan_wa_${userId}`,
                      phoneNumber: senderPhone,
                      primaryIdentifier: senderPhone,
                      joinChannel: 'WHATSAPP',
                      activityStatus: 'ACTIVE',
                      hasSharedDevice: false,
                      lastActiveIp: '102.218.42.10',
                      name: `WhatsApp Operator (${senderPhone})`,
                      username: senderPhone,
                      state: 'ACTIVE_USER',
                      totalVolume: 0,
                      moneyIn: 0,
                      moneyOut: 0,
                      totalDeposits: 0,
                      totalWithdrawals: 0,
                      netBalance: 0,
                      riskScore: 10,
                      flags: [],
                      wallets: [`fin_acc_${userId}`],
                      activeMachinesCount: 0,
                      crystalBalance: 50,
                      createdAt: new Date().toISOString(),
                    };
                    allUsers.unshift(activeUser);
                    saveUsersToDisk(allUsers);
                  }

                  shared[chalId].status = 'APPROVED';
                  shared[chalId].sessionTokens = {
                    accessToken: `wa_token_${userId}`,
                    refreshToken: `wa_refresh_${userId}`,
                    user: {
                      id: activeUser.id,
                      identityId: activeUser.titanId,
                      telegramUserId: Number(activeUser.telegramId) || 0,
                      telegramUsername: null,
                      firstName: activeUser.name,
                      lastName: null,
                      photoUrl: null,
                      languageCode: 'en',
                      state: 'ACTIVE_USER',
                      isReady: true,
                      createdAt: activeUser.createdAt,
                    },
                    onboarding: { currentStep: 'COMPLETED', isCompleted: true },
                    isNewUser,
                  };
                  fs.writeFileSync(sharedPath, JSON.stringify(shared, null, 2), 'utf-8');
                }
              } catch (e) {}
            }

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, data: { handled: true } }));
          });
          return;
        }

        if (url.includes('/auth/whatsapp/challenge-status')) {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', () => {
            let challengeId = '';
            try {
              const parsed = JSON.parse(bodyStr || '{}');
              challengeId = parsed.challengeId || '';
            } catch (e) {}

            let status = 'PENDING';
            let sessionTokens: any = null;

            try {
              const sharedPath = resolve('/home/wendy/Desktop/tetherstream/.whatsapp_active_challenges.json');
              if (fs.existsSync(sharedPath)) {
                const shared = JSON.parse(fs.readFileSync(sharedPath, 'utf-8'));
                if (challengeId && shared[challengeId] && shared[challengeId].status === 'APPROVED') {
                  const chal = shared[challengeId];
                  status = 'APPROVED';
                  sessionTokens = chal.sessionTokens || null;
                } else {
                  // If specific challenge not marked approved yet, check if any challenge was approved
                  const approvedKeys = Object.keys(shared).filter(k => k.startsWith('wa_chal_') && shared[k]?.status === 'APPROVED' && shared[k]?.sessionTokens);
                  if (approvedKeys.length > 0) {
                    approvedKeys.sort((a, b) => new Date(shared[b].createdAt).getTime() - new Date(shared[a].createdAt).getTime());
                    const latestApproved = shared[approvedKeys[0]];
                    status = 'APPROVED';
                    sessionTokens = latestApproved.sessionTokens;
                  }
                }
              }
            } catch (e) {}

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            if (status === 'APPROVED' && sessionTokens) {
              res.end(JSON.stringify({
                success: true,
                data: {
                  status: 'APPROVED',
                  ...sessionTokens,
                },
              }));
            } else {
              res.end(JSON.stringify({
                success: true,
                data: { status },
              }));
            }
          });
          return;
        }

        // 0a. Operations Mission Control (Health Page)
        if (url.includes('/admin/operations/mission-control')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              system_health: { status: 'HEALTHY', database: 'UP', api: 'UP', treasury_reserve: 'HEALTHY', worker_queue: 'HEALTHY' },
              operational_queues: { payment_orders_pending: 0, payment_orders_verification: 1, operations_queue_open: 0, risk_events_open: 1, active_incidents: 0, support_cases_open: 0 },
              financial_summary: { total_liquidity_usdt: 3220, user_liabilities_usdt: 990, reserve_ratio_percent: 325.3, projected_payouts_usdt: 150 },
              capacity_summary: { total_capacity_ghs: 1250, active_nodes: 3, capacity_utilization_percent: 78.5 },
              active_incidents: [],
              recent_audit_trail: [],
            },
          }));
          return;
        }

        // 0b. Treasury Operators Intelligence
        if (url.includes('/admin/treasury-operators/intelligence') || url.includes('/admin/treasury-operators')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: { activeOperators: 2, queueLength: 1, avgResolutionTimeSec: 28, totalSettled24h: 670.0 },
          }));
          return;
        }

        // 0c. Treasury Health
        if (url.includes('/admin/treasury/health')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: { status: 'HEALTHY', reserves: 3220, unallocated: 2230 },
          }));
          return;
        }

        // 0d. Merchant Settlements
        if (url.includes('/admin/merchant-settlements') && !url.includes('/merchants')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: [] }));
          return;
        }

        // 0e. Machines HQ Catalog, Stats & Fleet (Real Ownership Tracking + Full Dynamic CRUD)
        if (url.includes('/admin/machines-hq/stats')) {
          const allUsers = loadUsersFromDisk();
          let totalOwned = 0;
          let totalActive = 0;
          let totalHashrateGhs = 0;
          const tierCounts: Record<string, number> = {
            TS_TRIAL: 0,
            TS_C10: 0,
            TS_A50: 0,
            TS_Q250: 0,
            TS_X1000: 0,
            TS_Q2500: 0,
          };
          const fleetRoster: any[] = [];

          for (const u of allUsers) {
            const count = u.activeMachinesCount || (u.userMachines ? u.userMachines.length : 0) || 0;
            totalOwned += count;
            totalActive += count;

            if (u.userMachines && Array.isArray(u.userMachines)) {
              for (const m of u.userMachines) {
                const code = m.tierCode || m.machineId || 'TS_C10';
                tierCounts[code] = (tierCounts[code] || 0) + 1;
                totalHashrateGhs += Number(m.capacityGhs || 5.0);
                fleetRoster.push({
                  id: m.id || `m_${u.id}_${fleetRoster.length}`,
                  tierCode: code,
                  name: m.nickname || m.name || `${code} Unit`,
                  ownerId: u.id,
                  ownerName: u.name,
                  ownerPhone: u.phoneNumber || u.username,
                  capacityGhs: m.capacityGhs || 5.0,
                  status: m.status || 'ACTIVE',
                  purchasedAt: m.purchasedAt || u.createdAt,
                });
              }
            } else if (count > 0) {
              // Map counts to standard tiers
              for (let i = 0; i < count; i++) {
                const code = i === 0 ? 'TS_TRIAL' : i === 1 ? 'TS_C10' : i === 2 ? 'TS_A50' : 'TS_Q250';
                tierCounts[code] = (tierCounts[code] || 0) + 1;
                const ghs = code === 'TS_TRIAL' ? 1.0 : code === 'TS_C10' ? 5.0 : code === 'TS_A50' ? 25.0 : 150.0;
                totalHashrateGhs += ghs;
                fleetRoster.push({
                  id: `mach_${u.id}_${i + 1}`,
                  tierCode: code,
                  name: `${code} Unit #${i + 1}`,
                  ownerId: u.id,
                  ownerName: u.name,
                  ownerPhone: u.phoneNumber || u.username,
                  capacityGhs: ghs,
                  status: 'ACTIVE',
                  purchasedAt: u.createdAt,
                });
              }
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              totalOwnedMachines: totalOwned,
              activeComputingFleet: totalActive,
              totalNetworkHashrateGhs: Math.round(totalHashrateGhs * 10) / 10,
              tierCounts,
              fleetRoster: fleetRoster.slice(0, 50),
            },
          }));
          return;
        }

        if (url.includes('/admin/machines-hq/catalog')) {
          // PUT: Update an existing machine
          if (req.method === 'PUT') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const parts = url.split('/');
                const machineId = parts[parts.length - 1].split('?')[0];
                const machines = loadMachinesFromDisk();
                const idx = machines.findIndex((m: any) => m.id === machineId || m.tierCode === machineId);
                if (idx >= 0) {
                  machines[idx] = {
                    ...machines[idx],
                    ...(body.name ? { name: body.name.trim() } : {}),
                    ...(body.description !== undefined ? { description: body.description.trim() } : {}),
                    ...(body.priceUsdt !== undefined ? { priceUsdt: parseFloat(body.priceUsdt).toFixed(2) } : {}),
                    ...(body.capacityGhs !== undefined ? { capacityGhs: parseFloat(body.capacityGhs).toFixed(1) } : {}),
                    ...(body.dailyYieldEstimateUsdt !== undefined ? { dailyYieldEstimateUsdt: parseFloat(body.dailyYieldEstimateUsdt).toFixed(2) } : {}),
                    ...(body.status ? { status: body.status } : {}),
                    ...(body.category ? { category: body.category } : {}),
                    updatedAt: new Date().toISOString(),
                  };
                  saveMachinesToDisk(machines);
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, data: machines[idx] }));
                } else {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ success: false, message: 'Machine not found' }));
                }
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: 'Invalid payload' }));
              }
            });
            return;
          }

          // POST: Create a new machine
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const machines = loadMachinesFromDisk();
                const newMachine = {
                  id: body.id || `mach_${Date.now().toString(36)}`,
                  tierCode: (body.tierCode || `TS_CUSTOM_${machines.length + 1}`).trim(),
                  name: (body.name || 'Custom Computing Unit').trim(),
                  description: (body.description || '').trim(),
                  category: body.category || 'Custom Machine',
                  priceUsdt: (parseFloat(body.priceUsdt) || 0).toFixed(2),
                  capacityGhs: (parseFloat(body.capacityGhs) || 10).toFixed(1),
                  dailyYieldEstimateUsdt: (parseFloat(body.dailyYieldEstimateUsdt) || 0.5).toFixed(2),
                  status: body.status || 'ACTIVE',
                  displayOrder: machines.length + 1,
                  outputs: [
                    { id: `out_${Date.now()}_usdt`, assetCode: 'USDT', baseYieldRate: '1.0', multiplier: '1.0', status: 'ACTIVE' },
                  ],
                  createdAt: new Date().toISOString(),
                };
                machines.push(newMachine);
                saveMachinesToDisk(machines);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, data: newMachine }));
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: 'Invalid payload' }));
              }
            });
            return;
          }

          // GET: List all machines from disk + attach real userFleet counts
          const allUsers = loadUsersFromDisk();
          const tierCounts: Record<string, number> = {
            TS_TRIAL: 0,
            TS_C10: 0,
            TS_A50: 0,
            TS_Q250: 0,
            TS_X1000: 0,
            TS_Q2500: 0,
          };

          for (const u of allUsers) {
            const count = u.activeMachinesCount || (u.userMachines ? u.userMachines.length : 0) || 0;
            if (u.userMachines && Array.isArray(u.userMachines)) {
              for (const m of u.userMachines) {
                const code = m.tierCode || m.machineId || 'TS_C10';
                tierCounts[code] = (tierCounts[code] || 0) + 1;
              }
            } else if (count > 0) {
              for (let i = 0; i < count; i++) {
                const code = i === 0 ? 'TS_TRIAL' : i === 1 ? 'TS_C10' : i === 2 ? 'TS_A50' : 'TS_Q250';
                tierCounts[code] = (tierCounts[code] || 0) + 1;
              }
            }
          }

          const diskMachines = loadMachinesFromDisk();
          const catalogWithCounts = diskMachines.map((m: any) => ({
            ...m,
            _count: {
              userFleet: tierCounts[m.tierCode] || 0,
            },
          }));

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: catalogWithCounts,
          }));
          return;
        }

        // 0f. Machines HQ Economy Profiles
        if (url.includes('/admin/machines-hq/economy/profiles')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: [
              { id: 'ep_1', code: 'STANDARD_PROD', name: 'Authoritative Production Matrix', version: 1, yieldMultiplier: '1.0', referralMultiplier: '1.0', rewardMultiplier: '1.0', isActive: true, priority: 1 },
              { id: 'ep_2', code: 'WEEKEND_BOOST', name: 'Promotional Weekend Surge', version: 2, yieldMultiplier: '1.25', referralMultiplier: '1.1', rewardMultiplier: '1.5', isActive: false, priority: 2 },
            ],
          }));
          return;
        }

        // 1. Live stream & Events
        if (url.includes('/admin/dashboard/live-stream') || url.includes('/admin/dashboard/events')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: [
              { id: 'ev_1', timestamp: new Date().toISOString(), category: 'TREASURY', severity: 'INFO', title: 'Double-Entry Invariant Balanced', detail: 'Reserve backing ratio at 325.3% ($3,220.00 Float vs $990.00 Liabilities)' },
              { id: 'ev_2', timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), category: 'SETTLEMENT', severity: 'SUCCESS', title: 'TRC-20 Payout Dispatched', detail: '#PAY-TRC-4419 ($450.00 USDT) settled for @bitris_titan' },
              { id: 'ev_3', timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(), category: 'SETTLEMENT', severity: 'SUCCESS', title: 'M-Pesa B2C Payout Dispatched', detail: '#PAY-MPESA-88 ($220.00 USDT) settled for Amina Nakato' },
              { id: 'ev_4', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), category: 'SECURITY', severity: 'INFO', title: 'Super Admin Session Authenticated', detail: 'Founder signed in via Multi-Sig WebApp Gate' },
            ],
          }));
          return;
        }

        // 2. Platform Operations Switches & Rules (GET & POST)
        if (url.includes('/admin/operations-hq/switches') || url.includes('/operations/switches')) {
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(bodyStr || '{}');
                mockPlatformSwitches = { ...mockPlatformSwitches, ...parsed };
              } catch (_) {}
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, data: mockPlatformSwitches }));
            });
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: mockPlatformSwitches }));
          return;
        }

        // 3. Settings & Payout Policies (GET & POST)
        if (url.includes('/admin/config/settings')) {
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const parsed = JSON.parse(bodyStr || '{}');
                mockSettings = { ...mockSettings, ...parsed };
              } catch (_) {}
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, data: mockSettings }));
            });
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: mockSettings }));
          return;
        }

        // 4. Crypto Wallets Config
        if (url.includes('/admin/config/crypto-wallets')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: [
              {
                id: 'w_1',
                walletId: 'w_1',
                asset: 'USDT',
                network: 'TRC20',
                address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
                receivingAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
                label: 'Official USDT Escrow Hot Wallet',
                status: 'ACTIVE',
                requiredConfirmations: 19,
                pollIntervalSeconds: 10,
              },
            ],
          }));
          return;
        }

        // 5. Mobile Money Config & Merchants — FULL CRUD (Persistent)
        if (url.includes('/admin/config/mobile-money') || url.includes('/admin/merchant-settlements/merchants')) {
          // DELETE: Remove merchant
          if (req.method === 'DELETE') {
            const parts = url.split('/');
            const merchantId = parts[parts.indexOf('merchants') + 1]?.split('?')[0];
            const merchants = loadMerchantsFromDisk();
            const filtered = merchants.filter((m: any) => m.id !== merchantId);
            saveMerchantsToDisk(filtered);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Merchant removed' }));
            return;
          }

          // POST: Toggle merchant status
          if (url.includes('/status') && req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const parts = url.split('/');
                const merchantId = parts[parts.indexOf('merchants') + 1]?.split('?')[0];
                const merchants = loadMerchantsFromDisk();
                const idx = merchants.findIndex((m: any) => m.id === merchantId);
                if (idx >= 0) {
                  merchants[idx].status = body.status || (merchants[idx].status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE');
                  merchants[idx].updatedAt = new Date().toISOString();
                  saveMerchantsToDisk(merchants);
                }
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, data: merchants[idx] || null }));
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
              }
            });
            return;
          }

          // PUT: Update merchant details
          if (req.method === 'PUT') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const parts = url.split('/');
                const merchantId = parts[parts.indexOf('merchants') + 1]?.split('?')[0];
                const merchants = loadMerchantsFromDisk();
                const idx = merchants.findIndex((m: any) => m.id === merchantId);
                if (idx >= 0) {
                  merchants[idx] = {
                    ...merchants[idx],
                    ...(body.merchantName ? { merchantName: body.merchantName.trim() } : {}),
                    ...(body.merchantNumber ? { merchantNumber: body.merchantNumber.trim() } : {}),
                    ...(body.network ? { network: body.network } : {}),
                    ...(body.country ? { country: body.country } : {}),
                    ...(body.currency ? { currency: body.currency } : {}),
                    ...(body.dailyLimit ? { dailyLimit: Number(body.dailyLimit) } : {}),
                    ...(body.status ? { status: body.status } : {}),
                    updatedAt: new Date().toISOString(),
                  };
                  saveMerchantsToDisk(merchants);
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, data: merchants[idx] }));
                } else {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ success: false, message: 'Merchant not found' }));
                }
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: 'Invalid request body' }));
              }
            });
            return;
          }

          // POST: Create new merchant
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const merchants = loadMerchantsFromDisk();
                const newMerchant = {
                  id: `mm_${Date.now().toString(36)}`,
                  network: (body.network || 'MTN_UGANDA').trim(),
                  merchantName: (body.merchantName || 'New Merchant').trim(),
                  merchantNumber: (body.merchantNumber || '000000').trim(),
                  country: body.country || 'UG',
                  currency: body.currency || 'UGX',
                  dailyLimit: body.dailyLimit || 5000000,
                  status: 'ACTIVE',
                  createdAt: new Date().toISOString(),
                };
                merchants.push(newMerchant);
                saveMerchantsToDisk(merchants);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, data: newMerchant }));
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: 'Invalid request body' }));
              }
            });
            return;
          }

          // GET: List all merchants from disk
          const merchants = loadMerchantsFromDisk();
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: merchants }));
          return;
        }

        // 5b. Public merchant list for user portal payment flow
        if (url.includes('/settlement/merchants') || url.includes('/config/merchants/active')) {
          const merchants = loadMerchantsFromDisk();
          const active = merchants.filter((m: any) => m.status === 'ACTIVE');
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: active }));
          return;
        }

        // 5c. User Portal Dynamic Settlement Session (Uses Admin Merchants)
        if (url.includes('/settlement/session')) {
          // POST /settlement/session/:id/submit-reference
          if (url.includes('/submit-reference') && req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, data: { status: 'VERIFYING', reference: body.reference } }));
              } catch (_) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: 'Invalid request' }));
              }
            });
            return;
          }

          // GET /settlement/session/:id
          if (req.method === 'GET') {
            const parts = url.split('/');
            const sId = parts[parts.indexOf('session') + 1]?.split('?')[0];
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: {
                settlementId: sId || `set_${Date.now()}`,
                status: 'WAITING_FOR_PAYMENT',
              },
            }));
            return;
          }

          // POST /settlement/session -> Create session with live active merchant
          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const reqNetwork = (body.mobileMoneyNetwork || 'MTN').toUpperCase();
                const country = (body.country || 'UG').toUpperCase();
                const usdtAmt = Number(body.requestedAmount || body.expectedCryptoAmount || 10);
                const rate = country === 'KE' ? 129.5 : 3774.62;
                const localCurrency = country === 'KE' ? 'KES' : 'UGX';
                const localAmt = Math.round(usdtAmt * rate);

                // Match against live merchants stored by admin strictly by country and network
                const merchants = loadMerchantsFromDisk();
                const activeMerchants = merchants.filter((m: any) => m.status === 'ACTIVE');
                
                let selectedMerchant = activeMerchants.find((m: any) => {
                  const mNet = (m.network || '').toUpperCase();
                  const mCountry = (m.country || 'UG').toUpperCase();
                  if (mCountry !== country) return false;

                  if (reqNetwork.includes('AIRTEL')) return mNet.includes('AIRTEL');
                  if (reqNetwork.includes('MTN')) return mNet.includes('MTN');
                  if (reqNetwork.includes('MPESA') || reqNetwork.includes('SAFARICOM')) return mNet.includes('MPESA') || mNet.includes('SAFARICOM');
                  return false;
                });

                if (!selectedMerchant) {
                  const isAirtel = reqNetwork.includes('AIRTEL');
                  const isKenya = country === 'KE' || reqNetwork.includes('MPESA') || reqNetwork.includes('SAFARICOM');
                  selectedMerchant = {
                    id: isKenya ? 'mm_safaricom_ke_1' : isAirtel ? 'mm_airtel_ug_1' : 'mm_mtn_ug_1',
                    network: isKenya ? 'SAFARICOM_MPESA' : isAirtel ? 'AIRTEL' : 'MTN',
                    merchantName: isKenya ? 'TetherStream Kenya Ops' : isAirtel ? 'TitanStream Escrow Airtel' : 'TitanStream Escrow MTN',
                    merchantNumber: isKenya ? '445910' : isAirtel ? '7183443' : '234654',
                    country: isKenya ? 'KE' : 'UG',
                    currency: isKenya ? 'KES' : 'UGX',
                  };
                }

                const settlementId = `stl_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
                const refCode = `MM-${Date.now().toString(36).substring(2, 8).toUpperCase()}`;
                const mNum = selectedMerchant.merchantNumber;
                
                let ussdCode = `*165*1*1*${mNum}*${localAmt}#`;
                if (reqNetwork.includes('AIRTEL')) {
                  ussdCode = `*185*9*${mNum}*${localAmt}#`;
                } else if (reqNetwork.includes('MPESA') || reqNetwork.includes('SAFARICOM')) {
                  ussdCode = `*334*1*${mNum}*${refCode}*${localAmt}#`;
                }

                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  data: {
                    settlementId,
                    referenceCode: refCode,
                    status: 'WAITING_FOR_PAYMENT',
                    network: reqNetwork,
                    merchantId: selectedMerchant.id,
                    merchantName: selectedMerchant.merchantName,
                    merchantNumber: mNum,
                    requestedAmount: localAmt.toString(),
                    expectedCryptoAmount: usdtAmt.toString(),
                    exchangeRate: rate.toString(),
                    asset: 'USDT',
                    paymentCurrency: localCurrency,
                    paymentAmount: localAmt.toString(),
                    submittedReference: null,
                    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    createdAt: new Date().toISOString(),
                    instructions: {
                      title: `Pay with ${selectedMerchant.merchantName}`,
                      network: reqNetwork,
                      merchantName: selectedMerchant.merchantName,
                      merchantNumber: mNum,
                      amountUgx: localAmt.toString(),
                      ussdCode,
                    },
                  },
                }));
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, message: 'Failed to create settlement session' }));
              }
            });
            return;
          }
        }

        // 6. Admin Management
        if (url.includes('/admin/management/admins')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: [
              { id: 'adm_1', telegramUserId: '5387655307', name: 'Wendy (Founder)', username: 'wendy_admin', role: 'SUPER_ADMIN', permissions: ['*'], status: 'ACTIVE', createdAt: new Date().toISOString() },
              { id: 'adm_2', telegramUserId: '8921471029', name: 'Treasury Supervisor', username: 'treasury_supervisor', role: 'TREASURY_OPERATOR', permissions: ['TREASURY_WRITE', 'PAYOUT_DISPATCH'], status: 'ACTIVE', createdAt: new Date().toISOString() },
            ],
          }));
          return;
        }

        // 7. Withdrawals & Payout Dispatch Actions
        if (url.includes('/admin/financial/withdrawals')) {
          // POST /admin/financial/withdrawals/:id/approve
          if (url.includes('/approve') && req.method === 'POST') {
            const parts = url.split('/');
            const id = parts[parts.indexOf('withdrawals') + 1];
            const item = mockWithdrawalsList.find(w => w.id === id || w.referenceCode === id);
            if (item) item.status = 'COMPLETED';
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Withdrawal approved & dispatched via double-entry ledger', reference: `DISPATCH-${Date.now().toString().slice(-6)}` }));
            return;
          }

          // POST /admin/financial/withdrawals/:id/reject
          if (url.includes('/reject') && req.method === 'POST') {
            const parts = url.split('/');
            const id = parts[parts.indexOf('withdrawals') + 1];
            const item = mockWithdrawalsList.find(w => w.id === id || w.referenceCode === id);
            if (item) item.status = 'REJECTED';
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, message: 'Withdrawal rejected & held funds unlocked back to user' }));
            return;
          }

          // GET /admin/financial/withdrawals/:id/validate
          if (url.includes('/validate')) {
            const parts = url.split('/');
            const id = parts[parts.indexOf('withdrawals') + 1];
            const item = mockWithdrawalsList.find(w => w.id === id || w.referenceCode === id) || mockWithdrawalsList[0];
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: {
                safe: item.status !== 'SUSPENDED_REVIEW',
                referenceCode: item.referenceCode,
                checks: [
                  { name: 'Reserve Backing Invariant', passed: true, message: 'Operating USDT reserves at 325.3% (Well above 150% threshold)' },
                  { name: 'Double-Entry Invariant Proof', passed: true, message: `Balancing: DEBIT User Liability (-$${item.amount}) == CREDIT Operating Float (+$${item.amount})` },
                  { name: 'Velocity Rate Limiter', passed: true, message: 'User within 3 daily requests limit' },
                  {
                    name: 'AML / Fraud Geolocation Check',
                    passed: item.status !== 'SUSPENDED_REVIEW',
                    message: item.status === 'SUSPENDED_REVIEW' ? 'Flagged: Geolocation Delta >1200km from registration IP' : 'Clean: Device fingerprint & IP matched',
                  },
                ],
              },
            }));
            return;
          }

          // GET list
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: mockWithdrawalsList,
            items: mockWithdrawalsList,
          }));
          return;
        }

        // 8. Games Command Endpoints
        if (url.includes('/admin/games')) {
          if (url.includes('/catalog')) {
            if (req.method === 'PATCH' || req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const parsed = JSON.parse(bodyStr || '{}');
                  const gameId = url.split('/').pop() || parsed.gameId;
                  const idx = mockGamesCatalog.findIndex(g => g.gameId === gameId);
                  if (idx >= 0) {
                    mockGamesCatalog[idx] = { ...mockGamesCatalog[idx], ...parsed, updatedAt: new Date().toISOString() };
                  } else {
                    mockGamesCatalog.push({ ...parsed, gameId: parsed.gameId || `game_${Date.now()}`, updatedAt: new Date().toISOString() });
                  }
                } catch (_) {}
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, data: mockGamesCatalog }));
              });
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, data: mockGamesCatalog }));
            return;
          }

          if (url.includes('/challenges/completions')) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, data: [], items: [] }));
            return;
          }

          if (url.includes('/challenges')) {
            if (req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', () => {
                try {
                  const parsed = JSON.parse(bodyStr || '{}');
                  mockChallenges.push({ id: `ch_${Date.now()}`, ...parsed });
                } catch (_) {}
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, data: mockChallenges }));
              });
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, data: mockChallenges, items: mockChallenges }));
            return;
          }

          if (url.includes('/grants')) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: [
                { id: 'gr_1', telegramUserId: '5387655307', gameId: 'titan-core-reactor', sessionId: 'sess_99182', type: 'XP', amount: '50', reference: 'CHALLENGE_REACTOR_100', createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
                { id: 'gr_2', telegramUserId: '8921471029', gameId: 'lucky-wheel', sessionId: 'sess_99180', type: 'EVENT_POINTS', amount: '25', reference: 'SPIN_JACKPOT_SECTOR', createdAt: new Date(Date.now() - 85 * 60 * 1000).toISOString() },
              ],
            }));
            return;
          }

          if (url.includes('/sessions')) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: [
                { id: 'sess_99182', telegramUserId: '5387655307', gameId: 'titan-core-reactor', status: 'COMPLETED', score: 142, crystalCost: 5, crystalsEarned: 16, usdtEarned: '0.05', durationMs: 44200, createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
                { id: 'sess_99180', telegramUserId: '8921471029', gameId: 'lucky-wheel', status: 'COMPLETED', score: 1, crystalCost: 5, crystalsEarned: 25, usdtEarned: null, durationMs: 4000, createdAt: new Date(Date.now() - 85 * 60 * 1000).toISOString() },
              ],
            }));
            return;
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: mockGamesCatalog }));
          return;
        }

        // 9. Settlement Center & Outbox
        if (url.includes('/admin/financial/settlement-center') || url.includes('/admin/financial/settlement')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              activeRailsCount: 3,
              totalSettled24hUsdt: 670.0,
              avgDispatchLatencySeconds: 14,
              providers: [
                { providerId: 'TRON_TRC20', displayName: 'TRON TRC-20 Hot Escrow', status: 'ACTIVE', healthStatus: 'HEALTHY', checkedAt: new Date().toISOString(), priority: 1, pendingSessions: 1, completedSessions: 2, failedSessions: 0, supportedAssets: ['USDT'] },
                { providerId: 'SAFARICOM_MPESA', displayName: 'Safaricom M-Pesa B2C', status: 'ACTIVE', healthStatus: 'HEALTHY', checkedAt: new Date().toISOString(), priority: 2, pendingSessions: 0, completedSessions: 1, failedSessions: 0, supportedAssets: ['KES'] },
                { providerId: 'MTN_MOMO', displayName: 'MTN Mobile Money Direct', status: 'ACTIVE', healthStatus: 'HEALTHY', checkedAt: new Date().toISOString(), priority: 3, pendingSessions: 0, completedSessions: 0, failedSessions: 0, supportedAssets: ['UGX', 'GHS'] },
              ],
            },
          }));
          return;
        }

        // 10. General Dashboard Metrics (Calibrated to 3 real users)
        if ((url.startsWith('/api/v1/admin/dashboard') || url.startsWith('/api/admin/dashboard')) && !url.includes('/fraud') && !url.includes('/simulation') && !url.includes('/search')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              activeUsers: 3,
              totalCapacityGhs: 1250,
              totalReservesUsdt: 3220,
              pendingVerifications: 1,
              systemHealth: 'HEALTHY',
            },
          }));
          return;
        }

        // 11. Financial Ledger, Assets & Overview (Calibrated to 3 real users)
        if (url.includes('/admin/financial/ledger')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: [] }));
          return;
        }
        if (url.includes('/admin/financial/assets')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: [
              {
                assetCode: 'USDT',
                name: 'Tether USD',
                symbol: 'USDT',
                decimals: 6,
                enabled: true,
                totalLedgerVolume: 1660.00,
                pendingDepositVolume: 0.00,
                pendingPayoutVolume: 150.00,
                treasuryBalance: 3220.00,
                totalBalance: '3220.00',
                lockedBalance: '150.00',
                availableBalance: '3070.00',
                totalUsers: 3,
              },
              {
                assetCode: 'TON',
                name: 'Toncoin',
                symbol: 'TON',
                decimals: 9,
                enabled: true,
                totalLedgerVolume: 0.00,
                pendingDepositVolume: 0.00,
                pendingPayoutVolume: 0.00,
                treasuryBalance: 0.00,
                totalBalance: '0.00',
                lockedBalance: '0.00',
                availableBalance: '0.00',
                totalUsers: 0,
              },
            ],
          }));
          return;
        }
        if (url.includes('/admin/financial/overview')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              totalInflow: 1660.0,
              totalOutflow: 670.0,
              netReserve: 990.0,
              targetReserveRatio: 200,
              actualReserveRatio: 325.3,
              payoutRunwayDays: 142,
              pendingDepositsCount: 0,
              pendingWithdrawalsCount: 1,
              summary: {
                totalDepositsVolume: 1660.0,
                totalPayoutsVolume: 670.0,
                reserveRatio: '325.3%',
                activeAssetsCount: 2,
              },
            },
          }));
          return;
        }

        // 12. Automation Rules
        if (url.includes('/admin/automation/rules')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: [
              {
                id: 'rule_1',
                name: 'High Value Deposit Verification',
                description: 'Flags payment orders >= $500 for enhanced ledger review',
                eventPattern: 'PaymentOrderCreated',
                conditions: [{ field: 'amount', operator: 'GREATER_THAN', value: 500 }],
                actions: ['EMIT_NOTIFICATION', 'FLAG_RISK_REVIEW'],
                isEnabled: true,
                priority: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              {
                id: 'rule_2',
                name: 'Rapid Withdrawal Velocity Alert',
                description: 'Alerts treasury when withdrawal count exceeds threshold',
                eventPattern: 'WithdrawalRequested',
                conditions: [{ field: 'velocity', operator: 'GREATER_THAN', value: 3 }],
                actions: ['NOTIFY_TREASURY_OPERATOR'],
                isEnabled: true,
                priority: 2,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
          }));
          return;
        }

        // Generic catch-all for remaining admin routes
        if (
          url.includes('/admin/rewards') ||
          url.includes('/admin/referrals') ||
          url.includes('/admin/automation/evaluations') ||
          url.includes('/admin/notifications') ||
          url.includes('/admin/support') ||
          url.includes('/admin/whatsapp') ||
          url.includes('/admin/machines') ||
          url.includes('/admin/orders') ||
          url.includes('/admin/payment-rails') ||
          url.includes('/admin/audit')
        ) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: [] }));
          return;
        }

        if (url.includes('/admin/growth')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: { stats: {}, history: [] } }));
          return;
        }
        if (url.includes('/admin/intelligence') || url.includes('/admin/users')) {
          const rawUsers = loadUsersFromDisk();
          const allUsers = rawUsers.filter((u: any) => !u.name?.includes('@lid') && !u.id?.startsWith('86609') && !u.primaryIdentifier?.includes('@lid'));
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          const activeCount = allUsers.filter((u: any) => u.activityStatus === 'ACTIVE').length;
          const waCount = allUsers.filter((u: any) => u.joinChannel === 'WHATSAPP').length;
          const tgCount = allUsers.filter((u: any) => u.joinChannel === 'TELEGRAM').length;
          const totalIn = allUsers.reduce((sum: number, u: any) => sum + (u.totalDeposits || 0), 0);
          const totalOut = allUsers.reduce((sum: number, u: any) => sum + (u.totalWithdrawals || 0), 0);

          res.end(JSON.stringify({
            success: true,
            data: {
              items: allUsers,
              summary: {
                totalUsers: allUsers.length,
                activeUsers: activeCount,
                inactiveUsers: allUsers.length - activeCount,
                whatsappUsers: waCount,
                telegramUsers: tgCount,
                aggregateMoneyIn: totalIn,
                aggregateMoneyOut: totalOut,
              },
              pagination: {
                total: allUsers.length,
                page: 1,
                limit: 50,
              },
            },
          }));
          return;
        }
        if (url.includes('/admin/operations')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: { activeNodes: 3, healthStatus: 'HEALTHY' } }));
          return;
        }
        if (url.includes('/admin/risk')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: { highRiskCount: 1, items: [] } }));
          return;
        }
        if (url.includes('/admin/readiness')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: { checks: [] } }));
          return;
        }
        if (url.includes('/admin/health')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: { status: 'HEALTHY', probes: [] } }));
          return;
        }
        if (url.includes('/admin/revenue')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: { daily: [], total: 1660.0 } }));
          return;
        }
        if (url.includes('/admin/liquidity')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, data: { pools: [] } }));
          return;
        }

        // ==========================================
        // User Application Resilient Endpoints
        // ==========================================

        // User Profile & Name Management
        if (url.includes('/users/me') || url.includes('/user/profile')) {
          if (req.method === 'PATCH' || req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const allUsers = loadUsersFromDisk();
                const primaryUser = allUsers[0] || {
                  id: 'usr_001',
                  telegramUserId: 5387655307,
                  username: 'wendy_droid',
                  firstName: 'Wendy',
                  status: 'ACTIVE',
                  isVerified: true,
                };
                if (body.firstName || body.displayName) {
                  primaryUser.firstName = (body.displayName || body.firstName).trim();
                }
                if (body.lastName) primaryUser.lastName = body.lastName.trim();
                if (body.phoneNumber || body.connectedWhatsApp) {
                  primaryUser.phoneNumber = (body.phoneNumber || body.connectedWhatsApp).trim();
                  primaryUser.connectedWhatsApp = (body.phoneNumber || body.connectedWhatsApp).trim();
                }
                if (body.withdrawalPhoneNumber) {
                  primaryUser.withdrawalPhoneNumber = body.withdrawalPhoneNumber.trim();
                }
                if (allUsers.length === 0) allUsers.push(primaryUser);
                saveUsersToDisk(allUsers);
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, data: primaryUser }));
              } catch (e) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true }));
              }
            });
            return;
          } else if (req.method === 'GET') {
            const allUsers = loadUsersFromDisk();
            const primaryUser = allUsers[0] || {
              id: 'usr_001',
              telegramUserId: 5387655307,
              username: 'wendy_droid',
              firstName: 'Wendy',
              status: 'ACTIVE',
              isVerified: true,
            };
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, data: primaryUser }));
            return;
          }
        }

        // User Preferences & Settings
        if (url.includes('/user/preferences') || url.includes('/settings/preferences')) {
          if (req.method === 'PATCH' || req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const allUsers = loadUsersFromDisk();
                const primaryUser = allUsers[0];
                if (primaryUser && body.settings?.displayName) {
                  primaryUser.firstName = body.settings.displayName;
                  saveUsersToDisk(allUsers);
                }
              } catch (e) {}
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            });
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              telegramUserId: 5387655307,
              authenticationMethod: 'TELEGRAM',
              notificationChannel: 'TELEGRAM',
              preferredShareChannel: 'TELEGRAM',
              pushToken: null,
              settings: {},
            },
          }));
          return;
        }

        // User Trust Profile
        if (url.includes('/user/trust/profile') || url.includes('/user/trust-profile') || url.includes('/user/trust')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              trustScore: 85,
              verificationStatus: 'VERIFIED',
              accountAgeDays: 30,
              completedSettlements: 0,
              activeDisputes: 0,
              antiFraudScore: 95,
              tier: 'STANDARD',
            },
          }));
          return;
        }

        // User Financial Balance
        if (url.includes('/financial/balance')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const baseBal = targetUser?.netBalance != null ? Number(targetUser.netBalance) : 0;
          const totalUsdt = baseBal.toFixed(2);
          const tonBal = (targetUser?.tonBalance != null ? Number(targetUser.tonBalance) : 0).toFixed(4);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              financialAccountId: targetUser?.wallets?.[0] || `fin_acc_${targetUser?.id || 'user'}`,
              balances: [
                { assetCode: 'USDT', name: 'Tether USD', symbol: 'USDT', decimals: 2, availableBalance: totalUsdt, pendingBalance: '0.00', reservedBalance: '0.00' },
                { assetCode: 'TON', name: 'The Open Network', symbol: 'TON', decimals: 4, availableBalance: tonBal, pendingBalance: '0.0000', reservedBalance: '0.0000' },
              ],
            },
          }));
          return;
        }

        // Mining Session State
        if (url.includes('/mining/state')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const activeCurrency = targetUser?.miningCurrency || 'USDT';
          
          const userMachines = Array.isArray(targetUser?.activeMachines) ? targetUser.activeMachines : [];
          const totalCapacity = userMachines.length > 0 
            ? userMachines.reduce((sum: number, m: any) => sum + (Number(m.capacityGhs) || 0), 0)
            : 1.0;

          const now = Date.now();
          const lastUpdate = targetUser?.lastMiningUpdate ? new Date(targetUser.lastMiningUpdate).getTime() : 0;
          let unclaimed = Number(targetUser?.unclaimedMiningBalance || 0);

          // If this is a fresh user, give initial baseline so counter is visibly active immediately
          if (unclaimed === 0 && !targetUser?.lastMiningUpdate) {
            unclaimed = 0.050000;
          } else if (lastUpdate > 0 && now > lastUpdate) {
            // Accrue passive yield for the entire duration the user was away / logged out
            const elapsedSec = (now - lastUpdate) / 1000;
            const ratePerSec = 0.0000289 * totalCapacity;
            const offlineAccrual = elapsedSec * ratePerSec;
            unclaimed += offlineAccrual;
          }

          if (targetUser) {
            targetUser.unclaimedMiningBalance = Number(unclaimed.toFixed(6));
            targetUser.lastMiningUpdate = new Date(now).toISOString();
            saveUsersToDisk(allUsers);
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              activeCurrency,
              baseSpeedGhs: totalCapacity,
              coolerMultiplier: 1.0,
              unclaimedBalance: Number(unclaimed.toFixed(6)),
              machineMode: 'PROMOTIONAL',
              lifetimePromotionalOutput: 0,
              interactivePromotionalOutput: 0,
              isOverheated: false,
              cooldownRemaining: 0,
              tapYieldPerTap: 0.0002,
            },
          }));
          return;
        }

        // Mining Tap
        if (url.includes('/mining/tap')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const activeCurrency = targetUser?.miningCurrency || 'USDT';
          const userMachines = Array.isArray(targetUser?.activeMachines) ? targetUser.activeMachines : [];
          const totalCapacity = userMachines.length > 0 
            ? userMachines.reduce((sum: number, m: any) => sum + (Number(m.capacityGhs) || 0), 0)
            : 1.0;

          const now = Date.now();
          const lastUpdate = targetUser?.lastMiningUpdate ? new Date(targetUser.lastMiningUpdate).getTime() : now;
          let currentUnclaimed = Number(targetUser?.unclaimedMiningBalance || 0);

          if (now > lastUpdate) {
            const elapsedSec = (now - lastUpdate) / 1000;
            const ratePerSec = 0.0000289 * totalCapacity;
            currentUnclaimed += elapsedSec * ratePerSec;
          }

          const newUnclaimed = Number((currentUnclaimed + 0.0002).toFixed(6));

          if (targetUser) {
            targetUser.unclaimedMiningBalance = newUnclaimed;
            targetUser.lastMiningUpdate = new Date(now).toISOString();
            saveUsersToDisk(allUsers);
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              activeCurrency,
              baseSpeedGhs: totalCapacity,
              coolerMultiplier: 1.05,
              unclaimedBalance: newUnclaimed,
              machineMode: 'PROMOTIONAL',
              lifetimePromotionalOutput: 0,
              interactivePromotionalOutput: 0,
              isOverheated: false,
              cooldownRemaining: 0,
              tapYieldPerTap: 0.0002,
            },
          }));
          return;
        }

        // Mining Toggle Currency
        if (url.includes('/mining/toggle')) {
          let body = '';
          req.on('data', (c) => { body += c; });
          req.on('end', () => {
            const allUsers = loadUsersFromDisk();
            const targetUser = findRequestUser(req, allUsers);
            let currency = 'USDT';
            try {
              const parsed = JSON.parse(body || '{}');
              currency = parsed.currency || 'USDT';
            } catch {
              // fallback
            }

            if (targetUser) {
              targetUser.miningCurrency = currency;
              saveUsersToDisk(allUsers);
            }

            const userMachines = Array.isArray(targetUser?.activeMachines) ? targetUser.activeMachines : [];
            const baseSpeedGhs = userMachines.length > 0 
              ? userMachines.reduce((sum: number, m: any) => sum + (Number(m.capacityGhs) || 0), 0)
              : 1.0;
            const unclaimed = Number(targetUser?.unclaimedMiningBalance || 0);

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: {
                activeCurrency: currency,
                baseSpeedGhs,
                coolerMultiplier: 1.0,
                unclaimedBalance: unclaimed,
                machineMode: 'PROMOTIONAL',
                lifetimePromotionalOutput: 0,
                interactivePromotionalOutput: 0,
                isOverheated: false,
                cooldownRemaining: 0,
                tapYieldPerTap: 0.0002,
              },
            }));
          });
          return;
        }

        // Mining Claim Rewards
        if (url.includes('/mining/claim')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const unclaimed = Number(targetUser?.unclaimedMiningBalance || 0);

          if (!targetUser || unclaimed < 3.0) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({
              success: false,
              error: {
                code: unclaimed === 0 ? 'ALREADY_CLAIMED' : 'MINIMUM_CLAIM_THRESHOLD',
                message: unclaimed === 0 
                  ? 'Mining rewards have already been collected.' 
                  : `Minimum collection amount is $3.00 (Current balance: $${unclaimed.toFixed(4)}). Keep mining to reach $3.00.`,
              },
            }));
            return;
          }

          targetUser.netBalance = Number(((targetUser.netBalance || 0) + unclaimed).toFixed(4));
          targetUser.unclaimedMiningBalance = 0;
          targetUser.lastMiningUpdate = new Date().toISOString();
          if (!Array.isArray(targetUser.transactions)) targetUser.transactions = [];
          targetUser.transactions.unshift({
            id: `tx_mine_${Date.now()}`,
            type: 'MINING_YIELD',
            amount: unclaimed.toFixed(4),
            asset: targetUser.miningCurrency || 'USDT',
            status: 'COMPLETED',
            reference: `MINE-${Date.now().toString().slice(-6)}`,
            description: 'Cloud Machine Mining Yield Claimed',
            createdAt: new Date().toISOString(),
          });
          saveUsersToDisk(allUsers);

          const userMachines = Array.isArray(targetUser?.activeMachines) ? targetUser.activeMachines : [];
          const baseSpeedGhs = userMachines.length > 0 
            ? userMachines.reduce((sum: number, m: any) => sum + (Number(m.capacityGhs) || 0), 0)
            : 1.0;

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              success: true,
              amount: unclaimed.toFixed(4),
              session: {
                activeCurrency: targetUser?.miningCurrency || 'USDT',
                baseSpeedGhs,
                coolerMultiplier: 1.0,
                unclaimedBalance: 0,
                machineMode: 'PROMOTIONAL',
                lifetimePromotionalOutput: 0,
                interactivePromotionalOutput: 0,
                isOverheated: false,
                cooldownRemaining: 0,
                tapYieldPerTap: 0.0001,
              },
            },
          }));
          return;
        }

        // Treasury Metrics
        if (url.includes('/treasury/metrics')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              totalLiquidity: 250000.00,
              userLiabilities: 45200.00,
              reserveRatio: 553.1,
              projectedPayouts: 12500.00,
              settlementExposure: 8900.00,
              capacityRemaining: 92.5,
              healthStatus: 'HEALTHY',
              riskScore: 'LOW',
              forecastDays: 90,
              countryAllocation: { 'UG': 65, 'KE': 20, 'TZ': 10, 'OTHER': 5 },
            },
          }));
          return;
        }

        // User Trust Profile
        if (url.includes('/user/trust/profile')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              telegramUserId: Number(targetUser?.telegramId || 0),
              trustScore: 85,
              reputationRank: 'Builder',
              loginCount: 5,
              educationScore: 100,
              isReady: true,
              operatorAccess: 'Unlocked',
              createdAt: targetUser?.createdAt || new Date().toISOString(),
            },
          }));
          return;
        }

        // Machines Catalog
        if (url.includes('/machines/catalog')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: [
              {
                tierCode: 'TS_CORE_LITE',
                name: 'Titan Core Lite',
                priceUsdt: 25.0,
                capacityGhs: 125,
                powerRatingW: 15,
                description: 'Ideal starter compute engine for everyday yield generation.',
                dailyYieldEstimateUsdt: 0.85,
                isPopular: false,
              },
              {
                tierCode: 'TS_STREAM_PRO',
                name: 'Stream Pro Accelerator',
                priceUsdt: 100.0,
                capacityGhs: 550,
                powerRatingW: 60,
                description: 'High-efficiency stream engine with optimized hash pipeline.',
                dailyYieldEstimateUsdt: 3.60,
                isPopular: true,
              },
              {
                tierCode: 'TS_ENTERPRISE_TITAN',
                name: 'Titan Enterprise Matrix',
                priceUsdt: 500.0,
                capacityGhs: 3200,
                powerRatingW: 350,
                description: 'Industrial-grade compute node for maximum continuous yield.',
                dailyYieldEstimateUsdt: 19.50,
                isPopular: false,
              },
            ],
          }));
          return;
        }

        // My Machines
        if (url.includes('/machines/my') || url.includes('/machines/user-machines')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const machines = targetUser?.activeMachines || [];
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: machines,
          }));
          return;
        }

        // Purchase Machine
        if (url.includes('/machines/purchase')) {
          let body = '';
          req.on('data', (c) => { body += c; });
          req.on('end', () => {
            const allUsers = loadUsersFromDisk();
            const targetUser = findRequestUser(req, allUsers);
            let tierCode = 'TS_CORE_LITE';
            try {
              const parsed = JSON.parse(body || '{}');
              tierCode = parsed.tierCode || 'TS_CORE_LITE';
            } catch {}

            const catalog = [
              { tierCode: 'TS_CORE_LITE', name: 'Titan Core Lite', priceUsdt: 25.0, capacityGhs: 125 },
              { tierCode: 'TS_STREAM_PRO', name: 'Stream Pro Accelerator', priceUsdt: 100.0, capacityGhs: 550 },
              { tierCode: 'TS_ENTERPRISE_TITAN', name: 'Titan Enterprise Matrix', priceUsdt: 500.0, capacityGhs: 3200 },
            ];
            const item = catalog.find((c) => c.tierCode === tierCode) || catalog[0];

            if (targetUser) {
              if (!Array.isArray(targetUser.activeMachines)) targetUser.activeMachines = [];
              const newMachine = {
                id: `mach_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                telegramUserId: targetUser.telegramId || targetUser.id,
                tierCode: item.tierCode,
                name: item.name,
                purchasePrice: item.priceUsdt,
                currency: 'USDT',
                status: 'ACTIVE',
                capacityGhs: item.capacityGhs,
                lifetimeEarnings: 0,
                purchasedAt: new Date().toISOString(),
                activatedAt: new Date().toISOString(),
              };
              targetUser.activeMachines.push(newMachine);
              saveUsersToDisk(allUsers);

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                data: {
                  success: true,
                  requiresFunding: false,
                  machine: newMachine,
                  message: `Successfully commissioned ${item.name}!`,
                },
              }));
            } else {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                data: {
                  success: true,
                  requiresFunding: false,
                  message: 'Machine commissioned',
                },
              }));
            }
          });
          return;
        }

        // Payment Orders Destinations
        if (url.includes('/payment-orders/destinations')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: [
              {
                id: 'dest_mtn_ug',
                network: 'MTN',
                country: 'UG',
                currency: 'UGX',
                receivingNumber: '0772123456',
                receivingName: 'TITANSTREAM OPERATIONS',
                ussdTemplate: '*165*1*1*{number}*{amount}#',
                exchangeRateUsdt: 3782,
                minAmountUsdt: 5,
                maxAmountUsdt: 10000,
                isActive: true,
              },
              {
                id: 'dest_airtel_ug',
                network: 'AIRTEL',
                country: 'UG',
                currency: 'UGX',
                receivingNumber: '0752762181',
                receivingName: 'TITANSTREAM OPERATIONS',
                ussdTemplate: '*185*1*1*{number}*{amount}#',
                exchangeRateUsdt: 3782,
                minAmountUsdt: 5,
                maxAmountUsdt: 10000,
                isActive: true,
              },
            ],
          }));
          return;
        }

        // Payment Orders My Orders
        if (url.includes('/payment-orders/my')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const orders = targetUser?.paymentOrders || [];
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: orders,
          }));
          return;
        }

        // Create Payment Order
        if (req.method === 'POST' && url === '/api/v1/payment-orders') {
          let body = '';
          req.on('data', (c) => { body += c; });
          req.on('end', () => {
            const allUsers = loadUsersFromDisk();
            const targetUser = findRequestUser(req, allUsers);
            let payload: any = {};
            try {
              payload = JSON.parse(body || '{}');
            } catch {}

            const orderId = `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const ref = `ORD-${Date.now().toString().slice(-6)}`;
            const newOrder = {
              id: orderId,
              reference: ref,
              telegramUserId: targetUser?.telegramId || 'usr_canonical',
              type: payload.type || 'DEPOSIT',
              amount: payload.amount || 50,
              localAmount: payload.amount ? Math.round(payload.amount * 3782) : 189100,
              currency: payload.currency || 'UGX',
              asset: 'USDT',
              paymentMethod: payload.paymentMethod || 'MOBILE_MONEY',
              network: payload.network || 'MTN',
              country: payload.country || 'UG',
              status: 'AWAITING_PAYMENT',
              receivingNumber: '0752762181',
              receivingName: 'TITANSTREAM OPERATIONS',
              ussdCode: `*165*1*1*0752762181*${payload.amount ? Math.round(payload.amount * 3782) : 189100}#`,
              telUri: `tel:*165*1*1*0752762181*${payload.amount ? Math.round(payload.amount * 3782) : 189100}%23`,
              mobileNumber: payload.mobileNumber || '+256752762181',
              metadata: payload.metadata || {},
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            if (targetUser) {
              if (!Array.isArray(targetUser.paymentOrders)) targetUser.paymentOrders = [];
              targetUser.paymentOrders.unshift(newOrder);
              saveUsersToDisk(allUsers);
            }

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: newOrder,
            }));
          });
          return;
        }

        // Verify Payment Order
        if (url.includes('/payment-orders/') && url.includes('/verify')) {
          const parts = url.split('/');
          const orderId = parts[parts.indexOf('payment-orders') + 1];
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const order = (targetUser?.paymentOrders || []).find((o: any) => o.id === orderId || o.reference === orderId);
          if (order) {
            order.status = 'AWAITING_VERIFICATION';
            saveUsersToDisk(allUsers);
          }

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: order || { id: orderId, status: 'AWAITING_VERIFICATION' },
          }));
          return;
        }

        // User Financial Transactions
        if (url.includes('/financial/transactions')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const txs = targetUser?.transactions || [];
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              items: txs,
              pagination: { limit: 50, offset: 0, total: txs.length },
            },
          }));
          return;
        }

        // Growth Profile
        if (url.includes('/growth/profile')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const claimedArr: string[] = targetUser?.claimedRewards || [];
          const claimedSet = new Set(claimedArr);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              userId: targetUser?.id || 'usr_canonical_operator',
              trustScore: 85 + (claimedSet.size * 2),
              level: 'VERIFIED',
              levelName: 'Verified Operator',
              benefits: ['1.0x Base Rate', 'Standard Instant Settlements'],
              nextLevel: { level: 'TRUSTED', name: 'Trusted Member' },
              completedSettlements: 1,
              accountAgeDays: 7,
              totalVolumeUSDT: 50,
              referrals: {
                code: 'TITAN888',
                link: 'https://t.me/titanstream_bot?start=ref_TITAN888',
                totalInvited: 0,
                qualifiedCount: 0,
                totalEarnedUSDT: 0,
              },
              rewardsCount: claimedSet.size,
            },
          }));
          return;
        }

        // Growth Referrals
        if (url.includes('/growth/referrals')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const refs = targetUser.referrals || [];
          const totalInvited = refs.length;
          const qualifiedCount = refs.filter((r: any) => r.status === 'QUALIFIED' || r.status === 'PAYING' || r.status === 'REWARDED').length;
          const payingCount = refs.filter((r: any) => r.status === 'PAYING' || r.status === 'REWARDED').length;
          const totalEarned = (targetUser.claimedRewards || []).filter((id: string) => id.startsWith('ref_') || id.startsWith('soc_')).length * 2.0;
          const code = targetUser.referralCode || ('TITAN' + (targetUser.phoneNumber || targetUser.telegramId || targetUser.id).slice(-4));

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              referralCode: code,
              referralLink: 'https://t.me/titanstream_bot?start=ref_' + code,
              totalInvited,
              qualifiedCount,
              payingCount,
              totalEarnedUSDT: totalEarned,
              totalEarnedTon: 0,
              networkContributionUsdt: Number((refs.reduce((acc: number, r: any) => acc + (r.netContributionUsdt || 0), 0)).toFixed(2)),
              networkGrossVolumeUsdt: Number((refs.reduce((acc: number, r: any) => acc + (r.grossVolumeUsdt || 0), 0)).toFixed(2)),
              qualificationStatus: {
                qualifiedCount,
                payingCount,
                withdrawalRequired: 5,
                withdrawalRemaining: Math.max(0, 5 - qualifiedCount),
                isWithdrawalUnlocked: qualifiedCount >= 5,
              },
              directReferrals: refs,
              referrals: refs,
              tierBreakdown: { tier1: totalInvited, tier2: 0, tier3: 0 },
            },
          }));
          return;
        }

        // Growth Qualifications
        if (url.includes('/growth/qualification')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const refs = targetUser.referrals || [];
          const qualifiedCount = refs.filter((r: any) => r.status === 'QUALIFIED' || r.status === 'PAYING' || r.status === 'REWARDED').length;
          const payingCount = refs.filter((r: any) => r.status === 'PAYING' || r.status === 'REWARDED').length;

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              qualifiedCount,
              payingCount,
              withdrawalRequired: 5,
              withdrawalRemaining: Math.max(0, 5 - qualifiedCount),
              isWithdrawalUnlocked: qualifiedCount >= 5,
              withdrawalEligible: qualifiedCount >= 5,
              discountEligible: true,
              discountPercent: 0,
              requirements: [],
            },
          }));
          return;
        }

        // Growth Progress
        if (url.includes('/growth/progress')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const claimedSet = new Set(targetUser.claimedRewards || []);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              streakDays: 1,
              completedMissions: claimedSet.size,
              totalMissions: 2,
              levelName: 'Verified Operator',
              progressPercent: Math.min(100, (claimedSet.size / 2) * 100),
              nextTier: 'Trusted Member',
            },
          }));
          return;
        }

        // Games Crystal Balance & Catalog
        if (url.includes('/games/balance')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const crystals = Number(targetUser.crystalsBalance || 0);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              balance: crystals,
              lifetimeEarned: crystals,
              lifetimeSpent: 0,
            },
          }));
          return;
        }

        if (url.includes('/games/profile')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const crystals = Number(targetUser.crystalsBalance || 0);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              profile: {
                level: 1,
                xp: crystals,
                nextLevelXp: 500,
                highestScore: 0,
                gamesPlayed: 0,
                crystalsBalance: crystals,
              },
              dailyLogin: {
                day: 1,
                streak: 1,
                claimedToday: true,
                canClaim: false,
              },
            },
          }));
          return;
        }

        // Next Best Action Engine
        if (url.includes('/growth/next-best-action')) {
          const claimedSet: Set<string> = (globalThis as any).__mockClaimedRewardIds || new Set();
          const hasUnclaimed = !claimedSet.has('starter_welcome') || !claimedSet.has('starter_security');
          
          if (!hasUnclaimed) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              data: null,
            }));
            return;
          }

          const unclaimedCount = (claimedSet.has('starter_welcome') ? 0 : 1) + (claimedSet.has('starter_security') ? 0 : 1);
          const unclaimedAmt = (claimedSet.has('starter_welcome') ? 0 : 0.5) + (claimedSet.has('starter_security') ? 0 : 1.0);

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              actionType: 'CLAIM_REWARD',
              title: 'Claim Your Unlocked Rewards',
              description: `You have ${unclaimedCount} verified reward badge(s) ready to be credited to your available wallet balance.`,
              reason: 'UNCLAIMED_INCENTIVES',
              destinationTab: 'rewards',
              priority: 'URGENT',
              potentialUnlockUsdt: unclaimedAmt,
              badge: 'Claimable',
            },
          }));
          return;
        }

        // Growth Achievements (12 Canonical Achievements)
        if (url.includes('/growth/achievements')) {
          const claimedSet: Set<string> = (globalThis as any).__mockClaimedRewardIds || new Set();
          const hasClaimedAny = claimedSet.size > 0;
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              achievements: [
                { code: 'FIRST_REWARD', name: 'First Victory', description: 'Claim your first reward.', tier: 'BRONZE', icon: '🏆', target: 1, progress: hasClaimedAny ? 1 : 0, achieved: hasClaimedAny, achievedAt: hasClaimedAny ? new Date().toISOString() : null },
                { code: 'REWARD_HUNTER', name: 'Reward Hunter', description: 'Claim 5 rewards.', tier: 'SILVER', icon: '🎯', target: 5, progress: claimedSet.size, achieved: claimedSet.size >= 5, achievedAt: null },
                { code: 'TITAN_PATRON', name: 'Titan Patron', description: 'Claim 10 rewards.', tier: 'GOLD', icon: '💎', target: 10, progress: claimedSet.size, achieved: false, achievedAt: null },
                { code: 'FIRST_REFERRAL', name: 'First Invite', description: 'Invite your first friend to qualify.', tier: 'BRONZE', icon: '🤝', target: 1, progress: 0, achieved: false, achievedAt: null },
                { code: 'NETWORK_BUILDER', name: 'Network Builder', description: 'Qualify 3 referrals.', tier: 'SILVER', icon: '🌐', target: 3, progress: 0, achieved: false, achievedAt: null },
                { code: 'REFERRAL_MAGNET', name: 'Referral Magnet', description: 'Qualify 10 referrals.', tier: 'PLATINUM', icon: '🧲', target: 10, progress: 0, achieved: false, achievedAt: null },
                { code: 'FIRST_MACHINE', name: 'Core Operator', description: 'Commission your first active compute engine.', tier: 'BRONZE', icon: '⚡', target: 1, progress: 1, achieved: true, achievedAt: new Date().toISOString() },
                { code: 'MACHINE_COLLECTOR', name: 'Fleet Architect', description: 'Deploy 3 active compute engines in your fleet.', tier: 'GOLD', icon: '🖥️', target: 3, progress: 1, achieved: false, achievedAt: null },
                { code: 'FIRST_SETTLEMENT', name: 'First Settlement', description: 'Complete your first settlement.', tier: 'BRONZE', icon: '✅', target: 1, progress: 1, achieved: true, achievedAt: new Date().toISOString() },
                { code: 'SETTLEMENT_VETERAN', name: 'Settlement Veteran', description: 'Complete 10 settlements.', tier: 'SILVER', icon: '📊', target: 10, progress: 1, achieved: false, achievedAt: null },
                { code: 'TRUSTED_MEMBER', name: 'Trusted Member', description: 'Reach the Trusted level.', tier: 'SILVER', icon: '🛡️', target: 2, progress: 1, achieved: false, achievedAt: null },
                { code: 'WEEKLY_WARRIOR', name: 'Weekly Warrior', description: 'Claim rewards 3 days in a row.', tier: 'SILVER', icon: '🔥', target: 3, progress: 1, achieved: false, achievedAt: null },
              ],
              totalUnlocked: (hasClaimedAny ? 1 : 0) + 2, // First Reward (if claimed) + Core Operator + First Settlement
              total: 12,
              justUnlocked: [],
            },
          }));
          return;
        }

        // Growth Missions Queue
        if (url.includes('/growth/rewards/missions')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const claimedArr: string[] = targetUser?.claimedRewards || [];
          const claimedSet = new Set(claimedArr);

          const allEngineMissions = [
            {
              id: 'starter_welcome',
              ruleCode: 'RULE_STARTER_WELCOME',
              rewardType: 'MILESTONE',
              amount: '0.50',
              assetCode: 'USDT',
              status: claimedSet.has('starter_welcome') ? 'CLAIMED' : 'AVAILABLE',
              reference: 'REF-STARTER-1',
              createdAt: new Date().toISOString(),
              ruleName: 'Activate Hardware Core',
              description: 'Commission your first compute engine on Titan Hub',
              requirement: { key: 'mining_cycle', label: 'Hardware Core', required: 1, current: 1, unit: 'core', completed: true, actionTab: 'hub' },
              reason: 'Ready to claim starter bonus',
              eligible: !claimedSet.has('starter_welcome'),
              category: 'machine',
              difficulty: 'EASY',
              progressPercent: 100,
              estimatedRemaining: 'Claim now',
            },
            {
              id: 'starter_security',
              ruleCode: 'RULE_STARTER_SECURITY',
              rewardType: 'MILESTONE',
              amount: '1.00',
              assetCode: 'USDT',
              status: claimedSet.has('starter_security') ? 'CLAIMED' : 'AVAILABLE',
              reference: 'REF-STARTER-2',
              createdAt: new Date().toISOString(),
              ruleName: 'Security Configuration',
              description: 'Verify Telegram session & configure security settings',
              requirement: { key: 'security_config', label: 'Security Verified', required: 1, current: 1, unit: 'shield', completed: true, actionTab: 'wallet' },
              reason: 'Ready to claim security bonus',
              eligible: !claimedSet.has('starter_security'),
              category: 'profile',
              difficulty: 'EASY',
              progressPercent: 100,
              estimatedRemaining: 'Claim now',
            },
            {
              id: 'milestone_first_settlement',
              ruleCode: 'MILESTONE_FIRST_SETTLEMENT',
              rewardType: 'MILESTONE',
              amount: '2.00',
              assetCode: 'USDT',
              status: claimedSet.has('milestone_first_settlement') ? 'CLAIMED' : 'IN_PROGRESS',
              reference: 'REF-SETTLE-1',
              createdAt: new Date().toISOString(),
              ruleName: 'First Settlement Bonus',
              description: 'Complete your first deposit or settlement session to unlock payout liquidity',
              requirement: { key: 'settlement_count', label: 'Completed Settlements', required: 1, current: 0, unit: 'settlement', completed: false, actionTab: 'wallet' },
              reason: 'Complete 1 settlement from Wallet screen to claim',
              eligible: false,
              category: 'settlement',
              difficulty: 'MEDIUM',
              progressPercent: 0,
              estimatedRemaining: '1 settlement needed',
            },
            {
              id: 'milestone_fleet_expansion',
              ruleCode: 'MILESTONE_FLEET_EXPANSION',
              rewardType: 'MILESTONE',
              amount: '2.50',
              assetCode: 'USDT',
              status: claimedSet.has('milestone_fleet_expansion') ? 'CLAIMED' : 'IN_PROGRESS',
              reference: 'REF-FLEET-1',
              createdAt: new Date().toISOString(),
              ruleName: 'Fleet Expansion',
              description: 'Deploy 3 active compute engines in your hardware fleet',
              requirement: { key: 'machine_capacity', label: 'Active Compute Fleet', required: 3, current: 1, unit: 'engines', completed: false, actionTab: 'shop' },
              reason: '2 more engines needed in Shop',
              eligible: false,
              category: 'machine',
              difficulty: 'MEDIUM',
              progressPercent: 33,
              estimatedRemaining: '2 engines needed',
            },
            {
              id: 'referral_reward_5usdt',
              ruleCode: 'REFERRAL_DEFAULT_5USDT',
              rewardType: 'REFERRAL',
              amount: '5.00',
              assetCode: 'USDT',
              status: claimedSet.has('referral_reward_5usdt') ? 'CLAIMED' : 'IN_PROGRESS',
              reference: 'REF-INVITE-1',
              createdAt: new Date().toISOString(),
              ruleName: 'First Referral Reward',
              description: 'Invite your first partner who completes onboarding & qualifying settlement',
              requirement: { key: 'referral_qualified', label: 'Qualified Partner', required: 1, current: 0, unit: 'invite', completed: false, actionTab: 'friends' },
              reason: 'Invite friends from Grow tab',
              eligible: false,
              category: 'referral',
              difficulty: 'MEDIUM',
              progressPercent: 0,
              estimatedRemaining: '1 invite needed',
            },
            {
              id: 'milestone_trust_upgrade',
              ruleCode: 'MILESTONE_TRUST_UPGRADE',
              rewardType: 'MILESTONE',
              amount: '2.00',
              assetCode: 'USDT',
              status: claimedSet.has('milestone_trust_upgrade') ? 'CLAIMED' : 'IN_PROGRESS',
              reference: 'REF-TRUST-1',
              createdAt: new Date().toISOString(),
              ruleName: 'Trusted Operator Promotion',
              description: 'Upgrade your operator safety score to 50+ to unlock tier discounts',
              requirement: { key: 'user_level', label: 'Safety Rank', required: 50, current: 40, unit: 'score', completed: false, actionTab: 'wallet' },
              reason: 'Perform clean operations to elevate score',
              eligible: false,
              category: 'profile',
              difficulty: 'HARD',
              progressPercent: 80,
              estimatedRemaining: '10 pts needed',
            },
          ];

          // Progressive rollup: claimed missions leave, next active ones roll up
          const uncompleted = allEngineMissions.filter((m) => !claimedSet.has(m.id));
          const rollupQueue = uncompleted.slice(0, 4);

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              missions: rollupQueue,
            },
          }));
          return;
        }

        // Social Growth Missions
        if (url.includes('/growth/social/missions')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          targetUser.claimedVirtualMissions = targetUser.claimedVirtualMissions || [];
          targetUser.participatedMissions = targetUser.participatedMissions || [];
          targetUser.crystalsBalance = Number(targetUser.crystalsBalance || 0);

          if (req.method === 'POST' && url.includes('/claim-virtual')) {
            const match = url.match(/\/growth\/social\/missions\/([^/?#]+)\/claim-virtual/);
            const missionId = match ? match[1] : 'soc_1';

            if (targetUser.claimedVirtualMissions.includes(missionId)) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, alreadyClaimed: true, crystals: 0, xp: 0 }));
              return;
            }

            let crystalsReward = 250;
            let xpReward = 100;
            if (missionId === 'soc_2') { crystalsReward = 500; xpReward = 250; }
            if (missionId === 'soc_3') { crystalsReward = 1500; xpReward = 1000; }

            targetUser.claimedVirtualMissions.push(missionId);
            targetUser.crystalsBalance += crystalsReward;
            targetUser.transactions = targetUser.transactions || [];
            targetUser.transactions.unshift({
              id: 'tx_crys_' + Date.now(),
              type: 'CRYSTAL_REWARD',
              amount: crystalsReward,
              currency: 'CRYSTALS',
              status: 'COMPLETED',
              description: `Mission Reward (${missionId}): +${crystalsReward} Crystals`,
              createdAt: new Date().toISOString(),
            });

            saveUsersToDisk(allUsers);

            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({ success: true, crystals: crystalsReward, xp: xpReward, alreadyClaimed: false }));
            return;
          }

          if (req.method === 'POST' && url.includes('/participate')) {
            const match = url.match(/\/growth\/social\/missions\/([^/?#]+)\/participate/);
            const missionId = match ? match[1] : 'soc_2';
            if (!targetUser.participatedMissions.includes(missionId)) {
              targetUser.participatedMissions.push(missionId);
              saveUsersToDisk(allUsers);
            }
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify({
              success: true,
              participation: {
                id: 'part_' + (targetUser.id || 'usr').slice(-4),
                trackingCode: 'TSG-' + (targetUser.phoneNumber || targetUser.telegramId || targetUser.id).slice(-4),
              },
            }));
            return;
          }

          // Dynamic missions according to user's real state
          const refs = targetUser.referrals || [];
          const isSoc1Claimed = targetUser.claimedVirtualMissions.includes('soc_1');
          const isSoc2Claimed = targetUser.claimedVirtualMissions.includes('soc_2');
          const isSoc3Claimed = targetUser.claimedVirtualMissions.includes('soc_3');

          const soc2Progress = Math.min(100, Math.round((refs.length / 3) * 100));
          const soc3Progress = Math.min(100, Math.round((refs.filter((r: any) => r.status === 'PAYING' || r.status === 'REWARDED').length / 3) * 100));

          const verifiedSoc2Value = Number((refs.reduce((acc: number, r: any) => acc + (r.netContributionUsdt || 0), 0)).toFixed(2));
          const verifiedSoc3Value = Number((refs.filter((r: any) => r.status === 'PAYING' || r.status === 'REWARDED').length * 5.0).toFixed(2));

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            missions: [
              {
                id: 'soc_1',
                code: 'SOCIAL_JOIN_TG',
                name: 'Join Official Titan Telegram',
                description: 'Join our official Telegram community for live rate updates and announcements.',
                tier: 'ENGAGEMENT',
                category: 'social',
                channel: 'TELEGRAM',
                virtualRewardCrystals: 250,
                virtualRewardXp: 100,
                maxRewardUsdt: 0,
                requiredContributionUsdt: 0,
                verifiedContributionUsdt: 0,
                rewardRate: 0,
                platformMarginBufferUsdt: 0,
                progressPercent: isSoc1Claimed ? 100 : 0,
                status: isSoc1Claimed ? 'CLAIMED' : 'TRACKING',
                isOverSettled: false,
                isEligible: false,
                isClaimed: false,
                virtualRewardsClaimed: isSoc1Claimed,
                trackingCode: 'TSG-TELE-' + (targetUser.phoneNumber || targetUser.telegramId || targetUser.id).slice(-4),
                attributedActionsCount: isSoc1Claimed ? 1 : 0,
              },
              {
                id: 'soc_2',
                code: 'SOCIAL_SHARE_CIRCLE',
                name: 'Invite Friends Bonus',
                description: 'Share TitanStream with friends. Earn 500 Crystals immediately + get $2.00 USDT cash reward when your friends start mining.',
                tier: 'DISTRIBUTION',
                category: 'distribution',
                channel: 'ALL',
                virtualRewardCrystals: 500,
                virtualRewardXp: 250,
                maxRewardUsdt: 2.0,
                requiredContributionUsdt: 10.0,
                verifiedContributionUsdt: verifiedSoc2Value,
                rewardRate: 0.2,
                platformMarginBufferUsdt: 8.0,
                progressPercent: soc2Progress,
                status: verifiedSoc2Value >= 10.0 ? 'ELIGIBLE' : (refs.length > 0 ? 'VALUE_GENERATING' : 'TRACKING'),
                isOverSettled: verifiedSoc2Value >= 10.0,
                isEligible: verifiedSoc2Value >= 10.0,
                isClaimed: (targetUser.claimedRewards || []).includes('soc_2'),
                virtualRewardsClaimed: isSoc2Claimed,
                trackingCode: 'TSG-CIRC-' + (targetUser.phoneNumber || targetUser.telegramId || targetUser.id).slice(-4),
                attributedActionsCount: refs.length,
              },
              {
                id: 'soc_3',
                code: 'SOCIAL_ACTIVATE_TRADERS',
                name: 'Community Mining Leader',
                description: 'Invite 3 active friends who complete settlements. Earn up to $5.00 USDT cash bonus.',
                tier: 'REVENUE',
                category: 'revenue',
                channel: 'WHATSAPP',
                virtualRewardCrystals: 1500,
                virtualRewardXp: 1000,
                maxRewardUsdt: 5.0,
                requiredContributionUsdt: 25.0,
                verifiedContributionUsdt: verifiedSoc3Value,
                rewardRate: 0.2,
                platformMarginBufferUsdt: 20.0,
                progressPercent: soc3Progress,
                status: verifiedSoc3Value >= 25.0 ? 'ELIGIBLE' : (verifiedSoc3Value > 0 ? 'VALUE_GENERATING' : 'TRACKING'),
                isOverSettled: verifiedSoc3Value >= 25.0,
                isEligible: verifiedSoc3Value >= 25.0,
                isClaimed: (targetUser.claimedRewards || []).includes('soc_3'),
                virtualRewardsClaimed: isSoc3Claimed,
                trackingCode: 'TSG-TRAD-' + (targetUser.phoneNumber || targetUser.telegramId || targetUser.id).slice(-4),
                attributedActionsCount: refs.filter((r: any) => r.status === 'PAYING' || r.status === 'REWARDED').length,
              },
            ],
          }));
          return;
        }

        // Social Value Bank
        if (url.includes('/growth/social/value-bank')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const refs = targetUser.referrals || [];
          const userCrystals = Number(targetUser.crystalsBalance || 0);

          const totalGenerated = Number((refs.reduce((acc: number, r: any) => acc + (r.netContributionUsdt || 0), 0)).toFixed(2));
          const unlockedRewards = Number(((targetUser.claimedRewards || []).filter((id: string) => id.startsWith('soc_') || id.startsWith('ref_')).length * 2.0).toFixed(2));
          const retainedContribution = Number((Math.max(0, totalGenerated - unlockedRewards)).toFixed(2));
          const completedCount = (targetUser.claimedVirtualMissions || []).length;

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            valueBank: {
              totalValueGeneratedUsdt: totalGenerated,
              unlockedRewardsUsdt: unlockedRewards,
              retainedContributionUsdt: retainedContribution,
              activeMissionsCount: 3,
              completedMissionsCount: completedCount,
              totalCrystalsEarned: userCrystals,
            },
          }));
          return;
        }

        // Admin Social Campaigns
        if (url.includes('/admin/growth/social/campaigns')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            campaigns: [
              {
                id: 'soc_1',
                code: 'SOCIAL_JOIN_TG',
                name: 'Join Official Titan Telegram',
                tier: 'ENGAGEMENT',
                channel: 'TELEGRAM',
                enabled: true,
                totalParticipants: 420,
                totalClicks: 890,
                verifiedContributionUsdt: '0.00',
                unlockedRewardsUsdt: '0.00',
                retainedContributionUsdt: '0.00',
                roi: 'N/A',
                status: 'PROFITABLE',
              },
              {
                id: 'soc_2',
                code: 'SOCIAL_SHARE_CIRCLE',
                name: 'Activate Your Circle',
                tier: 'DISTRIBUTION',
                channel: 'ALL',
                enabled: true,
                totalParticipants: 180,
                totalClicks: 1250,
                verifiedContributionUsdt: '1420.00',
                unlockedRewardsUsdt: '284.00',
                retainedContributionUsdt: '1136.00',
                roi: '5.00',
                status: 'PROFITABLE',
              },
            ],
          }));
          return;
        }

        // Growth Rewards Claim (POST /growth/rewards/:id/claim)
        if (url.includes('/growth/rewards/') && (url.includes('/claim') || req.method === 'POST')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          targetUser.claimedRewards = targetUser.claimedRewards || [];
          targetUser.transactions = targetUser.transactions || [];
          targetUser.netBalance = Number(targetUser.netBalance || 0);

          const claimedSet = new Set(targetUser.claimedRewards);
          const match = url.match(/\/growth\/rewards\/([^/?#]+)\/claim/) || url.match(/\/growth\/rewards\/([^/?#]+)/);
          const rawId = match ? match[1] : 'starter_welcome';
          const rewardId = rawId.replace(/^rule:/, '');

          // Disallow duplicate claim
          if (claimedSet.has(rewardId) || (rewardId.includes('welcome') && claimedSet.has('starter_welcome')) || (rewardId.includes('security') && claimedSet.has('starter_security'))) {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 400;
            res.end(JSON.stringify({
              success: false,
              statusCode: 400,
              error: 'Bad Request',
              message: 'This reward has already been claimed.',
            }));
            return;
          }

          targetUser.claimedRewards.push(rewardId);
          if (rewardId.includes('welcome') && !targetUser.claimedRewards.includes('starter_welcome')) {
            targetUser.claimedRewards.push('starter_welcome');
          }
          if (rewardId.includes('security') && !targetUser.claimedRewards.includes('starter_security')) {
            targetUser.claimedRewards.push('starter_security');
          }

          const amountVal = rewardId.includes('security') ? 1.00 : 0.50;
          targetUser.netBalance = Number((targetUser.netBalance + amountVal).toFixed(2));

          const rewardData = {
            id: rewardId,
            amount: amountVal.toFixed(2),
            assetCode: 'USDT',
            status: 'CLAIMED',
            reference: `ref_reward_${rewardId}_${Date.now()}`,
            processedAt: new Date().toISOString(),
          };

          const txRecord = {
            id: 'tx_rwd_' + Date.now(),
            type: 'REWARD',
            amount: amountVal,
            assetCode: 'USDT',
            status: 'COMPLETED',
            reference: rewardData.reference,
            createdAt: new Date().toISOString(),
            description: rewardId.includes('security') ? 'Security Configuration Reward' : 'Hardware Core Starter Reward',
          };
          targetUser.transactions.unshift(txRecord);

          saveUsersToDisk(allUsers);

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              success: true,
              reward: rewardData,
            },
          }));
          return;
        }

        // Exact GET /growth/rewards
        if (url === '/api/v1/growth/rewards' || url === '/growth/rewards') {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const claimedSet = new Set(targetUser?.claimedRewards || []);
          const list: any[] = [];
          if (claimedSet.has('starter_welcome')) {
            list.push({ id: 'starter_welcome', amount: '0.50', assetCode: 'USDT', status: 'CLAIMED', processedAt: new Date().toISOString() });
          }
          if (claimedSet.has('starter_security')) {
            list.push({ id: 'starter_security', amount: '1.00', assetCode: 'USDT', status: 'CLAIMED', processedAt: new Date().toISOString() });
          }
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: list,
          }));
          return;
        }

        // Single reward detail
        if (url.includes('/growth/rewards/') && !url.includes('/missions') && !url.includes('/history') && !url.includes('/available')) {
          const match = url.match(/\/growth\/rewards\/([^/?#]+)/);
          const rawId = match ? match[1] : 'starter_welcome';
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const claimedSet = new Set(targetUser?.claimedRewards || []);
          const isClaimed = claimedSet.has(rawId);

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              id: rawId,
              ruleName: rawId.includes('security') ? 'Security Configuration' : 'Activate Hardware Core',
              description: rawId.includes('security') ? 'Verify Telegram session & configure security settings' : 'Start your first compute cycle on Titan Hub',
              amount: rawId.includes('security') ? '1.00' : '0.50',
              assetCode: 'USDT',
              status: isClaimed ? 'CLAIMED' : 'AVAILABLE',
              reason: isClaimed ? 'Already claimed' : 'Starter Bonus',
              requirement: { key: 'action', label: 'Requirement Met', required: 1, current: 1, unit: 'check', completed: true },
            },
          }));
          return;
        }

        // Growth Reward History
        if (url.includes('/growth/rewards/history')) {
          const allUsers = loadUsersFromDisk();
          const targetUser = findRequestUser(req, allUsers);
          const claimedSet = new Set(targetUser?.claimedRewards || []);
          const historyList: any[] = [];
          if (claimedSet.has('starter_welcome')) {
            historyList.push({ id: 'starter_welcome', amount: '0.50', assetCode: 'USDT', status: 'CLAIMED', processedAt: new Date().toISOString(), reference: 'REF-STARTER-1' });
          }
          if (claimedSet.has('starter_security')) {
            historyList.push({ id: 'starter_security', amount: '1.00', assetCode: 'USDT', status: 'CLAIMED', processedAt: new Date().toISOString(), reference: 'REF-STARTER-2' });
          }
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              history: historyList,
            },
          }));
          return;
        }

        // Growth Dashboard & Overview
        if (url.includes('/growth/dashboard') || url.includes('/growth/overview')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: {
              growthScore: 850,
              trustScore: 85,
              communityRank: '#412',
              rewardMultiplier: 1.0,
              referralMultiplier: 1.0,
              withdrawalLimit: 100,
              currentTier: 'Seed',
              nextUnlock: 'Builder I',
              totalVerifiedTransactions: 24582,
              trustChecklist: [
                { id: 't1', label: 'Verified account', completed: true },
                { id: 't2', label: 'First payment completed', completed: false },
                { id: 't3', label: 'Invite trusted users', completed: false },
                { id: 't4', label: 'Complete transactions', completed: false },
              ],
              availableRewards: [],
              todaysMissions: [],
              referralSummary: {
                code: 'TITAN888',
                link: 'https://t.me/titanstream_bot?start=ref_TITAN888',
                totalInvited: 0,
                qualifiedCount: 0,
                qualityScore: 100,
                totalEarnedUSDT: 0,
              },
              seasonProgress: {
                seasonNumber: 1,
                seasonTitle: 'Treasury Expansion',
                seasonProgressPower: 850,
                seasonTargetPower: 10000,
                daysRemaining: 18,
              },
            },
          }));
          return;
        }

        // Settlement History
        if (url.includes('/settlement/history')) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: [],
          }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), adminMockMiddleware()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion-dom')) {
            return 'vendor-motion';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false,
    host: '0.0.0.0',
    allowedHosts: true,
    watch: {
      ignored: ['**/.admin_users_db.json', '**/.git/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, req, res) => {
            if (res && !('headersSent' in res && res.headersSent)) {
              const url = req.url || '';
              // @ts-ignore
              res.writeHead(200, { 'Content-Type': 'application/json' });

              let responseData: any = [];

              if (url.includes('/admin/treasury-operators/intelligence')) {
                responseData = { activeOperators: 2, queueLength: 0, avgResolutionTimeSec: 28, totalSettled24h: 670.0 };
              } else if (url.includes('/admin/treasury/health')) {
                responseData = { status: 'HEALTHY', reserves: 3220, unallocated: 2230 };
              } else if (url.includes('/admin/financial/overview')) {
                responseData = { totalInflow: 1660.0, totalOutflow: 670.0, netReserve: 990.0 };
              } else if (url.includes('/admin/operations-hq/switches') || url.includes('/operations/switches')) {
                responseData = { maintenanceMode: false, readOnlyMode: false, disableWithdrawals: false, disablePurchases: false };
              } else if (url.includes('/admin/machines-hq/economy/profiles')) {
                responseData = [
                  { id: 'ep_1', code: 'STANDARD_PROD', name: 'Authoritative Production Matrix', version: 1, yieldMultiplier: '1.0', referralMultiplier: '1.0', rewardMultiplier: '1.0', isActive: true, priority: 1 },
                ];
              } else if (url.includes('/admin/users')) {
                responseData = { items: [], pagination: { total: 3, page: 1, limit: 50 } };
              }

              // @ts-ignore
              res.end(JSON.stringify({ success: true, data: responseData }));
            }
          });
        },
      },
    },
  },
});
