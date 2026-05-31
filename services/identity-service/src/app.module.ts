import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersController, ExperiencesController } from './users/users.controller';
import { HostApplicationsController } from './host-applications/host-applications.controller';

@Module({
  imports: [],
  controllers: [AppController, UsersController, ExperiencesController, HostApplicationsController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
