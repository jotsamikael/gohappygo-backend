import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards, Query } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UserEntity } from 'src/user/user.entity';
import { CreateReviewDto } from './dto/createReview.dto';
import { ReviewService } from './review.service';
import { UpdateReviewDto } from './dto/updateReview.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReviewResponseDto, CreateReviewResponseDto, PaginatedReviewsResponseDto } from './dto/review-response.dto';
import { FindReviewsQueryDto } from './dto/findReviewsQuery.dto';
import { ModerateReviewDto } from './dto/moderateReview.dto';
import { UserRole } from 'src/user/user.entity';
import { Roles } from 'src/auth/decorators/role.decorators';
import { RolesGuard } from 'src/auth/guards/roles-guard';

@ApiTags('reviews')
@Controller('review')
export class ReviewController {

constructor(private reviewService: ReviewService){}

//Create a Review
@Post()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth') 
@ApiOperation({ summary: 'Create a review' })
@ApiBody({ type: CreateReviewDto })
@ApiResponse({ status: 201, description: 'Review created successfully', type: CreateReviewResponseDto })
@ApiResponse({ status: 400, description: 'Bad request' })
async addReview(@CurrentUser() user: UserEntity, @Body() createReviewDto: CreateReviewDto) {
  return this.reviewService.addReview(user, createReviewDto);
}




@Patch(':id')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth') 
@ApiOperation({ summary: 'Edit a review' })
@ApiResponse({ status: 200, description: 'Review updated successfully',type: ReviewResponseDto })
@ApiResponse({ status: 400, description: 'Bad request' })
async editReview(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: UserEntity,
  @Body() updateReviewDto: UpdateReviewDto
) {
  return this.reviewService.editReview(id, user, updateReviewDto);
}

@Get()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiOperation({ 
    summary: 'Get reviews with filters',
    description: 'For regular users: Get reviews where they are reviewer or reviewee. Use asReviewer=true query parameter to only get reviews they posted. For admins/operators: Get all reviews with full filtering capabilities.'
})
@ApiResponse({ status: 200, description: 'Reviews fetched successfully', type: PaginatedReviewsResponseDto })
@ApiResponse({ status: 400, description: 'Bad request' })
async getAllReviews(
  @Query() query: FindReviewsQueryDto,
  @CurrentUser() user: UserEntity
): Promise<PaginatedReviewsResponseDto> {
  return this.reviewService.getAllReviews(query, user);
}

@Patch(':id/moderate')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
@ApiBearerAuth('JWT-auth')
@ApiOperation({ 
  summary: 'Moderate a review (Admin/Operator only)',
  description: 'Allows administrators and operators to edit review comments without time restrictions. Rating cannot be changed.'
})
@ApiBody({ type: ModerateReviewDto })
@ApiResponse({ 
  status: 200, 
  description: 'Review moderated successfully',
  type: CreateReviewResponseDto
})
@ApiResponse({ status: 403, description: 'Forbidden - Admin/Operator access only' })
@ApiResponse({ status: 404, description: 'Review not found' })
async moderateReview(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: UserEntity,
  @Body() moderateDto: ModerateReviewDto
) {
  return this.reviewService.moderateReview(id, user, moderateDto);
}

}
