import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;

@Controller('host-applications')
export class HostApplicationsController {
  constructor(private prisma: PrismaService) {}

  private get db(): AnyPrisma {
    return this.prisma;
  }

  @Post()
  async create(
    @Body()
    body: {
      firebaseUid: string;
      email?: string;
      hostTypes: string;
      businessName?: string;
      businessAddress?: string;
      businessLat?: number;
      businessLng?: number;
      phoneNumber?: string;
      licenseNumber?: string;
      idType?: string;
      idDocumentUrl?: string;
      businessDocUrl?: string;
      healthCertUrl?: string;
      licenseDocUrl?: string;
      bankDocUrl?: string;
    },
  ) {
    return this.db.hostApplication.upsert({
      where: { firebaseUid: body.firebaseUid },
      update: { ...body, status: 'PENDING', submittedAt: new Date() },
      create: { ...body, status: 'PENDING' },
    });
  }

  @Get()
  async list(@Query('status') status?: string) {
    const where = status ? { status } : {};
    return this.db.hostApplication.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
    });
  }

  @Patch()
  async review(
    @Body()
    body: {
      firebaseUid: string;
      approve: boolean;
      reviewNote?: string;
    },
  ) {
    return this.db.hostApplication.update({
      where: { firebaseUid: body.firebaseUid },
      data: {
        status: body.approve ? 'APPROVED' : 'REJECTED',
        reviewedAt: new Date(),
        reviewNote: body.reviewNote ?? null,
      },
    });
  }
}
