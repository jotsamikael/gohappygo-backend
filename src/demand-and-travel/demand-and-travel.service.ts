import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { DemandService } from 'src/demand/demand.service';
import { TravelService } from 'src/travel/travel.service';
import { AirlineService } from 'src/airline/airline.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FindDemandsAndTravelsQueryDto } from './dto/FindDemandsAndTravelsQuery.dto';
import { DemandOrTravelResponseDto, PaginatedDemandsAndTravelsResponseDto } from './dto/demand-and-travel-response.dto';
import { PackageKind } from 'src/demand/package-kind.enum';
import { AirlineResponseDto } from './dto/airlineResponseDto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BookmarkEntity, BookmarkType } from 'src/bookmark/entities/bookmark.entity';
import { JwtService } from '@nestjs/jwt';
import { DemandAndTravelMapper } from './demand-and-travel.mapper';

@Injectable()
export class DemandAndTravelService {
    private demandTravelListCacheKeys: Set<string> = new Set();

    constructor(
        private demandService: DemandService, 
        private travelService: TravelService,
        private airlineService: AirlineService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @InjectRepository(BookmarkEntity) private readonly bookmarkRepository: Repository<BookmarkEntity>,
        private readonly jwtService: JwtService,
        private readonly demandAndTravelMapper: DemandAndTravelMapper
    ) {}

    async getDemandsAndTravels(query: FindDemandsAndTravelsQueryDto, user: any): Promise<PaginatedDemandsAndTravelsResponseDto> {
        // Get current user ID - only check bookmarks if user is actually logged in (has numeric ID)
        const currentUserId: number | null = (user?.id && typeof user.id === 'number') ? user.id : null;
        console.log('Current user id:', currentUserId || 'anonymous');
        
        // Clean query parameters - remove null, undefined, empty string values
        const cleanedQuery = Object.fromEntries(
            Object.entries(query).filter(([_, value]) => 
                value !== null && 
                value !== undefined && 
                value !== '' && 
                value !== 'null' && 
                value !== 'undefined'
            )
        ) as FindDemandsAndTravelsQueryDto;
        
        // Include user ID in cache key to prevent cache collisions between authenticated and anonymous users
        const cacheKey = this.generateDemandTravelListCacheKey(cleanedQuery, currentUserId);
        console.log(`Generated cache key: ${cacheKey}`);
        this.demandTravelListCacheKeys.add(cacheKey);
      
        // Check cache first
        const cachedData = await this.cacheManager.get<PaginatedDemandsAndTravelsResponseDto>(cacheKey);
        if (cachedData) {
            console.log(`Cache Hit---------> Returning demands and travels list from Cache ${cacheKey}`);
            return cachedData;
        }
      
        console.log(`Cache Miss---------> Returning demands and travels list from database`);

        const {
            page = 1,
            limit = 10,
            description,
            flightNumber,
            airlineId,
            departureAirportId,
            arrivalAirportId,
            userId,
            status,
            travelDate,
            type,
            minWeight,
            maxWeight,
            minPricePerKg,
            maxPricePerKg,
            weightAvailable,
            isVerified,
            orderBy = 'createdAt:desc'
        } = cleanedQuery;

        // Extract airline from flightNumber if provided (for caching purposes only)
        // When flightNumber is provided, we filter by exact flightNumber at DB level, not by airlineId
        let foundAirline: any = null;

        if (flightNumber) {
            // Extract IATA code (first 2-3 characters) for airline caching
            const iataCode2 = flightNumber.substring(0, 2).toUpperCase();
            foundAirline = await this.airlineService.findByIataCode(iataCode2);
            
            // If 2-char not found, try 3-char
            if (!foundAirline && flightNumber.length >= 3) {
                const iataCode3 = flightNumber.substring(0, 3).toUpperCase();
                foundAirline = await this.airlineService.findByIataCode(iataCode3);
            }
        }

        // Build queries - filter by exact flightNumber at DB level when provided
        const allDemandsQuery: any = {
            page: 1,
            limit: 1000,
            orderBy: 'createdAt:desc'
        };

        const allTravelsQuery: any = {
            page: 1,
            limit: 1000,
            orderBy: 'createdAt:desc'
        };

        // Add exact flightNumber filter if provided (exact match at DB level)
        if (flightNumber) {
            console.log('✅ Filtering by exact flightNumber:', flightNumber);
            allDemandsQuery.flightNumber = flightNumber;
            allTravelsQuery.flightNumber = flightNumber;
        }

        // Add airlineId filter if provided (filters by airline at DB level)
        // Note: If both flightNumber and airlineId are provided, flightNumber takes precedence for exact matching
        if (airlineId) {
            console.log('✅ Filtering by airlineId:', airlineId);
            allDemandsQuery.airlineId = airlineId;
            allTravelsQuery.airlineId = airlineId;
        }

        // Fetch demands and travels in parallel (filtered by exact flightNumber at DB level if provided)
        const [demandsResponse, travelsResponse] = await Promise.all([
            this.demandService.getDemands(allDemandsQuery),
            this.travelService.getAllTravels(allTravelsQuery)
        ]);

        console.log('🔍 Debug - Total demands found:', demandsResponse.items.length);
        console.log('🔍 Debug - Total travels found:', travelsResponse.items.length);

        // Extract IDs for bookmark lookup
        const travelIds = travelsResponse.items.map(t => t.id).filter(Boolean);
        const demandIds = demandsResponse.items.map(d => d.id).filter(Boolean);

        // Initialize airline cache
        const airlineCache = new Map<string, any>();
        
        // Pre-populate cache with found airline if available
        if (foundAirline) {
            const allFlightNumbers = [
                ...demandsResponse.items.map(d => d.flightNumber).filter(Boolean),
                ...travelsResponse.items.map(t => t.flightNumber).filter(Boolean)
            ];
            allFlightNumbers.forEach(fn => {
                if (fn) {
                    const fnIata = fn.substring(0, 2).toUpperCase();
                    if (fnIata === foundAirline.iataCode) {
                        airlineCache.set(fn, foundAirline);
                    }
                }
            });
        }

        // Fetch bookmarks in parallel with airline prefetch (if needed)
        // This optimizes by running bookmark query concurrently with airline operations
        const bookmarkPromise = currentUserId && (travelIds.length > 0 || demandIds.length > 0)
            ? this.fetchUserBookmarksBatch(currentUserId, travelIds, demandIds)
            : Promise.resolve({ travelIds: new Set<number>(), demandIds: new Set<number>() });

        // Build airline cache promise - skip expensive prefetch if we already have the airline
        const airlineCachePromise = foundAirline
            ? Promise.resolve(airlineCache) // Already populated
            : (() => {
                const allFlightNumbers = [
                    ...demandsResponse.items.map(d => d.flightNumber).filter(Boolean),
                    ...travelsResponse.items.map(t => t.flightNumber).filter(Boolean)
                ];
                if (allFlightNumbers.length > 0) {
                    return this.prefetchAirlines(allFlightNumbers).then(prefetched => {
                        const cache = new Map<string, any>(airlineCache);
                        prefetched.forEach((airline, fn) => cache.set(fn, airline));
                        return cache;
                    });
                }
                return Promise.resolve(airlineCache);
            })();

        // Wait for both bookmark and airline operations to complete in parallel
        const [{ travelIds: travelBookmarkedIds, demandIds: demandBookmarkedIds }, finalAirlineCache] = await Promise.all([
            bookmarkPromise,
            airlineCachePromise
        ]);

        // Transform demands and travels with bookmark status in a single pass
        const demandsWithBookmark = demandsResponse.items.map((demand) => {
            const airline = finalAirlineCache.get(demand.flightNumber) || demand.airline || null;
            const isBookmarked = currentUserId ? demandBookmarkedIds.has(demand.id) : false;
            return this.demandAndTravelMapper.toDemandResponse(demand, airline, isBookmarked);
        });

        const travelsWithBookmark = travelsResponse.items.map((travel) => {
            const airline = finalAirlineCache.get(travel.flightNumber) || travel.airline || null;
            const isBookmarked = currentUserId ? travelBookmarkedIds.has(travel.id) : false;
            return this.demandAndTravelMapper.toTravelResponse(travel, airline, isBookmarked);
        });

        // Combine all items
        let combinedItems = [...demandsWithBookmark, ...travelsWithBookmark];

        // Filter out cancelled items
        combinedItems = combinedItems.filter(item => item.status !== 'cancelled');

        // Apply filters manually
        if (description) {
            combinedItems = combinedItems.filter(item => 
                item.description.toLowerCase().includes(description.toLowerCase())
            );
        }

        // flightNumber filter is already applied at DB level, no need to filter again in memory

        if (departureAirportId) {
            combinedItems = combinedItems.filter(item => 
                item.departureAirportId === departureAirportId
            );
        }

        if (arrivalAirportId) {
            combinedItems = combinedItems.filter(item => 
                item.arrivalAirportId === arrivalAirportId
            );
        }

        if (userId) {
            combinedItems = combinedItems.filter(item => 
                item.userId === userId
            );
        }

        if (status) {
            combinedItems = combinedItems.filter(item => 
                item.status === status
            );
        }

        if (travelDate) {
            const targetDate = new Date(travelDate);
            combinedItems = combinedItems.filter(item => {
                const itemDate = new Date(item.deliveryDate);
                return itemDate.toDateString() === targetDate.toDateString();
            });
        }

        if (type) {
            combinedItems = combinedItems.filter(item => 
                item.type === type
            );
        }

        if (minWeight !== undefined) {
            combinedItems = combinedItems.filter(item => {
                // For demands, check weight property
                if (item.type === 'demand' && 'weight' in item && item.weight !== undefined) {
                    return item.weight >= minWeight;
                }
                // For travels, check weightAvailable property
                if (item.type === 'travel' && 'weightAvailable' in item && item.weightAvailable !== undefined) {
                    return item.weightAvailable >= minWeight;
                }
                // If neither condition matches, exclude the item
                return false;
            });
        }

        if (maxWeight !== undefined) {
            combinedItems = combinedItems.filter(item => {
                // For demands, check weight property
                if (item.type === 'demand' && 'weight' in item && item.weight !== undefined) {
                    return item.weight <= maxWeight;
                }
                // For travels, check weightAvailable property
                if (item.type === 'travel' && 'weightAvailable' in item && item.weightAvailable !== undefined) {
                    return item.weightAvailable <= maxWeight;
                }
                // If neither condition matches, exclude the item
                return false;
            });
        }

        if (minPricePerKg !== undefined) {
            combinedItems = combinedItems.filter(item => 
                item.pricePerKg !== undefined && item.pricePerKg >= minPricePerKg
            );
        }

        if (maxPricePerKg !== undefined) {
            combinedItems = combinedItems.filter(item => 
                item.pricePerKg !== undefined && item.pricePerKg <= maxPricePerKg
            );
        }

        if (weightAvailable !== undefined) {
            combinedItems = combinedItems.filter(item => 
                'weightAvailable' in item && item.weightAvailable !== undefined && item.weightAvailable >= weightAvailable
            );
        }

        // Add isVerified filter (new)
        if (isVerified !== undefined) {
            combinedItems = combinedItems.filter(item => 
                item.user?.isVerified === isVerified
            );
        }

        // Apply sorting
        const [sortField, sortDirection] = orderBy.split(':');
        const validSortFields = ['createdAt', 'deliveryDate', 'description', 'flightNumber', 'pricePerKg', 'weight'];
        const validSortDirections = ['asc', 'desc'];

        if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
            combinedItems.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                switch (sortField) {
                    case 'createdAt':
                        aValue = new Date(a.createdAt);
                        bValue = new Date(b.createdAt);
                        break;
                    case 'deliveryDate':
                        aValue = new Date(a.deliveryDate);
                        bValue = new Date(b.deliveryDate);
                        break;
                    case 'description':
                        aValue = a.description;
                        bValue = b.description;
                        break;
                    case 'flightNumber':
                        aValue = a.flightNumber;
                        bValue = b.flightNumber;
                        break;
                    case 'pricePerKg':
                        aValue = a.pricePerKg || 0;
                        bValue = b.pricePerKg || 0;
                        break;
                    case 'weight':
                        aValue = ('weight' in a ? a.weight : 0) || 0;
                        bValue = ('weight' in b ? b.weight : 0) || 0;
                        break;
                    default:
                        aValue = new Date(a.createdAt);
                        bValue = new Date(b.createdAt);
                }

                if (sortDirection === 'asc') {
                    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                } else {
                    return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                }
            });
        }

        // Apply pagination
        const totalItems = combinedItems.length;
        const totalPages = Math.ceil(totalItems / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedItems = combinedItems.slice(startIndex, endIndex);

        const responseResult: PaginatedDemandsAndTravelsResponseDto = {
            items: paginatedItems,
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


    private generateDemandTravelListCacheKey(query: FindDemandsAndTravelsQueryDto | any, userId: number | null = null): string {
        const {
            page = 1,
            limit = 10,
            description,
            flightNumber,
            airlineId,
            departureAirportId,
            arrivalAirportId,
            userId: queryUserId,
            status,
            travelDate,
            type,
            minWeight,
            maxWeight,
            minPricePerKg,
            maxPricePerKg,
            weightAvailable,
            isVerified,
            orderBy = 'createdAt:desc'
        } = query;

        // Helper function to normalize values for cache key
        const normalize = (value: any): string => {
            if (value === null || value === undefined || value === '' || value === 'null' || value === 'undefined') {
                return 'all';
            }
            return String(value);
        };

        // Include current user ID in cache key to prevent cache collisions
        const userContext = userId ? `user${userId}` : 'anon';
        
        return `demand_travel_list_${userContext}_page${normalize(page)}_limit${normalize(limit)}_desc${normalize(description)}_flight${normalize(flightNumber)}_airline${normalize(airlineId)}_origin${normalize(departureAirportId)}_dest${normalize(arrivalAirportId)}_user${normalize(queryUserId)}_status${normalize(status)}_date${normalize(travelDate)}_type${normalize(type)}_minWeight${normalize(minWeight)}_maxWeight${normalize(maxWeight)}_minPrice${normalize(minPricePerKg)}_maxPrice${normalize(maxPricePerKg)}_weightAvail${normalize(weightAvailable)}_verified${normalize(isVerified)}_order${normalize(orderBy)}`;
    }

    // Method to clear cache when data is updated
    async clearDemandTravelListCache(): Promise<void> {
        for (const cacheKey of this.demandTravelListCacheKeys) {
            await this.cacheManager.del(cacheKey);
        }
        this.demandTravelListCacheKeys.clear();
    }

    /**
     * Fetch user bookmarks for both travels and demands in a single optimized query
     * This combines two separate queries into one, reducing database round trips
     */
    private async fetchUserBookmarksBatch(
        userId: number,
        travelIds: number[],
        demandIds: number[]
    ): Promise<{ travelIds: Set<number>, demandIds: Set<number> }> {
        // Build conditions for combined query
        const conditions: any[] = [];
        
        if (travelIds.length > 0) {
            conditions.push({
                userId,
                bookmarkType: BookmarkType.TRAVEL,
                travelId: In(travelIds)
            });
        }
        
        if (demandIds.length > 0) {
            conditions.push({
                userId,
                bookmarkType: BookmarkType.DEMAND,
                demandId: In(demandIds)
            });
        }

        // If no IDs to check, return empty sets
        if (conditions.length === 0) {
            return { travelIds: new Set<number>(), demandIds: new Set<number>() };
        }

        // Single query for both bookmark types
        const bookmarks = await this.bookmarkRepository.find({
            where: conditions,
            select: ['travelId', 'demandId', 'bookmarkType']
        });

        // Separate travel and demand bookmarks
        const travelBookmarkedIds = new Set<number>();
        const demandBookmarkedIds = new Set<number>();

        bookmarks.forEach(bookmark => {
            if (bookmark.bookmarkType === BookmarkType.TRAVEL && bookmark.travelId) {
                travelBookmarkedIds.add(bookmark.travelId);
            } else if (bookmark.bookmarkType === BookmarkType.DEMAND && bookmark.demandId) {
                demandBookmarkedIds.add(bookmark.demandId);
            }
        });

        return { travelIds: travelBookmarkedIds, demandIds: demandBookmarkedIds };
    }

    /**
     * Pre-fetch airlines for multiple flight numbers to avoid connection pool exhaustion
     * This method deduplicates IATA codes and fetches them efficiently with improved error handling
     */
    private async prefetchAirlines(flightNumbers: string[]): Promise<Map<string, any>> {
        const airlineCache = new Map<string, any>();
        
        // Extract unique IATA codes from flight numbers
        const iataCodesSet = new Set<string>();
        
        for (const flightNumber of flightNumbers) {
            if (!flightNumber || flightNumber.length < 2) {
                continue;
            }
            
            // Only try 2-character IATA code (standard, most common)
            // Validate it's actually alphabetic before adding
            const iataCode2 = flightNumber.substring(0, 2).toUpperCase();
            if (/^[A-Z]{2}$/.test(iataCode2)) {
                iataCodesSet.add(iataCode2);
            }
        }
        
        const uniqueIataCodes = Array.from(iataCodesSet);
        console.log(`🔍 Pre-fetching ${uniqueIataCodes.length} unique airline IATA codes from ${flightNumbers.length} flight numbers`);
        
        // Process in smaller batches with delays to avoid overwhelming DB
        const batchSize = 5; // Further reduced from 10 to minimize connection pool usage
        const batches: string[][] = [];
        
        for (let i = 0; i < uniqueIataCodes.length; i += batchSize) {
            batches.push(uniqueIataCodes.slice(i, i + batchSize));
        }
        
        // Process batches sequentially with a delay between batches
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            const airlinePromises = batch.map(iataCode => 
                this.airlineService.findByIataCode(iataCode)
                    .then(airline => ({ iataCode, airline }))
                    .catch(error => {
                        // Only log connection errors
                        if (error.code === 'PROTOCOL_CONNECTION_LOST' || 
                            error.code === 'ETIMEDOUT' || 
                            error.code === 'ECONNREFUSED' ||
                            error.code === 'ECONNRESET') {
                            console.warn(`⚠️  Database connection error for IATA code ${iataCode}:`, error.code);
                        }
                        // Return null for any error (not found or connection issues)
                        return { iataCode, airline: null };
                    })
            );
            
            const batchResults = await Promise.all(airlinePromises);
            
            // Build IATA to airline map
            const iataToAirlineMap = new Map<string, any>();
            for (const { iataCode, airline } of batchResults) {
                if (airline) {
                    iataToAirlineMap.set(iataCode, airline);
                }
            }
            
            // Map flight numbers to airlines
            for (const flightNumber of flightNumbers) {
                if (airlineCache.has(flightNumber)) {
                    continue; // Already found
                }
                
                if (!flightNumber || flightNumber.length < 2) {
                    continue;
                }
                
                // Try 2-character IATA code
                const iataCode2 = flightNumber.substring(0, 2).toUpperCase();
                if (iataToAirlineMap.has(iataCode2)) {
                    airlineCache.set(flightNumber, iataToAirlineMap.get(iataCode2));
                }
            }
            
            // Delay between batches to avoid overwhelming the connection pool
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay (increased from 100ms)
            }
        }
        
        console.log(`✅ Pre-fetched ${airlineCache.size} airlines for ${flightNumbers.length} flight numbers`);
        return airlineCache;
    }

    /**
     * Helper method to get airline from flight number
     * Extracts first 2-3 characters and matches with IATA code
     */
    public async getAirlineFromFlightNumber(flightNumber: string): Promise<AirlineResponseDto | null> {
        if (!flightNumber || flightNumber.length < 2) {
            return null;
        }

        // Try 2-character IATA code first (most common)
        let iataCode = flightNumber.substring(0, 2).toUpperCase();
        let airline = await this.airlineService.findByIataCode(iataCode);

        // If not found, try 3-character code
        if (!airline && flightNumber.length >= 3) {
            iataCode = flightNumber.substring(0, 3).toUpperCase();
            airline = await this.airlineService.findByIataCode(iataCode);
        }

        if (!airline) {
            return null;
        }

        return {
            id: airline.id,
            name: airline.name,
            icaoCode: airline.icaoCode,
            iataCode: airline.iataCode,
            prefix: airline.prefix,
            logoUrl: airline.logoUrl
        };
    }
}
