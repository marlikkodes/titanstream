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
    strictPort: true,
    host: true,
    allowedHosts: true,
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
