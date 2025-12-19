import { Inject, Injectable } from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuoteEntity } from './entities/quote.entity';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PaginatedResponse } from 'src/common/interfaces/paginated-reponse.interfaces';
import { FindQuoteQueryDto } from './dto/find-quote-query.dto';
import { CustomNotFoundException } from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';

@Injectable()
export class QuoteService {
  private quoteListCacheKeys: Set<string> = new Set();
  constructor(@InjectRepository(QuoteEntity) private quoteRepository: Repository<QuoteEntity>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  async onModuleInit() {
    await this.seedTravelQuotes();
  }

  async getAllQuotes(query: FindQuoteQueryDto): Promise<PaginatedResponse<QuoteEntity>> {
    const cacheKey = this.generateQuoteListCacheKey(query);
    this.quoteListCacheKeys.add(cacheKey);

    const cachedData = await this.cacheManager.get<PaginatedResponse<QuoteEntity>>(cacheKey);
    if (cachedData) {
      console.log(`Cache Hit---------> Returning quotes list from Cache ${cacheKey}`);
      return cachedData;
    }

    console.log(`Cache Miss---------> Returning quotes list from database`);

    const { page = 1, limit = 10, quote, author, fontFamily, fontSize, orderBy = 'createdAt:desc' } = query;
    const skip = (page - 1) * limit;
    const queryBuilder = this.quoteRepository.createQueryBuilder('quote')
      .skip(skip)
      .take(limit);

    if (quote) {
      queryBuilder.andWhere('quote.quote LIKE :quote', { quote: `%${quote}%` });
    }
    if (author) {
      queryBuilder.andWhere('quote.author LIKE :author', { author: `%${author}%` });
    }
    if (fontFamily) {
      queryBuilder.andWhere('quote.fontFamily LIKE :fontFamily', { fontFamily: `%${fontFamily}%` });
    }
    if (fontSize) {
      queryBuilder.andWhere('quote.fontSize LIKE :fontSize', { fontSize: `%${fontSize}%` });
    }

    // Apply sorting

    const [sortField, sortDirection] = orderBy.split(':');
    const validSortFields = ['createdAt', 'fontFamily', 'fontSize'];
    const validSortDirections = ['asc', 'desc'];
    if (validSortFields.includes(sortField) && validSortDirections.includes(sortDirection)) {
      queryBuilder.orderBy(`quote.${sortField}`, sortDirection.toUpperCase() as 'ASC' | 'DESC');
    } else {
      queryBuilder.orderBy('quote.createdAt', 'DESC'); // default
    }
    const items = await queryBuilder.getMany();
    // Get the count first (without joins to avoid complex queries)
    const totalItems = await queryBuilder.getCount();

    const totalPages = Math.ceil(totalItems / limit);
    const responseResult = {
      items,
      meta: {
        totalItems,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages
      }
    };

    await this.cacheManager.set(cacheKey, responseResult, 30000);
    return responseResult;
  }

  generateQuoteListCacheKey(query: FindQuoteQueryDto) {
    const { page = 1, limit = 10, quote, author, fontFamily, fontSize, orderBy = 'createdAt:desc' } = query;
    return `quotes_list_page${page}_limit${limit}_quote${quote || 'all'}_author${author || 'all'}_fontFamily${fontFamily || 'all'}_fontSize${fontSize || 'all'}_order${orderBy}`;
  }

  /**
   * Clear quote list cache
   */
  private async clearQuoteListCache(): Promise<void> {
    const cacheKeys = Array.from(this.quoteListCacheKeys);
    for (const key of cacheKeys) {
      await this.cacheManager.del(key);
    }
    this.quoteListCacheKeys.clear();
  }


  async create(createQuoteDto: CreateQuoteDto, user: any = null): Promise<QuoteEntity> {
    const quote = this.quoteRepository.create(createQuoteDto);
    if (user) {
      quote.createdBy = user.id;
    }
    const savedQuote = await this.quoteRepository.save(quote);
    
    // Clear cache after creating a new quote
    await this.clearQuoteListCache();
    
    return savedQuote;
  }

  async getRandomQuotes(numberOfQuotes: number): Promise<QuoteEntity[]> {
    return this.quoteRepository.find({ take: numberOfQuotes });
  }



  async update(id: number, updateQuoteDto: UpdateQuoteDto, user: any): Promise<QuoteEntity> {
    console.log('user', user);
    // First, check if quote exists
    const existingQuote = await this.quoteRepository.findOne({ where: { id } });
    
    if (!existingQuote) {
      throw new CustomNotFoundException(`Quote with ID ${id} not found`, ErrorCode.QUOTE_NOT_FOUND);
    }
    
    // Merge the updates with the existing quote
    const updatedQuote = this.quoteRepository.merge(existingQuote, updateQuoteDto);
    
    updatedQuote.updatedBy = user.id;

    // Save and return
    const savedQuote = await this.quoteRepository.save(updatedQuote);
    
    // Clear cache after updating a quote
    await this.clearQuoteListCache();
    
    return savedQuote;
  }

  async remove(id: number): Promise<void> {
    await this.quoteRepository.delete(id);
    
    // Clear cache after deleting a quote
    await this.clearQuoteListCache();
  }

  async seedTravelQuotes(): Promise<QuoteEntity[]> {
    const travelQuotes = [
      {
        quote: 'Travel is the only thing you buy that makes you richer.',
        author: 'Anonymous',
        fontFamily: 'Arial',
        fontSize: '18px'
      },
      {
        quote: 'The world is a book, and those who do not travel read only one page.',
        author: 'Saint Augustine',
        fontFamily: 'Georgia',
        fontSize: '16px'
      },
      {
        quote: 'Not all those who wander are lost.',
        author: 'J.R.R. Tolkien',
        fontFamily: 'Times New Roman',
        fontSize: '20px'
      },
      {
        quote: 'To travel is to live.',
        author: 'Hans Christian Andersen',
        fontFamily: 'Verdana',
        fontSize: '18px'
      },
      {
        quote: 'Adventure is worthwhile.',
        author: 'Aesop',
        fontFamily: 'Helvetica',
        fontSize: '22px'
      }
    ];

    const seededQuotes: QuoteEntity[] = [];

    for (const quoteData of travelQuotes) {
      // Check if quote already exists
      const existingQuote = await this.quoteRepository.findOne({
        where: { quote: quoteData.quote }
      });

      if (!existingQuote) {
        const newQuote = this.quoteRepository.create(quoteData);
        const savedQuote = await this.quoteRepository.save(newQuote);
        seededQuotes.push(savedQuote);
      }
    }

    return seededQuotes;
  }
}



