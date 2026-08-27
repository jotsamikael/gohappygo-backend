import { plainToInstance } from "class-transformer";
import { roundRatingToTenth } from "src/common/transforms/round-rating-to-tenth.util";
import { DemandEntity } from "./demand.entity";
import {
    DemandDetailResponseDto,
    DemandDetailAirportDto,
    DemandDetailUserDto,
    DemandDetailAirlineDto,
    DemandDetailImageDto,
    DemandDetailReviewDto,
    DemandDetailReviewerDto,
    DemandDetailCurrencyDto
} from "./dto/demand-detail-response.dto";
import {
    DemandResponseDto,
    DemandListAirportDto,
    DemandListUserDto,
    DemandListImageDto,
    DemandListAirlineDto,
    DemandListCurrencyDto
} from "./dto/demand-response.dto";
import { ReviewEntity } from "src/review/review.entity";
import { Injectable } from "@nestjs/common";
import { CommonService } from "src/common/service/common.service";
import { formatFlightNumberForResponse } from "src/common/transforms/format-flight-number.util";

@Injectable()
export class DemandMapper {
    constructor(private commonService: CommonService) { }

    /**
     * Transform DemandEntity to DemandResponseDto for list endpoints
     */
    toListResponseDto(demand: DemandEntity): DemandResponseDto {
        // Transform departure airport
        const departureAirport = demand.departureAirport ? plainToInstance(DemandListAirportDto, {
            id: demand.departureAirport.id,
            publicId: demand.departureAirport?.publicId ?? '',
            ident: demand.departureAirport.ident,
            type: demand.departureAirport.type,
            name: demand.departureAirport.name,
            isoCountry: demand.departureAirport.isoCountry || '',
            isoRegion: demand.departureAirport.isoRegion || '',
            municipality: demand.departureAirport.municipality || '',
            icaoCode: demand.departureAirport.icaoCode || '',
            iataCode: demand.departureAirport.iataCode || '',
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform arrival airport
        const arrivalAirport = demand.arrivalAirport ? plainToInstance(DemandListAirportDto, {
            id: demand.arrivalAirport.id,
            publicId: demand.arrivalAirport?.publicId ?? '',
            ident: demand.arrivalAirport.ident,
            type: demand.arrivalAirport.type,
            name: demand.arrivalAirport.name,
            isoCountry: demand.arrivalAirport.isoCountry || '',
            isoRegion: demand.arrivalAirport.isoRegion || '',
            municipality: demand.arrivalAirport.municipality || '',
            icaoCode: demand.arrivalAirport.icaoCode || '',
            iataCode: demand.arrivalAirport.iataCode || '',
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform user
        const publicUser = this.commonService.publicUserOrDeletedPlaceholder(demand.user, demand.userId);
        const user = publicUser ? plainToInstance(DemandListUserDto, publicUser, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform images
        const images = demand.images ? demand.images.map(image => plainToInstance(DemandListImageDto, {
            id: image.id,
            publicId: image?.publicId ?? '',
            originalName: image.originalName,
            fileUrl: image.fileUrl,
            size: image.size,
            mimeType: image.mimeType,
            purpose: image.purpose,
            uploadedAt: image.uploadedAt,
            travelId: image.travelId || null,
            demandId: image.demandId,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        })) : [];

        // Transform airline
        const airline = demand.airline ? plainToInstance(DemandListAirlineDto, {
            id: demand.airline.id,
            publicId: demand.airline?.publicId ?? '',
            isDeactivated: demand.airline.isDeactivated,
            icaoCode: demand.airline.icaoCode,
            iataCode: demand.airline.iataCode || '',
            name: demand.airline.name,
            logoUrl: demand.airline.logoUrl || '',
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform currency
        const currency = demand.currency ? plainToInstance(DemandListCurrencyDto, {
            code: demand.currency.code,
            name: demand.currency.name,
            symbol: demand.currency.symbol,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Build the complete mapped data
        const mappedData: any = {
            id: demand.id,
            publicId: demand.publicId,
            createdAt: demand.createdAt,
            updatedAt: demand.updatedAt,
            deletedAt: demand.deletedAt || null,
            createdBy: demand.createdBy,
            updatedBy: demand.updatedBy || null,
            isDeactivated: demand.isDeactivated,
            userId: demand.userId,
            airlineId: demand.airlineId,
            description: demand.description,
            flightNumber: formatFlightNumberForResponse(demand.flightNumber),
            departureAirportId: demand.departureAirportId,
            arrivalAirportId: demand.arrivalAirportId,
            // Format travelDate as date-only (YYYY-MM-DD) to avoid timezone issues
            travelDate: demand.travelDate ? new Date(demand.travelDate).toISOString().split('T')[0] : null,
            weight: demand.weight ? demand.weight.toString() : '0.00',
            pricePerKg: demand.pricePerKg ? demand.pricePerKg.toString() : '0.00',
            currencyId: demand.currencyId,
            status: demand.status,
            departureAirport: departureAirport,
            arrivalAirport: arrivalAirport,
            user: user,
            images: images,
            airline: airline,
            currency: currency,
        };

        // Transform the main DTO
        const result = plainToInstance(DemandResponseDto, mappedData, {
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
     * Transform array of DemandEntity to DemandResponseDto array
     */
    toListResponseDtoArray(demands: DemandEntity[]): DemandResponseDto[] {
        return demands.map(demand => this.toListResponseDto(demand));
    }

    toDemandDetailResponse(demand: DemandEntity, reviews: ReviewEntity[]): DemandDetailResponseDto {
        // Transform airports
        const departureAirport = demand.departureAirport ? plainToInstance(DemandDetailAirportDto, {
            id: demand.departureAirport.id,
            publicId: demand.departureAirport?.publicId ?? '',
            type: demand.departureAirport.type,
            name: demand.departureAirport.name,
            latitudeDeg: demand.departureAirport.latitudeDeg?.toString() || null,
            longitudeDeg: demand.departureAirport.longitudeDeg?.toString() || null,
            continent: demand.departureAirport.continent,
            isoCountry: demand.departureAirport.isoCountry,
            municipality: demand.departureAirport.municipality,
            icaoCode: demand.departureAirport.icaoCode,
            iataCode: demand.departureAirport.iataCode,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        const arrivalAirport = demand.arrivalAirport ? plainToInstance(DemandDetailAirportDto, {
            id: demand.arrivalAirport.id,
            publicId: demand.arrivalAirport?.publicId ?? '',
            type: demand.arrivalAirport.type,
            name: demand.arrivalAirport.name,
            latitudeDeg: demand.arrivalAirport.latitudeDeg?.toString() || null,
            longitudeDeg: demand.arrivalAirport.longitudeDeg?.toString() || null,
            continent: demand.arrivalAirport.continent,
            isoCountry: demand.arrivalAirport.isoCountry,
            municipality: demand.arrivalAirport.municipality,
            icaoCode: demand.arrivalAirport.icaoCode,
            iataCode: demand.arrivalAirport.iataCode,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform user
        const publicUser = this.commonService.publicUserOrDeletedPlaceholder(demand.user, demand.userId);
        const user = publicUser ? plainToInstance(DemandDetailUserDto, {
            ...publicUser,
            phone: this.commonService.isAnonymizedUser(demand.user) ? null : demand.user?.phone,
            username: this.commonService.isAnonymizedUser(demand.user) ? null : (demand.user?.username || null),
            isPhoneVerified: demand.user?.isPhoneVerified ?? false,
            rating: roundRatingToTenth(demand.user?.rating ?? null),
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform airline
        const airline = demand.airline ? plainToInstance(DemandDetailAirlineDto, {
            id: demand.airline.id,
            publicId: demand.airline?.publicId ?? '',
            name: demand.airline.name,
            icaoCode: demand.airline.icaoCode,
            iataCode: demand.airline.iataCode || '',
            logoUrl: demand.airline.logoUrl || null,
            isDeactivated: demand.airline.isDeactivated,
            createdAt: demand.airline.createdAt,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform currency
        const currency = demand.currency ? plainToInstance(DemandDetailCurrencyDto, {
            id: demand.currency.id,
            publicId: demand.currency?.publicId ?? '',
            code: demand.currency.code,
            symbol: demand.currency.symbol,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform images
        const images = demand.images ? demand.images.map(image => plainToInstance(DemandDetailImageDto, {
            id: image.id,
            publicId: image?.publicId ?? '',
            fileUrl: image.fileUrl,
            purpose: image.purpose,
            uploadedAt: image.uploadedAt,
            travelId: image.travelId || null,
            demandId: image.demandId,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        })) : [];

        // Transform reviews
        const transformedReviews = reviews.map(review => {
            const reviewerPublic = this.commonService.publicUserOrDeletedPlaceholder(review.reviewer, review.reviewerId);
            const reviewer = reviewerPublic ? plainToInstance(DemandDetailReviewerDto, reviewerPublic, {
                excludeExtraneousValues: true,
                enableImplicitConversion: true
            }) : null;

            return plainToInstance(DemandDetailReviewDto, {
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
            id: demand.id,
            publicId: demand.publicId,
            description: demand.description,
            flightNumber: formatFlightNumberForResponse(demand.flightNumber),
            departureAirport: departureAirport,
            arrivalAirport: arrivalAirport,
            weight: demand.weight ? demand.weight.toString() : '0.00',
            pricePerKg: demand.pricePerKg ? demand.pricePerKg.toString() : '0.00',
            status: demand.status,
            currency: currency,
            user: user,
            airline: airline,
            images: images,
            createdAt: demand.createdAt,
            reviews: transformedReviews,
            updatedAt: demand.updatedAt,
            deletedAt: demand.deletedAt || null,
            createdBy: demand.createdBy ?? null,
            updatedBy: demand.updatedBy ?? null,
            isDeactivated: demand.isDeactivated ?? false,
            userId: demand.userId,
            airlineId: demand.airlineId,
            departureAirportId: demand.departureAirportId,
            arrivalAirportId: demand.arrivalAirportId,
            // Format travelDate as date-only (YYYY-MM-DD) to avoid timezone issues
            travelDate: demand.travelDate ? new Date(demand.travelDate).toISOString().split('T')[0] : null,

            currencyId: demand.currencyId,
            requests: demand.requests || [],
        };

        // Transform the main DTO
        const result = plainToInstance(DemandDetailResponseDto, mappedData, {
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