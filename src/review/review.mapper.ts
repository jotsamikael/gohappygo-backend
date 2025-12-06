import { Injectable } from "@nestjs/common";
import { ReviewEntity } from "./review.entity";
import { ReviewResponseDto, ReviewUserDto, ReviewRequestDto, ReviewRequestStatusDto, ReviewTravelDto, ReviewDemandDto } from "./dto/review-response.dto";
import { RequestEntity } from "src/request/request.entity";
import { TravelEntity } from "src/travel/travel.entity";
import { DemandEntity } from "src/demand/demand.entity";
import { plainToInstance } from "class-transformer";
import { CommonService } from "src/common/service/common.service";

@Injectable()
export class ReviewMapper {
    constructor(private commonService: CommonService) {}
    toResponseDto(review: ReviewEntity & { request?: RequestEntity | null }): ReviewResponseDto {
        // Access relations directly from the entity
        const reviewer = (review as any).reviewer;
        const reviewee = (review as any).reviewee;
        const request = (review as any).request;
        
        // Transform nested objects first
        let requestDto: ReviewRequestDto | null = null;
        let reviewerDto: ReviewUserDto | null = null;
        let revieweeDto: ReviewUserDto | null = null;
        
        if (request && request.id) {
            requestDto = this.mapRequestToDto(request);
        }
        
        if (reviewer && reviewer.id) {
            reviewerDto = this.mapUserToDto(reviewer);
        }
        
        if (reviewee && reviewee.id) {
            revieweeDto = this.mapUserToDto(reviewee);
        }
        
        // Build the complete mapped data - include all fields
        const mappedData: any = {
            id: review.id,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            reviewerId: review.reviewerId,
            revieweeId: review.revieweeId,
            requestId: review.requestId,
            rating: review.rating ? review.rating.toString() : null,
            comment: review.comment || null,
        };
        
        // Transform the base object first
        const result = plainToInstance(ReviewResponseDto, mappedData, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        });
        
        // Manually assign nested DTOs after transformation
        // This ensures they're properly serialized even if plainToInstance doesn't handle them
        (result as any).request = requestDto;
        (result as any).reviewer = reviewerDto;
        (result as any).reviewee = revieweeDto;
        
        return result;
    }

    mapUserToDto(user: any): ReviewUserDto {
        return plainToInstance(ReviewUserDto, {
            id: user.id,
            createdAt: user.createdAt,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: this.commonService.formatFullName(user.firstName, user.lastName),
            email: user.email,
            profilePictureUrl: user.profilePictureUrl || null,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        });
    }

    private mapRequestToDto(request: RequestEntity): ReviewRequestDto {
        return plainToInstance(ReviewRequestDto, {
            id: request.id,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            demandId: request.demandId,
            travelId: request.travelId,
            requesterId: request.requesterId,
            requestType: request.requestType,
            weight: request.weight ? request.weight.toString() : null,
            currentStatusId: request.currentStatusId || null,
            currentStatus: request.currentStatus ? plainToInstance(ReviewRequestStatusDto, {
                status: request.currentStatus.status
            }, {
                excludeExtraneousValues: true,
                enableImplicitConversion: true
            }) : null,
            travel: request.travel ? this.mapTravelToDto(request.travel) : null,
            demand: request.demand ? this.mapDemandToDto(request.demand) : null,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        });
    }

    private mapTravelToDto(travel: TravelEntity): ReviewTravelDto {
        return plainToInstance(ReviewTravelDto, {
            id: travel.id,
            createdAt: travel.createdAt,
            updatedAt: travel.updatedAt,
            deletedAt: travel.deletedAt || null,
            createdBy: travel.createdBy ?? null,
            updatedBy: travel.updatedBy ?? null,
            isDeactivated: travel.isDeactivated,
            userId: travel.userId,
            description: travel.description,
            flightNumber: travel.flightNumber,
            isSharedWeight: travel.isSharedWeight,
            isInstant: travel.isInstant,
            isAllowExtraWeight: travel.isAllowExtraWeight,
            feeForLateComer: travel.feeForLateComer ? travel.feeForLateComer.toString() : '0.00',
            feeForGloomy: travel.feeForGloomy ? travel.feeForGloomy.toString() : '0.00',
            airlineId: travel.airlineId,
            departureAirportId: travel.departureAirportId,
            arrivalAirportId: travel.arrivalAirportId,
            departureDatetime: travel.departureDatetime,
            totalWeightAllowance: travel.totalWeightAllowance ? travel.totalWeightAllowance.toString() : '0.00',
            weightAvailable: travel.weightAvailable ? travel.weightAvailable.toString() : '0.00',
            pricePerKg: travel.pricePerKg ? travel.pricePerKg.toString() : '0.00',
            currencyId: travel.currencyId,
            status: travel.status,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        });
    }

    private mapDemandToDto(demand: DemandEntity): ReviewDemandDto | null {
        // For now, return null as demand structure might be different
        // Can be extended later if needed
        return null;
    }
}