import { PartialType } from '@nestjs/mapped-types';
import { CreateAirportDto } from './create-airport.dto';

export class UpdateAirportDto extends PartialType(CreateAirportDto) {}
