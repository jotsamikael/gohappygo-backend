import { Injectable, NotFoundException, ConflictException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { CurrencyEntity } from './entities/currency.entity';
import { FindCurrenciesQueryDto } from './dto/find-currencies-query.dto';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { CustomConflictException } from 'src/common/exception/custom-exceptions';
import { CustomNotFoundException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';

@Injectable()
export class CurrencyService {
  private currencyListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(CurrencyEntity)
    private currencyRepository: Repository<CurrencyEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Create a new currency
   */
  async create(createCurrencyDto: CreateCurrencyDto, user: any): Promise<CurrencyEntity> {
    // Check if currency code already exists
    const existingCurrency = await this.currencyRepository.findOne({
      where: { code: createCurrencyDto.code.toUpperCase() },
    });

    if (existingCurrency) {
      throw new CustomConflictException(`Currency with code ${createCurrencyDto.code} already exists`, ErrorCode.CURRENCY_ALREADY_EXISTS);
    }

    const currency = this.currencyRepository.create({
      ...createCurrencyDto,
      createdBy: user.id,
      code: createCurrencyDto.code.toUpperCase(), // Always store currency codes in uppercase
    });

    const savedCurrency = await this.currencyRepository.save(currency);
    
    // Clear cache after creating a new currency
    await this.clearCurrencyListCache();
    
    return savedCurrency;
  }

  /**
   * Get all currencies with pagination, filtering, and sorting
   */
  async findAll(query: FindCurrenciesQueryDto): Promise<PaginatedResponse<CurrencyEntity>> {
    const cacheKey = this.generateCurrencyListCacheKey(query);
    this.currencyListCacheKeys.add(cacheKey);

    // Check cache first
    const cachedData = await this.cacheManager.get<PaginatedResponse<CurrencyEntity>>(cacheKey);
    if (cachedData) {
      console.log(`Cache Hit---------> Returning currencies list from Cache ${cacheKey}`);
      return cachedData;
    }
    console.log(`Cache Miss---------> Returning currencies list from database`);

    const {
      page = 1,
      limit = 10,
      code,
      name,
      country,
      isActive,
      orderBy = 'code:asc',
    } = query;

    const skip = (page - 1) * limit;

    // Build the query
    const queryBuilder = this.currencyRepository
      .createQueryBuilder('currency')
      .skip(skip)
      .take(limit);

    // Apply filters
    if (code) {
      queryBuilder.andWhere('LOWER(currency.code) LIKE LOWER(:code)', { code: `%${code}%` });
    }

    if (name) {
      queryBuilder.andWhere('LOWER(currency.name) LIKE LOWER(:name)', { name: `%${name}%` });
    }

    if (country) {
      queryBuilder.andWhere('LOWER(currency.country) LIKE LOWER(:country)', { country: `%${country}%` });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('currency.isActive = :isActive', { isActive });
    }

    // Apply sorting
    const [sortField, sortDirection] = orderBy.split(':');
    const validSortFields = ['code', 'name', 'country', 'createdAt'];
    const validSortDirections = ['asc', 'desc'];

    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`currency.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy('currency.code', 'ASC'); // default
    }

    // Get the count
    const totalItems = await queryBuilder.getCount();
    const items = await queryBuilder.getMany();

    const totalPages = Math.ceil(totalItems / limit);

    const responseResult = {
      items,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };

    await this.cacheManager.set(cacheKey, responseResult, 30000);
    return responseResult;
  }

  /**
   * Get a single currency by ID
   */
  async findOne(id: number): Promise<CurrencyEntity> {
    const currency = await this.currencyRepository.findOne({
      where: { id },
    });

    if (!currency) {
      throw new CustomNotFoundException(`Currency with ID ${id} not found`, ErrorCode.CURRENCY_NOT_FOUND);
    }

    return currency;
  }

  /**
   * Find currency by code
   */
  async findByCode(code: string): Promise<CurrencyEntity | null> {
    return this.currencyRepository.findOne({
      where: { code: code.toUpperCase() },
    });
  }

  /**
   * Update a currency
   */
  async update(id: number, updateCurrencyDto: UpdateCurrencyDto): Promise<CurrencyEntity> {
    const currency = await this.findOne(id);

    // If updating the code, check if it's unique
    if (updateCurrencyDto.code && updateCurrencyDto.code !== currency.code) {
      const existingCurrency = await this.currencyRepository.findOne({
        where: { code: updateCurrencyDto.code.toUpperCase() },
      });

      if (existingCurrency) {
        throw new CustomConflictException(`Currency with code ${updateCurrencyDto.code} already exists`, ErrorCode.CURRENCY_ALREADY_EXISTS);
      }

      updateCurrencyDto.code = updateCurrencyDto.code.toUpperCase();
    }

    Object.assign(currency, updateCurrencyDto);
    const updatedCurrency = await this.currencyRepository.save(currency);
    
    // Clear cache after updating
    await this.clearCurrencyListCache();
    
    return updatedCurrency;
  }

  /**
   * Delete a currency (soft delete)
   */
  async remove(id: number): Promise<{ message: string }> {
    const currency = await this.findOne(id);
    
    await this.currencyRepository.softDelete(id);
    
    // Clear cache after deletion
    await this.clearCurrencyListCache();
    
    return { message: `Currency ${currency.code} has been successfully deleted` };
  }

  /**
   * Get active currencies only
   */
  async findAllActive(): Promise<CurrencyEntity[]> {
    return this.currencyRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  /**
   * Generate cache key for currency list queries
   */
  private generateCurrencyListCacheKey(query: FindCurrenciesQueryDto): string {
    const {
      page = 1,
      limit = 10,
      code,
      name,
      country,
      isActive,
      orderBy = 'code:asc',
    } = query;

    return `currencies_list_page${page}_limit${limit}_code${code || 'all'}_name${name || 'all'}_country${country || 'all'}_active${isActive !== undefined ? isActive : 'all'}_order${orderBy}`;
  }

  /**
   * Clear currency list cache
   */
  async clearCurrencyListCache(): Promise<void> {
    for (const cacheKey of this.currencyListCacheKeys) {
      await this.cacheManager.del(cacheKey);
    }
    this.currencyListCacheKeys.clear();
  }

  /**
   * Convert amount from a given currency to USD
   * @param amount - Amount in the source currency
   * @param fromCurrencyCode - Source currency code (e.g., 'EUR', 'GBP')
   * @returns Amount in USD
   */
  async convertToUSD(amount: number, fromCurrencyCode: string): Promise<number> {
    // Get USD currency (base currency with exchangeRate = 1.0)
    const usdCurrency = await this.findByCode('USD');
    if (!usdCurrency) {
      throw new CustomNotFoundException('USD currency not found in database', ErrorCode.CURRENCY_NOT_FOUND);
    }

    // If already USD, return as is
    if (fromCurrencyCode.toUpperCase() === 'USD') {
      return amount;
    }

    // Get source currency
    const sourceCurrency = await this.findByCode(fromCurrencyCode);
    if (!sourceCurrency) {
      throw new CustomNotFoundException(`Currency with code ${fromCurrencyCode} not found`, ErrorCode.CURRENCY_NOT_FOUND);
    }

    // Convert: amount / sourceCurrency.exchangeRate
    // exchangeRate is relative to base currency (USD), so dividing by exchangeRate gives USD amount
    const convertedAmount = amount / Number(sourceCurrency.exchangeRate);
    
    // Round to 2 decimal places
    return Math.round(convertedAmount * 100) / 100;
  }
}
