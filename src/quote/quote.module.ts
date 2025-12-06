import { Module } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { QuoteController } from './quote.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuoteEntity } from './entities/quote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QuoteEntity])],
  controllers: [QuoteController],
  providers: [QuoteService],
})
export class QuoteModule {}
