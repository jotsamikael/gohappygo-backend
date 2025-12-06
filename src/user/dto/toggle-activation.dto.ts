import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ToggleActivationDto {
  @ApiProperty({
    description: 'Whether to deactivate (true) or activate (false) the staff member',
    example: true
  })
  @IsBoolean()
  @IsNotEmpty()
  isDeactivated: boolean;
}
