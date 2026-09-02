import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { DemandService } from 'src/demand/demand.service';
import { TravelService } from 'src/travel/travel.service';
import { AirlineService } from 'src/airline/airline.service';
import { CurrencyService } from 'src/currency/currency.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FindDemandsAndTravelsQueryDto } from './dto/FindDemandsAndTravelsQuery.dto';
import { DemandOrTravelResponseDto, PaginatedDemandsAndTravelsResponseDto } from './dto/demand-and-travel-response.dto';
import { DemandTravelAirlineResponseDto } from './dto/airlineResponseDto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { BookmarkEntity, BookmarkType } from 'src/bookmark/entities/bookmark.entity';
import { JwtService } from '@nestjs/jwt';
import { DemandAndTravelMapper } from './demand-and-travel.mapper';
import { ConfigService } from '@nestjs/config';
import { UserEntity, UserRole } from 'src/user/user.entity';
import { AirportService } from 'src/airport/airport.service';
import { VisibilityService } from 'src/common/service/visibility.service';
import { CacheInvalidationService, CacheNamespace } from 'src/common/service/cache-invalidation.service';
import { CommonService } from 'src/common/service/common.service';

@Injectable()
export class DemandAndTravelService {
    constructor(
        private demandService: DemandService, 
        private travelService: TravelService,
        private airlineService: AirlineService,
        private airportService: AirportService,
        private currencyService: CurrencyService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @InjectRepository(BookmarkEntity) private readonly bookmarkRepository: Repository<BookmarkEntity>,
        @InjectRepository(UserEntity) private readonly userRepository: Repository<UserEntity>,
        private readonly jwtService: JwtService,
        private readonly demandAndTravelMapper: DemandAndTravelMapper,
        private readonly configService: ConfigService,
        private readonly visibilityService: VisibilityService,
        private readonly cacheInvalidation: CacheInvalidationService,
        private readonly commonService: CommonService,
    ) {}

    async getDemandsAndTravels(query: FindDemandsAndTravelsQueryDto, user: any): Promise<PaginatedDemandsAndTravelsResponseDto> {
        // Get current user ID - only check bookmarks if user is actually logged in (has numeric ID)
        const currentUserId: number | null = (user?.id && typeof user.id === 'number') ? user.id : null;
        console.log('Current user id:', currentUserId || 'anonymous');
        console.log('🔍 User object:', JSON.stringify(user, null, 2));
        console.log('🔍 User role:', user?.role);
        console.log('🔍 User role type:', typeof user?.role);
        
        console.log('🔍 RAW query received:', JSON.stringify(query));
        
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
        
        console.log('🔍 Cleaned query:', JSON.stringify(cleanedQuery));
        
        // Include user ID in cache key to prevent cache collisions between authenticated and anonymous users
        const cacheKey = this.generateDemandTravelListCacheKey(cleanedQuery, currentUserId, user);
        console.log(`Generated cache key: ${cacheKey}`);
        this.cacheInvalidation.track(CacheNamespace.DEMAND_TRAVEL, cacheKey);
      
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
            email,
            status,
            travelDate,
            type,
            minWeight,
            maxWeight,
            minPricePerKg,
            maxPricePerKg,
            weightAvailable,
            isVerified,
            airlineIataCode,
            departureAirportIataCode,
            arrivalAirportIataCode,
            orderBy = 'createdAt:desc'
        } = cleanedQuery;

        // Extract airline from flightNumber if provided (for caching purposes only)
        // When flightNumber is provided, we filter by exact flightNumber at DB level, not by airlineId
        let foundAirline: any = null;

        if (flightNumber) {
            // Extract IATA code (first 2-3 characters) for airline caching
            const iataCode2 = flightNumber.substring(0, 2).toUpperCase();
            foundAirline = await this.airlineService.findByIataCode(iataCode2, user);
            
            // If 2-char not found, try 3-char
            if (!foundAirline && flightNumber.length >= 3) {
                const iataCode3 = flightNumber.substring(0, 3).toUpperCase();
                foundAirline = await this.airlineService.findByIataCode(iataCode3, user);
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

        // Handle email filter (admin only) - look up user IDs by email and filter after fetching
        const isAdmin = user?.role?.code === 'ADMIN';
        let matchingUserIds: number[] | null = null;
        if (email) {
            if (!isAdmin) {
                console.log('🔒 Ignoring email filter - user is not admin');
            } else {
                console.log('🔍 Debug - Admin filtering by email:', email);
                
                // Look up users with matching email (partial match)
                console.log('🔍 Debug - Searching users with email LIKE:', `%${email}%`);
                const matchingUsers = await this.userRepository.find({
                    where: { email: Like(`%${email}%`) },
                    select: ['id', 'email']
                });
                
                console.log('🔍 Debug - Raw matching users:', JSON.stringify(matchingUsers));
                matchingUserIds = matchingUsers.map(u => u.id);
                console.log('🔍 Debug - Found users matching email:', matchingUserIds.length, 'user IDs:', matchingUserIds);
                
                if (matchingUserIds.length === 0) {
                    // No users match this email - return empty result early
                    console.log('🔍 Debug - No users found matching email, returning empty result');
                    const emptyResponse: PaginatedDemandsAndTravelsResponseDto = {
                        items: [],
                        meta: {
                            currentPage: page,
                            itemsPerPage: limit,
                            totalItems: 0,
                            totalPages: 0,
                            hasPreviousPage: false,
                            hasNextPage: false
                        }
                    };
                    await this.cacheManager.set(cacheKey, emptyResponse, 30000);
                    return emptyResponse;
                }
            }
        }

        // Add airlineId filter if provided (filters by airline at DB level)
        // Note: If both flightNumber and airlineId are provided, flightNumber takes precedence for exact matching
        if (airlineId) {
            console.log('✅ Filtering by airlineId:', airlineId);
            allDemandsQuery.airlineId = airlineId;
            allTravelsQuery.airlineId = airlineId;
        }

        // Resolve airlineIataCode to airlineId if provided
        // This converts the IATA code to the numeric airline ID before the DB query
        if (airlineIataCode) {
            console.log('✅ Filtering by airlineIataCode:', airlineIataCode);
            const airline = await this.airlineService.findByIataCode(airlineIataCode, user);
            if (airline) {
                allDemandsQuery.airlineId = airline.id;
                allTravelsQuery.airlineId = airline.id;
            } else {
                console.log('⚠️ No airline found for IATA code:', airlineIataCode);
                // No airline found - return empty result early
                const emptyResponse: PaginatedDemandsAndTravelsResponseDto = {
                    items: [],
                    meta: {
                        currentPage: page,
                        itemsPerPage: limit,
                        totalItems: 0,
                        totalPages: 0,
                        hasPreviousPage: false,
                        hasNextPage: false
                    }
                };
                await this.cacheManager.set(cacheKey, emptyResponse, 30000);
                return emptyResponse;
            }
        }

        // Resolve departureAirportIataCode to departureAirportId if provided
        // This converts the IATA code to the numeric airport ID before the DB query
        if (departureAirportIataCode) {
            console.log('✅ Filtering by departureAirportIataCode:', departureAirportIataCode);
            const airport = await this.airportService.findByIataCode(departureAirportIataCode, user);
            if (airport) {
                allDemandsQuery.departureAirportId = airport.id;
                allTravelsQuery.departureAirportId = airport.id;
            } else {
                console.log('⚠️ No airport found for IATA code:', departureAirportIataCode);
                const emptyResponse: PaginatedDemandsAndTravelsResponseDto = {
                    items: [],
                    meta: {
                        currentPage: page,
                        itemsPerPage: limit,
                        totalItems: 0,
                        totalPages: 0,
                        hasPreviousPage: false,
                        hasNextPage: false
                    }
                };
                await this.cacheManager.set(cacheKey, emptyResponse, 30000);
                return emptyResponse;
            }
        }

        // Resolve arrivalAirportIataCode to arrivalAirportId if provided
        if (arrivalAirportIataCode) {
            console.log('✅ Filtering by arrivalAirportIataCode:', arrivalAirportIataCode);
            const airport = await this.airportService.findByIataCode(arrivalAirportIataCode, user);
            if (airport) {
                allDemandsQuery.arrivalAirportId = airport.id;
                allTravelsQuery.arrivalAirportId = airport.id;
            } else {
                console.log('⚠️ No airport found for IATA code:', arrivalAirportIataCode);
                const emptyResponse: PaginatedDemandsAndTravelsResponseDto = {
                    items: [],
                    meta: {
                        currentPage: page,
                        itemsPerPage: limit,
                        totalItems: 0,
                        totalPages: 0,
                        hasPreviousPage: false,
                        hasNextPage: false
                    }
                };
                await this.cacheManager.set(cacheKey, emptyResponse, 30000);
                return emptyResponse;
            }
        }

        // Fetch demands and travels in parallel (filtered by exact flightNumber at DB level if provided)
        const [demandsResponse, travelsResponse] = await Promise.all([
            this.demandService.getDemands(allDemandsQuery),
            this.travelService.getAllTravels(allTravelsQuery)
        ]);

        console.log('🔍 Debug - Total demands found:', demandsResponse.items.length);
        console.log('🔍 Debug - Total travels found:', travelsResponse.items.length);
        
        // Debug currency data in demands
        if (demandsResponse.items.length > 0) {
            const firstDemand = demandsResponse.items[0] as any;
            console.log('🔍 Debug - First demand currency check:', {
                demandId: firstDemand.id,
                hasCurrency: !!firstDemand.currency,
                currency: firstDemand.currency,
                currencyId: firstDemand.currencyId,
                allKeys: Object.keys(firstDemand)
            });
        }
        
        // Debug currency data in travels
        if (travelsResponse.items.length > 0) {
            const firstTravel = travelsResponse.items[0] as any;
            console.log('🔍 Debug - First travel currency check:', {
                travelId: firstTravel.id,
                hasCurrency: !!firstTravel.currency,
                currency: firstTravel.currency,
                currencyId: firstTravel.currencyId,
                allKeys: Object.keys(firstTravel)
            });
        }

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

        // Extract currency IDs for prefetching
        const currencyIds = new Set<number>();
        demandsResponse.items.forEach(d => {
            if (d.currencyId) currencyIds.add(d.currencyId);
        });
        travelsResponse.items.forEach(t => {
            if (t.currencyId) currencyIds.add(t.currencyId);
        });
        console.log('🔍 Debug - Unique currency IDs to fetch:', Array.from(currencyIds));

        // Fetch bookmarks in parallel with airline and currency prefetch (if needed)
        // This optimizes by running bookmark query concurrently with airline/currency operations
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
                    return this.prefetchAirlines(allFlightNumbers, user).then(prefetched => {
                        const cache = new Map<string, any>(airlineCache);
                        prefetched.forEach((airline, fn) => cache.set(fn, airline));
                        return cache;
                    });
                }
                return Promise.resolve(airlineCache);
            })();

        // Build currency cache promise
        const currencyCachePromise = currencyIds.size > 0
            ? this.prefetchCurrencies(Array.from(currencyIds))
            : Promise.resolve(new Map<number, any>());

        // Wait for bookmark, airline, and currency operations to complete in parallel
        const [{ travelIds: travelBookmarkedIds, demandIds: demandBookmarkedIds }, finalAirlineCache, currencyCache] = await Promise.all([
            bookmarkPromise,
            airlineCachePromise,
            currencyCachePromise
        ]);
        
        console.log('🔍 Debug - Currency cache size:', currencyCache.size);

        // Transform demands and travels with bookmark status in a single pass
        const demandsWithBookmark = demandsResponse.items.map((demand) => {
            const airline = finalAirlineCache.get(demand.flightNumber) || (demand as any).airline || null;
            const currency = demand.currencyId ? currencyCache.get(demand.currencyId) || null : null;
            const isBookmarked = currentUserId ? demandBookmarkedIds.has(demand.id) : false;
            
            // Debug currency before mapping
            if (demand.id === demandsResponse.items[0]?.id) {
                const demandAny = demand as any;
                console.log('🔍 Debug - Demand before mapping:', {
                    demandId: demand.id,
                    currency: demandAny.currency,
                    currencyId: demand.currencyId,
                    currencyFromCache: currency,
                    hasCurrencyProperty: 'currency' in demandAny
                });
            }
            
            const mapped = this.demandAndTravelMapper.toDemandResponse(demand, airline, isBookmarked, currency);
            
            // Debug currency after mapping
            if (demand.id === demandsResponse.items[0]?.id) {
                console.log('🔍 Debug - Demand after mapping:', {
                    demandId: mapped.id,
                    currency: mapped.currency,
                    hasCurrencyProperty: 'currency' in mapped
                });
            }
            
            return mapped;
        });

        const travelsWithBookmark = travelsResponse.items.map((travel) => {
            const airline = finalAirlineCache.get(travel.flightNumber) || (travel as any).airline || null;
            const currency = travel.currencyId ? currencyCache.get(travel.currencyId) || null : null;
            const isBookmarked = currentUserId ? travelBookmarkedIds.has(travel.id) : false;
            
            // Debug currency before mapping
            if (travel.id === travelsResponse.items[0]?.id) {
                const travelAny = travel as any;
                console.log('🔍 Debug - Travel before mapping:', {
                    travelId: travel.id,
                    currency: travelAny.currency,
                    currencyId: travel.currencyId,
                    currencyFromCache: currency,
                    hasCurrencyProperty: 'currency' in travelAny
                });
            }
            
            const mapped = this.demandAndTravelMapper.toTravelResponse(travel, airline, isBookmarked, currency);
            
            // Debug currency after mapping
            if (travel.id === travelsResponse.items[0]?.id) {
                console.log('🔍 Debug - Travel after mapping:', {
                    travelId: mapped.id,
                    currency: mapped.currency,
                    hasCurrencyProperty: 'currency' in mapped
                });
            }
            
            return mapped;
        });

        // Combine all items
        let combinedItems = [...demandsWithBookmark, ...travelsWithBookmark];

        // Filter out cancelled items
        combinedItems = combinedItems.filter(item => item.status !== 'cancelled');

        // Filter out expired items for non-owners
        // Items where (travelDate + MAX_DISPLAY_DAYS_AFTER_TRAVEL_DATE) < current date
        // should only be visible to the owner
        const maxDisplayDaysRaw = this.configService.get<string>('MAX_DISPLAY_DAYS_AFTER_TRAVEL_DATE', '30');
        const maxDisplayDays = parseInt(maxDisplayDaysRaw, 10) || 30;
        
        const currentDate = new Date();
        currentDate.setUTCHours(0, 0, 0, 0); // Normalize to UTC midnight for date comparison
        
        combinedItems = combinedItems.filter(item => {
            if (!item.deliveryDate) {
                return true;
            }
            
            const deliveryDate = new Date(item.deliveryDate);
            deliveryDate.setUTCHours(0, 0, 0, 0);
            
            const expirationDate = new Date(deliveryDate);
            expirationDate.setUTCDate(expirationDate.getUTCDate() + maxDisplayDays);
            
            if (expirationDate < currentDate) {
                // Check if user is admin (role.code === 'ADMIN') - admin should see everything
                const isAdmin = user?.role?.code === 'ADMIN';
                const isOwner = currentUserId !== null && item.userId === currentUserId;
                if (!isOwner && !isAdmin) {
                    console.log(`🔒 Filtering out expired item: id=${item.id}, type=${item.type}, deliveryDate=${item.deliveryDate}, currentUserId=${currentUserId}, ownerId=${item.userId}`);
                }
                return isOwner || isAdmin; // Show to owner OR admin
            }
            
            return true;
        });

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

        // Filter by matching user IDs from email lookup (admin only)
        if (matchingUserIds && matchingUserIds.length > 0) {
            const userIdSet = new Set(matchingUserIds);
            console.log('🔍 Debug - Email filter userIdSet:', Array.from(userIdSet));
            console.log('🔍 Debug - Combined items userIds before filter:', combinedItems.map(i => i.userId));
            combinedItems = combinedItems.filter(item => 
                userIdSet.has(item.userId)
            );
            console.log('🔍 Debug - After email filter - demands and travels:', combinedItems.length);
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
        const validSortFields = ['createdAt', 'travelDate', 'deliveryDate', 'description', 'flightNumber', 'pricePerKg', 'weight'];
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
                    case 'travelDate':
                    case 'deliveryDate':
                        // travelDate sorting is based on the shared deliveryDate field
                        aValue = a.deliveryDate ? new Date(a.deliveryDate) : new Date(0);
                        bValue = b.deliveryDate ? new Date(b.deliveryDate) : new Date(0);
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
                        // Normalize to USD using CurrencyEntity.exchangeRate (1 [currency] = X USD)
                        // Prefer prefetched currency cache via mapped currency.id; fallback exchangeRate=1
                        const aRate = a.currency?.id ? (currencyCache.get(a.currency.id)?.exchangeRate ?? 1) : 1;
                        const bRate = b.currency?.id ? (currencyCache.get(b.currency.id)?.exchangeRate ?? 1) : 1;
                        aValue = (a.pricePerKg || 0) * Number(aRate);
                        bValue = (b.pricePerKg || 0) * Number(bRate);
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


    private generateDemandTravelListCacheKey(query: FindDemandsAndTravelsQueryDto | any, userId: number | null = null, user?: any): string {
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
            airlineIataCode,
            departureAirportIataCode,
            arrivalAirportIataCode,
            orderBy = 'createdAt:desc'
        } = query;

        // Helper function to normalize values for cache key
        const normalize = (value: any): string => {
            if (value === null || value === undefined || value === '' || value === 'null' || value === 'undefined') {
                return 'all';
            }
            return String(value);
        };

        // Include current user ID and visibility in cache key to prevent cache collisions
        const userContext = userId ? `user${userId}` : 'anon';
        const visibility = this.visibilityService.canViewDeactivated(user) ? 'all' : 'active';
        
        return `demand_travel_list_${userContext}_${visibility}_page${normalize(page)}_limit${normalize(limit)}_desc${normalize(description)}_flight${normalize(flightNumber)}_airline${normalize(airlineId)}_origin${normalize(departureAirportId)}_dest${normalize(arrivalAirportId)}_user${normalize(queryUserId)}_status${normalize(status)}_date${normalize(travelDate)}_type${normalize(type)}_minWeight${normalize(minWeight)}_maxWeight${normalize(maxWeight)}_minPrice${normalize(minPricePerKg)}_maxPrice${normalize(maxPricePerKg)}_weightAvail${normalize(weightAvailable)}_verified${normalize(isVerified)}_airlineIata${normalize(airlineIataCode)}_depAirportIata${normalize(departureAirportIataCode)}_arrAirportIata${normalize(arrivalAirportIataCode)}_order${normalize(orderBy)}`;
    }

    // Method to clear cache when data is updated
    async clearDemandTravelListCache(): Promise<void> {
        await this.cacheInvalidation.invalidateNamespace(CacheNamespace.DEMAND_TRAVEL);
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
    private async prefetchAirlines(flightNumbers: string[], user?: any): Promise<Map<string, any>> {
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
                this.airlineService.findByIataCode(iataCode, user)
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
     * Pre-fetch currencies by IDs to avoid multiple database queries
     */
    private async prefetchCurrencies(currencyIds: number[]): Promise<Map<number, any>> {
        const currencyCache = new Map<number, any>();
        
        if (currencyIds.length === 0) {
            return currencyCache;
        }
        
        console.log(`🔍 Pre-fetching ${currencyIds.length} currencies`);
        
        // Process in batches to avoid overwhelming the database
        const batchSize = 10;
        const batches: number[][] = [];
        
        for (let i = 0; i < currencyIds.length; i += batchSize) {
            batches.push(currencyIds.slice(i, i + batchSize));
        }
        
        // Process batches sequentially with a delay between batches
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            const currencyPromises = batch.map(currencyId =>
                this.currencyService.findOneById(currencyId)
                    .then(currency => ({ currencyId, currency }))
                    .catch(error => {
                        console.warn(`⚠️  Error fetching currency ${currencyId}:`, error.message);
                        return { currencyId, currency: null };
                    })
            );
            
            const batchResults = await Promise.all(currencyPromises);
            
            // Add to cache
            for (const { currencyId, currency } of batchResults) {
                if (currency) {
                    currencyCache.set(currencyId, currency);
                }
            }
            
            // Delay between batches
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log(`✅ Pre-fetched ${currencyCache.size} currencies`);
        return currencyCache;
    }

    /**
     * Helper method to get airline from flight number
     * Extracts first 2-3 characters and matches with IATA code
     */
    public async getAirlineFromFlightNumber(flightNumber: string, user?: any): Promise<DemandTravelAirlineResponseDto | null> {
        if (!flightNumber || flightNumber.length < 2) {
            return null;
        }

        const airline = await this.airlineService.findByFlightNumber(flightNumber, user);

        if (!airline) {
            return null;
        }

        return {
            id: airline.id,
            publicId: airline.publicId,
            name: airline.name,
            icaoCode: airline.icaoCode,
            iataCode: airline.iataCode,
            prefix: airline.prefix,
            logoUrl: this.commonService.resolveAirlineLogoUrl(airline.logoUrl)
        };
    }
}
