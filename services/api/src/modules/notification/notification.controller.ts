import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CanonicalUserId } from '../../common/decorators/canonical-user-id.decorator';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get in-app notifications for authenticated user' })
  async getNotifications(@CanonicalUserId() userId: string) {
    const records = await this.service.getNotificationsForUser(userId);
    return records.map((r: any) => ({
      id: r.id,
      userId: r.userId || userId,
      telegramUserId: r.telegramUserId ? r.telegramUserId.toString() : undefined,
      templateCode: r.templateCode,
      message: r.message,
      channel: r.channel,
      status: r.status,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark specific notification as read' })
  async markAsRead(@CanonicalUserId() userId: string, @Param('id') id: string) {
    return this.service.markAsRead(userId, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all unread notifications as read' })
  async markAllAsRead(@CanonicalUserId() userId: string) {
    return this.service.markAllAsRead(userId);
  }
}
