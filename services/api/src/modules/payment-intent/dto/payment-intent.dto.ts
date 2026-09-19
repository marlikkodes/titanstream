import { IsString, IsNumber, IsEnum, IsOptional, IsObject } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentIntentDto {
  @IsNumber()
  requestedAmount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsString()
  @IsOptional()
  asset?: string;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  network?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class VerifyPaymentIntentDto {
  @IsNumber()
  verifiedAmount: number;

  @IsString()
  verifiedCurrency: string;

  @IsString()
  @IsOptional()
  verifiedReference?: string;

  @IsString()
  @IsOptional()
  blockchainTxHash?: string;

  @IsString()
  @IsOptional()
  reviewNotes?: string;
}

export class RejectPaymentIntentDto {
  @IsString()
  rejectionReason: string;

  @IsString()
  @IsOptional()
  reviewNotes?: string;
}

export class EscalatePaymentIntentDto {
  @IsString()
  reason: string;
}
