import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { FindCurrenciesQueryDto } from './dto/find-currencies-query.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles-guard';
import { Roles } from 'src/auth/decorators/role.decorators';
import { UserRole } from 'src/user/user.entity';
import { CurrentUser } from 'src/auth/decorators/current-user.decorattor';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { CurrencyEntity } from './entities/currency.entity';

@ApiTags('currencies')
@Controller('currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN || UserRole.OPERATOR)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Create a new currency',
    description: 'Admin only - Create a new currency in the system'
  })
  @ApiResponse({ status: 201, description: 'Currency created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 409, description: 'Currency code already exists' })
  create(@CurrentUser() user: any ,@Body() createCurrencyDto: CreateCurrencyDto) {
    return this.currencyService.create(createCurrencyDto, user);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all currencies',
    description: 'Retrieve all currencies with pagination, filtering, and sorting'
  })
  @ApiResponse({ status: 200, description: 'Currencies fetched successfully', type: [CurrencyEntity] })
  @ApiResponse({ status: 400, description: 'Bad request' })
  findAll(@Query() query: FindCurrenciesQueryDto): Promise<PaginatedResponse<CurrencyEntity>>{
    return this.currencyService.findAll(query);
  }


  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Update a currency',
    description: 'Admin only - Update an existing currency'
  })
  @ApiResponse({ status: 200, description: 'Currency updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  @ApiResponse({ status: 409, description: 'Currency code already exists' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateCurrencyDto: UpdateCurrencyDto
  ) {
    return this.currencyService.update(id, updateCurrencyDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Delete a currency',
    description: 'Admin only - Soft delete a currency'
  })
  @ApiResponse({ status: 200, description: 'Currency deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.currencyService.remove(id);
  }
}
