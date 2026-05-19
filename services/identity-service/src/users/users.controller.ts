import { Body, Controller, Post, Get, Patch, Param } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Post('upsert-from-firebase')
  async upsertFromFirebase(
    @Body()
    body: {
      firebaseUid: string;
      email?: string;
      role?: Role;
    },
  ) {
    return this.prisma.user.upsert({
      where: { firebaseUid: body.firebaseUid },
      update: { email: body.email ?? undefined },
      create: {
        firebaseUid: body.firebaseUid,
        email: body.email,
        role: body.role ?? Role.TRAVELER,
      },
    });
  }

  @Post('get-by-firebase')
  async getByFirebase(@Body() body: { firebaseUid: string }) {
    return this.prisma.user.findUnique({
      where: { firebaseUid: body.firebaseUid },
    });
  }

  // Admin: Get all users
  @Get('all')
  async getAllUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin: User stats
  @Get('stats')
  async getStats() {
    const total = await this.prisma.user.count();
    const travelers = await this.prisma.user.count({ where: { role: Role.TRAVELER } });
    const hosts = await this.prisma.user.count({ where: { role: Role.HOST } });
    const admins = await this.prisma.user.count({ where: { role: Role.ADMIN } });
    return { total, travelers, hosts, admins };
  }

  // Admin: change user role
  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body() body: { role: Role }) {
    return this.prisma.user.update({
      where: { id },
      data: { role: body.role },
    });
  }
}
