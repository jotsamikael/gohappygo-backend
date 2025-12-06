import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { ApiBearerAuth, ApiOperation, ApiBody, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QuoteEntity } from './entities/quote.entity';
import { FindQuoteQueryDto } from './dto/find-quote-query.dto';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

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
  @ApiBearerAuth('JWT-auth') 
  @ApiOperation({ summary: 'Get all quotes' })
  @ApiResponse({ status: 200, description: 'Quotes fetched successfully',type: [QuoteEntity] })
  @ApiResponse({ status: 400, description: 'Bad request' })
  getAllQuotes(@Query() query: FindQuoteQueryDto) {
    return this.quoteService.getAllQuotes(query);
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
}
