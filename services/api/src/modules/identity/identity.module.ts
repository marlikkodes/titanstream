import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { IdentityMasterEngineService } from './identity-master.service';
import { PrismaModule } from '../../database/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IdentityService, IdentityMasterEngineService],
  exports: [IdentityService, IdentityMasterEngineService],
})
export class IdentityModule {}
