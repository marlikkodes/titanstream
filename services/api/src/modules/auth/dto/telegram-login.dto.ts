import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Dedicated DTO for the standalone Telegram Login Widget payload.
 *
 * Distinct from Mini App `initData` (POST /auth/telegram { initData: string }).
 * Standalone web sends the flat Telegram-signed object:
 * { id, first_name?, last_name?, username?, photo_url?, auth_date, hash }
 * plus TitanStream control fields (nonce, referralCode, id_token) which are
 * NEVER part of Telegram's signature base string.
 *
 * Only `id`, `auth_date`, `hash` are required for verification. Optional
 * Telegram fields (last_name, username, photo_url, first_name) must NOT be
 * required — a Telegram user may legitimately lack them.
 */
export class TelegramLoginDto {
  @ApiProperty({ description: 'Telegram user ID (number or numeric string)' })
  @IsNotEmpty({ message: 'TELEGRAM_WEB_LOGIN_PAYLOAD_INVALID: id is required' })
  id: number | string;

  @ApiPropertyOptional({ description: 'Telegram first name' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Telegram last name' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Telegram username (without @)' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Telegram avatar URL' })
  @IsOptional()
  @IsString()
  photo_url?: string;

  @ApiProperty({ description: 'Telegram auth_date Unix timestamp (seconds)' })
  @IsNotEmpty({ message: 'TELEGRAM_WEB_LOGIN_PAYLOAD_INVALID: auth_date is required' })
  auth_date: number | string;

  @ApiProperty({ description: 'Telegram HMAC hex signature' })
  @IsString()
  @IsNotEmpty({ message: 'TELEGRAM_WEB_LOGIN_PAYLOAD_INVALID: hash is required' })
  hash: string;

  @ApiPropertyOptional({ description: 'Replay-protection nonce issued by /auth/telegram-nonce' })
  @IsOptional()
  @IsString()
  nonce?: string;

  @ApiPropertyOptional({ description: 'Referral code supplied by the browser (not Telegram-signed)' })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({ description: 'Legacy referral_code alias (not Telegram-signed)' })
  @IsOptional()
  @IsString()
  referral_code?: string;

  @ApiPropertyOptional({ description: 'Telegram OAuth id_token JWT (new oauth.telegram.org flow)' })
  @IsOptional()
  @IsString()
  id_token?: string;
}
