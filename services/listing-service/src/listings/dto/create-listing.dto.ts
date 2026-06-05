import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PriceTierDto {
  @IsString() label!: string;
  @IsNumber() price!: number;
  @IsString() description!: string;
}
import { ListingType } from '../listing.entity';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1200)
  description!: string;

  @IsEnum(ListingType)
  type!: ListingType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  startDateTime?: string; // ISO string from UI

  // UI sends lat/lng
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsString()
  @IsNotEmpty()
  placeName!: string;

  @IsOptional()
  @IsString()
  mapLink?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceTierDto)
  priceTiers?: PriceTierDto[];
}
