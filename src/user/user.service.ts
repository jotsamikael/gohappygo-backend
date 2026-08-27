import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { FindOptionsWhere, In, Repository, UpdateResult } from 'typeorm';
import { CreateUserDto } from './dto/request/createUser.dto';
import { RoleService } from 'src/role/role.service';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from './dto/request/updateUser.dto';
import { ChangePasswordDto } from './dto/request/changePassword.dto';
import { UpdatePhoneDto } from './dto/request/UpdatePhone.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FindUsersQueryDto } from 'src/auth/dto/FindUsersQuery.dto';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { UserResponseDto } from './dto/user-response.dto';
import { UserListItemResponseDto } from './dto/user-list-item-response.dto';
import { UserMapper } from './user.mapper';
import { UpdateProfileDto } from './dto/request/update-profile.dto';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { FilePurpose } from 'src/uploaded-file/uploaded-file-purpose.enum';
import { CommonService } from 'src/common/service/common.service';
import { CustomBadRequestException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';

@Injectable()
export class UserService implements OnModuleInit {

  private userListCacheKeys: Set<string> = new Set();

  //injecting service from another module
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private roleService: RoleService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private fileUploadService: FileUploadService,
    private commonService: CommonService,
    private userMapper: UserMapper,
  ) { }

  async onModuleInit() {
    await this.seedAdminUser();
    await this.seedOperatorUser();
  }


  async getAllUsers(query: FindUsersQueryDto): Promise<PaginatedResponse<UserListItemResponseDto>> {
    const { page = 1, limit = 10, ...filters } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role');

    if (filters.email) {
      queryBuilder.andWhere('LOWER(user.email) LIKE LOWER(:email)', { email: `%${filters.email}%` });
    }

    if (filters.phone) {
      queryBuilder.andWhere('LOWER(user.phone) LIKE LOWER(:phone)', { phone: `%${filters.phone}%` });
    }

    if (filters.roleCode) {
      queryBuilder.andWhere('UPPER(role.code) = UPPER(:roleCode)', {
        roleCode: filters.roleCode,
      });
    }

    if (filters.isVerified !== undefined) {
      queryBuilder.andWhere('user.isVerified = :isVerified', { isVerified: filters.isVerified });
    }

    if (filters.isStripeVerified !== undefined) {
      if (filters.isStripeVerified) {
        queryBuilder.andWhere('user.stripeAccountStatus IN (:...stripeVerifiedStatuses)', {
          stripeVerifiedStatuses: ['active', 'restricted'],
        });
      } else {
        queryBuilder.andWhere(
          '(user.stripeAccountStatus IN (:...stripeUnverifiedStatuses) OR user.stripeAccountStatus IS NULL)',
          { stripeUnverifiedStatuses: ['uninitiated', 'pending'] },
        );
      }
    }

    if (filters.createdDate) {
      const dateString = new Date(filters.createdDate).toISOString().split('T')[0];
      queryBuilder.andWhere('DATE(user.created_at) = :dateString', { dateString });
    }

    // Apply sorting
    let sortField = 'createdAt';
    let sortDirection = 'desc';
    const validSortFields = ['createdAt'];
    const validSortDirections = ['asc', 'desc'];

    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`user.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy('user.createdAt', 'DESC'); // default
    }

    // Get total count
    const totalItems = await queryBuilder.getCount();
    console.log('🔍 Total items found:', totalItems);

    // Apply pagination
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const users = await queryBuilder.getMany();
    console.log(' Users retrieved:', users.length);

    // Debug: Log user details
    users.forEach((user, index) => {
      console.log(` User ${index + 1}:`, {
        id: user.id,
        email: user.email,
        isVerified: user.isVerified,
        isPhoneVerified: user.isPhoneVerified,
        filesCount: user.files?.length || 0
      });
    });

    // Map to response DTOs with isAwaitingVerification field
    const userResponses = await Promise.all(
      users.map(async (user) =>
        this.userMapper.toUserListItemDto(
          user,
          await this.checkIfUserIsAwaitingVerification(user),
        ),
      ),
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      items: userResponses,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage,
        hasPreviousPage
      }
    };
  }



   async getUserByPhone(phone: string): Promise<UserEntity | null> {
    const user = await this.userRepository.findOne({ where:{phone}, relations: ['role'] });
    if (!user) {
      throw new NotFoundException(`User with phone ${phone} not found`);
    }
    return user;
  }

  
  async getUserById(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findOne({ where: { id }, relations: ['role'] });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} was not found`);
    }
    return user;
  }

  async createUser(createUserDto: CreateUserDto, user: UserEntity) {
    const role = await this.roleService.getUserRoleIdByCode('USER');

    const hashedPassword = await this.hashPassword('123456');

    const newUser = this.userRepository.create({
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: createUserDto.email,
      phone: createUserDto.phoneNumber,
      roleId: createUserDto.roleId,
      password: hashedPassword,
      isDeactivated: false,
      createdBy: user.id
    });
    const saveUser = await this.userRepository.save(newUser);
    const { password, ...result } = saveUser;
    return {
      user: result,
      message: 'Admin created successfully, login to continue',
    };
  }

  async findByField(
    field: string,
    value: string,
    includeDeleted = true,
  ): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: {
        [field]: value,
      },
      relations: ['role'],
      withDeleted: includeDeleted,
    });
  }

  async findByStripeAccountId(stripeAccountId: string): Promise<UserEntity | null> {
    return this.userRepository.findOne({
      where: {
        stripeAccountId,
      },
      relations: ['role'],
    });
  }

/**
 * Toggle staff member activation status
 * @param id - The ID of the staff member
 * @param isDeactivated - The desired activation status
 * @param user - The user making the request
 * @returns The updated staff member
 */
async toggleStaffActivation(
  id: number, 
  isDeactivated: boolean, 
  user: UserEntity
): Promise<UserResponseDto> {
  const currentUser = await this.getUserById(id);
  
  // Prevent self-deactivation
  if (currentUser.id === user.id) {
    throw new BadRequestException('You cannot deactivate your own account');
  }
  
  currentUser.isDeactivated = isDeactivated;
  currentUser.updatedBy = user.id;
  
  const updatedUser = await this.userRepository.save(currentUser);
  
  // Clear cache after update
  await this.clearUserListCache();
  
  // Return the mapped DTO instead of raw entity
  return this.mapToUserResponseDto(updatedUser);
}

// Add this mapping method if it doesn't exist
private async mapToUserResponseDto(user: UserEntity): Promise<UserResponseDto> {
  // Check if user is awaiting verification
  const isAwaitingVerification = await this.checkIfUserIsAwaitingVerification(user);

  return {
    id: user.id,
    publicId: user.publicId,
    email: user.email,
    phone: user.phone,
    username: user.username,
    fullName: this.commonService.userFullName(user),
    profilePictureUrl: user.profilePictureUrl,
    bio: user.bio, // Add this line
    isDeactivated: user.isDeactivated,
    role: {
      id: user.role.id,
      name: user.role.name,
      code: user.role.code,
      description: user.role.description,
    },
    isPhoneVerified: user.isPhoneVerified,
    isVerified: user.isVerified,
    isAwaitingVerification: isAwaitingVerification,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    rating: user.rating,
    numberOfReviews: user.numberOfReviews
  };
}

private async checkIfUserIsAwaitingVerification(user: UserEntity): Promise<boolean> {
  // User must have phone verified but not be fully verified
  if (user.isPhoneVerified && !user.isVerified) {
    // Check if they have uploaded verification files
    const verificationFiles = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.files', 'files')
      .where('user.id = :userId', { userId: user.id })
      .andWhere('files.purpose IN (:...purposes)', {
        purposes: ['SELFIE', 'ID_FRONT', 'ID_BACK']
      })
      .getOne();

    return !!verificationFiles?.files?.length;
  }

  return false;
}

  /**
   * Update staff member details
   * @param id - The ID of the staff member to update
   * @param updateUserDto - The data to update the staff member with
   * @param user - The user making the request
   * @returns The updated staff member
   */
  async updateStaff(
    id: number,
    updateUserDto: UpdateUserDto,
    user: UserEntity
  ): Promise<UserEntity> {
    const currentUser = await this.getUserById(id);

    //Check uniqueness if email is changing
    if (
      updateUserDto.email &&
      updateUserDto.email !== currentUser.email
    ) {
      const emailExists = await this.userRepository.findOne({
        where: { email: updateUserDto.email },
      });
      if (emailExists) {
        throw new ConflictException('Email already in use');
      }
      currentUser.email = updateUserDto.email;
    }


    if (updateUserDto.firstName) {
      currentUser.firstName = updateUserDto.firstName;
    }

    if (updateUserDto.lastName) {
      currentUser.lastName = updateUserDto.lastName;
    }

    // update role
    if (typeof updateUserDto.roleId === 'number') {
      currentUser.roleId = updateUserDto.roleId;
      currentUser.role = await this.roleService.getUserRoleById(updateUserDto.roleId);
    }


    currentUser.updatedBy = user.id;
    const updatedUser = await this.userRepository.save(currentUser);

    // Clear the cache after updating
    await this.clearUserListCache();

    // Optionally emit updated event
    // this.userEventService.emitUserUpdated(updatedUser);

    return updatedUser;
  }

/**
 * Set user phone verified
 * @param user - The user to set to phone verified
 * @returns The user with phone verified set to true
 */
  async setToUserPhoneVerified(user: UserEntity) {
    user.isPhoneVerified = true;
    await this.userRepository.save(user);

  }
/**
 * Update password
 * @param id 
 * @param changePasswordDto 
 * @returns 
 */
async updatePassword(id: number, changePasswordDto: ChangePasswordDto) {
  // Get current user
  const currentUser = await this.getUserById(id);
  
  // Verify current password matches
  if (!await this.verifyPassword(changePasswordDto.currentPassword, currentUser.password)) {
    throw new BadRequestException('Current password is incorrect');
  }
  
  // Check if new password is the same as current password
  if (await this.verifyPassword(changePasswordDto.newPassword, currentUser.password)) {
    throw new BadRequestException('New password must be different from current password');
  }
  
  // Hash newly defined user password
  const hashedNewPassword = await this.hashPassword(changePasswordDto.newPassword);
  currentUser.password = hashedNewPassword;
  currentUser.updatedBy = id; // Track who updated
  await this.userRepository.save(currentUser);

  // Remove password from response
  const { password, ...userWithoutPassword } = currentUser;

  return {
    user: userWithoutPassword,
    message: 'Password updated successfully',
  };
}

  async restoreUserAccount(id: number): Promise<UpdateResult> {
    const user = await this.userRepository.restore(id);
    return user;
  }

  async findByIdsIncludingDeleted(ids: number[]): Promise<UserEntity[]> {
    if (!ids.length) {
      return [];
    }
    return this.userRepository.find({
      where: { id: In(ids) },
      withDeleted: true,
    });
  }

  async hydrateListingOwners<T extends { userId?: number; user?: UserEntity | null }>(
    items: T[],
  ): Promise<void> {
    const missingUserIds = [
      ...new Set(items.filter((item) => item.userId && !item.user).map((item) => item.userId!)),
    ];
    if (!missingUserIds.length) {
      return;
    }

    const deletedUsers = await this.findByIdsIncludingDeleted(missingUserIds);
    const userMap = new Map(deletedUsers.map((user) => [user.id, user]));

    for (const item of items) {
      if (!item.user && item.userId) {
        item.user = userMap.get(item.userId);
      }
    }
  }

  async hydrateReviewUsers(reviews: Array<{
    reviewer?: UserEntity | null;
    reviewee?: UserEntity | null;
    reviewerId?: number;
    revieweeId?: number;
  }>): Promise<void> {
    const missingIds = new Set<number>();
    for (const review of reviews) {
      if (review.reviewerId && !review.reviewer) {
        missingIds.add(review.reviewerId);
      }
      if (review.revieweeId && !review.reviewee) {
        missingIds.add(review.revieweeId);
      }
    }

    if (!missingIds.size) {
      return;
    }

    const users = await this.findByIdsIncludingDeleted([...missingIds]);
    const userMap = new Map(users.map((user) => [user.id, user]));

    for (const review of reviews) {
      if (!review.reviewer && review.reviewerId) {
        review.reviewer = userMap.get(review.reviewerId);
      }
      if (!review.reviewee && review.revieweeId) {
        review.reviewee = userMap.get(review.revieweeId);
      }
    }
  }

  // Add this method to src/user/user.service.ts after the existing getUserProfile method

  /**
   * Get comprehensive user profile with all relations and counts
   * This method returns the full user profile with all related data
   */
  async getFullUserProfile(userId: number): Promise<any> {
    try {
      // Get user with all relations
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: [
          'role',
          'demands',
          'travels',
          'messagesSend',
          'messagesReceived',
          'files',
          'requests',
          'activations',
          'verificationLogs',
          'verificationActions',
        ],
      });

      if (!user) {
        throw new NotFoundException(`User profile not found`);
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;

      // Add counts for better UX
      const profileWithCounts = {
        ...userWithoutPassword,
        demandsCount: user.demands?.length || 0,
        travelsCount: user.travels?.length || 0,
        messagesSentCount: user.messagesSend?.length || 0,
        messagesReceivedCount: user.messagesReceived?.length || 0,
        requestsCount: user.requests?.length || 0,
        filesCount: user.files?.length || 0,
      };

      return profileWithCounts;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException(`Failed to fetch user profile: ${error.message}`);
    }
  }

/**
 * Update user profile
 * @param user - The user to update
 * @param updateProfileDto - The data to update the user with (firstName, lastName, profilePictureUrl, bio)
 * @returns The updated user
 */
async updateUserProfile(
  user: any, 
  updateProfileDto: UpdateProfileDto,
  profilePicture?: Express.Multer.File
) {
  const currentUser = await this.getUserById(user.id);

  if (currentUser.isVerified) {
    const currentFirst = (currentUser.firstName ?? '').trim();
    const currentLast = (currentUser.lastName ?? '').trim();

    if (
      updateProfileDto.firstName !== undefined &&
      updateProfileDto.firstName.trim() !== currentFirst
    ) {
      throw new CustomBadRequestException(
        'First name cannot be changed after identity verification',
        ErrorCode.USER_PROFILE_NAME_LOCKED_AFTER_VERIFICATION,
      );
    }

    if (
      updateProfileDto.lastName !== undefined &&
      updateProfileDto.lastName.trim() !== currentLast
    ) {
      throw new CustomBadRequestException(
        'Last name cannot be changed after identity verification',
        ErrorCode.USER_PROFILE_NAME_LOCKED_AFTER_VERIFICATION,
      );
    }
  }

  // Update firstName if provided
  if (updateProfileDto.firstName) {
    currentUser.firstName = updateProfileDto.firstName;
  }

  // Update lastName if provided
  if (updateProfileDto.lastName) {
    currentUser.lastName = updateProfileDto.lastName;
  }

  // Recompute username from latest profile names using "Firstname L." format.
  const normalizedFirstName = (currentUser.firstName || '').trim();
  const normalizedLastName = (currentUser.lastName || '').trim();
  if (normalizedFirstName) {
    const lastInitial = normalizedLastName ? normalizedLastName.charAt(0).toUpperCase() : '';
    currentUser.username = lastInitial
      ? `${normalizedFirstName} ${lastInitial}.`
      : normalizedFirstName;
  }

  // Update bio if provided
  if (updateProfileDto.bio !== undefined) {
    currentUser.bio = updateProfileDto.bio;
  }

 
  // Handle profile picture upload
  if (profilePicture) {
    try {
      // Upload to Cloudinary via FileUploadService
      const uploadedFile = await this.fileUploadService.uploadFile(
        profilePicture,
        FilePurpose.PROFILE_PICTURE,
        currentUser
      );

      // Update user's profile picture URL
      currentUser.profilePictureUrl = uploadedFile.fileUrl;
    } catch (error) {
      throw new BadRequestException(`Failed to upload profile picture: ${error.message}`);
    }
  }

  currentUser.updatedBy = user.id;
  const updatedUser = await this.userRepository.save(currentUser);

  // Remove password from response
  const { password, ...result } = updatedUser;

  return {
    user: result,
    message: 'Profile updated successfully',
  };
}

/**
 * Update phone number
 * @param user 
 * @param updatePhoneDto 
 * @returns 
 */
  async updatePhoneNumber(user: UserEntity, updatePhoneDto: UpdatePhoneDto) {

    //get user
    const foundUser = await this.getUserById(user.id)
    console.log(foundUser)

    if (!foundUser) {
      throw new NotFoundException(`User not found`)

    }
    //if old and new phone number are the save, cancel
    if (updatePhoneDto.newPhoneNumber == updatePhoneDto.oldPhoneNumber) {
      throw new BadRequestException(`Old phone number and new can not be the same`)
    }
    //
    foundUser.phone = updatePhoneDto.newPhoneNumber; //update phone number
    foundUser.isPhoneVerified = false; //set is phone verified to false 
    await this.userRepository.save(foundUser);

    //TODO emit phone number changed event

    return {
      user: foundUser,
      message: 'PhoneNumber updated successfully',
    }

  }

  /**
   * Delete staff member
   * @param id - The ID of the staff member to delete
   * @returns The deleted staff member
   */
  async deleteStaff(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} was not found`);
    }
    await this.userRepository.softDelete(id);
    await this.clearUserListCache();
  }



  async save(user: UserEntity) {
    await this.userRepository.save(user);
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


  async findOne(arg: FindOptionsWhere<UserEntity>): Promise<UserEntity | null> {
    return await this.userRepository.findOne({
      where: arg,
      relations: ['role', 'demands', 'travels', 'files', 'verificationLogs', 'verificationActions'],
    });
  }


  private generateUserListCacheKey(query: FindUsersQueryDto): string {
    const {
      page = 1,
      limit = 10,
      email,
      phone,
      roleCode,
      isVerified,
      isStripeVerified,
      createdDate,
      orderBy = 'createdAt:desc'
    } = query;

    return `users_list_page${page}_limit${limit}_email${email || 'all'}_phone${phone || 'all'}_role${roleCode || 'all'}_verified${isVerified ?? 'all'}_stripeVerified${isStripeVerified ?? 'all'}_created_at${createdDate || 'all'}_order${orderBy}`;
  }


  /**
     * Seeds an admin user when the application starts
     * This ensures there's always an admin user available for platform management
     */
  private async seedAdminUser(): Promise<void> {
    const adminEmail = process.env.ADMIN_EMAIL || 'support@gohappygo.fr';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    const adminPhone = process.env.ADMIN_PHONE || '+1234567890';

    try {
      // Check if admin user already exists
      const existingAdmin = await this.userRepository.findOne({
        where: { email: adminEmail },
        relations: ['role']
      });

      if (existingAdmin) {
        console.log(`🟡 Admin user '${adminEmail}' already exists`);
        return;
      }

      // Get admin role
      const adminRole = await this.roleService.getUserRoleIdByCode('ADMIN');
      if (!adminRole) {
        console.log(`🔴 Admin role not found. Please ensure roles are seeded first.`);
        return;
      }

      // Check if phone number is already in use
      const existingPhone = await this.userRepository.findOne({
        where: { phone: adminPhone }
      });

      if (existingPhone) {
        console.log(`🔴 Phone number '${adminPhone}' is already in use. Please use a different phone number.`);
        return;
      }

      // Hash password
      const hashedPassword = await this.hashPassword(adminPassword);

      // Create admin user
      const adminUser = this.userRepository.create({
        firstName: 'Admin',
        lastName: 'User',
        email: adminEmail,
        phone: adminPhone,
        username: 'admin',
        password: hashedPassword,
        roleId: adminRole.id,
        isPhoneVerified: true,
        isVerified: true,
        profilePictureUrl: undefined
      });

      await this.userRepository.save(adminUser);
      console.log(`🟢 Admin user '${adminEmail}' created successfully`);
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Password: ${adminPassword}`);
      console.log(`📱 Phone: ${adminPhone}`);
      console.log(`⚠️  Please change the default password after first login!`);
      console.log(`🔐 Role: ${adminRole.name}`);

    } catch (error) {
      console.error(`🔴 Failed to seed admin user:`, error.message);
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        console.log(`💡 Admin user might already exist with different credentials.`);
      }
    }
  }


  /**
   * Seeds an operator user when the application starts
   * This ensures there's always an operator user available for operational tasks
   */
  private async seedOperatorUser(): Promise<void> {
    const operatorEmail = process.env.OPERATOR_EMAIL || 'operator@gohappygo.com';
    const operatorPassword = process.env.OPERATOR_PASSWORD || 'password123';
    const operatorPhone = process.env.OPERATOR_PHONE || '+1234567891';

    try {
      // Check if operator user already exists
      const existingOperator = await this.userRepository.findOne({
        where: { email: operatorEmail },
        relations: ['role']
      });

      if (existingOperator) {
        console.log(`🟡 Operator user '${operatorEmail}' already exists`);
        return;
      }

      // Get operator role
      const operatorRole = await this.roleService.getUserRoleIdByCode('OPERATOR');
      if (!operatorRole) {
        console.log(`🔴 Operator role not found. Please ensure roles are seeded first.`);
        return;
      }

      // Check if phone number is already in use
      const existingPhone = await this.userRepository.findOne({
        where: { phone: operatorPhone }
      });

      if (existingPhone) {
        console.log(`🔴 Phone number '${operatorPhone}' is already in use. Please use a different phone number.`);
        return;
      }

      // Hash password
      const hashedPassword = await this.hashPassword(operatorPassword);

      // Create operator user
      const operatorUser = this.userRepository.create({
        firstName: 'Operator',
        lastName: 'User',
        email: operatorEmail,
        phone: operatorPhone,
        username: 'operator',
        password: hashedPassword,
        roleId: operatorRole.id,
        isPhoneVerified: true,
        isVerified: true,
        profilePictureUrl: undefined
      });

      await this.userRepository.save(operatorUser);
      console.log(`🟢 Operator user '${operatorEmail}' created successfully`);
      console.log(`📧 Email: ${operatorEmail}`);
      console.log(`🔑 Password: ${operatorPassword}`);
      console.log(`📱 Phone: ${operatorPhone}`);
      console.log(`⚠️  Please change the default password after first login!`);
      console.log(`🔐 Role: ${operatorRole.name}`);

    } catch (error) {
      console.error(`🔴 Failed to seed operator user:`, error.message);
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        console.log(`💡 Operator user might already exist with different credentials.`);
      }
    }
  }

  // Add this method to clear user list cache
  private async clearUserListCache(): Promise<void> {
    // Clear all user list cache keys
    for (const cacheKey of this.userListCacheKeys) {
      await this.cacheManager.del(cacheKey);
    }
    this.userListCacheKeys.clear();
  }

  // Update user rating statistics (called by ReviewService)
  async updateUserRatingStats(userId: number, rating: number | null, numberOfReviews: number): Promise<void> {
    await this.userRepository.update(userId, {
      rating,
      numberOfReviews
    });
  }

  // Add this method to UserService
  async findAllUserIds(): Promise<number[]> {
    const users = await this.userRepository.find({
      select: ['id']
    });
    return users.map(user => user.id);
  }
}
