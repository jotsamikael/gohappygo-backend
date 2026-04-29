import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AlertEntity } from './entities/alert.entity';
import { AlertResponseDto, AlertAirportResponseDto, AlertUserResponseDto } from './dto/response/alert-response.dto';
import { CommonService } from 'src/common/service/common.service';

@Injectable()
export class AlertMapper {
  constructor(private readonly commonService: CommonService) {}

  /**
   * Map AlertEntity to AlertResponseDto
   */
  toResponseDto(alert: AlertEntity): AlertResponseDto {
    const mapped = {
      id: alert.id,
      userId: alert.userId,
      departureAirportId: alert.departureAirportId,
      arrivalAirportId: alert.arrivalAirportId,
      alertType: alert.alertType,
      flightNumber: alert.flightNumber,
      travelDate: alert.travelDate,
      departureAirport: alert.departureAirport
        ? this.toAirportResponseDto(alert.departureAirport)
        : null,
      arrivalAirport: alert.arrivalAirport
        ? this.toAirportResponseDto(alert.arrivalAirport)
        : null,
      user: alert.user
        ? this.toUserResponseDto(alert.user)
        : null,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };

    return plainToInstance(AlertResponseDto, mapped, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map airport entity to AlertAirportResponseDto
   */
  private toAirportResponseDto(airport: any): AlertAirportResponseDto {
    return plainToInstance(AlertAirportResponseDto, {
      id: airport.id,
      name: airport.name,
      municipality: airport.municipality,
      isoCountry: airport.isoCountry,
    }, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }

  /**
   * Map user entity to AlertUserResponseDto
   */
  private toUserResponseDto(user: any): AlertUserResponseDto {
    return plainToInstance(AlertUserResponseDto, {
      id: user.id,
      email: user.email,
      fullName: this.commonService.userFullName(user),
    }, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });
  }
}
