import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as https from 'https';
import * as stream from 'stream';
import { AirlineEntity } from './entities/airline.entity';
import { FindAirlinesQueryDto } from './dto/FindAirlinesQueryDto';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { CustomNotFoundException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';
import { UpdateAirlineDto } from './dto/update-airline.dto';
import { CreateAirlineDto } from './dto/create-airline.dto';
import { CloudinaryService } from 'src/file-upload/cloudinary/cloudinary.service';

@Injectable()
export class AirlineService implements OnModuleInit {

  private readonly logger = new Logger(AirlineService.name);
  private airlineListCacheKeys: Set<string> = new Set();

  constructor(
    @InjectRepository(AirlineEntity)
    private airlineRepository: Repository<AirlineEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly cloudinaryService: CloudinaryService,
  ) {}


  async onModuleInit() {
    // Uncomment the line below to run logo migration on startup.
    // Adjust the ID range to match your airline records.
    // await this.downloadLogoAndUpdateUrl(2, 3);
  }

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

  /**
   * Toggle the activation status of an airline (admin/operator only).
   * If the airline is currently active it will be deactivated, and vice versa.
   * A deactivated airline is hidden from regular users but still visible to admins/operators.
   * 
   * @param id - Airline ID
   * @param user - The authenticated admin/operator user
   * @returns The updated airline entity
   */
  async toggleActivation(id: number, user: any): Promise<AirlineEntity> {
    const airline = await this.airlineRepository.findOne({ where: { id } });

    if (!airline) {
      throw new CustomNotFoundException(`Airline with ID ${id} not found`, ErrorCode.AIRLINE_NOT_FOUND);
    }

    // Toggle the current state
    airline.isDeactivated = !airline.isDeactivated;
    airline.updatedBy = user.id;

    const savedAirline = await this.airlineRepository.save(airline);

    // Clear cache so the change takes effect immediately
    await this.clearAirlineListCache();

    const newState = airline.isDeactivated ? 'deactivated' : 'activated';
    this.logger.log(`Airline #${id} (${airline.name}) ${newState} by user #${user.id}`);

    return savedAirline;
  }

  async createAirline(
    createAirlineDto: CreateAirlineDto,
    user: any,
    logo?: Express.Multer.File,
  ): Promise<AirlineEntity> {
    // Check for duplicate ICAO code
    const existing = await this.airlineRepository.findOne({
      where: { icaoCode: createAirlineDto.icaoCode },
    });
    if (existing) {
      throw new CustomNotFoundException(
        `Airline with ICAO code '${createAirlineDto.icaoCode}' already exists`,
        ErrorCode.REVIEW_ALREADY_EXISTS,
      );
    }

    // Handle logo upload if provided
    let logoUrl: string | undefined;
    if (logo) {
      const publicId = createAirlineDto.iataCode || createAirlineDto.icaoCode;
      const result = await this.cloudinaryService.storeAirlineLogoFiles(logo, publicId);
      logoUrl = result.secure_url;
    }

    const airline = this.airlineRepository.create({
      ...createAirlineDto,
      logoUrl,
      createdBy: user.id,
      updatedBy: user.id,
    });

    const savedAirline = await this.airlineRepository.save(airline);

    // Clear cache
    await this.clearAirlineListCache();

    this.logger.log(`Airline created: ${savedAirline.name} (${savedAirline.icaoCode}) by user #${user.id}`);
    return savedAirline;
  }

  async updateAirline(
    id: number,
    updateAirlineDto: UpdateAirlineDto,
    user: any,
    logo?: Express.Multer.File,
  ): Promise<AirlineEntity> {
    const airline = await this.airlineRepository.findOne({ where: { id } });
    if (!airline) {
      throw new CustomNotFoundException(`Airline with ID ${id} not found`, ErrorCode.AIRLINE_NOT_FOUND);
    }

    // Check for duplicate ICAO code if being changed
    if (updateAirlineDto.icaoCode && updateAirlineDto.icaoCode !== airline.icaoCode) {
      const existing = await this.airlineRepository.findOne({
        where: { icaoCode: updateAirlineDto.icaoCode },
      });
      if (existing) {
        throw new CustomNotFoundException(
          `Airline with ICAO code '${updateAirlineDto.icaoCode}' already exists`,
          ErrorCode.REVIEW_ALREADY_EXISTS,
        );
      }
    }

    // Handle logo upload if provided
    if (logo) {
      const publicId = updateAirlineDto.iataCode || airline.iataCode || updateAirlineDto.icaoCode || airline.icaoCode;
      const result = await this.cloudinaryService.storeAirlineLogoFiles(logo, publicId);
      airline.logoUrl = result.secure_url;
    }

    // Merge the DTO fields into the airline entity
    Object.assign(airline, updateAirlineDto);
    airline.updatedBy = user.id;

    const savedAirline = await this.airlineRepository.save(airline);

    // Clear cache
    await this.clearAirlineListCache();

    this.logger.log(`Airline updated: ${savedAirline.name} (ID: ${id}) by user #${user.id}`);
    return savedAirline;
  }

  deleteAirline(id: number) {
    throw new Error('Method not implemented.');
  }


  /**
   * Download airline logos from their current logoUrl and re-upload to Cloudinary.
   * Each logo is stored in Cloudinary under the 'airlinelogos' folder, named with the airline's IATA code.
   * The airline's logoUrl in the database is then updated to the Cloudinary public URL.
   * 
   * This ensures logos are self-hosted and not dependent on third-party services.
   * 
   * @param startId - The starting airline ID (inclusive)
   * @param endId - The ending airline ID (inclusive)
   */
  async downloadLogoAndUpdateUrl(startId: number, endId: number): Promise<void> {
    this.logger.log(`Starting logo migration for airlines with IDs ${startId} to ${endId}...`);

    const airlines = await this.airlineRepository
      .createQueryBuilder('airline')
      .where('airline.id BETWEEN :startId AND :endId', { startId, endId })
      .andWhere('airline.iataCode IS NOT NULL')
      .andWhere('airline.iataCode != :empty', { empty: '' })
      .getMany();

    this.logger.log(`Found ${airlines.length} airlines with IATA codes in the specified ID range.`);

    let successCount = 0;
    let failCount = 0;

    for (const airline of airlines) {
      if (!airline.logoUrl) {
        this.logger.warn(`Airline #${airline.id} (${airline.iataCode}) has no logoUrl. Skipping.`);
        continue;
      }

      try {
        this.logger.log(`Downloading logo for ${airline.name} (${airline.iataCode}) from ${airline.logoUrl}...`);

        // Download the image as a buffer
        const imageBuffer = await this.downloadImage(airline.logoUrl);

        // Create a Multer-like file object for CloudinaryService.storeAirlineLogoFiles
        const fileName = `${airline.iataCode}.${this.getExtension(airline.logoUrl)}`;
        const multerFile: Express.Multer.File = {
          fieldname: 'file',
          originalname: fileName,
          encoding: '7bit',
          mimetype: this.getMimeType(airline.logoUrl),
          buffer: imageBuffer,
          size: imageBuffer.length,
          stream: stream.Readable.from(imageBuffer),
          destination: '',
          filename: fileName,
          path: '',
        };

        // Upload to Cloudinary
        const result = await this.cloudinaryService.storeAirlineLogoFiles(multerFile);

        // Update the airline record with the Cloudinary URL
        airline.logoUrl = result.secure_url;
        await this.airlineRepository.save(airline);

        this.logger.log(`✅ Logo migrated for ${airline.name} (${airline.iataCode}): ${result.secure_url}`);
        successCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`❌ Failed to migrate logo for airline #${airline.id} (${airline.iataCode}): ${msg}`);
        failCount++;
      }
    }

    // Clear cache after bulk update
    await this.clearAirlineListCache();

    this.logger.log(
      `Logo migration complete. Success: ${successCount}, Failed: ${failCount}, Total processed: ${airlines.length}`,
    );
  }

  /**
   * Download an image from a URL and return it as a Buffer.
   */
  private downloadImage(url: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      // Handle both http and https URLs
      const protocol = url.startsWith('https') ? https : require('http');
      
      protocol.get(url, { timeout: 15000 }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
          if (response.headers.location) {
            resolve(this.downloadImage(response.headers.location));
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject)
        .on('timeout', function (this: any) {
          this.destroy();
          reject(new Error(`Timeout downloading ${url}`));
        });
    });
  }

  /**
   * Extract file extension from a URL.
   */
  private getExtension(url: string): string {
    const cleaned = url.split('?')[0].split('#')[0];
    const ext = cleaned.split('.').pop()?.toLowerCase() || 'png';
    // Only allow common image extensions
    const valid = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
    return valid.includes(ext) ? ext : 'png';
  }

  /**
   * Get MIME type from a URL based on file extension.
   */
  private getMimeType(url: string): string {
    const ext = this.getExtension(url);
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
    };
    return mimeMap[ext] || 'image/png';
  }

}
