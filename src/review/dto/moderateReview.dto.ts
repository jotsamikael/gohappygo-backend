import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class ModerateReviewDto {
  @ApiProperty({
    description: 'Moderated comment content',
    example: 'This comment has been moderated for inappropriate content',
    minLength: 1,
    maxLength: 2500
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2500)
  comment: string;
}
