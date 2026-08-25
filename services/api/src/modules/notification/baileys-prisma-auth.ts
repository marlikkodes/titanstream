import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';

export interface PrismaAuthStateResult {
  state: {
    creds: any;
    keys: {
      get: (type: string, ids: string[]) => Promise<{ [id: string]: any }>;
      set: (data: any) => Promise<void>;
    };
  };
  saveCreds: () => Promise<void>;
  clearCreds: () => Promise<void>;
}

/**
 * Creates a database-backed authentication state adapter for Baileys.
 * Persists WhatsApp credentials (`creds`) and key stores (`pre-key`, `session`, `sender-key`, etc.)
 * directly into PostgreSQL via Prisma (`BaileysAuthKey` model).
 */
export async function usePrismaAuthState(
  prisma: PrismaService,
  accountId: string,
  fallbackFolder?: string,
): Promise<PrismaAuthStateResult> {
  const logger = new Logger('usePrismaAuthState');

  const baileys = await import('@whiskeysockets/baileys').catch(() => null);
  const bAny = (baileys || {}) as any;
  const initAuthCreds = bAny.initAuthCreds || bAny.default?.initAuthCreds || (() => ({
    noiseKey: { private: Buffer.from('test'), public: Buffer.from('test') },
    pairingEphemeralKeyPair: { private: Buffer.from('test'), public: Buffer.from('test') },
    signedIdentityKey: { private: Buffer.from('test'), public: Buffer.from('test') },
    signedPreKey: { keyPair: { private: Buffer.from('test'), public: Buffer.from('test') }, signature: Buffer.from('test'), keyId: 1 },
    registrationId: 1234,
    advSecretKey: 'test',
    me: undefined,
    account: undefined,
    signalIdentities: [],
    myAppStateKeyId: undefined,
    firstUnuploadedPreKeyId: 1,
    nextPreKeyId: 1,
    lastAccountSyncTimestamp: 0,
    platform: 'ubuntu',
    registered: false,
  }));
  const BufferJSON = bAny.BufferJSON || bAny.default?.BufferJSON;
  const proto = bAny.proto || bAny.default?.proto;

  let localCacheDir: string | null = null;
  if (fallbackFolder) {
    localCacheDir = path.isAbsolute(fallbackFolder)
      ? fallbackFolder
      : path.resolve(process.cwd(), fallbackFolder);
    if (!fs.existsSync(localCacheDir)) {
      try {
        fs.mkdirSync(localCacheDir, { recursive: true });
      } catch {}
    }
  }

  const writeLocalCache = (keyId: string, content: any) => {
    if (!localCacheDir) return;
    try {
      const filePath = path.join(localCacheDir, `${keyId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(content, BufferJSON?.replacer, 2));
    } catch (err: any) {
      logger.debug(`Failed to write local auth cache for ${keyId}: ${err.message}`);
    }
  };

  const readLocalCache = (keyId: string) => {
    if (!localCacheDir) return null;
    try {
      const filePath = path.join(localCacheDir, `${keyId}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw, BufferJSON?.reviver);
      }
    } catch {}
    return null;
  };

  const deleteLocalCache = (keyId: string) => {
    if (!localCacheDir) return;
    try {
      const filePath = path.join(localCacheDir, `${keyId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  };

  // 1. Load or initialize `creds`
  let creds: any = null;
  try {
    const credsRecord = await prisma.baileysAuthKey.findUnique({
      where: {
        accountId_keyId: {
          accountId,
          keyId: 'creds',
        },
      },
    });

    if (credsRecord && credsRecord.data) {
      const serialized = JSON.stringify(credsRecord.data);
      creds = JSON.parse(serialized, BufferJSON?.reviver);
      logger.log(`[PRISMA_AUTH] Loaded existing WhatsApp credentials from PostgreSQL for [${accountId}] (registered: ${creds.registered})`);
    }
  } catch (err: any) {
    logger.warn(`[PRISMA_AUTH] Failed to fetch creds from DB: ${err.message}. Checking local cache...`);
  }

  if (!creds) {
    creds = readLocalCache('creds');
    if (creds) {
      logger.log(`[PRISMA_AUTH] Loaded credentials from local fallback cache for [${accountId}]`);
      // Sync loaded local creds back to DB
      try {
        const dataJson = JSON.parse(JSON.stringify(creds, BufferJSON?.replacer));
        await prisma.baileysAuthKey.upsert({
          where: { accountId_keyId: { accountId, keyId: 'creds' } },
          create: { accountId, keyId: 'creds', data: dataJson },
          update: { data: dataJson },
        });
      } catch {}
    } else {
      logger.log(`[PRISMA_AUTH] Initializing fresh WhatsApp auth credentials for [${accountId}]`);
      creds = initAuthCreds();
    }
  }

  // 2. Define `saveCreds`
  const saveCreds = async () => {
    try {
      const dataJson = JSON.parse(JSON.stringify(creds, BufferJSON?.replacer));
      await prisma.baileysAuthKey.upsert({
        where: {
          accountId_keyId: { accountId, keyId: 'creds' },
        },
        create: {
          accountId,
          keyId: 'creds',
          data: dataJson,
        },
        update: {
          data: dataJson,
        },
      });
      writeLocalCache('creds', creds);
    } catch (err: any) {
      logger.error(`[PRISMA_AUTH_SAVE_ERR] Failed to save creds to DB: ${err.message}`);
      writeLocalCache('creds', creds);
    }
  };

  // 3. Define `clearCreds`
  const clearCreds = async () => {
    try {
      await prisma.baileysAuthKey.deleteMany({
        where: { accountId },
      });
    } catch (err: any) {
      logger.error(`[PRISMA_AUTH_CLEAR_ERR] Failed to clear creds from DB: ${err.message}`);
    }
    if (localCacheDir && fs.existsSync(localCacheDir)) {
      try {
        fs.rmSync(localCacheDir, { recursive: true, force: true });
      } catch {}
    }
  };

  // 4. Define `keys` store (get/set)
  const keys = {
    get: async (type: string, ids: string[]) => {
      const data: { [id: string]: any } = {};

      const keyIds = ids.map((id) => `${type}-${id}`);

      // Batch query PostgreSQL database for requested keys
      try {
        const records = await prisma.baileysAuthKey.findMany({
          where: {
            accountId,
            keyId: { in: keyIds },
          },
        });

        const recordMap = new Map<string, any>();
        for (const r of records) {
          recordMap.set(r.keyId, r.data);
        }

        for (const id of ids) {
          const fullKeyId = `${type}-${id}`;
          let val: any = null;

          if (recordMap.has(fullKeyId)) {
            const rawJson = JSON.stringify(recordMap.get(fullKeyId));
            val = JSON.parse(rawJson, BufferJSON?.reviver);
          } else {
            val = readLocalCache(fullKeyId);
          }

          if (val) {
            if (type === 'app-state-sync-key' && proto?.Message?.AppStateSyncKeyData) {
              val = proto.Message.AppStateSyncKeyData.fromObject(val);
            }
            data[id] = val;
          }
        }
      } catch (err: any) {
        logger.warn(`[PRISMA_AUTH_GET_KEYS_ERR] DB read failed for keys (${type}): ${err.message}. Falling back to disk cache.`);
        for (const id of ids) {
          const fullKeyId = `${type}-${id}`;
          const val = readLocalCache(fullKeyId);
          if (val) {
            data[id] = val;
          }
        }
      }

      return data;
    },

    set: async (data: any) => {
      const upsertOperations: any[] = [];
      const deleteIds: string[] = [];

      for (const category in data) {
        for (const id in data[category]) {
          const value = data[category][id];
          const fullKeyId = `${category}-${id}`;

          if (value) {
            const valueJson = JSON.parse(JSON.stringify(value, BufferJSON?.replacer));
            upsertOperations.push({
              accountId,
              keyId: fullKeyId,
              data: valueJson,
            });
            writeLocalCache(fullKeyId, value);
          } else {
            deleteIds.push(fullKeyId);
            deleteLocalCache(fullKeyId);
          }
        }
      }

      // Execute database operations asynchronously without blocking main thread
      if (upsertOperations.length > 0 || deleteIds.length > 0) {
        try {
          if (deleteIds.length > 0) {
            await prisma.baileysAuthKey.deleteMany({
              where: {
                accountId,
                keyId: { in: deleteIds },
              },
            });
          }

          for (const item of upsertOperations) {
            await prisma.baileysAuthKey.upsert({
              where: {
                accountId_keyId: {
                  accountId: item.accountId,
                  keyId: item.keyId,
                },
              },
              create: item,
              update: { data: item.data },
            });
          }
        } catch (err: any) {
          logger.error(`[PRISMA_AUTH_SET_KEYS_ERR] DB batch key write failed: ${err.message}`);
        }
      }
    },
  };

  return {
    state: {
      creds,
      keys,
    },
    saveCreds,
    clearCreds,
  };
}
