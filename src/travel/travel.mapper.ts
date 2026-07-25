import { Injectable } from "@nestjs/common";
import { roundRatingToTenth } from "src/common/transforms/round-rating-to-tenth.util";
import { 
    TravelResponseDto, 
    TravelListAirportDto, 
    TravelListUserDto, 
    TravelListImageDto, 
    TravelListAirlineDto,
    TravelListCurrencyDto
} from "./dto/travel-response.dto";
import { TravelEntity } from "./travel.entity";
import { plainToInstance } from "class-transformer";
import { 
    TravelDetailResponseDto, 
    TravelDetailReviewDto,
    TravelDetailAirportDto,
    TravelDetailUserDto,
    TravelDetailAirlineDto,
    TravelDetailImageDto,
    TravelDetailReviewerDto,
    TravelDetailCurrencyDto
} from "./dto/travel-detail.response.dto";
import { ReviewEntity } from "src/review/review.entity";
import { CommonService } from "src/common/service/common.service";
import { formatFlightNumberForResponse } from "src/common/transforms/format-flight-number.util";

@Injectable()
export class TravelMapper {
    constructor(private commonService: CommonService) {}
    
    /**
     * Transform TravelEntity to TravelResponseDto for list endpoints
     */
    toListResponseDto(travel: TravelEntity & { isEditable?: boolean }): TravelResponseDto {
        // Transform departure airport
        const departureAirport = travel.departureAirport ? plainToInstance(TravelListAirportDto, {
            id: travel.departureAirport.id,
            publicId: travel.departureAirport?.publicId ?? '',
            ident: travel.departureAirport.ident,
            type: travel.departureAirport.type,
            name: travel.departureAirport.name,
            isoCountry: travel.departureAirport.isoCountry || '',
            isoRegion: travel.departureAirport.isoRegion || '',
            municipality: travel.departureAirport.municipality || '',
            icaoCode: travel.departureAirport.icaoCode || '',
            iataCode: travel.departureAirport.iataCode || '',
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform arrival airport
        const arrivalAirport = travel.arrivalAirport ? plainToInstance(TravelListAirportDto, {
            id: travel.arrivalAirport.id,
            publicId: travel.arrivalAirport?.publicId ?? '',
            ident: travel.arrivalAirport.ident,
            type: travel.arrivalAirport.type,
            name: travel.arrivalAirport.name,
            isoCountry: travel.arrivalAirport.isoCountry || '',
            isoRegion: travel.arrivalAirport.isoRegion || '',
            municipality: travel.arrivalAirport.municipality || '',
            icaoCode: travel.arrivalAirport.icaoCode || '',
            iataCode: travel.arrivalAirport.iataCode || '',
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform user
        const user = travel.user ? plainToInstance(TravelListUserDto, {
            id: travel.user.id,
            publicId: travel.user?.publicId ?? '',
            createdAt: travel.user.createdAt,
            updatedAt: travel.user.updatedAt,
            isDeactivated: travel.user.isDeactivated,
            bio: travel.user.bio || '',
            fullName: this.commonService.userFullName(travel.user),
            profilePictureUrl: travel.user.profilePictureUrl || '',
            isVerified: travel.user.isVerified,
            rating: travel.user.rating ? travel.user.rating.toString() : null,
            numberOfReviews: travel.user.numberOfReviews || 0,
            stripeAccountStatus: travel.user.stripeAccountStatus || 'uninitiated',
            stripeCountryCode: travel.user.stripeCountryCode || null,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform images
        const images = travel.images ? travel.images.map(image => plainToInstance(TravelListImageDto, {
            id: image.id,
            publicId: image?.publicId ?? '',
            originalName: image.originalName,
            fileUrl: image.fileUrl,
            size: image.size,
            mimeType: image.mimeType,
            purpose: image.purpose,
            uploadedAt: image.uploadedAt,
            travelId: image.travelId,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        })) : [];

        // Transform airline
        const airline = travel.airline ? plainToInstance(TravelListAirlineDto, {
            id: travel.airline.id,
            publicId: travel.airline?.publicId ?? '',
            isDeactivated: travel.airline.isDeactivated,
            icaoCode: travel.airline.icaoCode,
            iataCode: travel.airline.iataCode || '',
            name: travel.airline.name,
            logoUrl: travel.airline.logoUrl || '',
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform currency
        const currency = travel.currency ? plainToInstance(TravelListCurrencyDto, {
            code: travel.currency.code,
            name: travel.currency.name,
            symbol: travel.currency.symbol,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Build the complete mapped data
        const mappedData: any = {
            id: travel.id,
            publicId: travel.publicId,
            createdAt: travel.createdAt,
            updatedAt: travel.updatedAt,
            deletedAt: travel.deletedAt || null,
            createdBy: travel.createdBy,
            updatedBy: travel.updatedBy || null,
            isDeactivated: travel.isDeactivated,
            userId: travel.userId,
            description: travel.description,
            flightNumber: formatFlightNumberForResponse(travel.flightNumber),
            isSharedWeight: travel.isSharedWeight,
            isInstant: travel.isInstant,
            isAllowExtraWeight: travel.isAllowExtraWeight,
            punctualityLevel: travel.punctualityLevel ?? false,
            feeForGloomy: travel.feeForGloomy ? travel.feeForGloomy.toString() : '0.00',
            feeForLateComer: travel.feeForLateComer ? travel.feeForLateComer.toString() : '0.00',
            airlineId: travel.airlineId,
            departureAirportId: travel.departureAirportId,
            arrivalAirportId: travel.arrivalAirportId,
            // Prefer travelDate, fallback to departureDatetime (YYYY-MM-DD) to avoid timezone issues
            departureDatetime: (travel.travelDate ?? travel.departureDatetime) ? new Date(travel.travelDate ?? travel.departureDatetime).toISOString().split('T')[0] : null,

            totalWeightAllowance: travel.totalWeightAllowance ? travel.totalWeightAllowance.toString() : '0.00',
            weightAvailable: travel.weightAvailable ? travel.weightAvailable.toString() : '0.00',
            pricePerKg: travel.pricePerKg ? travel.pricePerKg.toString() : '0.00',
            currencyId: travel.currencyId,
            status: travel.status,
            departureAirport: departureAirport,
            arrivalAirport: arrivalAirport,
            user: user,
            images: images,
            airline: airline,
            currency: currency,
            isEditable: travel.isEditable ?? false,
        };

        // Transform the main DTO
        const result = plainToInstance(TravelResponseDto, mappedData, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        });

        // Manually assign nested objects to ensure they're included
        (result as any).departureAirport = departureAirport;
        (result as any).arrivalAirport = arrivalAirport;
        (result as any).user = user;
        (result as any).images = images;
        (result as any).airline = airline;
        (result as any).currency = currency;

        return result;
    }

    /**
     * Transform array of TravelEntity to TravelResponseDto array
     */
    toListResponseDtoArray(travels: (TravelEntity & { isEditable?: boolean })[]): TravelResponseDto[] {
        return travels.map(travel => this.toListResponseDto(travel));
    }

    toResponseDto(travel: TravelEntity): TravelResponseDto {
        return plainToInstance(TravelResponseDto, travel);
    }

    toDetailResponseDto(travel: TravelEntity, reviews: ReviewEntity[] = []): TravelDetailResponseDto {
        // Transform airports
        const departureAirport = travel.departureAirport ? plainToInstance(TravelDetailAirportDto, {
            id: travel.departureAirport.id,
            publicId: travel.departureAirport?.publicId ?? '',
            name: travel.departureAirport.name,
            latitudeDeg: travel.departureAirport.latitudeDeg,
            longitudeDeg: travel.departureAirport.longitudeDeg,
            continent: travel.departureAirport.continent,
            isoCountry: travel.departureAirport.isoCountry,
            icaoCode: travel.departureAirport.icaoCode || '',
            iataCode: travel.departureAirport.iataCode || '',
            createdAt: travel.departureAirport.createdAt,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        const arrivalAirport = travel.arrivalAirport ? plainToInstance(TravelDetailAirportDto, {
            id: travel.arrivalAirport.id,
            publicId: travel.arrivalAirport?.publicId ?? '',
            name: travel.arrivalAirport.name,
            latitudeDeg: travel.arrivalAirport.latitudeDeg,
            longitudeDeg: travel.arrivalAirport.longitudeDeg,
            continent: travel.arrivalAirport.continent,
            isoCountry: travel.arrivalAirport.isoCountry,
            icaoCode: travel.arrivalAirport.icaoCode || '',
            iataCode: travel.arrivalAirport.iataCode || '',
            createdAt: travel.arrivalAirport.createdAt,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform user
        const user = travel.user ? plainToInstance(TravelDetailUserDto, {
            id: travel.user.id,
            publicId: travel.user?.publicId ?? '',
            fullName: this.commonService.userFullName(travel.user),
            phone: travel.user.phone,
            username: travel.user.username || null,
            profilePictureUrl: travel.user.profilePictureUrl || null,
            bio: travel.user.bio || null,
            isVerified: travel.user.isVerified,
            createdAt: travel.user.createdAt,
            rating: roundRatingToTenth(travel.user.rating),
            numberOfReviews: travel.user.numberOfReviews || 0
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform airline
        const airline = travel.airline ? plainToInstance(TravelDetailAirlineDto, {
            id: travel.airline.id,
            publicId: travel.airline?.publicId ?? '',
            name: travel.airline.name,
            icaoCode: travel.airline.icaoCode,
            iataCode: travel.airline.iataCode || '',
            prefix: travel.airline.prefix || '',
            logoUrl: travel.airline.logoUrl || null,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform currency
        const currency = travel.currency ? plainToInstance(TravelDetailCurrencyDto, {
            id: travel.currency.id,
            publicId: travel.currency?.publicId ?? '',
            code: travel.currency.code,
            symbol: travel.currency.symbol,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform images
        const images = travel.images ? travel.images.map(image => plainToInstance(TravelDetailImageDto, {
            id: image.id,
            publicId: image?.publicId ?? '',
            fileUrl: image.fileUrl,
            originalName: image.originalName,
            purpose: image.purpose?.toString() || '',
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        })) : [];

        // Transform reviews
        const transformedReviews = reviews.map(review => {
            const reviewer = review.reviewer ? plainToInstance(TravelDetailReviewerDto, {
                id: review.reviewer.id,
                publicId: review.reviewer?.publicId ?? '',
                fullName: this.commonService.userFullName(review.reviewer),
                profilePictureUrl: review.reviewer.profilePictureUrl || null,
            }, {
                excludeExtraneousValues: true,
                enableImplicitConversion: true
            }) : null;

            return plainToInstance(TravelDetailReviewDto, {
                id: review.id,
                publicId: review.publicId,
                createdAt: review.createdAt,
                updatedAt: review.updatedAt,
                reviewerId: review.reviewerId,
                revieweeId: review.revieweeId,
                requestId: review.requestId,
                rating: review.rating ? review.rating.toString() : null,
                comment: review.comment || null,
                reviewer: reviewer,
            }, {
                excludeExtraneousValues: true,
                enableImplicitConversion: true
            });
        });

        // Build the complete mapped data
        const mappedData: any = {
            id: travel.id,
            publicId: travel.publicId,
            description: travel.description,
            flightNumber: formatFlightNumberForResponse(travel.flightNumber),
            isSharedWeight: travel.isSharedWeight,
            isInstant: travel.isInstant,
            isAllowExtraWeight: travel.isAllowExtraWeight,
            punctualityLevel: travel.punctualityLevel ?? false,
            feeForGloomy: travel.feeForGloomy ? Number(travel.feeForGloomy) : 0,
            currency: currency,
            departureAirport: departureAirport,
            arrivalAirport: arrivalAirport,
            // Prefer travelDate, fallback to departureDatetime (YYYY-MM-DD) to avoid timezone issues
            departureDatetime: (travel.travelDate ?? travel.departureDatetime) ? new Date(travel.travelDate ?? travel.departureDatetime).toISOString().split('T')[0] : null,
            totalWeightAllowance: travel.totalWeightAllowance ? Number(travel.totalWeightAllowance) : 0,
            weightAvailable: travel.weightAvailable ? Number(travel.weightAvailable) : 0,
            pricePerKg: travel.pricePerKg ? Number(travel.pricePerKg) : 0,
            status: travel.status,
            user: user,
            airline: airline,
            images: images,
            createdAt: travel.createdAt,
            reviews: transformedReviews,
        };

        // Transform the main DTO
        const result = plainToInstance(TravelDetailResponseDto, mappedData, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        });

        // Manually assign nested objects to ensure they're included
        (result as any).departureAirport = departureAirport;
        (result as any).arrivalAirport = arrivalAirport;
        (result as any).currency = currency;
        (result as any).user = user;
        (result as any).airline = airline;
        (result as any).images = images;
        (result as any).reviews = transformedReviews;

        return result;
    }
}