import { Global, Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { IdentityModule } from '../identity/identity.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { BotModule } from '../bot/bot.module';
import { GrowthModule } from '../growth/growth.module';
import { FinancialModule } from '../financial/financial.module';
import { ConversationalRouterService } from './conversational-router.service';

@Global()
@Module({
  imports: [
    PrismaModule,
    IdentityModule,
    forwardRef(() => AuthModule),
    forwardRef(() => NotificationModule),
    forwardRef(() => BotModule),
    forwardRef(() => GrowthModule),
    forwardRef(() => FinancialModule),
  ],
  providers: [ConversationalRouterService],
  exports: [ConversationalRouterService],
})
export class ConversationalModule {}
