import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { ApiBearerAuth, ApiOperation, ApiBody, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QuoteEntity } from './entities/quote.entity';
import { FindQuoteQueryDto } from './dto/find-quote-query.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { Roles } from 'src/auth/decorators/role.decorators';
import { UserRole } from 'src/user/user.entity';

@ApiTags('quotes')
@Controller('quotes')
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  @ApiBearerAuth('JWT-auth') 
  @UseGuards(JwtAuthGuard)  
  @ApiOperation({ summary: 'Create a quote' })
  @ApiBody({ type: CreateQuoteDto })
  @ApiResponse({ status: 201, description: 'Quote created successfully',type: QuoteEntity })
  @ApiResponse({ status: 400, description: 'Bad request' })
  create(@Body() createQuoteDto: CreateQuoteDto,@CurrentUser() user: any) {
    return this.quoteService.create(createQuoteDto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth') 
  @ApiOperation({ summary: 'Get all quotes', description: 'Admins/operators see all records; regular users see only active (non-deactivated) records.' })
  @ApiResponse({ status: 200, description: 'Quotes fetched successfully',type: [QuoteEntity] })
  @ApiResponse({ status: 400, description: 'Bad request' })
  getAllQuotes(@Query() query: FindQuoteQueryDto, @CurrentUser() user: any) {
    return this.quoteService.getAllQuotes(query, user);
  }
  

  @Patch(':id')
  @ApiBearerAuth('JWT-auth') 
  @ApiOperation({ summary: 'Update a quote' })
  @UseGuards(JwtAuthGuard)  
  @ApiBody({ type: UpdateQuoteDto })
  @ApiResponse({ status: 200, description: 'Quote updated successfully',type: QuoteEntity })
  @ApiResponse({ status: 400, description: 'Bad request' })
  update(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: any, @Body() updateQuoteDto: UpdateQuoteDto) {
    return this.quoteService.update(+id, updateQuoteDto, user);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth') 
  @UseGuards(JwtAuthGuard)  
  @ApiOperation({ summary: 'Delete a quote' })
  @ApiResponse({ status: 200, description: 'Quote deleted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.quoteService.remove(+id);
  }


  @Get('random')
  @ApiOperation({ summary: 'Get random quotes' })
  @ApiResponse({ status: 200, description: 'Random quotes fetched successfully',type: [QuoteEntity] })
  @ApiResponse({ status: 400, description: 'Bad request' })
  getRandomQuotes(@Query('numberOfQuotes', ParseIntPipe) numberOfQuotes: number) {
    return this.quoteService.getRandomQuotes(numberOfQuotes);
  }

  /**
   * Toggle activation status of a quote (admin/operator only).
   * If the quote is currently active it will be deactivated, and vice versa.
   * PATCH /quotes/:id/toggle-activation
   */
  @Patch(':id/toggle-activation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Toggle activation status of a quote (Admin/Operator only)',
    description: 'Toggles the `isDeactivated` flag on a quote. If the quote is currently active it will be deactivated (hidden from regular users), and if it is deactivated it will be re-activated (visible to regular users). Admins/operators can see all quotes regardless of status.'
  })
  @ApiParam({ name: 'id', type: Number, description: 'Quote ID' })
  @ApiResponse({ status: 200, description: 'Quote activation status toggled successfully', type: QuoteEntity })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin/Operator access only' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  toggleQuoteActivation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ): Promise<QuoteEntity> {
    return this.quoteService.toggleActivation(id, user);
  }
}
