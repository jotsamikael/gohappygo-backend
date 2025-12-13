import { Injectable } from "@nestjs/common";
import { TravelResponseDto } from "./dto/travel-response.dto";
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

@Injectable()
export class TravelMapper {
    constructor(private commonService: CommonService) {}
    toResponseDto(travel: TravelEntity): TravelResponseDto {
        return plainToInstance(TravelResponseDto, travel);
    }

    toDetailResponseDto(travel: TravelEntity, reviews: ReviewEntity[] = []): TravelDetailResponseDto {
        // Transform airports
        const departureAirport = travel.departureAirport ? plainToInstance(TravelDetailAirportDto, {
            id: travel.departureAirport.id,
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
            email: travel.user.email,
            firstName: travel.user.firstName,
            lastName: travel.user.lastName,
            fullName: this.commonService.formatFullName(travel.user.firstName, travel.user.lastName),
            phone: travel.user.phone,
            username: travel.user.username || null,
            profilePictureUrl: travel.user.profilePictureUrl || null,
            bio: travel.user.bio || null,
            isVerified: travel.user.isVerified,
            createdAt: travel.user.createdAt,
            rating: travel.user.rating || null,
            numberOfReviews: travel.user.numberOfReviews || 0
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform airline
        const airline = travel.airline ? plainToInstance(TravelDetailAirlineDto, {
            id: travel.airline.id,
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
            code: travel.currency.code,
            symbol: travel.currency.symbol,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Transform images
        const images = travel.images ? travel.images.map(image => plainToInstance(TravelDetailImageDto, {
            id: image.id,
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
                firstName: review.reviewer.firstName,
                lastName: review.reviewer.lastName,
                fullName: this.commonService.formatFullName(review.reviewer.firstName, review.reviewer.lastName),
                email: review.reviewer.email,
                profilePictureUrl: review.reviewer.profilePictureUrl || null,
            }, {
                excludeExtraneousValues: true,
                enableImplicitConversion: true
            }) : null;

            return plainToInstance(TravelDetailReviewDto, {
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
            id: travel.id,
            description: travel.description,
            flightNumber: travel.flightNumber,
            isSharedWeight: travel.isSharedWeight,
            isInstant: travel.isInstant,
            isAllowExtraWeight: travel.isAllowExtraWeight,
            feeForLateComer: travel.feeForLateComer ? Number(travel.feeForLateComer) : 0,
            feeForGloomy: travel.feeForGloomy ? Number(travel.feeForGloomy) : 0,
            currency: currency,
            departureAirport: departureAirport,
            arrivalAirport: arrivalAirport,
            departureDatetime: travel.departureDatetime,
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