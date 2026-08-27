import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { RequestEntity } from "./request.entity";
import { RequestAcceptResponseDto, RequestTravelDto, RequestUserDto } from "./dto/request-accept-response.dto";
import { UserResponseDto } from "./dto/request-response.dto";
import { UserEntity } from "src/user/user.entity";
import { CommonService } from "src/common/service/common.service";

@Injectable()
export class RequestMapper {
    constructor(private commonService: CommonService) {}

    /**
     * Map UserEntity to UserResponseDto
     */
    toUserResponseDto(user: UserEntity | null, userId?: number): UserResponseDto | null {
        const publicUser = this.commonService.publicUserOrDeletedPlaceholder(user, userId);
        if (!publicUser) {
            return null;
        }

        return plainToInstance(UserResponseDto, publicUser, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        });
    }

    toAcceptResponseDto(request: RequestEntity): RequestAcceptResponseDto {
        // Map travel if exists
        const travel = request.travel ? plainToInstance(RequestTravelDto, {
            id: request.travel.id,
            publicId: request.travel.publicId,
            createdAt: request.travel.createdAt,
            updatedAt: request.travel.updatedAt,
            createdBy: request.travel.createdBy,
            isDeactivated: request.travel.isDeactivated,
            userId: request.travel.userId,
            description: request.travel.description,
            flightNumber: request.travel.flightNumber,
            isSharedWeight: request.travel.isSharedWeight,
            isInstant: request.travel.isInstant,
            isAllowExtraWeight: request.travel.isAllowExtraWeight,
            punctualityLevel: request.travel.punctualityLevel ?? false,
            feeForGloomy: request.travel.feeForGloomy ? request.travel.feeForGloomy.toString() : '0.00',
            airlineId: request.travel.airlineId,
            departureAirportId: request.travel.departureAirportId,
            arrivalAirportId: request.travel.arrivalAirportId,
            departureDatetime: (request.travel as any).travelDate ?? request.travel.departureDatetime,
            totalWeightAllowance: request.travel.totalWeightAllowance ? request.travel.totalWeightAllowance.toString() : '0.00',
            weightAvailable: request.travel.weightAvailable ? request.travel.weightAvailable.toString() : '0.00',
            pricePerKg: request.travel.pricePerKg ? request.travel.pricePerKg.toString() : '0.00',
            currencyId: request.travel.currencyId,
            status: request.travel.status,
            user: request.travel.user || request.travel.userId
              ? plainToInstance(RequestUserDto, {
                  ...this.commonService.publicUserOrDeletedPlaceholder(
                    request.travel.user,
                    request.travel.userId,
                  )!,
                  phone: this.commonService.isAnonymizedUser(request.travel.user)
                    ? null
                    : request.travel.user?.phone,
                  currencyId: request.travel.user?.currencyId,
                }, {
                excludeExtraneousValues: true,
                enableImplicitConversion: true
            }) : null,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        }) : null;

        // Build the main response
        const mapped = plainToInstance(RequestAcceptResponseDto, {
            id: request.id,
            publicId: request.publicId,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            deletedAt: request.deletedAt,
            createdBy: request.createdBy,
            updatedBy: request.updatedBy,
            isDeactivated: request.isDeactivated,
            demandId: request.demandId,
            travelId: request.travelId,
            requesterId: request.requesterId,
            requestType: request.requestType,
            weight: request.weight ? request.weight.toString() : '0.00',
            currentStatusId: request.currentStatusId,
            travel: travel,
            demand: request.demand || null,
        }, {
            excludeExtraneousValues: true,
            enableImplicitConversion: true
        });

        // Manually assign nested objects
        (mapped as any).travel = travel;

        return mapped;
    }
}