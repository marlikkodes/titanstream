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
    let temporaryPath: string | undefined;
    try {
      const filePath = path.join(localCacheDir, `${keyId}.json`);
      temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(temporaryPath, JSON.stringify(content, BufferJSON?.replacer, 2));
      fs.renameSync(temporaryPath, filePath);
    } catch (err: any) {
      logger.debug(`Failed to write local auth cache for ${keyId}: ${err.message}`);
      if (temporaryPath) {
        try {
          fs.unlinkSync(temporaryPath);
        } catch {}
      }
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

  let isDbAvailable = true;

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
    isDbAvailable = false;
    logger.warn(`[PRISMA_AUTH] PostgreSQL offline/unreachable: ${err.message}. Running in fast local disk cache mode.`);
  }

  if (!creds) {
    creds = readLocalCache('creds');
    if (creds) {
      logger.log(`[PRISMA_AUTH] Loaded credentials from local fallback cache for [${accountId}]`);
      if (isDbAvailable) {
        try {
          const dataJson = JSON.parse(JSON.stringify(creds, BufferJSON?.replacer));
          await prisma.baileysAuthKey.upsert({
            where: { accountId_keyId: { accountId, keyId: 'creds' } },
            create: { accountId, keyId: 'creds', data: dataJson },
            update: { data: dataJson },
          });
        } catch {
          isDbAvailable = false;
        }
      }
    } else {
      logger.log(`[PRISMA_AUTH] Initializing fresh WhatsApp auth credentials for [${accountId}]`);
      creds = initAuthCreds();
    }
  }

  // 2. Define `saveCreds`
  const saveCreds = async () => {
    writeLocalCache('creds', creds);
    if (!isDbAvailable) return;
    try {
      const dataJson = JSON.parse(JSON.stringify(creds, BufferJSON?.replacer));
      await prisma.baileysAuthKey.upsert({
        where: { accountId_keyId: { accountId, keyId: 'creds' } },
        create: { accountId, keyId: 'creds', data: dataJson },
        update: { data: dataJson },
      });
    } catch {
      isDbAvailable = false;
    }
  };

  // 3. Define `clearCreds`
  const clearCreds = async () => {
    if (isDbAvailable) {
      try {
        await prisma.baileysAuthKey.deleteMany({
          where: { accountId },
        });
      } catch (err: any) {
        logger.error(`[PRISMA_AUTH_CLEAR_ERR] Failed to clear creds from DB: ${err.message}`);
      }
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
      const missingIds: string[] = [];

      // Fast-path: read from local disk cache first (0ms, non-blocking)
      for (const id of ids) {
        const fullKeyId = `${type}-${id}`;
        let val = readLocalCache(fullKeyId);
        if (val) {
          if (type === 'app-state-sync-key' && proto?.Message?.AppStateSyncKeyData) {
            val = proto.Message.AppStateSyncKeyData.fromObject(val);
          }
          data[id] = val;
        } else {
          missingIds.push(id);
        }
      }

      // If all keys were resolved locally or DB is offline, return immediately (0ms)
      if (missingIds.length === 0 || !isDbAvailable) {
        return data;
      }

      // Query PostgreSQL only if DB is healthy and keys are missing from disk
      try {
        const keyIds = missingIds.map((id) => `${type}-${id}`);
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

        for (const id of missingIds) {
          const fullKeyId = `${type}-${id}`;
          if (recordMap.has(fullKeyId)) {
            const rawJson = JSON.stringify(recordMap.get(fullKeyId));
            let val = JSON.parse(rawJson, BufferJSON?.reviver);
            if (val) {
              if (type === 'app-state-sync-key' && proto?.Message?.AppStateSyncKeyData) {
                val = proto.Message.AppStateSyncKeyData.fromObject(val);
              }
              data[id] = val;
              writeLocalCache(fullKeyId, val);
            }
          }
        }
      } catch {
        isDbAvailable = false;
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
            // Write to local disk cache immediately (0ms)
            writeLocalCache(fullKeyId, value);
            if (isDbAvailable) {
              const valueJson = JSON.parse(JSON.stringify(value, BufferJSON?.replacer));
              upsertOperations.push({
                accountId,
                keyId: fullKeyId,
                data: valueJson,
              });
            }
          } else {
            deleteIds.push(fullKeyId);
            deleteLocalCache(fullKeyId);
          }
        }
      }

      // Baileys awaits this store. Persist before resolving so a reconnect never
      // observes a partially saved key set.
      if (isDbAvailable && (upsertOperations.length > 0 || deleteIds.length > 0)) {
        try {
          if (deleteIds.length > 0) {
            await prisma.baileysAuthKey.deleteMany({
              where: { accountId, keyId: { in: deleteIds } },
            });
          }
          for (const item of upsertOperations) {
            await prisma.baileysAuthKey.upsert({
              where: { accountId_keyId: { accountId: item.accountId, keyId: item.keyId } },
              create: item,
              update: { data: item.data },
            });
          }
        } catch {
          isDbAvailable = false;
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
