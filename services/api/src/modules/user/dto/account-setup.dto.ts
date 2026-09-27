import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionMethod } from '../../../common/interfaces/user-state.enum';

export class UpdateAccountSetupDto {
  @ApiProperty({ description: 'User first name (canonical profile identity)' })
  @IsString()
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ description: 'User last name (canonical profile identity)' })
  @IsString()
  @MaxLength(60)
  lastName!: string;

  @ApiProperty({
    enum: TransactionMethod,
    description: 'Preferred transaction route. MOBILE_MONEY requires a withdrawal number; CRYPTO does not.',
  })
  @IsEnum(TransactionMethod)
  preferredTransactionMethod!: TransactionMethod;

  @ApiPropertyOptional({
    description:
      'Mobile-money withdrawal number (user declaration, not provider-verified). ' +
      'Required when preferredTransactionMethod is MOBILE_MONEY; ignored when CRYPTO.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  withdrawalPhoneNumber?: string;
}
