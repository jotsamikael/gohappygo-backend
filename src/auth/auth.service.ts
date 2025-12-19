import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { UserEventsService } from 'src/events/user-events.service';
import { UserRoleEntity } from 'src/role/userRole.entity';
import { UserEntity, UserRole } from 'src/user/user.entity';
import { UserService } from 'src/user/user.service';
import { RoleService } from 'src/role/role.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { VerifyUserAccountDto } from './dto/verifyUserAccount.dto';
import { UserVerificationAuditService } from 'src/user-verification-audit-entity/user-verification-audit.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FilePurpose } from 'src/uploaded-file/uploaded-file-purpose.enum';
import { UploadVerificationResponseDto, UploadedFileResponseDto } from './dto/auth-response.dto';
import { UploadVerificationDto } from './dto/upload-verification.dto';
import { SmsService } from 'src/sms/sms.service';
import { EmailService } from 'src/email/email.service';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import { EmailTemplatesService } from 'src/email/email-templates.service';
import { EmailVerificationService } from 'src/email-verification/email-verification.service';
import { PhoneVerificationService } from 'src/phone-verification/phone-verification.service';
import { ResendEmailVerificationDto } from './dto/resendEmailVerificationDto';
import { DemandService } from 'src/demand/demand.service';
import { TravelService } from 'src/travel/travel.service';
import { CurrencyService } from 'src/currency/currency.service';
import { DemandEntity } from 'src/demand/demand.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { RequestEntity } from 'src/request/request.entity';
import { BookmarkEntity, BookmarkType } from 'src/bookmark/entities/bookmark.entity';
import { ReviewEntity } from 'src/review/review.entity';
import { TransactionEntity } from 'src/transaction/transaction.entity';
import { UserProfileResponseDto, ProfileStatsResponseDto } from './dto/user-profile-response.dto';
import { CurrencyResponseDto } from 'src/currency/dto/currency-response.dto';
import { CustomBadRequestException, CustomConflictException, CustomNotFoundException, CustomUnauthorizedException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';

@Injectable()
export class AuthService {
 
  private userListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
    @InjectRepository(DemandEntity)
    private demandRepository: Repository<DemandEntity>,
    @InjectRepository(TravelEntity)
    private travelRepository: Repository<TravelEntity>,
    @InjectRepository(RequestEntity)
    private requestRepository: Repository<RequestEntity>,
    @InjectRepository(BookmarkEntity)
    private bookmarkRepository: Repository<BookmarkEntity>,
    @InjectRepository(ReviewEntity)
    private reviewRepository: Repository<ReviewEntity>,
    @InjectRepository(TransactionEntity)
    private transactionRepository: Repository<TransactionEntity>,
    private demandService: DemandService,
    private travelService: TravelService,
   
    private currencyService: CurrencyService,
    private jwtService: JwtService,
    private readonly userEventService: UserEventsService,
    private readonly roleService: RoleService,
    private userService: UserService,
    private fileUploadService: FileUploadService,
    private userAccountVerificationService: UserVerificationAuditService,
    private emailVerificationService: EmailVerificationService,
    private phoneVerificationService: PhoneVerificationService,
    private smsService: SmsService,
    private emailService: EmailService,
    private emailTemplatesService: EmailTemplatesService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    //bcrypt.hash('123456789',10).then(console.log) //this function allows you to generate the password for a user
  }

  async register(registerDto: RegisterDto) {
    //get the role of the role with code USER
    const userRole = await this.roleService.getUserRoleIdByCode('USER'); // secure default

    // Check for existing user by email or phone, including soft-deleted
    const existingEmailUser = await this.userService.findByField(
      'email',
      registerDto.email,
      true,
    );
    const existingPhoneUser = await this.userService.findByField(
      'phone',
      registerDto.phoneNumber,
      true,
    );

    // Check for soft-deleted email match → restore
    if (existingEmailUser?.deletedAt) {
      await this.userService.restoreUserAccount(existingEmailUser.id);
      // Optionally reset password, send welcome-back email, etc.
      return {
        user: existingEmailUser,
        message: 'Welcome back! Your account has been restored.',
      };
    }

    // Check for soft-deleted phone match → restore
    if (existingPhoneUser?.deletedAt) {
      await this.userService.restoreUserAccount(existingPhoneUser.id);
      return {
        user: existingPhoneUser,
        message: 'Welcome back! Your account has been restored.',
      };
    }

    // If either already exists and is NOT deleted → reject registration
    if (existingEmailUser || existingPhoneUser) {
      throw new CustomConflictException('Email or phone number is already in use. Please try a different one.', ErrorCode.AUTH_ACCOUNT_ALREADY_EXISTS);
    }

    const hashedPassword = await this.hashPassword(registerDto.password);
    const newlyCreatedUser = this.usersRepository.create({
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phoneNumber,
      password: hashedPassword,
      profilePictureUrl: 'https://res.cloudinary.com/dgdy4huuc/image/upload/v1760627196/gohappygo/profile-preview_sjwdus.png',
      roleId: userRole?.id,
      isEmailVerified: false,
      isPhoneVerified: false,
      isVerified: false,
    });

    const saveUser = await this.usersRepository.save(newlyCreatedUser);

    // Generate verification codes
    const emailVerificationCode = this.generate6DigitCode();

    // Record verification codes
    await this.emailVerificationService.recordEmailVerification(saveUser, emailVerificationCode.toString());

    // Send verification emails and SMS
    await this.sendEmailVerification(saveUser, emailVerificationCode.toString());

    const { password, ...result } = saveUser;
    //this.userEventService.emitUserRegistered(saveUser);

    return {
      user: result,
      message: 'Registration successful. Please verify your email and phone number to continue.',
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const user = await this.userService.findByField('email', verifyEmailDto.email);
    
    if (!user) {
      throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
    }

    const latestVerification = await this.emailVerificationService.getLatestValidEmailVerificationCode(user);
    
    if (!latestVerification) {
      throw new CustomBadRequestException('No valid email verification code found', ErrorCode.FAILED_TO_UPLOAD_FILES);
    }

    if (latestVerification.code !== verifyEmailDto.verificationCode) {
      throw new CustomBadRequestException('Invalid email verification code', ErrorCode.FAILED_TO_UPLOAD_FILES);
    }

    // Mark email as verified
    user.isEmailVerified = true;
    await this.userService.save(user);

    // Mark verification code as used
    await this.emailVerificationService.setValidatedDate(latestVerification);

    // Send welcome email
    //await this.emailService.sendWelcomeEmail(user.email, user.firstName);

    //emit email verified event
    this.userEventService.emitEmailVerified(user, verifyEmailDto.email);

    // Generate authentication tokens (auto-login)
    const tokens = this.generateToken(user);
    const { password, ...userWithoutPassword } = user;

    return {
      message: 'Email verified successfully',
      user: userWithoutPassword,
      ...tokens, // includes access_token and refresh_token
    };
  }

 
  /*async resendVerification(resendVerificationDto: ResendVerificationDto) {
    const user = await this.userService.findByField('email', resendVerificationDto.email);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (resendVerificationDto.type === VerificationType.EMAIL) {
      if (user.isEmailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      const emailVerificationCode = this.generate6DigitCode();
      await this.emailVerificationService.recordEmailVerification(user, emailVerificationCode.toString());
      await this.sendEmailVerification(user, emailVerificationCode.toString());

      return {
        message: 'Email verification code sent successfully',
      };
    } else if (resendVerificationDto.type === VerificationType.PHONE) {
      if (user.isPhoneVerified) {
        throw new BadRequestException('Phone number is already verified');
      }

      const phoneVerificationCode = this.generate6DigitCode();
      await this.phoneVerificationService.recordPhoneVerification(user, phoneVerificationCode.toString());
      await this.sendPhoneVerification(user, phoneVerificationCode.toString());

      return {
        message: 'Phone verification code sent successfully',
      };
    }

    throw new BadRequestException('Invalid verification type');
  }*/

   async resendEmailVerification(resendEmailVerificationDto: ResendEmailVerificationDto) {
        const user = await this.userService.findByField('email', resendEmailVerificationDto.email);
        if(!user){
            throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
        }
        const emailVerificationCode = this.generate6DigitCode();
        await this.emailVerificationService.recordEmailVerification(user, emailVerificationCode.toString());
        await this.sendEmailVerification(user, emailVerificationCode.toString());
        return {
            message: 'Email verification code sent successfully',
        };
    }

    async generatePhoneVerificationCode(user: UserEntity): Promise<{ code: string; expiresAt: Date }> {
    const { code, expiresAt } = await this.phoneVerificationService.recordPhoneVerificationCode(user);
    return { code, expiresAt };
  }

    async verifyPhone(user: UserEntity, code: string): Promise<boolean> {
    //get user
    const foundUser = await this.userService.getUserById(user.id);
    if(!foundUser){
      throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
    }
    //get verification code
    const verificationCode = await this.phoneVerificationService.getLatestValidPhoneVerificationCode(foundUser);
    if(!verificationCode){
      throw new CustomBadRequestException('No valid phone verification code found', ErrorCode.FAILED_TO_UPLOAD_FILES);
    }
    //verify code
    const isValid = await this.phoneVerificationService.verifyCode(code, foundUser);
    if(!isValid){
      throw new CustomBadRequestException('Invalid phone verification code', ErrorCode.FAILED_TO_UPLOAD_FILES);
    }
    //update user phone verified
    foundUser.isPhoneVerified = true;
    await this.userService.save(foundUser);
    //return true
    return true;
  }
 
    
// Update the uploadVerificationDocuments method:
// In src/auth/auth.service.ts
async uploadVerificationDocuments(
  files: Express.Multer.File[],
  uploadVerificationDto: UploadVerificationDto, // Now only contains notes
  user: UserEntity,
): Promise<UploadVerificationResponseDto> {
  // Validate number of files
  if (!files || files.length !== 3) {
    throw new CustomBadRequestException('Exactly 3 files are required: selfie, ID front, and ID back', ErrorCode.FAILED_TO_UPLOAD_FILES);
  }

  // Validate file types and sizes
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  for (const file of files) {
    // Check file size
    if (file.size > maxFileSize) {
      throw new CustomBadRequestException(`File ${file.originalname} is too large. Maximum size is 5MB`, ErrorCode.FAILED_TO_UPLOAD_FILES);
    }

    // Check file type
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new CustomBadRequestException(`File ${file.originalname} is not a valid image. Allowed types: JPEG, PNG, WebP`, ErrorCode.FAILED_TO_UPLOAD_FILES);
    }
  }

  const [selfie, idFront, idBack] = files;
  
  try {
    // Upload selfie
    const selfieFile = await this.fileUploadService.uploadFile(
      selfie, 
      FilePurpose.SELFIE, 
      user
    );

    // Upload ID front
    const idFrontFile = await this.fileUploadService.uploadFile(
      idFront, 
      FilePurpose.ID_FRONT, 
      user
    );

    // Upload ID back
    const idBackFile = await this.fileUploadService.uploadFile(
      idBack, 
      FilePurpose.ID_BACK, 
      user
    );

    // Update user's profile picture URL to the selfie image
    user.profilePictureUrl = selfieFile.fileUrl;
    await this.usersRepository.save(user);

    const response: UploadVerificationResponseDto = {
      message: 'Verification documents uploaded successfully',
      files: [
        this.mapToUploadedFileResponse(selfieFile),
        this.mapToUploadedFileResponse(idFrontFile),
        this.mapToUploadedFileResponse(idBackFile)
      ]
    };

    //emit user verification documents uploaded event
    this.userEventService.emitVerificationDocumentsUploaded(user, ['ID_FRONT', 'ID_BACK', 'SELFIE'], 3, uploadVerificationDto.notes);

    return response;
  } catch (error) {
    throw new CustomBadRequestException(`Failed to upload files: ${error.message}`, ErrorCode.FAILED_TO_UPLOAD_FILES);
  }
}

// Helper method to map file entities to response DTOs
private mapToUploadedFileResponse(fileEntity: any): UploadedFileResponseDto {
  return {
    id: fileEntity.id,
    originalName: fileEntity.originalName,
    url: fileEntity.url,
    purpose: fileEntity.purpose,
    uploadedAt: fileEntity.uploadedAt || fileEntity.createdAt
  };
}



 

  async verifyUserAccount(
    idUser: number,
    verifyUserAccountDto: VerifyUserAccountDto,
    admin: UserEntity,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: idUser },
    });
    if (!user) {
      throw new CustomNotFoundException(`User with id ${idUser} not found`, ErrorCode.USER_NOT_FOUND);
    }

    if (verifyUserAccountDto.approved) {
      // Approval logic
      user.isVerified = true;
      await this.userService.save(user);
    } else {
      // Rejection logic - your approach
      user.isVerified = false;
      await this.userService.save(user);
      
      // Delete verification files
      await this.deleteUserVerificationFiles(user.id);
    }

    // Emit event and record audit
    this.userEventService.emitVerificationStatusChanged(
      user, 
      verifyUserAccountDto.approved ? 'approved' : 'rejected', 
      verifyUserAccountDto.reason, 
      admin
    );

    await this.userAccountVerificationService.record(
      verifyUserAccountDto.approved,
      verifyUserAccountDto.reason,
      user,
      admin,
    );

    // Send email notification
    await this.sendVerificationStatusEmail(user, verifyUserAccountDto);

    return {
      message: `User verification ${verifyUserAccountDto.approved ? 'approved' : 'rejected'} successfully`,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified
      }
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersRepository.findOne({
      where: { email: loginDto.email },
      relations: ['role'],
    });
   console.log(user);
    if (
      !user)
     {
      throw new CustomUnauthorizedException(
        'Invalid credentials or account not exists',
        ErrorCode.AUTH_INVALID_CREDENTIALS_OR_ACCOUNT_NOT_EXISTS,
      );
    }
    //check password
    const isPasswordValid = await this.verifyPassword(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new CustomUnauthorizedException(
        'Invalid credentials or account not exists',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
      );
    }

    //generate
    const tokens = this.generateToken(user);
    const { password, ...result } = user;

    // Get recent currency (only for USER role)
    let recentCurrency: CurrencyResponseDto | null = null;
    if (user.role?.code === UserRole.USER) {
      const currencyData = await this.getMostRecentCurrencyForUser(user.id);
      if (currencyData) {
        // Fetch full currency entity to get all DTO fields
        const currency = await this.currencyService.findOne(currencyData.id);
        if (currency) {
          recentCurrency = {
            id: currency.id,
            name: currency.name,
            symbol: currency.symbol,
            code: currency.code
          };
        }
      }
    }

    // Get profile stats (only for USER role)
    let profileStats: ProfileStatsResponseDto;
    
    if (user.role?.code === UserRole.USER) {
      // Fetch all counts in parallel for maximum efficiency
      const [
        demandsCount,
        travelsCount,
        bookmarkStats,
        requestStatusCounts,
        reviewsReceivedCount,
        reviewsGivenCount,
        transactionsCompletedCount
      ] = await Promise.all([
        // Demands count
        this.demandRepository.count({ where: { userId: user.id } }),
        
        // Travels count
        this.travelRepository.count({ where: { userId: user.id } }),
        
        // Bookmark counts
        this.getBookmarkCounts(user.id),
        
        // Request status counts
        this.getRequestStatusCounts(user.id),
        
        // Reviews received (reviews where user is the reviewee)
        this.getReviewsReceivedCount(user.id),
        
        // Reviews given (reviews where user is the reviewer)
        this.getReviewsGivenCount(user.id),
        
        // Completed transactions
        this.getCompletedTransactionsCount(user.id)
      ]);

      profileStats = {
        demandsCount,
        travelsCount,
        bookMarkTravelCount: bookmarkStats.travelBookmarks,
        bookMarkDemandCount: bookmarkStats.demandBookmarks,
        requestsCompletedCount: requestStatusCounts.completed,
        requestsNegotiatingCount: requestStatusCounts.negotiating,
        requestsCancelledCount: requestStatusCounts.cancelled,
        requestsAcceptedCount: requestStatusCounts.accepted,
        requestsRejectedCount: requestStatusCounts.rejected,
        reviewsReceivedCount,
        reviewsGivenCount,
        transactionsCompletedCount
      };
    } else {
      // For non-USER roles (ADMIN, OPERATOR), return empty stats
      profileStats = {
        demandsCount: 0,
        travelsCount: 0,
        bookMarkTravelCount: 0,
        bookMarkDemandCount: 0,
        requestsCompletedCount: 0,
        requestsNegotiatingCount: 0,
        requestsCancelledCount: 0,
        requestsAcceptedCount: 0,
        requestsRejectedCount: 0,
        reviewsReceivedCount: 0,
        reviewsGivenCount: 0,
        transactionsCompletedCount: 0
      };
    }

    return {
      user: {
        ...result,
        recentCurrency,
        profileStats,
      },
      ...tokens,
    };
  }

  generateToken(user: UserEntity) {
    return {
      access_token: this.generateAccessToken(user),
      refresh_token: this.generateRefreshToken(user),
    };
  }

  generateAccessToken(user: UserEntity): string {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role.code,
      type: 'access' // Add token type for clarity
    };
    return this.jwtService.sign(payload, {
      secret: 'jwt_secret',
      expiresIn: '1440m',//24 hours
    });
  }

  // Find current user by ID
  async getUserById(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });
    if (!user) {
      throw new CustomNotFoundException('User not found!', ErrorCode.USER_NOT_FOUND);
    }
    const { password, ...result } = user;
    return result;
  }

  async getMostRecentCurrencyForUser(userId: number): Promise<{ id: number; code: string; country: string } | null> {
    // Find most recent demand and travel using services
    const demandResult = await this.demandService.getDemands({
      page: 1,
      limit: 1,
      userId,
      orderBy: 'createdAt:desc',
    } as any);
    const latestDemand: any = demandResult?.items?.[0];

    const travelResult = await this.travelService.getAllTravels({
      page: 1,
      limit: 1,
      userId,
      orderBy: 'createdAt:desc',
    } as any);
    const latestTravel: any = travelResult?.items?.[0];

    // Choose the most recent between the two
    let chosenCurrencyId: number | null = null;
    if (latestDemand && latestTravel) {
      chosenCurrencyId = (latestDemand.createdAt > latestTravel.createdAt)
        ? latestDemand.currencyId
        : latestTravel.currencyId;
    } else if (latestDemand) {
      chosenCurrencyId = latestDemand.currencyId;
    } else if (latestTravel) {
      chosenCurrencyId = latestTravel.currencyId;
    }

    if (!chosenCurrencyId) {
      const usd = await this.currencyService.findByCode('USD');
      return usd ? { id: usd.id, code: usd.code, country: usd.country } : null;
    }

    const currency = await this.currencyService.findOne(chosenCurrencyId);
    if (!currency) return null;

    return { id: currency.id, code: currency.code, country: currency.country };
  }

  async refreshToken(refreshToken: string) {
    try {
      // Verify the refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: 'refresh_secret',
      });

      // Check if it's actually a refresh token
      if (payload.type !== 'refresh') {
        throw new CustomUnauthorizedException('Invalid token type', ErrorCode.AUTH_INVALID_TOKEN_TYPE);
      }

      // Get user with role
      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
        relations: ['role'],
      });

      if (!user) {
        throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(user);
      
      return { 
        accessToken: newAccessToken,
        message: 'Token refreshed successfully'
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new CustomUnauthorizedException('Refresh token expired', ErrorCode.AUTH_TOKEN_EXPIRED);
      }
      throw new CustomUnauthorizedException('Invalid refresh token', ErrorCode.AUTH_INVALID_REFRESH_TOKEN);
    }
  }

  generateRefreshToken(user: UserEntity): string {
    const payload = {
      email: user.email,
      sub: user.id,
      type: 'refresh' // Add token type for clarity
    };
    return this.jwtService.sign(payload, {
      secret: 'refresh_secret', // Use different secret
      expiresIn: '7d',
    });
  }
  private async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private generate5DigitCode(): number {
    return Math.floor(10000 + Math.random() * 90000);
  }

  private async sendEmailVerification(user: UserEntity, code: string) {
    const emailTemplate = this.emailTemplatesService.getEmailVerificationTemplate(user.firstName, code);
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Email Verification - GoHappyGo',
      html: emailTemplate
    });
  }

  private async sendPhoneVerification(user: UserEntity, code: string) {
    await this.smsService.sendVerificationCode(user.phone, code);
  }

  private generate6DigitCode(): number {
    return Math.floor(100000 + Math.random() * 900000);
  }

  async getUserVerificationFiles(userId: number): Promise<any> {
  // Get user with verification files
  const user = await this.userService.getUserById(userId);
  
  if (!user) {
    throw new CustomNotFoundException(`User with ID ${userId} not found`, ErrorCode.USER_NOT_FOUND);
  }

  // Get verification files
  const verificationFiles = await this.fileUploadService.getUserVerificationFiles(userId);

  // Check if all required files are present
  const requiredPurposes = ['SELFIE', 'ID_FRONT', 'ID_BACK'];
  const missingFiles = requiredPurposes.filter(purpose => 
    !verificationFiles.some(file => file.purpose === purpose)
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isPhoneVerified: user.isPhoneVerified,
      isEmailVerified: user.isEmailVerified,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    },
    verificationFiles,
    missingFiles,
    isComplete: missingFiles.length === 0,
    canBeApproved: user.isPhoneVerified && missingFiles.length === 0
  };
}

// Add this new method to send verification status emails
private async sendVerificationStatusEmail(user: UserEntity, verificationData: VerifyUserAccountDto): Promise<void> {
  try {
    const emailTemplate = this.emailTemplatesService.getVerificationStatusTemplate(
      user.firstName,
      verificationData.approved,
      verificationData.reason
    );

    await this.emailService.sendEmail({
      to: user.email,
      subject: verificationData.approved 
        ? 'Account Verification Approved - GoHappyGo' 
        : 'Account Verification Update - GoHappyGo',
      html: emailTemplate
    });
  } catch (error) {
    // Assuming 'logger' is available from NestJS context or imported
    // For now, we'll just log the error
    console.error(`Failed to send verification status email to ${user.email}:`, error);
  }
}

// Add method to delete only verification files
private async deleteUserVerificationFiles(userId: number): Promise<void> {
  try {
    // Get only verification files (SELFIE, ID_FRONT, ID_BACK)
    const verificationFiles = await this.fileUploadService.getUserVerificationFiles(userId);
    
    console.log(`Found ${verificationFiles.length} verification files to delete for user ${userId}`);
    
    // Delete each verification file
    for (const file of verificationFiles) {
      try {
        await this.fileUploadService.remove(file.id);
        console.log(`Deleted verification file: ${file.originalName} (${file.purpose})`);
      } catch (fileError) {
        console.error(`Error deleting file ${file.id}:`, fileError);
        // Continue with other files even if one fails
      }
    }
    
    console.log(`Successfully deleted ${verificationFiles.length} verification files for user ${userId}`);
  } catch (error) {
    console.error(`Error in deleteUserVerificationFiles for user ${userId}:`, error);
    // Don't throw error to avoid breaking the verification process
  }
}

  async deleteAccount(user: UserEntity): Promise<{ message: string }> {
    // 1) Prevent deletion if the user is involved in active requests
    const blockedStatuses = ['ACCEPTED', 'NEGOCIATING'];
    const activeReqCount = await this.requestRepository
      .createQueryBuilder('r')
      .leftJoin('r.currentStatus', 'status')
      .leftJoin('r.travel', 'travel')
      .leftJoin('travel.user', 'travelUser')
      .leftJoin('r.demand', 'demand')
      .leftJoin('demand.user', 'demandUser')
      .where('r.requesterId = :uid OR travelUser.id = :uid OR demandUser.id = :uid', { uid: user.id })
      .andWhere('status.status IN (:...blocked)', { blocked: blockedStatuses })
      .getCount();

    if (activeReqCount > 0) {
      throw new CustomBadRequestException('Account cannot be deleted while a request is in ACCEPTED or NEGOCIATING status.', ErrorCode.REQUEST_IN_ACCEPTED_OR_NEGOCIATING_STATUS);
    }

    // 2) Soft delete future demands and travels (>= today)
    const now = new Date();

    const futureDemands = await this.demandRepository
      .createQueryBuilder('d')
      .where('d.userId = :uid', { uid: user.id })
      .andWhere('DATE(d.travelDate) >= DATE(:today)', { today: now })
      .getMany();
    for (const d of futureDemands) {
      await this.demandService.softDeleteDemandByUser(d.id);
    }

    const futureTravels = await this.travelRepository
      .createQueryBuilder('t')
      .where('t.userId = :uid', { uid: user.id })
      .andWhere('t.departureDatetime >= :now', { now })
      .getMany();
    for (const t of futureTravels) {
      await this.travelService.softDeleteTravel(t.id);
    }

    // 3) Soft delete the user (sets deleted_at)
    await this.usersRepository.softDelete(user.id);
    return { message: 'Account deleted successfully' };
  }

  /**
   * Get user profile with all stats using efficient COUNT queries
   * Only fetches profile stats if user role is USER (admins/operators don't need these stats)
   */
  async getUserProfileWithStats(userId: number): Promise<UserProfileResponseDto> {
    // Get user with role (minimal relations)
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user) {
      throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
    }

    // Get recent currency (only for USER role)
    let recentCurrency: CurrencyResponseDto | null = null;
    if (user.role?.code === UserRole.USER) {
      const currencyData = await this.getMostRecentCurrencyForUser(userId);
      if (currencyData) {
        // Fetch full currency entity to get all DTO fields
        const currency = await this.currencyService.findOne(currencyData.id);
        if (currency) {
          recentCurrency = {
            id: currency.id,
            name: currency.name,
            symbol: currency.symbol,
            code: currency.code
          };
        }
      }
    }

    // Only fetch profile stats if user is a regular USER
    // Admins and operators don't have these stats
    let profileStats: ProfileStatsResponseDto;
    
    if (user.role?.code === UserRole.USER) {
      // Fetch all counts in parallel for maximum efficiency
      const [
        demandsCount,
        travelsCount,
        bookmarkStats,
        requestStatusCounts,
        reviewsReceivedCount,
        reviewsGivenCount,
        transactionsCompletedCount
      ] = await Promise.all([
        // Demands count
        this.demandRepository.count({ where: { userId } }),
        
        // Travels count
        this.travelRepository.count({ where: { userId } }),
        
        // Bookmark counts
        this.getBookmarkCounts(userId),
        
        // Request status counts
        this.getRequestStatusCounts(userId),
        
        // Reviews received (reviews where user is the reviewee)
        this.getReviewsReceivedCount(userId),
        
        // Reviews given (reviews where user is the reviewer)
        this.getReviewsGivenCount(userId),
        
        // Completed transactions
        this.getCompletedTransactionsCount(userId)
      ]);

      profileStats = {
        demandsCount,
        travelsCount,
        bookMarkTravelCount: bookmarkStats.travelBookmarks,
        bookMarkDemandCount: bookmarkStats.demandBookmarks,
        requestsCompletedCount: requestStatusCounts.completed,
        requestsNegotiatingCount: requestStatusCounts.negotiating,
        requestsCancelledCount: requestStatusCounts.cancelled,
        requestsAcceptedCount: requestStatusCounts.accepted,
        requestsRejectedCount: requestStatusCounts.rejected,
        reviewsReceivedCount,
        reviewsGivenCount,
        transactionsCompletedCount
      };
    } else {
      // For non-USER roles (ADMIN, OPERATOR), return empty stats
      // They don't have demands, travels, requests, etc.
      profileStats = {
        demandsCount: 0,
        travelsCount: 0,
        bookMarkTravelCount: 0,
        bookMarkDemandCount: 0,
        requestsCompletedCount: 0,
        requestsNegotiatingCount: 0,
        requestsCancelledCount: 0,
        requestsAcceptedCount: 0,
        requestsRejectedCount: 0,
        reviewsReceivedCount: 0,
        reviewsGivenCount: 0,
        transactionsCompletedCount: 0
      };
    }

    // Check if user is awaiting verification (only for USER role)
    const isAwaitingVerification = user.role?.code === UserRole.USER && 
      !user.isVerified && 
      await this.hasVerificationFiles(userId);

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      profilePictureUrl: user.profilePictureUrl,
      bio: user.bio,
      role: user.role,
      isPhoneVerified: user.isPhoneVerified,
      isVerified: user.isVerified,
      isAwaitingVerification,
      recentCurrency,
      createdAt: user.createdAt,
      profileStats
    };
  }

  // Helper methods for counts (only called for USER role)
  private async getBookmarkCounts(userId: number): Promise<{ travelBookmarks: number; demandBookmarks: number }> {
    const [travelBookmarks, demandBookmarks] = await Promise.all([
      this.bookmarkRepository.count({
        where: { userId, bookmarkType: BookmarkType.TRAVEL }
      }),
      this.bookmarkRepository.count({
        where: { userId, bookmarkType: BookmarkType.DEMAND }
      })
    ]);
    return { travelBookmarks, demandBookmarks };
  }

  private async getRequestStatusCounts(userId: number): Promise<{
    completed: number;
    negotiating: number;
    cancelled: number;
    accepted: number;
    rejected: number;
  }> {
    // Get all requests for the user (as requester or linked to their travels/demands)
    const requests = await this.requestRepository.find({
      where: [
        { requesterId: userId },
        { travel: { userId } },
        { demand: { userId } }
      ],
      relations: ['currentStatus']
    });

    // Count by status
    const counts = {
      completed: 0,
      negotiating: 0,
      cancelled: 0,
      accepted: 0,
      rejected: 0
    };

    requests.forEach(request => {
      const status = request.currentStatus?.status;
      if (status === 'COMPLETED') counts.completed++;
      else if (status === 'NEGOTIATING') counts.negotiating++;
      else if (status === 'CANCELLED') counts.cancelled++;
      else if (status === 'ACCEPTED') counts.accepted++;
      else if (status === 'REJECTED') counts.rejected++;
    });

    return counts;
  }

  private async getReviewsReceivedCount(userId: number): Promise<number> {
    return this.reviewRepository.count({
      where: { revieweeId: userId }
    });
  }

  private async getReviewsGivenCount(userId: number): Promise<number> {
    return this.reviewRepository.count({
      where: { reviewerId: userId }
    });
  }

  private async getCompletedTransactionsCount(userId: number): Promise<number> {
    return this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.status = :status', { status: 'paid' })
      .andWhere('(transaction.payerId = :userId OR transaction.payeeId = :userId)', { userId })
      .getCount();
  }

  private async hasVerificationFiles(userId: number): Promise<boolean> {
    const files = await this.fileUploadService.getUserVerificationFiles(userId);
    return files.length >= 3; // SELFIE, ID_FRONT, ID_BACK
  }
}
