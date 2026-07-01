import { BookmarkEntity, BookmarkType } from './entities/bookmark.entity';
import {
  BookmarkItemResponseDto,
  TravelResponseDto,
  DemandResponseDto,
  AirportResponseDto,
  UserResponseDto,
  DemandImageResponseDto,
  BookmarkCurrencyResponseDto,
} from './dto/bookmark-response.dto';
import { plainToInstance } from 'class-transformer';
import { Injectable } from '@nestjs/common';
import { CommonService } from 'src/common/service/common.service';

@Injectable()
export class BookmarkMapper {
  constructor(private commonService: CommonService) {}

  toAirportResponse(airport: any): AirportResponseDto | null {
   return plainToInstance(AirportResponseDto, airport,
     { excludeExtraneousValues: true,
     enableImplicitConversion: true 
    });
  }

  toUserResponse(user: any): UserResponseDto | null {
    return plainToInstance(
      UserResponseDto,
      {
        id: user.id,
        publicId: user?.publicId ?? '',
        isDeactivated: user.isDeactivated,
        email: user.email,
        phone: user.phone,
        fullName: this.commonService.userFullName(user),
        profilePictureUrl: user.profilePictureUrl ?? '',
      },
      { excludeExtraneousValues: true, enableImplicitConversion: true },
    );
  }

  toTravelResponse(travel: any): TravelResponseDto | null {
   return plainToInstance(TravelResponseDto, travel, {
     excludeExtraneousValues: true,
    enableImplicitConversion: true });
  }

  toDemandResponse(demand: any): DemandResponseDto | null {
  return plainToInstance(DemandResponseDto, demand, { excludeExtraneousValues: true,
    enableImplicitConversion: true });
  }

  toCurrencyResponse(currency: any): BookmarkCurrencyResponseDto | null {
    if (!currency) {
      return null;
    }

    return plainToInstance(
      BookmarkCurrencyResponseDto,
      {
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      },
      { excludeExtraneousValues: true, enableImplicitConversion: true },
    );
  }

  toBookmarkItemResponse(bookmark: BookmarkEntity): BookmarkItemResponseDto {
    // Prepare the bookmark data with demand image if bookmarkType is DEMAND
    const bookmarkData: any = {
      ...bookmark,
      publicId: bookmark.publicId,
      demandImage: null,
    };

    // Map travel with properly formatted user if it exists
    if (bookmark.travel) {
      const travelResponse = this.toTravelResponse(bookmark.travel);
      if (travelResponse && bookmark.travel.user) {
        // Override user with properly formatted user including fullName
        travelResponse.user = this.toUserResponse(bookmark.travel.user);
      }
      bookmarkData.travel = travelResponse;
    }

    // Map demand with properly formatted user if it exists
    if (bookmark.demand) {
      const demandResponse = this.toDemandResponse(bookmark.demand);
      if (demandResponse && bookmark.demand.user) {
        // Override user with properly formatted user including fullName
        demandResponse.user = this.toUserResponse(bookmark.demand.user);
      }
      bookmarkData.demand = demandResponse;
    }

    // If bookmarkType is DEMAND and demand exists with images, get the first image URL
    if (bookmark.bookmarkType === BookmarkType.DEMAND && bookmark.demand?.images && bookmark.demand.images.length > 0) {
      // Sort images by purpose to get DEMAND_IMAGE_1 first, then DEMAND_IMAGE_2, etc.
      const sortedImages = [...bookmark.demand.images].sort((a, b) => {
        const purposeOrder = ['DEMAND_IMAGE_1', 'DEMAND_IMAGE_2', 'DEMAND_IMAGE_3'];
        const aIndex = purposeOrder.indexOf(String(a.purpose));
        const bIndex = purposeOrder.indexOf(String(b.purpose));
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });

      const firstImage = sortedImages[0];
      if (firstImage && firstImage.fileUrl) {
        bookmarkData.demandImage = plainToInstance(DemandImageResponseDto, {
          demandImageUrl: firstImage.fileUrl,
        }, {
          excludeExtraneousValues: true,
          enableImplicitConversion: true
        });
      }
    }

    bookmarkData.currency = this.toCurrencyResponse(
      bookmark.travel?.currency ?? bookmark.demand?.currency ?? null,
    );

    return plainToInstance(BookmarkItemResponseDto, bookmarkData,
       { excludeExtraneousValues: true,
      enableImplicitConversion: true });
  }
}
