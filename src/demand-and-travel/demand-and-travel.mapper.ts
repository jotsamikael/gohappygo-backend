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
      isVerified: user.isVerified || false
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
   * Map demand entity to DemandOrTravelResponseDto
   */
  toDemandResponse(
    demand: DemandEntity, 
    airline: any = null, 
    isBookmarked: boolean = false
  ): DemandOrTravelResponseDto {
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
      deliveryDate: demand.travelDate,
      createdAt: demand.createdAt,
      updatedAt: demand.updatedAt,
      weight: demand.weight,
      pricePerKg: demand.pricePerKg,
      isDeactivated: demand.isDeactivated,
      packageKind: demand.packageKind,
      departureAirport: this.toAirportSimpleResponse(demand.departureAirport),
      arrivalAirport: this.toAirportSimpleResponse(demand.arrivalAirport),
      airline: this.toAirlineSimpleResponse(airline),
      user: this.toUserNameResponse(demand.user),
      images: this.toImageResponseArray(demand.images || []),
      isBookmarked
    };

    return plainToInstance(DemandOrTravelResponseDto, mapped, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map travel entity to DemandOrTravelResponseDto
   */
  toTravelResponse(
    travel: TravelEntity, 
    airline: any = null, 
    isBookmarked: boolean = false
  ): DemandOrTravelResponseDto {
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
      pricePerKg: travel.pricePerKg,
      weightAvailable: travel.weightAvailable,
      isDeactivated: travel.isDeactivated,
      isSharedWeight: travel.isSharedWeight,
      isInstant: travel.isInstant,
      isAllowExtraWeight: travel.isAllowExtraWeight,
      feeForLateComer: travel.feeForLateComer,
      feeForGloomy: travel.feeForGloomy,
      departureAirport: this.toAirportSimpleResponse(travel.departureAirport),
      arrivalAirport: this.toAirportSimpleResponse(travel.arrivalAirport),
      airline: this.toAirlineSimpleResponse(airline || travel.airline),
      user: this.toUserNameResponse(travel.user),
      images: this.toImageResponseArray(travel.images || []),
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