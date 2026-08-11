import { Injectable, Logger } from '@nestjs/common';

// ─── Exchange Rate Service ───────────────────────────────────────────────────
// Retrieves live rates from CoinGecko + OpenER API, caches them, applies spread,
// and records the rate used for each settlement for auditability.

export interface CachedRate {
  baseRate: number;
  appliedRate: number;
  userRate: number;
  spread: number;
  fetchedAt: Date;
  source: string;
}

interface CountrySpreadConfig {
  currencyCode: string;
  spreadPercent: number;    // e.g. 2.0 means 2% spread
  fallbackRate: number;     // Used only if all external APIs are unreachable
}

const COUNTRY_SPREADS: Record<string, CountrySpreadConfig> = {
  UGX: { currencyCode: 'UGX', spreadPercent: 2.5, fallbackRate: 3690 },
  KES: { currencyCode: 'KES', spreadPercent: 2.0, fallbackRate: 129.5 },
  NGN: { currencyCode: 'NGN', spreadPercent: 3.0, fallbackRate: 1365 },
  GHS: { currencyCode: 'GHS', spreadPercent: 2.5, fallbackRate: 11.8 },
  TZS: { currencyCode: 'TZS', spreadPercent: 2.5, fallbackRate: 2640 },
  GBP: { currencyCode: 'GBP', spreadPercent: 0.5, fallbackRate: 0.74 },
  EUR: { currencyCode: 'EUR', spreadPercent: 0.5, fallbackRate: 0.86 },
  USD: { currencyCode: 'USD', spreadPercent: 0.0, fallbackRate: 1.0 },
};

const CACHE_TTL_MS = 60_000; // 60 seconds
const FALLBACK_DEVIATION_THRESHOLD = 0.10; // 10%

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cache: Map<string, CachedRate> = new Map();

  /**
   * Get the current exchange rate for a currency.
   * Caches the result. On cache miss, fetches live from external API.
   */
  async getRate(currencyCode: string): Promise<CachedRate> {
    const cached = this.cache.get(currencyCode);
    if (cached && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
      return cached;
    }
    return this.fetchAndCache(currencyCode);
  }

  /**
   * Get rates for all supported currencies.
   */
  async getAllRates(): Promise<{ rates: CachedRate[]; baseCurrency: string; updatedAt: string }> {
    const codes = Object.keys(COUNTRY_SPREADS);
    const rates = await Promise.all(codes.map((code) => this.getRate(code)));
    return {
      rates,
      baseCurrency: 'USDT',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Record the rate used for a specific settlement.
   * Returns the rate snapshot that should be stored with the settlement.
   */
  async lockRateForSettlement(currencyCode: string): Promise<{
    baseRate: number;
    appliedRate: number;
    userRate: number;
    rateTimestamp: string;
    source: string;
  }> {
    const rate = await this.getRate(currencyCode);
    return {
      baseRate: rate.baseRate,
      appliedRate: rate.appliedRate,
      userRate: rate.userRate,
      rateTimestamp: rate.fetchedAt.toISOString(),
      source: rate.source,
    };
  }

  /**
   * Fetch live rate from external APIs (CoinGecko -> OpenER API -> Fallback).
   */
  private async fetchAndCache(currencyCode: string): Promise<CachedRate> {
    const config = COUNTRY_SPREADS[currencyCode.toUpperCase()];
    if (!config) {
      const rate: CachedRate = {
        baseRate: 1,
        appliedRate: 1,
        userRate: 1,
        spread: 0,
        fetchedAt: new Date(),
        source: 'fallback',
      };
      this.cache.set(currencyCode, rate);
      return rate;
    }

    if (currencyCode.toUpperCase() === 'USD') {
      const usdRate: CachedRate = {
        baseRate: 1.0,
        appliedRate: 1.0,
        userRate: 1.0,
        spread: 0,
        fetchedAt: new Date(),
        source: 'fixed',
      };
      this.cache.set(currencyCode, usdRate);
      return usdRate;
    }

    let baseRate = config.fallbackRate;
    let source = 'fallback';

    // Provider 1: CoinGecko simple price API
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=${currencyCode.toLowerCase()}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (response.ok) {
        const data = await response.json();
        const cgRate = data?.tether?.[currencyCode.toLowerCase()];
        if (cgRate && typeof cgRate === 'number' && cgRate > 0) {
          baseRate = cgRate;
          source = 'coingecko';
        }
      }
    } catch {
      // CoinGecko unreachable — try fallback provider
    }

    // Provider 2: OpenER Exchange Rates API (free, reliable fallback for fiat rates)
    if (source === 'fallback') {
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD', {
          signal: AbortSignal.timeout(4000),
        });
        if (response.ok) {
          const data = await response.json();
          const erRate = data?.rates?.[currencyCode.toUpperCase()];
          if (erRate && typeof erRate === 'number' && erRate > 0) {
            baseRate = erRate;
            source = 'open_er_api';
          }
        }
      } catch {
        // OpenER unreachable
      }
    }

    // Fallback rate deviation check
    if (source === 'fallback') {
      const lastCached = this.cache.get(currencyCode);
      if (lastCached && lastCached.source !== 'fallback' && lastCached.source !== 'fallback_deviated' && lastCached.baseRate > 0) {
        const deviation = Math.abs(config.fallbackRate - lastCached.baseRate) / lastCached.baseRate;
        if (deviation > FALLBACK_DEVIATION_THRESHOLD) {
          this.logger.warn(
            `[ExchangeRate] FALLBACK DEVIATION for ${currencyCode}: ` +
            `fallback=${config.fallbackRate}, lastLive=${lastCached.baseRate}, ` +
            `deviation=${(deviation * 100).toFixed(1)}%`,
          );
          source = 'fallback_deviated';
        }
      }
    }

    // Apply spread
    const spreadMultiplier = 1 + (config.spreadPercent / 100);
    const appliedRate = Math.round((baseRate * spreadMultiplier) * 100) / 100;
    const userRate = appliedRate;

    const rate: CachedRate = {
      baseRate,
      appliedRate,
      userRate,
      spread: config.spreadPercent,
      fetchedAt: new Date(),
      source,
    };

    this.cache.set(currencyCode, rate);
    this.logger.log(`[ExchangeRate] ${currencyCode}: base=${baseRate}, userRate=${userRate} (${config.spreadPercent}% spread), source=${source}`);
    return rate;
  }
}
