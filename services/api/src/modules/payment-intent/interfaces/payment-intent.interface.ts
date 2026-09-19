import { PaymentIntentStatus, PaymentMethod } from '@prisma/client';

export interface CreatePaymentIntentDto {
  telegramUserId: bigint;
  paymentMethod: PaymentMethod;
  asset?: string;
  requestedAmount: number;
  currency?: string;
  country?: string;
  network?: string;
  metadata?: Record<string, any>;
}

export interface PaymentIntentView {
  id: string;
  reference: string;
  status: PaymentIntentStatus;
  paymentMethod: PaymentMethod;
  asset: string;
  requestedAmount: string;
  expectedCryptoAmount: string;
  currency: string;
  country: string;
  network: string;
  exchangeRate: string;
  merchantDestination?: string;
  usdtAddress?: string;
  expiresAt: string;
  createdAt: string;
  instructions?: Record<string, any>;
}
