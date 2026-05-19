import { Module } from '@nestjs/common';
import { NotificationsResolver } from './notifications.resolver';

@Module({
  providers: [NotificationsResolver],
})
export class NotificationsModule {}
