import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Listing, ListingStatus } from './listing.entity';
import { Report, ReportStatus } from './report.entity';
import { AuditLog } from './audit-log.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing) private repo: Repository<Listing>,
    @InjectRepository(Report) private reportRepo: Repository<Report>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async addAuditLog(action: string, adminFirebaseUid: string, resourceId?: string, details?: string) {
    const log = this.auditRepo.create({ action, adminFirebaseUid, resourceId, details });
    await this.auditRepo.save(log);
  }

  async adminGetAuditLogs() {
    return this.auditRepo.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  private get notificationServiceUrl() {
    return process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';
  }

  private get identityServiceUrl() {
    return process.env.IDENTITY_SERVICE_URL || 'http://localhost:3001';
  }

  private async notifyAdmins(title: string, body: string, type = 'GENERAL', resourceId?: string) {
    try {
      const res = await axios.get<{ firebaseUid: string }[]>(`${this.identityServiceUrl}/users/admins`);
      const admins = res.data ?? [];
      await Promise.all(admins.map((a) => this.safeNotify(a.firebaseUid, title, body, type, resourceId)));
    } catch (err: unknown) {
      console.warn('[listing-service] notifyAdmins failed:', (err as Error)?.message);
    }
  }

  private async safeNotify(uid: string, title: string, body: string, type = 'GENERAL', resourceId?: string) {
    // Never block core flows. Notifications are “best effort”.
    try {
      // Push (FCM/Expo)
      void axios.post(`${this.notificationServiceUrl}/notify`, { uid, title, body }).catch(() => null);
      // Persist to DB so it appears in the notification bell
      await axios.post(`${this.identityServiceUrl}/users/${uid}/notifications`, {
        title, body, type, ...(resourceId ? { resourceId } : {}),
      });
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('[listing-service] notify failed:', error?.message ?? error);
    }
  }

  async create(hostFirebaseUid: string, dto: CreateListingDto) {
    const listing = this.repo.create({
      hostFirebaseUid,
      title: dto.title.trim(),
      description: dto.description.trim(),
      type: dto.type,
      category: dto.category?.trim(),
      placeName: dto.placeName?.trim(),
      mapLink: dto.mapLink?.trim(),
      imageUrl: dto.imageUrl?.trim(),
      price: dto.price,
      isPremium: dto.isPremium ?? false,
      startDateTime: dto.startDateTime
        ? new Date(dto.startDateTime)
        : undefined,
      location: { type: 'Point', coordinates: [dto.lng, dto.lat] }, // [lng, lat]
      status: ListingStatus.PENDING,
    });

    const saved = await this.repo.save(listing);

    // Optional: notify host “submitted for review”
    // await this.safeNotify(hostFirebaseUid, 'Listing submitted 🕒', `Your listing "${saved.title}" is pending review.`);

    return saved;
  }

  async myListings(hostFirebaseUid: string) {
    return this.repo.find({
      where: { hostFirebaseUid },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const listing = await this.repo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    // Increment view count fire-and-forget
    void this.repo.increment({ id }, 'viewCount', 1);
    return listing;
  }

  async searchNearby(params: {
    lat: number;
    lng: number;
    radiusKm?: number;
    limit?: number;
  }) {
    const { lat, lng, radiusKm = 50, limit = 20 } = params;
    const rows = await this.repo.query(
      `SELECT *, ST_Distance(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance
       FROM listings
       WHERE status = 'APPROVED'
         AND location IS NOT NULL
         AND ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
       ORDER BY distance
       LIMIT $4`,
      [lng, lat, radiusKm, limit],
    );
    return rows as Listing[];
  }

  async searchListings(params: {
    q?: string;
    category?: string;
    type?: string;
    limit?: number;
    offset?: number;
    includePremium?: boolean;
    startAfter?: string;
    startBefore?: string;
    hidePastEvents?: boolean;
  }) {
    const { q, category, type, limit = 12, offset = 0, includePremium = true, startAfter, startBefore, hidePastEvents } = params;
    const qb = this.repo
      .createQueryBuilder('listing')
      .where('listing.status = :status', { status: ListingStatus.APPROVED });

    if (!includePremium) {
      qb.andWhere('listing.isPremium = :isPremium', { isPremium: false });
    }

    if (q) {
      qb.andWhere(
        '(listing.title ILIKE :q OR listing.description ILIKE :q)',
        { q: `%${q}%` },
      );
    }
    if (category) {
      qb.andWhere('listing.category = :category', { category });
    }
    if (type) {
      qb.andWhere('listing.type = :type', { type });
    }
    if (startAfter) {
      qb.andWhere('listing.startDateTime >= :startAfter', { startAfter: new Date(startAfter) });
    }
    if (startBefore) {
      qb.andWhere('listing.startDateTime <= :startBefore', { startBefore: new Date(startBefore) });
    }
    if (hidePastEvents) {
      qb.andWhere(
        "(listing.type != 'EVENT' OR listing.\"startDateTime\" IS NULL OR listing.\"startDateTime\" >= :now)",
        { now: new Date() },
      );
    }

    qb.orderBy('listing.createdAt', 'DESC').skip(offset).take(limit);

    const [listings, total] = await qb.getManyAndCount();
    return { listings, total };
  }

  async update(hostFirebaseUid: string, id: string, dto: UpdateListingDto) {
    const listing = await this.repo.findOne({ where: { id, hostFirebaseUid } });
    if (!listing) throw new NotFoundException('Listing not found or unauthorized');

    if (dto.title !== undefined) listing.title = dto.title.trim();
    if (dto.description !== undefined) listing.description = dto.description.trim();
    if (dto.type !== undefined) listing.type = dto.type;
    if (dto.category !== undefined) listing.category = dto.category?.trim() || undefined;
    if (dto.placeName !== undefined) listing.placeName = dto.placeName?.trim() || undefined;
    if (dto.mapLink !== undefined) listing.mapLink = dto.mapLink?.trim() || undefined;
    if (dto.imageUrl !== undefined) listing.imageUrl = dto.imageUrl?.trim() || undefined;
    if (dto.price !== undefined) listing.price = dto.price;
    if (dto.startDateTime !== undefined) {
      listing.startDateTime = dto.startDateTime ? new Date(dto.startDateTime) : undefined;
    }
    if (dto.lat !== undefined && dto.lng !== undefined && dto.lat !== 0 && dto.lng !== 0) {
      listing.location = { type: 'Point', coordinates: [dto.lng, dto.lat] };
    }
    if (dto.isPremium !== undefined) listing.isPremium = dto.isPremium;

    // Changing content usually returns it to PENDING unless we disable that.
    listing.status = ListingStatus.PENDING;
    listing.rejectReason = undefined;

    return this.repo.save(listing);
  }

  async delete(hostFirebaseUid: string, id: string) {
    const listing = await this.repo.findOne({ where: { id, hostFirebaseUid } });
    if (!listing) throw new NotFoundException('Listing not found or unauthorized');

    await this.repo.remove(listing);
    return { id };
  }

  async findPending() {
    return this.repo.find({
      where: { status: ListingStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }
  async findAll() {
    return this.repo.find({
      where: { status: ListingStatus.APPROVED },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllAdmin() {
    return this.repo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getListingStats() {
    const total = await this.repo.count();
    const pending = await this.repo.count({ where: { status: ListingStatus.PENDING } });
    const approved = await this.repo.count({ where: { status: ListingStatus.APPROVED } });
    const rejected = await this.repo.count({ where: { status: ListingStatus.REJECTED } });

    return { total, pending, approved, rejected };
  }

  async approvedCountByHost(hostFirebaseUid: string): Promise<number> {
    return this.repo.count({ where: { hostFirebaseUid, status: ListingStatus.APPROVED } });
  }


  async approve(id: string, adminUid = 'system') {
    const listing = await this.repo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');

    listing.status = ListingStatus.APPROVED;
    listing.rejectReason = undefined;

    const saved = await this.repo.save(listing);

    void this.addAuditLog('APPROVE_LISTING', adminUid, id, `Approved: "${saved.title}"`);
    void this.safeNotify(
      saved.hostFirebaseUid,
      'Listing approved ✅',
      `Your listing "${saved.title}" is now live.`,
      'LISTING_APPROVED',
      saved.id,
    );

    return saved;
  }

  async reject(id: string, reason: string, adminUid = 'system') {
    const listing = await this.repo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');

    listing.status = ListingStatus.REJECTED;
    listing.rejectReason = reason;

    const saved = await this.repo.save(listing);

    void this.addAuditLog('REJECT_LISTING', adminUid, id, `Rejected: "${saved.title}" — ${reason}`);
    void this.safeNotify(
      saved.hostFirebaseUid,
      'Listing rejected ❌',
      `Your listing "${saved.title}" was rejected. Reason: ${reason}`,
      'LISTING_REJECTED',
      saved.id,
    );

    return saved;
  }

  async reportListing(
    reporterFirebaseUid: string,
    listingId: string,
    reason: string,
    comment?: string,
    imageUrls?: string[],
  ) {
    const listing = await this.repo.findOne({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');

    const report = this.reportRepo.create({
      listingId,
      reporterFirebaseUid,
      reason,
      comment,
      imageUrls: JSON.stringify(imageUrls ?? []),
      status: ReportStatus.PENDING,
    });
    const saved = await this.reportRepo.save(report);

    void this.notifyAdmins(
      'New Report 🚨',
      `A listing has been reported for: ${reason}`,
      'NEW_REPORT',
      listingId,
    );

    return saved;
  }

  async adminGetReports() {
    return this.reportRepo.find({ order: { createdAt: 'DESC' } });
  }

  async adminDismissReport(id: string) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    report.status = ReportStatus.DISMISSED;
    const saved = await this.reportRepo.save(report);
    void this.safeNotify(
      saved.reporterFirebaseUid,
      'Report Reviewed',
      'Your report has been reviewed. No policy violation was found and the listing remains active.',
      'REPORT_REVIEWED',
      saved.listingId,
    );
    return saved;
  }

  async adminActionReport(id: string) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    report.status = ReportStatus.ACTIONED;
    const saved = await this.reportRepo.save(report);
    void this.safeNotify(
      saved.reporterFirebaseUid,
      'Report Actioned ✅',
      'Thank you for your report. We have reviewed the listing and taken appropriate action.',
      'REPORT_ACTIONED',
      saved.listingId,
    );
    return saved;
  }
}
