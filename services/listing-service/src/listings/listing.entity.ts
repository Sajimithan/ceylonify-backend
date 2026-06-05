import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ListingStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

export enum ListingType {
  EVENT = 'EVENT',
  RENTAL = 'RENTAL',
  ACCOMMODATION = 'ACCOMMODATION',
  ACTIVITY = 'ACTIVITY',
}

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  hostFirebaseUid!: string; // who created it (Host)

  @Column()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: ListingType })
  type!: ListingType;

  @Column({ nullable: true })
  category?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price?: number;

  @Column({ type: 'jsonb', nullable: true })
  priceTiers?: { label: string; price: number; description: string }[];

  @Column({ type: 'timestamptz', nullable: true })
  startDateTime?: Date;

  // PostGIS point (longitude, latitude)
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location!: { type: 'Point'; coordinates: [number, number] };

  @Column({ default: 'Sri Lanka' })
  country!: string;

  @Column({ nullable: true })
  placeName?: string;

  @Column({ nullable: true })
  mapLink?: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.PENDING })
  status!: ListingStatus;

  @Column({ nullable: true })
  rejectReason?: string;

  @Column({ default: false })
  isPremium!: boolean;

  @Column({ type: 'int', default: 0 })
  viewCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
