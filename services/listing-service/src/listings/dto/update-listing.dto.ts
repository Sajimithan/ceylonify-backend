import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ListingType } from '../listing.entity';

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  description?: string;

  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  startDateTime?: string;

  @IsOptional()
  @IsString()
  placeName?: string;

  @IsOptional()
  @IsString()
  mapLink?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;
}
