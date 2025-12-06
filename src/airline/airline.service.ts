import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { AirlineEntity } from './entities/airline.entity';
import { FindAirlinesQueryDto } from './dto/FindAirlinesQueryDto';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';

@Injectable()
export class AirlineService {
  private airlineListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(AirlineEntity)
    private airlineRepository: Repository<AirlineEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}



  /**
   * Get all airlines with pagination, filtering, and sorting
   */
  async getAllAirlines(query: FindAirlinesQueryDto): Promise<PaginatedResponse<AirlineEntity>> {
    const cacheKey = this.generateAirlineListCacheKey(query);
    this.airlineListCacheKeys.add(cacheKey);

    // Check cache first
    const cachedData = await this.cacheManager.get<PaginatedResponse<AirlineEntity>>(cacheKey);
    if (cachedData) {
      console.log(`Cache Hit---------> Returning airlines list from Cache ${cacheKey}`);
      return cachedData;
    }
    console.log(`Cache Miss---------> Returning airlines list from database`);

    const {
      page = 1,
      limit = 10,
      name,
      iataCode,
      icaoCode,
      callsign,
      orderBy = 'name:asc'
    } = query;

    // Debug: Log the received values
    console.log('🔍 Debug - Received query parameters:');
    console.log('name:', name, 'Type:', typeof name);
    console.log('iataCode:', iataCode, 'Type:', typeof iataCode);
    console.log('icaoCode:', icaoCode, 'Type:', typeof icaoCode);
    console.log('callsign:', callsign, 'Type:', typeof callsign);

    const skip = (page - 1) * limit;

    // Build the query
    const queryBuilder = this.airlineRepository.createQueryBuilder('airline')
      .skip(skip)
      .take(limit);

    // Apply filters
    if (name) {
      queryBuilder.andWhere('LOWER(airline.name) LIKE LOWER(:name)', { name: `%${name}%` });
    }

    if (iataCode) {
      queryBuilder.andWhere('LOWER(airline.iataCode) LIKE LOWER(:iataCode)', { iataCode: `%${iataCode}%` });
    }

    if (icaoCode) {
      queryBuilder.andWhere('LOWER(airline.icaoCode) LIKE LOWER(:icaoCode)', { icaoCode: `%${icaoCode}%` });
    }

    if (callsign) {
      queryBuilder.andWhere('LOWER(airline.callsign) LIKE LOWER(:callsign)', { callsign: `%${callsign}%` });
    }

    // Debug: Log the final SQL query
    console.log(' Final SQL Query:', queryBuilder.getSql());

    // Apply sorting
    const [sortField, sortDirection] = orderBy.split(':');
    const validSortFields = ['name', 'iataCode', 'icaoCode', 'callsign', 'createdAt'];
    const validSortDirections = ['asc', 'desc'];

    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`airline.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy('airline.name', 'ASC'); // default
    }

    // Get the count first (without joins to avoid complex queries)
    const countQueryBuilder = this.airlineRepository.createQueryBuilder('airline');
    
    // Apply the same filters to count query
    if (name) {
      countQueryBuilder.andWhere('LOWER(airline.name) LIKE LOWER(:name)', { name: `%${name}%` });
    }
    if (iataCode) {
      countQueryBuilder.andWhere('LOWER(airline.iataCode) LIKE LOWER(:iataCode)', { iataCode: `%${iataCode}%` });
    }
    if (icaoCode) {
      countQueryBuilder.andWhere('LOWER(airline.icaoCode) LIKE LOWER(:icaoCode)', { icaoCode: `%${icaoCode}%` });
    }
    if (callsign) {
      countQueryBuilder.andWhere('LOWER(airline.callsign) LIKE LOWER(:callsign)', { callsign: `%${callsign}%` });
    }

    const totalItems = await countQueryBuilder.getCount();
    console.log('🔍 Total items found:', totalItems);

    const items = await queryBuilder.getMany();
    console.log(' Items retrieved:', items.length);

    const totalPages = Math.ceil(totalItems / limit);

    const responseResult = {
      items,
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages
      }
    };

    await this.cacheManager.set(cacheKey, responseResult, 30000);
    return responseResult;
  }

  /**
   * Find airline by IATA code (supports 2 or 3 character codes)
   * Uses cache to avoid repeated database queries
   */
  async findByIataCode(iataCode: string): Promise<AirlineEntity | null> {
    const cacheKey = `airline_iata_${iataCode.toUpperCase()}`;
    
    // Check cache first
    const cachedAirline = await this.cacheManager.get<AirlineEntity>(cacheKey);
    if (cachedAirline) {
      return cachedAirline;
    }
    
    // If not in cache, query database
    const airline = await this.airlineRepository.findOne({
      where: { iataCode: iataCode.toUpperCase() }
    });
    
    // Cache the result (including null results to avoid repeated failed lookups)
    // Cache for 1 hour (3600000 ms)
    if (airline) {
      await this.cacheManager.set(cacheKey, airline, 3600000);
    } else {
      // Cache null results for shorter time (5 minutes) to avoid excessive queries for invalid codes
      await this.cacheManager.set(cacheKey, null, 300000);
    }
    
    return airline;
  }

  /**
   * Find airline by flight number (extracts IATA code from first 2 characters)
   */
  async findByFlightNumber(flightNumber: string): Promise<AirlineEntity | null> {
    if (!flightNumber || flightNumber.length < 2) {
      return null;
    }
    
    const iataCode = flightNumber.substring(0, 2).toUpperCase();
    return this.findByIataCode(iataCode);
  }

  /**
   * Search airlines by name or code (for dropdown/autocomplete)
   */
  async searchAirlines(query: string): Promise<AirlineEntity[]> {
    return this.airlineRepository
      .createQueryBuilder('airline')
      .where('airline.name ILIKE :query OR airline.iataCode ILIKE :query OR airline.icaoCode ILIKE :query', {
        query: `%${query}%`
      })
      .orderBy('airline.name', 'ASC')
      .limit(20) // Limit for autocomplete
      .getMany();
  }

  /**
   * Get airline logo URL by flight number
   */
  async getAirlineLogoByFlightNumber(flightNumber: string): Promise<string | null> {
    const airline = await this.findByFlightNumber(flightNumber);
    return airline?.logoUrl || null;
  }

  /**
   * Generate cache key for airline list queries
   */
  private generateAirlineListCacheKey(query: FindAirlinesQueryDto): string {
    const {
      page = 1,
      limit = 10,
      name,
      iataCode,
      icaoCode,
      callsign,
      orderBy = 'name:asc'
    } = query;

    return `airlines_list_page${page}_limit${limit}_name${name || 'all'}_iata${iataCode || 'all'}_icao${icaoCode || 'all'}_callsign${callsign || 'all'}_order${orderBy}`;
  }

  /**
   * Clear airline list cache
   */
  async clearAirlineListCache(): Promise<void> {
    // Clear all airline list cache keys
    for (const cacheKey of this.airlineListCacheKeys) {
      await this.cacheManager.del(cacheKey);
    }
    this.airlineListCacheKeys.clear();
  }


}
