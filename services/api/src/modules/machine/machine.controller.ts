import { Controller, Get, Post, Body, Param, UseGuards, Headers, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MachineService } from './machine.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';

@ApiTags('Machines')
@Controller('machines')
export class MachineController {
  constructor(private readonly service: MachineService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Get available Cloud Machine capacity catalog' })
  getCatalog() {
    return this.service.getCatalog();
  }

  @Get('my')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get active user cloud machines and capacity telemetry' })
  async getMyMachines(@CanonicalUserId() userId: string) {
    return await this.service.getUserMachines(userId);
  }

  @Post('purchase')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Purchase and activate a Cloud Machine using wallet balance or initiating deposit' })
  async purchaseMachine(
    @CanonicalUserId() userId: string,
    @Body('tierCode') tierCode: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    return this.service.purchaseMachine(userId as any, tierCode, idempotencyKey);
  }

  @Post('repower')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Repower an existing active cloud machine for a 30-day cycle' })
  async repowerMachine(
    @CanonicalUserId() userId: string,
    @Body('machineId') machineId: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    return this.service.repowerMachine(userId as any, machineId, idempotencyKey);
  }

  @Post('upgrade')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Upgrade an existing active machine to a higher tier' })
  async upgradeMachine(
    @CanonicalUserId() userId: string,
    @Body('currentMachineId') currentMachineId: string,
    @Body('targetTierCode') targetTierCode: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey) throw new BadRequestException('IDEMPOTENCY_KEY_REQUIRED');
    return this.service.upgradeMachineTier(userId as any, currentMachineId, targetTierCode, idempotencyKey);
  }

  @Post(':id/nickname')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Set custom nickname for owned cloud machine' })
  async updateNickname(
    @CanonicalUserId() userId: string,
    @Param('id') machineId: string,
    @Body('nickname') nickname: string,
  ) {
    return this.service.updateNickname(userId, machineId, nickname);
  }

  @Post(':id/control')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Set machine operational status (start/pause/restart)' })
  async toggleControl(
    @CanonicalUserId() userId: string,
    @Param('id') machineId: string,
    @Body('action') action: 'start' | 'pause' | 'restart',
  ) {
    return this.service.toggleControl(userId, machineId, action);
  }

  @Get(':id/certificate')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get ownership certificate metadata for specified machine' })
  async getCertificate(
    @CanonicalUserId() userId: string,
    @Param('id') machineId: string,
  ) {
    return this.service.getCertificate(userId, machineId);
  }
}
