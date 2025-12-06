import { Controller, Post, Body, UseGuards, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FirebaseAuthService } from '../firebase/firebase-auth.service';
import { AuthService } from './auth.service';
import { UserEntity } from '../user/user.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorattor';

export class GoogleSignInDto {
  idToken: string;
}

export class GoogleAuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    isEmailVerified: boolean;
    profilePictureUrl: string;
  };
}

@ApiTags('auth')
@Controller('auth')
export class GoogleAuthController {
  constructor(
    private readonly firebaseAuthService: FirebaseAuthService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Google Sign-In
   */
  @Post('google')
  @ApiOperation({ summary: 'Sign in with Google' })
  @ApiResponse({ 
    status: 200, 
    description: 'Google sign-in successful',
    type: GoogleAuthResponseDto
  })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  async googleSignIn(@Body() googleSignInDto: GoogleSignInDto) {
    // Verify Firebase ID token
    const firebaseUser = await this.firebaseAuthService.verifyIdToken(googleSignInDto.idToken);
    
    // Create or update user in database
    const user = await this.firebaseAuthService.createOrUpdateUser(firebaseUser);
    
    // Generate JWT tokens
    const accessToken = await this.authService.generateToken(user);

    return {
      accessToken,
      refreshToken: '', // You may need to implement refresh token logic
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        profilePictureUrl: user.profilePictureUrl,
      }
    };
  }

  /**
   * Get current user info
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current user information' })
  @ApiResponse({ status: 200, description: 'User information retrieved successfully' })
  async getCurrentUser(@CurrentUser() user: UserEntity) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
      profilePictureUrl: user.profilePictureUrl,
      kycStatus: user.kycStatus,
      isVerified: user.isVerified,
    };
  }
}
