import { Module } from '@nestjs/common';
import { PremiumService } from './premium.service';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PremiumService],
  exports: [PremiumService],
})
export class PremiumModule {}
