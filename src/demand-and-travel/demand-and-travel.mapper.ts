import { plainToInstance } from "class-transformer";
import { AirlineResponseDto } from "src/airline/dto/airline-response.dto";
import { AirlineEntity } from "src/airline/entities/airline.entity";
import { 
  DemandOrTravelResponseDto, 
  AirportSimpleResponseDto, 
  AirlineSimpleResponseDto,
  UserNameResponseDto,
  ImageResponseDto
} from "./dto/demand-and-travel-response.dto";
import { Injectable } from "@nestjs/common";
import { DemandEntity } from "src/demand/demand.entity";
import { TravelEntity } from "src/travel/travel.entity";
import { CommonService } from "src/common/service/common.service";

@Injectable()
export class DemandAndTravelMapper {
  constructor(private commonService: CommonService) {}

  /**
   * Format user name as "John D."
   */
  private formatUserName(firstName?: string, lastName?: string): string {
    if (!firstName) return 'Unknown User';
    if (!lastName) return firstName;
    
    return this.commonService.formatFullName(firstName, lastName);
  }

  /**
   * Map airport entity to AirportSimpleResponseDto
   */
  toAirportSimpleResponse(airport: any): AirportSimpleResponseDto | null {
    if (!airport) return null;
    
    return plainToInstance(AirportSimpleResponseDto, {
      name: airport.name,
      municipality: airport.municipality,
      isoCountry: airport.isoCountry
    }, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map airline entity to AirlineSimpleResponseDto
   */
  toAirlineSimpleResponse(airline: any): AirlineSimpleResponseDto | null {
    if (!airline) return null;
    
    return plainToInstance(AirlineSimpleResponseDto, {
      airlineId: airline.id,
      name: airline.name,
      logoUrl: airline.logoUrl
    }, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map user entity to UserNameResponseDto
   */
  toUserNameResponse(user: any): UserNameResponseDto | null {
    if (!user) return null;
    
    const fullName = this.formatUserName(user.firstName, user.lastName);
    return plainToInstance(UserNameResponseDto, {
      id: user.id,
      name: fullName,
      fullName: fullName,
      selfieImage: user.profilePictureUrl,
      createdAt: user.createdAt || new Date(),
      isVerified: user.isVerified || false,
      rating: user.rating || null,
      numberOfReviews: user.numberOfReviews || 0
    }, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map images to ImageResponseDto array
   */
  toImageResponseArray(images: any[]): ImageResponseDto[] {
    if (!images || images.length === 0) return [];
    
    return images.map(image => 
      plainToInstance(ImageResponseDto, {
        id: image.id,
        fileUrl: image.fileUrl,
        originalName: image.originalName,
        purpose: image.purpose?.toString() || image.purpose
      }, {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      })
    );
  }

  /**
   * Map demand entity or DTO to DemandOrTravelResponseDto
   */
  toDemandResponse(
    demand: DemandEntity | any, 
    airline: any = null, 
    isBookmarked: boolean = false
  ): DemandOrTravelResponseDto {
    // Handle both DemandEntity and DemandResponseDto
    // If demand is a DTO (has nested objects already mapped), extract from DTO
    // Otherwise, treat as entity and map nested objects
    const mapped = {
      id: demand.id,
      type: 'demand' as const,
      title: demand.description,
      description: demand.description,
      flightNumber: demand.flightNumber,
      departureAirportId: demand.departureAirportId,
      arrivalAirportId: demand.arrivalAirportId,
      userId: demand.userId,
      status: demand.status,
      deliveryDate: demand.travelDate || demand.deliveryDate,
      createdAt: demand.createdAt,
      updatedAt: demand.updatedAt,
      weight: typeof demand.weight === 'string' ? parseFloat(demand.weight) : demand.weight,
      pricePerKg: typeof demand.pricePerKg === 'string' ? parseFloat(demand.pricePerKg) : demand.pricePerKg,
      isDeactivated: demand.isDeactivated,
      packageKind: demand.packageKind,
      departureAirport: demand.departureAirport 
        ? this.toAirportSimpleResponse(demand.departureAirport)
        : null,
      arrivalAirport: demand.arrivalAirport
        ? this.toAirportSimpleResponse(demand.arrivalAirport)
        : null,
      airline: airline 
        ? this.toAirlineSimpleResponse(airline)
        : (demand.airline ? this.toAirlineSimpleResponse(demand.airline) : null),
      user: demand.user
        ? this.toUserNameResponse(demand.user)
        : null,
      images: demand.images
        ? this.toImageResponseArray(demand.images)
        : [],
      isBookmarked
    };

    return plainToInstance(DemandOrTravelResponseDto, mapped, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map travel entity or DTO to DemandOrTravelResponseDto
   */
  toTravelResponse(
    travel: TravelEntity | any, 
    airline: any = null, 
    isBookmarked: boolean = false
  ): DemandOrTravelResponseDto {
    // Handle both TravelEntity and TravelResponseDto
    // If travel is a DTO (has nested objects already mapped), extract from DTO
    // Otherwise, treat as entity and map nested objects
    const mapped = {
      id: travel.id,
      type: 'travel' as const,
      title: travel.description,
      description: travel.description,
      flightNumber: travel.flightNumber,
      departureAirportId: travel.departureAirportId,
      arrivalAirportId: travel.arrivalAirportId,
      userId: travel.userId,
      status: travel.status,
      deliveryDate: travel.departureDatetime,
      createdAt: travel.createdAt,
      updatedAt: travel.updatedAt,
      pricePerKg: typeof travel.pricePerKg === 'string' ? parseFloat(travel.pricePerKg) : travel.pricePerKg,
      weightAvailable: typeof travel.weightAvailable === 'string' ? parseFloat(travel.weightAvailable) : travel.weightAvailable,
      isDeactivated: travel.isDeactivated,
      isSharedWeight: travel.isSharedWeight,
      isInstant: travel.isInstant,
      isAllowExtraWeight: travel.isAllowExtraWeight,
      punctualityLevel: travel.punctualityLevel ?? false,
      feeForGloomy: typeof travel.feeForGloomy === 'string' ? parseFloat(travel.feeForGloomy) : travel.feeForGloomy,
      departureAirport: travel.departureAirport 
        ? this.toAirportSimpleResponse(travel.departureAirport)
        : null,
      arrivalAirport: travel.arrivalAirport
        ? this.toAirportSimpleResponse(travel.arrivalAirport)
        : null,
      airline: airline 
        ? this.toAirlineSimpleResponse(airline)
        : (travel.airline ? this.toAirlineSimpleResponse(travel.airline) : null),
      user: travel.user
        ? this.toUserNameResponse(travel.user)
        : null,
      images: travel.images
        ? this.toImageResponseArray(travel.images)
        : [],
      isBookmarked
    };

    return plainToInstance(DemandOrTravelResponseDto, mapped, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map airline entity to AirlineResponseDto (for backward compatibility)
   */
  toAirlineResponse(airline: AirlineEntity): AirlineResponseDto {
    return plainToInstance(AirlineResponseDto, airline, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }
}