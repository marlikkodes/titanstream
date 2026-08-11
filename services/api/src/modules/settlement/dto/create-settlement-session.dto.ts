import { SettlementProviderId } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateSettlementSessionDto {
  @IsEnum(SettlementProviderId)
  @IsOptional()
  provider?: SettlementProviderId;

  @IsString()
  @IsNotEmpty()
  asset!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  requestedAmount!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/)
  expectedCryptoAmount!: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d+(\.\d+)?$/)
  exchangeRate?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  mobileMoneyNetwork?: string;

  @IsString()
  @IsOptional()
  paymentNetwork?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;
}
