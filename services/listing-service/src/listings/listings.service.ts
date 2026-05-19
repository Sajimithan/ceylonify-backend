import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Listing, ListingStatus } from './listing.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

@Injectable()
export class ListingsService {
  constructor(@InjectRepository(Listing) private repo: Repository<Listing>) {}

  private get notificationServiceUrl() {
    // Use env in docker/local; fallback to localhost for dev
    return process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';
  }

  private async safeNotify(uid: string, title: string, body: string) {
    // Never block core flows. Notifications are “best effort”.
    try {
      await axios.post(`${this.notificationServiceUrl}/notify`, {
        uid,
        title,
        body,
      });
    } catch (err: unknown) {
      const error = err as Error;
      // Don't throw. Just log.
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
    return listing;
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


  async approve(id: string) {
    const listing = await this.repo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');

    listing.status = ListingStatus.APPROVED;
    listing.rejectReason = undefined;

    const saved = await this.repo.save(listing);

    // ✅ Notify host
    void this.safeNotify(
      saved.hostFirebaseUid,
      'Listing approved ✅',
      `Your listing "${saved.title}" is now live.`,
    );

    return saved;
  }

  async reject(id: string, reason: string) {
    const listing = await this.repo.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');

    listing.status = ListingStatus.REJECTED;
    listing.rejectReason = reason;

    const saved = await this.repo.save(listing);

    // ✅ Notify host
    void this.safeNotify(
      saved.hostFirebaseUid,
      'Listing rejected ❌',
      `Your listing "${saved.title}" was rejected. Reason: ${reason}`,
    );

    return saved;
  }
}
