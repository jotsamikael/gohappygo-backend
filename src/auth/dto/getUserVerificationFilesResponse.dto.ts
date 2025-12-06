import { UserResponseDto } from "src/user/dto/user-response.dto";
import { UploadedFileResponseDto } from "./auth-response.dto";

export class GetUserVerificationFilesResponseDto {
    user: UserResponseDto;
    verificationFiles: UploadedFileResponseDto[];
    missingFiles: string[];
    isComplete: boolean;
    canBeApproved: boolean;
}