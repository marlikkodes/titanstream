import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { BaileysService } from './baileys.service';
import { BaileysAccountManagerService } from './baileys-account-manager.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [NotificationController],
  providers: [NotificationService, BaileysService, BaileysAccountManagerService],
  exports: [NotificationService, BaileysService, BaileysAccountManagerService],
})
export class NotificationModule {}
