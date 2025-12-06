import { Injectable } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { RequestEntity } from "./request.entity";
import { RequestAcceptResponseDto, RequestTravelDto, RequestUserDto } from "./dto/request-accept-response.dto";
import { CommonService } from "src/common/service/common.service";

@Injectable()
export class RequestMapper {
    constructor(private commonService: CommonService) {}

    toAcceptResponseDto(request: RequestEntity): RequestAcceptResponseDto {
        // Map travel if exists
        const travel = request.travel ? plainToInstance(RequestTravelDto, {
            id: request.travel.id,
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
            feeForLateComer: request.travel.feeForLateComer ? request.travel.feeForLateComer.toString() : '0.00',
            feeForGloomy: request.travel.feeForGloomy ? request.travel.feeForGloomy.toString() : '0.00',
            airlineId: request.travel.airlineId,
            departureAirportId: request.travel.departureAirportId,
            arrivalAirportId: request.travel.arrivalAirportId,
            departureDatetime: request.travel.departureDatetime,
            totalWeightAllowance: request.travel.totalWeightAllowance ? request.travel.totalWeightAllowance.toString() : '0.00',
            weightAvailable: request.travel.weightAvailable ? request.travel.weightAvailable.toString() : '0.00',
            pricePerKg: request.travel.pricePerKg ? request.travel.pricePerKg.toString() : '0.00',
            currencyId: request.travel.currencyId,
            status: request.travel.status,
            user: request.travel.user ? plainToInstance(RequestUserDto, {
                id: request.travel.user.id,
                createdAt: request.travel.user.createdAt,
                isDeactivated: request.travel.user.isDeactivated,
                email: request.travel.user.email,
                phone: request.travel.user.phone,
                firstName: request.travel.user.firstName,
                lastName: request.travel.user.lastName,
                fullName: this.commonService.formatFullName(request.travel.user.firstName, request.travel.user.lastName),
                profilePictureUrl: request.travel.user.profilePictureUrl || '',
                currencyId: request.travel.user.currencyId,
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