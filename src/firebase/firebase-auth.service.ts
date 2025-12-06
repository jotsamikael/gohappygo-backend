import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseConfig } from './firebase.config';
import { UserEntity } from '../user/user.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

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
    // Check if user already exists by Firebase UID or email
    let user = await this.usersRepository.findOne({
      where: [
        { firebaseUid: firebaseUser.uid },
        { email: firebaseUser.email }
      ]
    });

    if (user) {
      // Update existing user
      user.firebaseUid = firebaseUser.uid;
      user.email = firebaseUser.email;
      user.isEmailVerified = firebaseUser.emailVerified;
      //user.profilePictureUrl = firebaseUser.photoURL;
      user.firstName = firebaseUser.displayName?.split(' ')[0] || user.firstName;
      user.lastName = firebaseUser.displayName?.split(' ').slice(1).join(' ') || user.lastName;
      
      await this.usersRepository.save(user);
    } else {
      // Create new user
      user = this.usersRepository.create({
        firebaseUid: firebaseUser.uid,
        email: firebaseUser.email,
        isEmailVerified: firebaseUser.emailVerified,
        //profilePictureUrl: firebaseUser.photoURL,
        firstName: firebaseUser.displayName?.split(' ')[0] || 'User',
        lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
        username: firebaseUser.email.split('@')[0],
        phone: '', // Will be filled later
        password: '', // Not needed for Firebase auth
        roleId: 1, // Default role
        kycStatus: 'uninitiated',
        kycProvider: null,
        kycReference: null,
        kycUpdatedAt: null,
        isVerified: false,
        isPhoneVerified: false,
      });

      await this.usersRepository.save(user);
    }

    return user;
  }

  /**
   * Get user by Firebase UID
   */
  async getUserByFirebaseUid(uid: string): Promise<UserEntity | null> {
    return await this.usersRepository.findOne({
      where: { firebaseUid: uid }
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
