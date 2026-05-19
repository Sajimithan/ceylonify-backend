import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersController } from './users/users.controller';

@Module({
  imports: [],
  controllers: [AppController, UsersController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
