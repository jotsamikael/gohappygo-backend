import { ApiProperty } from '@nestjs/swagger';
import { DemandResponseDto } from 'src/demand/dto/demand-response.dto';
import { MessageResponseDto } from 'src/message/dto/message-response.dto';
import { RequestResponseDto } from 'src/request/dto/request-response.dto';
import { UserRoleResponseDto } from 'src/role/dto/role-response.dto';
import { TravelResponseDto } from 'src/travel/dto/travel-response.dto';



export class UploadedFileResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'selfie.jpg' })
  originalName: string;

  @ApiProperty({ example: 'https://cloudinary.com/selfie.jpg' })
  url: string;

  @ApiProperty({ example: 'SELFIE' })
  purpose: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  uploadedAt: Date;
}



export class UserProfileResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'John D.' })
  fullName: string;

  @ApiProperty({ example: '+1234567890' })
  phone: string;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiProperty({ example: 'https://example.com/profile.jpg' })
  profilePictureUrl: string;

  @ApiProperty({ example: false })
  isDeactivated: boolean;

  @ApiProperty({ example: false })
  isPhoneVerified: boolean;

  @ApiProperty({ example: false })
  isVerified: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: UserRoleResponseDto })
  role: UserRoleResponseDto;

  @ApiProperty({ type: [DemandResponseDto], description: 'User\'s delivery demands' })
  demands: DemandResponseDto[];

  @ApiProperty({ type: [TravelResponseDto], description: 'User\'s travel declarations' })
  travels: TravelResponseDto[];

  @ApiProperty({ type: [MessageResponseDto], description: 'Messages sent by the user' })
  messagesSend: MessageResponseDto[];

  @ApiProperty({ type: [MessageResponseDto], description: 'Messages received by the user' })
  messagesReceived: MessageResponseDto[];

  @ApiProperty({ type: [UploadedFileResponseDto], description: 'User\'s uploaded files' })
  files: UploadedFileResponseDto[];

  @ApiProperty({ type: [RequestResponseDto], description: 'User\'s requests' })
  requests: RequestResponseDto[];

  @ApiProperty({ example: 5, description: 'Total number of demands' })
  demandsCount: number;

  @ApiProperty({ example: 3, description: 'Total number of travels' })
  travelsCount: number;

  @ApiProperty({ example: 10, description: 'Total number of messages sent' })
  messagesSentCount: number;

  @ApiProperty({ example: 8, description: 'Total number of messages received' })
  messagesReceivedCount: number;

  @ApiProperty({ example: 2, description: 'Total number of requests' })
  requestsCount: number;
}