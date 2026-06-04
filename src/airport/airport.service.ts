import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateAirportDto } from './dto/create-airport.dto';
import { UpdateAirportDto } from './dto/update-airport.dto';
import { AirportEntity } from './entities/airport.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { FindAirportsQueryDto } from './dto/find-airports-query.dto';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CustomConflictException, CustomNotFoundException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { VisibilityService } from 'src/common/service/visibility.service';
import { CacheInvalidationService, CacheNamespace } from 'src/common/service/cache-invalidation.service';

@Injectable()
export class AirportService implements OnModuleInit {

  private readonly logger = new Logger(AirportService.name);

  async onModuleInit() {
    //await this.seedAirportData();
  }

  constructor(
    @InjectRepository(AirportEntity)
    private readonly airportRepository: Repository<AirportEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly visibilityService: VisibilityService,
    private readonly cacheInvalidation: CacheInvalidationService,
  ){}


   async getAllAirports(query: FindAirportsQueryDto, user?: any): Promise<PaginatedResponse<AirportEntity>> {
      const cacheKey = this.generateAirportListCacheKey(query, user);
      this.cacheInvalidation.track(CacheNamespace.AIRPORTS, cacheKey);

      // Check cache first
      const cachedData = await this.cacheManager.get<PaginatedResponse<AirportEntity>>(cacheKey);
      if (cachedData) {
          console.log(`Cache Hit---------> Returning airports list from Cache ${cacheKey}`);
          return cachedData;
      }

      console.log(`Cache Miss---------> Fetching airports from Database ${cacheKey}`);

      const { page = 1, limit = 10, name, municipality, municipalityOrName, isoCountry, iataCode, icaoCode, continent, isoRegion, type, scheduledService, orderBy = 'name:asc' } = query;
      const skip = (page - 1) * limit;

      // Build query
      const queryBuilder = this.airportRepository.createQueryBuilder('airport');

      // Filter to only include allowed airport types (exclude heliport, seaplane_base, closed, balloonport)
      const allowedTypes = ['medium_airport', 'large_airport'];
      queryBuilder.andWhere('airport.type IN (:...allowedTypes)', { allowedTypes });

      this.visibilityService.applyIsDeactivatedToQueryBuilder(user, queryBuilder, 'airport');

      // Apply filters - Use LIKE instead of ILIKE for MySQL
      if (name) {
          queryBuilder.andWhere('LOWER(airport.name) LIKE LOWER(:name)', { name: `%${name}%` });
      }

      if (municipality) {
          queryBuilder.andWhere('LOWER(airport.municipality) LIKE LOWER(:municipality)', { municipality: `%${municipality}%` });
      }

      // Search by municipality or name (OR condition)
      if (municipalityOrName) {
          queryBuilder.andWhere(
              '(LOWER(airport.municipality) LIKE LOWER(:municipalityOrName) OR LOWER(airport.name) LIKE LOWER(:municipalityOrName))',
              { municipalityOrName: `%${municipalityOrName}%` }
          );
      }

      if (isoCountry) {
          queryBuilder.andWhere('LOWER(airport.isoCountry) LIKE LOWER(:isoCountry)', { isoCountry: `%${isoCountry}%` });
      }

      if (iataCode) {
          queryBuilder.andWhere('LOWER(airport.iataCode) LIKE LOWER(:iataCode)', { iataCode: `%${iataCode}%` });
      }

      if (icaoCode) {
          queryBuilder.andWhere('LOWER(airport.icaoCode) LIKE LOWER(:icaoCode)', { icaoCode: `%${icaoCode}%` });
      }

      if (continent) {
          queryBuilder.andWhere('LOWER(airport.continent) LIKE LOWER(:continent)', { continent: `%${continent}%` });
      }

      if (isoRegion) {
          queryBuilder.andWhere('LOWER(airport.isoRegion) LIKE LOWER(:isoRegion)', { isoRegion: `%${isoRegion}%` });
      }

      if (type) {
          queryBuilder.andWhere('LOWER(airport.type) LIKE LOWER(:type)', { type: `%${type}%` });
      }

      // Add scheduled service filter
      if (scheduledService) {
          queryBuilder.andWhere('airport.scheduledService = :scheduledService', { scheduledService: scheduledService });
      }

      // Add viewport filtering
      if (query.latitudeMin !== undefined && query.latitudeMax !== undefined) {
        queryBuilder.andWhere('airport.latitudeDeg BETWEEN :latMin AND :latMax', {
          latMin: query.latitudeMin,
          latMax: query.latitudeMax
        });
      }
      
      if (query.longitudeMin !== undefined && query.longitudeMax !== undefined) {
        queryBuilder.andWhere('airport.longitudeDeg BETWEEN :lngMin AND :lngMax', {
          lngMin: query.longitudeMin,
          lngMax: query.longitudeMax
        });
      }

      // Apply sorting
      if (orderBy) {
          const [sortField, sortOrder] = orderBy.split(':');
          const validSortFields = ['name', 'municipality', 'isoCountry', 'iataCode', 'icaoCode', 'continent', 'createdAt'];
          const validSortOrders = ['asc', 'desc'];

          if (validSortFields.includes(sortField) && validSortOrders.includes(sortOrder)) {
              queryBuilder.orderBy(`airport.${sortField}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');
          } else {
              // Default sorting
              queryBuilder.orderBy('airport.name', 'ASC');
          }
      } else {
          queryBuilder.orderBy('airport.name', 'ASC');
      }

      // Get total count
      const totalItems = await queryBuilder.getCount();

      // Apply pagination
      queryBuilder.skip(skip).take(limit);

      // Execute query
      const items = await queryBuilder.getMany();

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalItems / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      const result: PaginatedResponse<AirportEntity> = {
          items,
          meta: {
              currentPage: page,
              itemsPerPage: limit,
              totalItems,
              totalPages,
              hasNextPage, 
              hasPreviousPage
          }
      };

      // Cache the result
      await this.cacheManager.set(cacheKey, result, 300000); // Cache for 5 minutes

      console.log(`✅ Fetched ${items.length} airports (page ${page}/${totalPages})`);
      return result;
   }


  generateAirportListCacheKey(query: FindAirportsQueryDto, user?: any): string {
   const { page = 1, limit = 10, name, municipality, municipalityOrName, isoCountry, iataCode, icaoCode, continent, isoRegion, type, scheduledService, orderBy } = query;
   const visibility = this.visibilityService.canViewDeactivated(user) ? 'all' : 'active';
   return `airports:${visibility}:${page}:${limit}:${name}:${municipality}:${municipalityOrName}:${isoCountry}:${iataCode}:${icaoCode}:${continent}:${isoRegion}:${type}:${scheduledService}:${orderBy}`;
  }


  async create(createAirportDto: CreateAirportDto, user: { id: number }): Promise<AirportEntity> {
    const existing = await this.airportRepository.findOne({
      where: { ident: createAirportDto.ident },
    });
    if (existing) {
      throw new CustomConflictException(
        `Airport with ident '${createAirportDto.ident}' already exists`,
        ErrorCode.AIRPORT_ALREADY_EXISTS,
      );
    }

    const airport = this.airportRepository.create({
      ...createAirportDto,
      createdBy: user.id,
      updatedBy: user.id,
    });
    const savedAirport = await this.airportRepository.save(airport);
    await this.clearAirportListCache();

    this.logger.log(`Airport created: ${savedAirport.name} (${savedAirport.ident}) by user #${user.id}`);
    return savedAirport;
  }

  findAll() {
    return this.airportRepository.find();
  }

  /**
   * Public GET /airports/:id — hides deactivated airports from visitors and regular users.
   */
  async findOne(id: number, user?: any): Promise<AirportEntity> {
    const airport = await this.findOneById(id);

    if (airport.isDeactivated && !this.visibilityService.canViewDeactivated(user)) {
      throw new CustomNotFoundException(`Airport with ID ${id} not found`, ErrorCode.AIRPORT_NOT_FOUND);
    }
    
    return airport;
  }

  /**
   * Resolve airport by id for linked data (requests, travels, emails) — includes deactivated.
   */
  async findOneById(id: number): Promise<AirportEntity> {
    const airport = await this.airportRepository.findOneBy({ id });

    if (!airport) {
      throw new CustomNotFoundException(`Airport with ID ${id} not found`, ErrorCode.AIRPORT_NOT_FOUND);
    }

    return airport;
  }

  /**
   * Find airport by IATA for search/filter UIs — respects deactivation visibility.
   */
  async findByIataCode(iataCode: string, user?: any): Promise<AirportEntity | null> {
    const where = this.visibilityService.applyIsDeactivatedFilter(user, {
      iataCode: iataCode.toUpperCase(),
    });
    return this.airportRepository.findOne({ where });
  }

  /** Resolve airport by IATA for existing records — includes deactivated. */
  async findByIataCodeForReference(iataCode: string): Promise<AirportEntity | null> {
    return this.airportRepository.findOne({
      where: { iataCode: iataCode.toUpperCase() },
    });
  }

  private async findOneForManagement(id: number): Promise<AirportEntity> {
    return this.findOneById(id);
  }

  async update(
    id: number,
    updateAirportDto: UpdateAirportDto,
    user: { id: number },
  ): Promise<AirportEntity> {
    const airport = await this.findOneForManagement(id);

    if (updateAirportDto.ident && updateAirportDto.ident !== airport.ident) {
      const existing = await this.airportRepository.findOne({
        where: { ident: updateAirportDto.ident },
      });
      if (existing) {
        throw new CustomConflictException(
          `Airport with ident '${updateAirportDto.ident}' already exists`,
          ErrorCode.AIRPORT_ALREADY_EXISTS,
        );
      }
    }

    Object.assign(airport, updateAirportDto);
    airport.updatedBy = user.id;

    const savedAirport = await this.airportRepository.save(airport);
    await this.clearAirportListCache();

    this.logger.log(`Airport updated: ${savedAirport.name} (ID: ${id}) by user #${user.id}`);
    return savedAirport;
  }

  async remove(id: number): Promise<void> {
    const airport = await this.findOneForManagement(id);
    await this.airportRepository.delete(id);
    await this.clearAirportListCache();
    this.logger.log(`Airport deleted: ${airport.name} (ID: ${id})`);
  }




  
  
 

  /**
   * Seeds airport data from the JSON file when the application starts
   * This ensures all airports are available for travel and demand creation
   
  private async seedAirportData(): Promise<void> {
    try {
      // Check if airports already exist
      const existingAirports = await this.airportRepository.count();
      if (existingAirports > 0) {
        console.log(` ${existingAirports} airports already exist in database`);
        return;
      }

      // Read the airports JSON file using process.cwd()
      const airportsFilePath = path.join(process.cwd(), 'src', 'airport', 'data', 'airports.json');
      console.log(` Attempting to read file from: ${airportsFilePath}`);
      
      const airportsData = fs.readFileSync(airportsFilePath, 'utf8');
      const airports = JSON.parse(airportsData);

      console.log(`📊Found ${airports.length} airports in JSON file`);

      // Transform the data to match the new entity structure
      const airportEntities = airports.map((airport: any) => {
        return this.airportRepository.create({
          ident: airport.ident,
          type: airport.type,
          name: airport.name,
          latitudeDeg: airport.latitude_deg ? parseFloat(airport.latitude_deg) : null,
          longitudeDeg: airport.longitude_deg ? parseFloat(airport.longitude_deg) : null,
          elevationFt: airport.elevation_ft ? parseInt(airport.elevation_ft) : null,
          continent: airport.continent,
          isoCountry: airport.iso_country,
          isoRegion: airport.iso_region,
          municipality: airport.municipality,
          scheduledService: airport.scheduled_service,
          icaoCode: airport.icao_code,
          iataCode: airport.iata_code,
          gpsCode: airport.gps_code,
          localCode: airport.local_code,
          homeLink: airport.home_link,
          wikipediaLink: airport.wikipedia_link,
          keywords: airport.keywords
        });
      });

      // Save all airports in batches to avoid memory issues
      const batchSize = 100;
      let savedCount = 0;

      for (let i = 0; i < airportEntities.length; i += batchSize) {
        const batch = airportEntities.slice(i, i + batchSize);
        await this.airportRepository.save(batch);
        savedCount += batch.length;
        console.log(`✈️ Saved batch ${Math.floor(i / batchSize) + 1}: ${savedCount}/${airports.length} airports`);
      }

      console.log(`🟢 Successfully seeded ${savedCount} airports`);
      
      // Get unique continents for display
      const uniqueContinents = [...new Set(airports.map((a: any) => a.continent))];
      console.log(` Continents available: ${uniqueContinents.slice(0, 5).join(', ')}${uniqueContinents.length > 5 ? ` and ${uniqueContinents.length - 5} more...` : ''}`);

    } catch (error) {
      console.error(`🔴 Failed to seed airport data:`, error.message);
      
      if (error.code === 'ENOENT') {
        console.error(`💡 Make sure the airports.json file exists at: src/airport/data/airports.json`);
        console.error(` Current directory: ${process.cwd()}`);
      }
      
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`💡 Some airports might already exist. Continuing...`);
      }
      
      // Log the full error for debugging
      console.error(`🔍 Full error:`, error);
    }
  }*/

  /**
   * Toggle the activation status of an airport (admin/operator only).
   * If the airport is currently active it will be deactivated, and vice versa.
   * A deactivated airport is hidden from regular users but still visible to admins/operators.
   * 
   * @param id - Airport ID
   * @param user - The authenticated admin/operator user
   * @returns The updated airport entity
   */
  async toggleActivation(id: number, user: any): Promise<AirportEntity> {
    const airport = await this.findOneForManagement(id);

    // Toggle the current state
    airport.isDeactivated = !airport.isDeactivated;
    airport.updatedBy = user.id;

    const savedAirport = await this.airportRepository.save(airport);

    // Clear cache so the change takes effect immediately
    await this.clearAirportListCache();

    const newState = airport.isDeactivated ? 'deactivated' : 'activated';
    this.logger.log(`Airport #${id} (${airport.ident}) ${newState} by user #${user.id}`);

    return savedAirport;
  }

  async clearAirportListCache(): Promise<void> {
    await this.cacheInvalidation.invalidateNamespace(CacheNamespace.AIRPORTS);
    await this.cacheInvalidation.invalidateNamespace(CacheNamespace.DEMAND_TRAVEL);
    this.logger.log('Cleared airport and demand-travel caches');
  }
}
