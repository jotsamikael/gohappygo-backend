import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
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

@Injectable()
export class AirportService implements OnModuleInit {

  private airportListCacheKeys: Set<string> = new Set();

  async onModuleInit() {
    //await this.seedAirportData();
  }

  constructor(
    @InjectRepository(AirportEntity)
    private readonly airportRepository: Repository<AirportEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ){}


   async getAllAirports(query: FindAirportsQueryDto): Promise<PaginatedResponse<AirportEntity>> {
      const cacheKey = this.generateAirportListCacheKey(query);
      this.airportListCacheKeys.add(cacheKey);

      // Check cache first
      const cachedData = await this.cacheManager.get<PaginatedResponse<AirportEntity>>(cacheKey);
      if (cachedData) {
          console.log(`Cache Hit---------> Returning airports list from Cache ${cacheKey}`);
          return cachedData;
      }

      console.log(`Cache Miss---------> Fetching airports from Database ${cacheKey}`);

      const { page = 1, limit = 10, name, municipality, isoCountry, iataCode, icaoCode, continent, isoRegion, type, scheduledService, orderBy = 'name:asc' } = query;
      const skip = (page - 1) * limit;

      // Build query
      const queryBuilder = this.airportRepository.createQueryBuilder('airport');

      // Filter to only include allowed airport types (exclude heliport, seaplane_base, closed, balloonport)
      const allowedTypes = ['medium_airport', 'large_airport'];
      queryBuilder.andWhere('airport.type IN (:...allowedTypes)', { allowedTypes });

      // Apply filters - Use LIKE instead of ILIKE for MySQL
      if (name) {
          queryBuilder.andWhere('LOWER(airport.name) LIKE LOWER(:name)', { name: `%${name}%` });
      }

      if (municipality) {
          queryBuilder.andWhere('LOWER(airport.municipality) LIKE LOWER(:municipality)', { municipality: `%${municipality}%` });
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


  generateAirportListCacheKey(query: FindAirportsQueryDto) : string{
   const { page = 1, limit = 10, name, municipality, isoCountry, iataCode, icaoCode, continent, isoRegion, type, scheduledService, orderBy } = query;
   return `airports:${page}:${limit}:${name}:${municipality}:${isoCountry}:${iataCode}:${icaoCode}:${continent}:${isoRegion}:${type}:${scheduledService}:${orderBy}`;
  }


  //create airport
  async create(createAirportDto: CreateAirportDto) {
    const airport = this.airportRepository.create(createAirportDto)
    const savedAirport = await this.airportRepository.save(airport)
    await this.clearAirportListCache(); // Clear cache after creating a new airport
    return savedAirport
  }

  findAll() {
    return this.airportRepository.find()
  }

  findOne(id: number) {
    return this.airportRepository.findOneBy({id})
  }

  update(id: number, updateAirportDto: UpdateAirportDto) {
    return this.airportRepository.update(id, updateAirportDto)
  }

  remove(id: number) {
    return this.airportRepository.delete(id)
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

  async clearAirportListCache(): Promise<void> {
    for (const cacheKey of this.airportListCacheKeys) {
      await this.cacheManager.del(cacheKey);
    }
    this.airportListCacheKeys.clear();
    console.log('🗑️ Cleared airport list cache');
  }
}
