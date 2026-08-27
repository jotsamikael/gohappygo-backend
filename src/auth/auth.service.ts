import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { RegisterDto } from './dto/register.dto';
import { RegisterWithEmailDto } from './dto/register-with-email.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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
import { StripeService } from 'src/stripe/stripe.service';
import { Logger } from '@nestjs/common';
import { CommonService } from 'src/common/service/common.service';
import { MessageService } from 'src/message/message.service';
import { PasswordResetService } from 'src/password-reset/password-reset.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { FirebaseAuthService } from 'src/firebase/firebase-auth.service';
import { CompleteSocialRegistrationDto } from './dto/complete-social-registration.dto';
import { ConfigService } from '@nestjs/config';
import { AccountDeletionService } from 'src/account-deletion/account-deletion.service';
import { DeleteAccountOptions, DeletionResult } from 'src/account-deletion/account-deletion.types';

@Injectable()
export class AuthService {
 
  private userListCacheKeys: Set<string> = new Set();
  private readonly logger = new Logger(AuthService.name);

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
    private passwordResetService: PasswordResetService,
    private smsService: SmsService,
    private emailService: EmailService,
    private emailTemplatesService: EmailTemplatesService,
    private stripeService: StripeService,
    private commonService: CommonService,
    private messageService: MessageService,
    private firebaseAuthService: FirebaseAuthService,
    private configService: ConfigService,
    private accountDeletionService: AccountDeletionService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    //bcrypt.hash('123456789',10).then(console.log) //this function allows you to generate the password for a user
  }

  /**
   * Strip firstName/lastName from objects returned to API clients; add computed fullName.
   */
  private buildPublicUser(rest: Record<string, any>, extras?: Record<string, any>): Record<string, any> {
    const { firstName, lastName, ...safe } = rest;
    const fullName = this.commonService.userFullName({
      username: safe.username,
      firstName,
      lastName,
    });
    return extras ? { ...safe, fullName, ...extras } : { ...safe, fullName };
  }

  /** Display handle persisted as `username`: "Firstname L." (aligned with DB backfill / list APIs). */
  private displayUsernameFromNames(firstName?: string | null, lastName?: string | null): string | undefined {
    const fn = (firstName ?? '').trim();
    const ln = (lastName ?? '').trim();
    if (!fn && !ln) {
      return undefined;
    }
    let value = (this.commonService.formatFullName(fn, ln) || '').trim();
    if (!value && ln) {
      value = `${ln.charAt(0).toUpperCase()}.`;
    }
    return value || undefined;
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

    // If either already exists and is NOT deleted → reject registration
    if (existingEmailUser || existingPhoneUser) {
      throw new CustomConflictException('Email or phone number is already in use. Please try a different one.', ErrorCode.AUTH_ACCOUNT_ALREADY_EXISTS);
    }

    const hashedPassword = await this.hashPassword(registerDto.password);
    const newlyCreatedUser = this.usersRepository.create({
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      username: this.displayUsernameFromNames(registerDto.firstName, registerDto.lastName),
      phone: registerDto.phoneNumber,
      password: hashedPassword,
      bio: 'I am a Happy traveler',
      profilePictureUrl: 'https://res.cloudinary.com/dgdy4huuc/image/upload/v1760627196/gohappygo/profile-preview_sjwdus.png',
      roleId: userRole?.id,
      isEmailVerified: false,
      isPhoneVerified: false,
      isVerified: false, //set for test purposes while awaiting KYC implementation
      stripeCountryCode: registerDto.countryCode, // Store country code for Stripe Connect
    });

    const saveUser = await this.usersRepository.save(newlyCreatedUser);

    // Create deferred Stripe Connect account (non-blocking - don't fail registration if this fails)
    // This allows users to receive payments immediately after registration
    // They must complete KYC via onboarding-link to withdraw funds
    try {
      await this.stripeService.createConnectAccount(saveUser, registerDto.countryCode, '127.0.0.1'); // IP will be updated when we have request context
      this.logger.log(`Stripe Connect account created for user ${saveUser.id} in country ${registerDto.countryCode}`);
    } catch (error) {
      // Log error but don't fail registration
      // User can create account later via onboarding-link endpoint
      this.logger.error(`Failed to create Stripe account during registration for user ${saveUser.id}: ${error.message}`, error.stack);
    }

    // Generate verification codes
    const emailVerificationCode = this.generate6DigitCode();

    // Record verification codes
    await this.emailVerificationService.recordEmailVerification(saveUser, emailVerificationCode.toString());

    // Send verification emails and SMS
    await this.sendEmailVerification(saveUser, emailVerificationCode.toString());

    const { password, ...result } = saveUser;
    //this.userEventService.emitUserRegistered(saveUser);

    return {
      user: this.buildPublicUser(result as any),
      message: 'Registration successful. Please verify your email and phone number to continue.',
    };
  }

  /**
   * Register with email only (unified two-step flow).
   * Creates user with placeholder phone, no Stripe account.
   * Returns JWT + needsRegistrationCompletion: true.
   * User completes profile via POST /auth/complete-registration.
   */
  async registerWithEmail(dto: RegisterWithEmailDto) {
    const userRole = await this.roleService.getUserRoleIdByCode('USER');

    const existingEmailUser = await this.userService.findByField('email', dto.email, true);
    if (existingEmailUser) {
      throw new CustomConflictException('Email is already in use.', ErrorCode.AUTH_ACCOUNT_ALREADY_EXISTS);
    }

    const hashedPassword = await this.hashPassword(dto.password);
    const placeholderPhone = `email_${crypto.randomUUID()}`;
    const newUser = this.usersRepository.create({
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName ?? '',
      username: this.displayUsernameFromNames(dto.firstName, dto.lastName),
      phone: placeholderPhone,
      password: hashedPassword,
      bio: 'I am a Happy traveler',
      profilePictureUrl: 'https://res.cloudinary.com/dgdy4huuc/image/upload/v1760627196/gohappygo/profile-preview_sjwdus.png',
      roleId: userRole?.id ?? 1,
      isEmailVerified: false,
      isPhoneVerified: false,
      isVerified: false,
      stripeCountryCode: undefined,
    });

    const savedUser = await this.usersRepository.save(newUser) as UserEntity;

    // Send email verification (non-blocking for unified flow)
    const emailVerificationCode = this.generate6DigitCode();
    await this.emailVerificationService.recordEmailVerification(savedUser, emailVerificationCode.toString());
    await this.sendEmailVerification(savedUser, emailVerificationCode.toString());

    const userWithRole = await this.usersRepository.findOne({
      where: { id: savedUser.id },
      relations: ['role'],
    });
    if (!userWithRole) {
      throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
    }

    const tokens = this.generateToken(userWithRole);
    const { password, ...result } = userWithRole;

    let recentCurrency: CurrencyResponseDto | null = null;
    if (userWithRole.role?.code === UserRole.USER) {
      const currencyData = await this.getMostRecentCurrencyForUser(userWithRole.id);
      if (currencyData) {
        const currency = await this.currencyService.findOne(currencyData.id);
        if (currency) {
          recentCurrency = { id: currency.id, publicId: currency.publicId, name: currency.name, symbol: currency.symbol, code: currency.code };
        }
      }
    }

    const profileStats: ProfileStatsResponseDto = {
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
      transactionsCompletedCount: 0,
      unreadMessageCount: 0,
    };

    const needsRegistrationCompletion = !userWithRole.stripeAccountId;

    return {
      user: this.buildPublicUser(result as any, { recentCurrency, profileStats }),
      ...tokens,
      needsRegistrationCompletion,
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const user = await this.userService.findByField('email', verifyEmailDto.email);
    
    if (!user) {
      throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
    }

    const latestVerification = await this.emailVerificationService.getLatestValidEmailVerificationCode(user);
    
    if (!latestVerification) {
      throw new CustomBadRequestException('No valid email verification code found', ErrorCode.AUTH_INVALID_VERIFICATION_CODE);
    }

    if (latestVerification.code !== verifyEmailDto.verificationCode) {
      throw new CustomBadRequestException('Invalid email verification code', ErrorCode.AUTH_INVALID_EMAIL_VERIFICATION_CODE);
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
      user: this.buildPublicUser(userWithoutPassword as any),
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
    publicId: fileEntity.publicId,
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
      await this.fileUploadService.deleteUserVerificationFiles(user.id);
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
        fullName: this.commonService.userFullName(user),
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
            publicId: currency.publicId,
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
        
        // Travels count (exclude cancelled)
        this.travelRepository.count({ where: { userId: user.id, status: Not('cancelled') } }),
        
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
        transactionsCompletedCount,
        unreadMessageCount: await this.messageService.getUnreadCount(user)
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
        transactionsCompletedCount: 0,
        unreadMessageCount: 0,
      };
    }

    return {
      user: this.buildPublicUser(result as any, { recentCurrency, profileStats }),
      ...tokens,
    };
  }

  /**
   * Social sign-in (Google/Facebook) - both use Firebase idToken
   */
  async socialSignIn(idToken: string) {
    const firebaseUser = await this.firebaseAuthService.verifyIdToken(idToken);
    const user = await this.firebaseAuthService.createOrUpdateUser(firebaseUser);

    // Reload user with role for full response
    const userWithRole = await this.usersRepository.findOne({
      where: { id: user.id },
      relations: ['role'],
    });
    if (!userWithRole) {
      throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
    }

    const tokens = this.generateToken(userWithRole);
    const { password, ...result } = userWithRole;

    // Get recent currency (only for USER role)
    let recentCurrency: CurrencyResponseDto | null = null;
    if (userWithRole.role?.code === UserRole.USER) {
      const currencyData = await this.getMostRecentCurrencyForUser(userWithRole.id);
      if (currencyData) {
        const currency = await this.currencyService.findOne(currencyData.id);
        if (currency) {
          recentCurrency = {
            id: currency.id,
            publicId: currency.publicId,
            name: currency.name,
            symbol: currency.symbol,
            code: currency.code,
          };
        }
      }
    }

    // Get profile stats (only for USER role)
    let profileStats: ProfileStatsResponseDto;
    if (userWithRole.role?.code === UserRole.USER) {
      const [
        demandsCount,
        travelsCount,
        bookmarkStats,
        requestStatusCounts,
        reviewsReceivedCount,
        reviewsGivenCount,
        transactionsCompletedCount,
      ] = await Promise.all([
        this.demandRepository.count({ where: { userId: userWithRole.id } }),
        this.travelRepository.count({ where: { userId: userWithRole.id } }),
        this.getBookmarkCounts(userWithRole.id),
        this.getRequestStatusCounts(userWithRole.id),
        this.getReviewsReceivedCount(userWithRole.id),
        this.getReviewsGivenCount(userWithRole.id),
        this.getCompletedTransactionsCount(userWithRole.id),
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
        transactionsCompletedCount,
        unreadMessageCount: await this.messageService.getUnreadCount(userWithRole),
      };
    } else {
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
        transactionsCompletedCount: 0,
        unreadMessageCount: 0,
      };
    }

    const needsRegistrationCompletion = !userWithRole.stripeAccountId;

    return {
      user: this.buildPublicUser(result as any, { recentCurrency, profileStats }),
      ...tokens,
      needsRegistrationCompletion,
    };
  }

  /**
   * Complete registration - collect country and phone, create Stripe Connect account.
   * Works for any user without a Stripe account (email, Google, or Facebook registration).
   */
  async completeRegistration(user: UserEntity, dto: CompleteSocialRegistrationDto, ipAddress: string = '127.0.0.1') {
    if (user.stripeAccountId) {
      throw new CustomBadRequestException('Registration already completed', ErrorCode.AUTH_ACCOUNT_ALREADY_EXISTS);
    }

    // Check phone not already used by another user (exclude placeholder phones)
    const existingByPhone = await this.usersRepository.findOne({
      where: { phone: dto.phoneNumber },
    });
    if (existingByPhone && existingByPhone.id !== user.id) {
      throw new CustomConflictException('Phone number already in use', ErrorCode.AUTH_ACCOUNT_ALREADY_EXISTS);
    }

    // Update user
    user.phone = dto.phoneNumber;
    user.stripeCountryCode = dto.countryCode;
    await this.usersRepository.save(user);

    // Create Stripe Connect account
    await this.stripeService.createConnectAccount(user, dto.countryCode, ipAddress);

    // Reload user with Stripe account ID
    const updatedUser = await this.usersRepository.findOne({
      where: { id: user.id },
      relations: ['role'],
    });
    if (!updatedUser) {
      throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
    }

    const tokens = this.generateToken(updatedUser);
    const { password, ...result } = updatedUser;

    const needsRegistrationCompletion = false;

    return {
      message: 'Profile completed successfully',
      user: this.buildPublicUser(result as any),
      ...tokens,
      needsRegistrationCompletion,
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
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES', '15m'),
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
    return this.buildPublicUser(result as any);
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
        access_token: newAccessToken,
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
      expiresIn: '15d',
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
      publicId: user.publicId,
      email: user.email,
      fullName: this.commonService.userFullName(user),
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

  async deleteAccount(user: UserEntity, options: DeleteAccountOptions = {}): Promise<DeletionResult> {
    return this.accountDeletionService.anonymizeAndCloseAccount(user, options);
  }

  /**
   * Get user profile with all stats using efficient COUNT queries
   * Only fetches profile stats if user role is USER (admins/operators don't need these stats)
   */
  async getUserProfileWithStats(
    userId: number,
    isViewingOtherUser: boolean,
    requester: UserEntity | null,
  ): Promise<UserProfileResponseDto> {
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
            publicId: currency.publicId,
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
        
        // Travels count (exclude cancelled)
        this.travelRepository.count({ where: { userId, status: Not('cancelled') } }),
        
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
        transactionsCompletedCount,
        unreadMessageCount: await this.messageService.getUnreadCount(user)
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
        transactionsCompletedCount: 0,
        unreadMessageCount: 0
      };
    }

    // Check if user is awaiting verification (only for USER role)
    const isAwaitingVerification = user.role?.code === UserRole.USER && 
      !user.isVerified && 
      await this.hasVerificationFiles(userId);

    // Format fullName - prefer persisted username
    const fullName = this.commonService.userFullName(user);

    // Get unread message count (for all users, not just USER role)
    const unreadMessageCount = await this.messageService.getUnreadCount(user);

    // Add unreadMessageCount to profileStats
    profileStats.unreadMessageCount = unreadMessageCount;

    // Get Stripe available balance
    let stripeAvailableBalance: string | null = null;
    if (user.stripeAccountId) {
      try {
        const balance = await this.stripeService.getAccountBalance(user.stripeAccountId);
        // Convert from cents to dollars (Stripe returns amounts in cents)
        const amount = balance.available[0]?.amount ? balance.available[0].amount / 100 : 0;
        // Get currency (Stripe returns lowercase like 'eur', 'usd') and convert to uppercase
        const currency = balance.available[0]?.currency?.toUpperCase() || 'USD';
        // Format amount with 2 decimal places
        stripeAvailableBalance = `${amount.toFixed(2)} ${currency}`;
      } catch (error) {
        this.logger.warn(`Failed to retrieve Stripe balance for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
        // Set to null on error - balance retrieval failure shouldn't break the endpoint
        stripeAvailableBalance = null;
      }
    }

    const needsRegistrationCompletion = !user.stripeAccountId;

    const isOwnProfile =
      requester !== null && !isViewingOtherUser && requester.id === user.id;

    // Visitors and USER role: when viewing someone else's profile, hide email/phone but still show display name + bio.
    const requesterIsVisitorOrUser =
      requester === null || requester.role?.code === UserRole.USER;
    const hideEmailAndPhone = isViewingOtherUser && requesterIsVisitorOrUser;

    return {
      id: user.id,
      publicId: user.publicId,
      email: hideEmailAndPhone ? null : user.email,
      fullName,
      ...(isOwnProfile
        ? {
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
          }
        : {}),
      phone: hideEmailAndPhone ? null : user.phone,
      profilePictureUrl: user.profilePictureUrl || null,
      bio: user.bio || null,
      isPhoneVerified: user.isPhoneVerified,
      isEmailVerified: user.isEmailVerified,
      isVerified: user.isVerified,
      isAwaitingVerification,
      recentCurrency,
      createdAt: user.createdAt,
      profileStats,
      stripeAccountId: user.stripeAccountId || null,
      stripeAccountStatus: user.stripeAccountStatus || 'uninitiated',
      stripeCountryCode: user.stripeCountryCode || null,
      stripeAvailableBalance,
      needsRegistrationCompletion,
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

  /**
   * Get Stripe requirements for the current user
   * Returns null if there are no requirements or if user doesn't have a Stripe account
   */
  async getStripeRequirements(userId: number): Promise<{
    hasRequirements: boolean;
    currentlyDue: string[];
    pastDue: string[];
    eventuallyDue: string[];
  } | null> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new CustomNotFoundException('User not found', ErrorCode.USER_NOT_FOUND);
    }

    if (!user.stripeAccountId) {
      return null;
    }

    try {
      return await this.stripeService.getAccountRequirements(user.stripeAccountId);
    } catch (error) {
      this.logger.warn(`Failed to retrieve Stripe requirements for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }


  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    // Find user by email (don't reveal if email exists for security)
    const user = await this.userService.findByField('email', forgotPasswordDto.email);
    
    // If user exists, process password reset
    if (user) {
      // Generate 6-digit reset code
      const resetCode = this.generate6DigitCode().toString();
      
      // Invalidate previous reset codes for this user
      await this.passwordResetService.invalidatePreviousCodes(user.id);
      
      // Save new reset code with expiration (10 minutes)
      await this.passwordResetService.recordPasswordReset(user, resetCode);
      
      // Send password reset email with full reset link
      await this.sendPasswordResetEmail(user, resetCode);
    }
    
    // Always return success message (don't reveal if email exists)
    return {
      message: 'If the email exists, a password reset link has been sent to your email address.',
    };
  }

  async resetPassword(code: string, resetPasswordDto: ResetPasswordDto) {
    // Find reset code (getResetCodeByCode already filters: not expired, not used)
    const reset = await this.passwordResetService.getResetCodeByCode(code);
    
    if (!reset) {
      throw new CustomBadRequestException(
        'Invalid, expired, or already used reset code',
        ErrorCode.AUTH_INVALID_CREDENTIALS,
      );
    }
    
    // Get user from reset record
    const user = reset.user;
    if (!user) {
      throw new CustomNotFoundException(
        'User not found',
        ErrorCode.USER_NOT_FOUND,
      );
    }
    
    // Hash new password
    const hashedPassword = await this.hashPassword(resetPasswordDto.password);
    
    // Update user password
    user.password = hashedPassword;
    await this.userService.save(user);
    
    // Mark reset code as used
    await this.passwordResetService.markAsUsed(reset);
    
    this.logger.log(`Password reset successful for user ${user.id} (${user.email})`);
    
    return {
      message: 'Password has been reset successfully',
    };
  }
  private async sendPasswordResetEmail(user: UserEntity, resetCode: string) {
    const emailTemplate = this.emailTemplatesService.getPasswordResetTemplate(user.firstName, resetCode);
    await this.emailService.sendEmail({
      to: user.email,
      subject: 'Password Reset - GoHappyGo',
      html: emailTemplate
    });
  }
}
