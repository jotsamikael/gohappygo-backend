import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyPhoneDto } from './dto/verifyPhone.dto';
import { FindUsersQueryDto } from './dto/FindUsersQuery.dto';
import { VerifyUserAccountDto } from './dto/verifyUserAccount.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles-guard';
import { Roles } from './decorators/role.decorators';
import { UserRole } from 'src/user/user.entity';
import { CurrentUser } from './decorators/current-user.decorattor';
import { UserEntity } from 'src/user/user.entity';
import { FileFieldsInterceptor, FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiParam } from '@nestjs/swagger';
import { RegisterResponseDto, LoginResponseDto, VerifyPhoneResponseDto, RefreshTokenResponseDto, UploadVerificationResponseDto, VerifyEmailResponseDto } from './dto/auth-response.dto';
import { UploadVerificationDto } from './dto/upload-verification.dto';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import { PhoneVerificationService } from '../phone-verification/phone-verification.service';
import { SmsService } from '../sms/sms.service';
import { GetUserVerificationFilesResponseDto } from './dto/getUserVerificationFilesResponse.dto';
import { VerifyUserAccountResponseDto } from './dto/verifyUserAccountResponse.dto';
import { ResendEmailVerificationDto } from './dto/resendEmailVerificationDto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ 
    status: 201, 
    description: 'User successfully registered',
    type: RegisterResponseDto
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - user already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-email')
  @ApiOperation({ 
    summary: 'Verify email with code',
    description: 'Verify email address with the 6-digit code sent via email. Upon successful verification, the user is automatically logged in and receives authentication tokens.'
  })
  @ApiBody({
    description: 'Verify email with code',
    type: VerifyEmailDto,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Email verified successfully. User is now logged in.',
    type: VerifyEmailResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid verification code' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-email-verification')
  @ApiOperation({ summary: 'Resend email verification code' })
  @ApiResponse({ status: 200, description: 'Email verification code resent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resendEmailVerification(@Body() resendEmailVerificationDto: ResendEmailVerificationDto) {
    return this.authService.resendEmailVerification(resendEmailVerificationDto);
  }

  


  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @UseGuards(LoginThrottlerGuard)
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    type: LoginResponseDto
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

 /* @Post('upload-verification')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload verification documents (ID, selfie)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload verification file',
    type: UploadFileDto,
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadFileForVerification(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
    @CurrentUser() user: UserEntity,
  ): Promise<any> {
    return this.authService.uploadVerificationDocuments(file, uploadFileDto, user);
  }*/


  @Post('send-sms-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Send SMS verification code',
    description: 'Generate and send a 6-digit SMS verification code for the current user'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'SMS code sent successfully',
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: '123456' },
        expiresAt: { type: 'string', format: 'date-time' },
        message: { type: 'string', example: 'SMS code sent successfully' }
      }
    }
  })
  async sendSmsCode(@CurrentUser() user: UserEntity): Promise<any> {
    const { code, expiresAt } = await this.authService.generatePhoneVerificationCode(user);
    
    return {
      code, // In production, remove this line and only return success message
      expiresAt,
      message: 'SMS code sent successfully'
    };
  }

  @Post('verify-phone')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Verify phone number with SMS code',
    description: 'Verify the SMS code and mark user phone as verified'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Phone number verified successfully' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid or expired SMS code' 
  })
  async verifyPhone(
    @CurrentUser() user: UserEntity,
    @Body() verifyPhoneDto: VerifyPhoneDto
  ): Promise<any> {
    const isValid = await this.authService.verifyPhone(user, verifyPhoneDto.code);
    
    if (!isValid) {
      throw new BadRequestException('Invalid or expired SMS code');
    }

    // Mark user phone as verified
    // await this.userService.setToUserPhoneVerified(user); // This line was removed as per the new_code

    return {
      message: 'Phone number verified successfully',
      isPhoneVerified: true
    };
  }

//validate the user account

@Post('upload-verification')
@UseGuards(JwtAuthGuard)
@UseInterceptors(
  FileFieldsInterceptor([
    { name: 'selfie', maxCount: 1 },
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 }
  ])
)
@ApiBearerAuth('JWT-auth')
@ApiOperation({ 
  summary: 'Upload verification documents',
  description: 'Upload selfie and both sides of national ID for identity verification'
})
@ApiConsumes('multipart/form-data')
@ApiBody({
  description: 'Upload verification files',
  schema: {
    type: 'object',
    properties: {
      selfie: {
        type: 'string',
        format: 'binary',
        description: 'Selfie photo of the user'
      },
      idFront: {
        type: 'string',
        format: 'binary',
        description: 'Front side of national ID'
      },
      idBack: {
        type: 'string',
        format: 'binary',
        description: 'Back side of national ID'
      },
      notes: {
        type: 'string',
        description: 'Additional notes for verification'
      }
    },
    required: ['selfie', 'idFront', 'idBack']
  }
})
@ApiResponse({ 
  status: 201, 
  description: 'Verification documents uploaded successfully',
  type: UploadVerificationResponseDto
})
@ApiResponse({ status: 400, description: 'Bad request - invalid files or missing files' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
async uploadVerificationDocuments(
  @UploadedFiles() files: { 
    selfie?: Express.Multer.File[], 
    idFront?: Express.Multer.File[], 
    idBack?: Express.Multer.File[] 
  },
  @Body() uploadVerificationDto: UploadVerificationDto,
  @CurrentUser() user: UserEntity,
): Promise<UploadVerificationResponseDto> {
  const selfie = files.selfie?.[0];
  const idFront = files.idFront?.[0];
  const idBack = files.idBack?.[0];
  
  // Validate files in the controller
  if (!selfie) {
    throw new BadRequestException('Selfie file is required');
  }
  if (!idFront) {
    throw new BadRequestException('ID front file is required');
  }
  if (!idBack) {
    throw new BadRequestException('ID back file is required');
  }
  
  const fileArray = [selfie, idFront, idBack];
  return this.authService.uploadVerificationDocuments(fileArray, uploadVerificationDto, user);
}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user information with profile stats' })
  @ApiResponse({ 
    status: 200, 
    description: 'Current user information with profile stats',
    type: UserProfileResponseDto
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@CurrentUser() user: UserEntity): Promise<UserProfileResponseDto> {
    return this.authService.getUserProfileWithStats(user.id);
  }

  @Get('admin/verification-files/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get user verification files for admin review',
    description: 'Retrieve uploaded verification documents (selfie, ID front, ID back) for admin verification'
  })
  @ApiParam({ name: 'userId', description: 'User ID to get verification files for' })
  @ApiResponse({ 
    status: 200, 
    description: 'Verification files retrieved successfully',
    type: GetUserVerificationFilesResponseDto
  }
)
async getUserVerificationFiles(@Param('userId') userId: number): Promise<any> {
  return this.authService.getUserVerificationFiles(userId);
}

  @Post('verify-user/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Verify user account (Admin only)' })
  @ApiBody({
    description: 'Verify user account',
    type: VerifyUserAccountDto,
  })
  @ApiResponse({ status: 200, description: 'User verified successfully', type: VerifyUserAccountResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async verifyUserAccount(@Param('id', ParseIntPipe) idUser: number, @CurrentUser() admin: UserEntity,@Body() verifyUserAccountDto: VerifyUserAccountDto){
    return this.authService.verifyUserAccount(idUser, verifyUserAccountDto, admin);
  }

  

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh access token' })
  
  @ApiResponse({ 
    status: 200, 
    description: 'Token refreshed successfully',
    type: RefreshTokenResponseDto
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Delete('delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Delete current user account',
    description: 'Soft delete the authenticated user account. Sets deleted_at so the user can no longer log in.'
  })
  @ApiResponse({ status: 200, description: 'Account deleted successfully', schema: { type: 'object', properties: { message: { type: 'string', example: 'Account deleted successfully' } } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAccount(@CurrentUser() user: UserEntity) {
    return this.authService.deleteAccount(user);
  }
}
