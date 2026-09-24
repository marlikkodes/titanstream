import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramClientService } from './telegram-client.service';

export interface CreateBroadcastDto {
  title: string;
  message: string;
  target?: 'ALL' | 'VERIFIED' | 'READY' | 'MACHINE_OWNERS' | 'ACTIVE_USERS';
  createdById?: string;
}

@Injectable()
export class BotBroadcastService {
  private readonly logger = new Logger(BotBroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramClient: TelegramClientService,
  ) {}

  async createAndDispatchBroadcast(dto: CreateBroadcastDto) {
    const broadcast = await this.prisma.botBroadcast.create({
      data: {
        title: dto.title,
        message: dto.message,
        target: dto.target || 'ALL',
        status: 'PROCESSING',
        createdById: dto.createdById,
      },
    });

    // Run dispatch asynchronously
    this.processBroadcast(broadcast.id).catch((err) =>
      this.logger.error(`Error processing broadcast ${broadcast.id}: ${err.message}`),
    );

    return broadcast;
  }

  private async processBroadcast(broadcastId: string) {
    const broadcast = await this.prisma.botBroadcast.findUnique({ where: { id: broadcastId } });
    if (!broadcast) return;

    let where: any = {};
    if (broadcast.target === 'VERIFIED') {
      where = { channelVerified: true };
    } else if (broadcast.target === 'READY') {
      where = { isReady: true };
    } else if (broadcast.target === 'MACHINE_OWNERS') {
      where = { userMachines: { some: {} } };
    } else if (broadcast.target === 'ACTIVE_USERS') {
      where = { state: 'ACTIVE_USER' };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { telegramUserId: true },
    });

    let sentCount = 0;
    let failedCount = 0;

    const formattedMessage = `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>📢 OFFICIAL ANNOUNCEMENT</b>\n` +
      `<b>${broadcast.title}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${broadcast.message}\n\n` +
      `<i>TitanStream Control Tower Notification</i>`;

    for (const u of users) {
      const res = await this.telegramClient.sendMessage(Number(u.telegramUserId), formattedMessage, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Open TitanStream Mini App', web_app: { url: process.env.TELEGRAM_WEBAPP_URL || 'https://titanstream.cc' } }],
          ],
        },
      });

      if (res.ok) sentCount++;
      else failedCount++;

      // Rate limit safety
      await new Promise((resolve) => setTimeout(resolve, 35));
    }

    await this.prisma.botBroadcast.update({
      where: { id: broadcastId },
      data: {
        sentCount,
        failedCount,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    this.logger.log(`Broadcast ${broadcastId} completed. Sent: ${sentCount}, Failed: ${failedCount}`);
  }

  async listBroadcasts() {
    return this.prisma.botBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
