import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsNumber, Min, Max } from "class-validator";

export class CreateReviewDto{

  @ApiProperty({
    description: 'requestId id',
    example: 1,
    minLength: 1,
    maxLength: 10
  })
  @IsNotEmpty()
  requestId: number;

  @ApiProperty({
    description: 'Rating (supports decimals for half-star ratings)',
    example: 4.5,
    minimum: 1,
    maximum: 5
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 1 })  // Allows one decimal place
  @Min(1)
  @Max(5)
  rating: number; // 1.0 to 5.0 (e.g., 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0)

  @ApiProperty({
    description: 'Comment',
    example: 'This is a comment',
    minLength: 1,
    maxLength: 2500
  })
  @IsOptional()
  comment: string;
}