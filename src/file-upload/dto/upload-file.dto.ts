import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { FilePurpose } from "src/uploaded-file/uploaded-file-purpose.enum";

export class UploadFileDto{
    @ApiProperty({
        description: 'File purpose',
        example: 'verification'
      })
    @IsString()
    @MaxLength(500)
    purpose:FilePurpose

}