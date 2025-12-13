import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { BookmarkService } from './bookmark.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { UpdateBookmarkDto } from './dto/update-bookmark.dto';
import { FindBookmarksQueryDto } from './dto/find-bookmarks-query.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { BookmarkType } from './entities/bookmark.entity';
import { BookmarkListResponseDto } from './dto/bookmark-response.dto';

@ApiTags('bookmarks')
@Controller('bookmark')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}


  @Post()
  @ApiOperation({
    summary: 'Add a bookmark',
    description: 'Bookmark a travel or demand for later reference ',

  })
  @ApiResponse({ status: 201, description: 'Bookmark created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Travel or demand not found' })
  @ApiResponse({ status: 409, description: 'Item already bookmarked' })
  create(@CurrentUser() user: any, @Body() createBookmarkDto: CreateBookmarkDto) {
    return this.bookmarkService.create(user.id, createBookmarkDto);
  }



  @Get()
  @ApiOperation({
    summary: 'Get all bookmarks',
    description: 'Retrieve all bookmarks for the authenticated user with pagination and filtering',

  })
  @ApiResponse({ status: 200, description: 'Bookmarks fetched successfully', type: BookmarkListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser() user: any, @Query() query: FindBookmarksQueryDto): Promise<BookmarkListResponseDto> {
    return this.bookmarkService.findAll(user.id, query);
  }


  @Get(':id')

  @Get('stats')
  @ApiOperation({
    summary: 'Get bookmark statistics',
    description: 'Get count of bookmarks by type for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'Statistics fetched successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats(@CurrentUser() user: any) {
    return this.bookmarkService.getBookmarkStats(user.id);
  }

  @Get('check/:bookmarkType/:itemId')
  @ApiOperation({
    summary: 'Check if an item is bookmarked',
    description: 'Check if a specific travel or demand is bookmarked by the user',
  })
  @ApiResponse({ status: 200, description: 'Check completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  checkBookmark(
    @CurrentUser() user: any,
    @Param('bookmarkType') bookmarkTypeParam: string,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    const bookmarkType = bookmarkTypeParam.toUpperCase() as BookmarkType;
    if (!Object.values(BookmarkType).includes(bookmarkType)) {
      throw new BadRequestException(`Invalid bookmark type: ${bookmarkTypeParam}. Must be TRAVEL or DEMAND`);
    }
    return this.bookmarkService.isBookmarked(user.id, bookmarkType, itemId);
  }


  @Patch(':id')
  @ApiOperation({
    summary: 'Update a bookmark',
    description: 'Update notes for a bookmark',
  })
  @ApiResponse({ status: 200, description: 'Bookmark updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Bookmark not found' })
  update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBookmarkDto: UpdateBookmarkDto,
  ) {
    return this.bookmarkService.update(user.id, id, updateBookmarkDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remove a bookmark',
    description: 'Delete a bookmark by its ID',
  })
  @ApiResponse({ status: 200, description: 'Bookmark removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Bookmark not found' })
  remove(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number) {
    return this.bookmarkService.remove(user.id, id);
  }

  @Delete('item/:bookmarkType/:itemId')
  @ApiOperation({
    summary: 'Remove bookmark by item',
    description: 'Remove a bookmark by travel or demand ID',
  })
  @ApiResponse({ status: 200, description: 'Bookmark removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Bookmark not found' })
  removeByItem(
    @CurrentUser() user: any,
    @Param('bookmarkType') bookmarkTypeParam: string,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    const bookmarkType = bookmarkTypeParam.toUpperCase() as BookmarkType;
    if (!Object.values(BookmarkType).includes(bookmarkType)) {
      throw new BadRequestException(`Invalid bookmark type: ${bookmarkTypeParam}. Must be TRAVEL or DEMAND`);
    }
    return this.bookmarkService.removeByItem(user.id, bookmarkType, itemId);
  }
}
