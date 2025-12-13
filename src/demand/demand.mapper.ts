import { plainToInstance } from "class-transformer";
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
import { ReviewEntity } from "src/review/review.entity";
import { Injectable } from "@nestjs/common";
import { CommonService } from "src/common/service/common.service";

@Injectable()
export class DemandMapper {
    constructor(private commonService: CommonService) {}
  
    toDemandDetailResponse(demand: DemandEntity, reviews: ReviewEntity[]): DemandDetailResponseDto {
        // Transform airports
        const departureAirport = demand.departureAirport ? plainToInstance(DemandDetailAirportDto, {
            id: demand.departureAirport.id,
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
        const user = demand.user ? plainToInstance(DemandDetailUserDto, {
            id: demand.user.id,
            email: demand.user.email,
            firstName: demand.user.firstName,
            lastName: demand.user.lastName,
            fullName: this.commonService.formatFullName(demand.user.firstName, demand.user.lastName),
            phone: demand.user.phone,
            username: demand.user.username || null,
            profilePictureUrl: demand.user.profilePictureUrl || null,
            bio: demand.user.bio || null,
            isDeactivated: demand.user.isDeactivated,
            isPhoneVerified: demand.user.isPhoneVerified,
            isVerified: demand.user.isVerified,
            createdAt: demand.user.createdAt,
            rating: demand.user.rating || null,
            numberOfReviews: demand.user.numberOfReviews || 0
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform airline
        const airline = demand.airline ? plainToInstance(DemandDetailAirlineDto, {
            id: demand.airline.id,
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
            code: demand.currency.code,
            symbol: demand.currency.symbol,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform images
        const images = demand.images ? demand.images.map(image => plainToInstance(DemandDetailImageDto, {
            id: image.id,
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
            const reviewer = review.reviewer ? plainToInstance(DemandDetailReviewerDto, {
                id: review.reviewer.id,
                firstName: review.reviewer.firstName,
                lastName: review.reviewer.lastName,
                fullName: this.commonService.formatFullName(review.reviewer.firstName, review.reviewer.lastName),
                email: review.reviewer.email,
                profilePictureUrl: review.reviewer.profilePictureUrl || null,
            }, {
                excludeExtraneousValues: true,
                enableImplicitConversion: true
            }) : null;

            return plainToInstance(DemandDetailReviewDto, {
                id: review.id,
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
            description: demand.description,
            flightNumber: demand.flightNumber,
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
            travelDate: demand.travelDate,
            currencyId: demand.currencyId,
            packageKind: demand.packageKind,
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