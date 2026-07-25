import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { FirebaseConfig } from './firebase.config';
import { UserEntity } from '../user/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleService } from '../role/role.service';

export interface FirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  provider: string;
}

@Injectable()
export class FirebaseAuthService {
  private auth: admin.auth.Auth;

  constructor(
    private firebaseConfig: FirebaseConfig,
    @InjectRepository(UserEntity) private usersRepository: Repository<UserEntity>,
    private roleService: RoleService,
  ) {
    this.auth = this.firebaseConfig.getAuth();
  }

  /**
   * Verify Firebase ID Token and get user data
   */
  async verifyIdToken(idToken: string): Promise<FirebaseUser> {
    try {
      const decodedToken = await this.auth.verifyIdToken(idToken);

      return {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        emailVerified: decodedToken.email_verified || false,
        displayName: decodedToken.name || '',
        photoURL: decodedToken.picture || '',
        provider: decodedToken.firebase.sign_in_provider,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid Firebase ID token');
    }
  }

  /**
   * Create or update user from Firebase authentication
   */
  async createOrUpdateUser(firebaseUser: FirebaseUser): Promise<UserEntity> {
    const normalizedEmail = firebaseUser.email?.trim() ?? '';

    const lookupConditions: FindOptionsWhere<UserEntity>[] = [{ firebaseUid: firebaseUser.uid }];
    if (normalizedEmail) {
      lookupConditions.push({ email: normalizedEmail });
    }

    let user = await this.usersRepository.findOne({
      where: lookupConditions,
    });

    if (user) {
      user.firebaseUid = firebaseUser.uid;
      if (normalizedEmail) {
        user.email = normalizedEmail;
      }
      user.isEmailVerified = firebaseUser.emailVerified;
      user.firstName = firebaseUser.displayName?.split(' ')[0] || user.firstName;
      user.lastName = firebaseUser.displayName?.split(' ').slice(1).join(' ') || user.lastName;

      await this.usersRepository.save(user);
    } else {
      const userRole = await this.roleService.getUserRoleIdByCode('USER');
      if (!userRole) {
        throw new BadRequestException('Default USER role is not configured');
      }
      const passwordPlaceholder = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
      const newUserData: DeepPartial<UserEntity> = {
        firebaseUid: firebaseUser.uid,
        email: normalizedEmail,
        isEmailVerified: firebaseUser.emailVerified,
        profilePictureUrl: firebaseUser.photoURL || undefined,
        firstName: firebaseUser.displayName?.split(' ')[0] || 'User',
        lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        username: normalizedEmail?.split('@')[0] || `user_${firebaseUser.uid.slice(0, 8)}`,
        phone: `social_${firebaseUser.uid}`,
        password: passwordPlaceholder,
        roleId: userRole.id,
        kycStatus: 'uninitiated',
        kycProvider: null,
        kycReference: null,
        kycUpdatedAt: null,
        isVerified: false,
        isPhoneVerified: false,
        stripeCountryCode: undefined,
      };
      user = this.usersRepository.create(newUserData);

      await this.usersRepository.save(user);
    }

    return user;
  }

  /**
   * Get user by Firebase UID
   */
  async getUserByFirebaseUid(uid: string): Promise<UserEntity | null> {
    return await this.usersRepository.findOne({
      where: { firebaseUid: uid },
    });
  }

  /**
   * Delete user from Firebase
   */
  async deleteFirebaseUser(uid: string): Promise<void> {
    try {
      await this.auth.deleteUser(uid);
    } catch (error) {
      throw new BadRequestException('Failed to delete Firebase user');
    }
  }
}
