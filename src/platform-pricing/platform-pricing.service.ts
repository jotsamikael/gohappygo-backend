import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CreatePlatformPricingDto } from './dto/create-platform-pricing.dto';
import { UpdatePlatformPricingDto } from './dto/update-platform-pricing.dto';
import { FindPlatformPricingQueryDto } from './dto/find-platform-pricing-query.dto';
import { PlatformPricingEntity } from './entities/platform-pricing.entity';
import { PlatformPricingResponseDto } from './dto/platform-pricing-response.dto';
import { PaginatedPlatformPricingResponseDto } from './dto/paginated-platform-pricing-response.dto';
import { PlatformPricingMapper } from './plateform-pricing.mapper';
import { CustomNotFoundException, CustomBadRequestException } from '../common/exception/custom-exceptions';
import { ErrorCode } from '../common/exception/error-codes';

@Injectable()
export class PlatformPricingService {
  constructor(
    @InjectRepository(PlatformPricingEntity)
    private platformPricingRepository: Repository<PlatformPricingEntity>,
    private platformPricingMapper: PlatformPricingMapper,
  ) { }

  /**
   * Create a new platform pricing record
   */
  async create(
    createPlatformPricingDto: CreatePlatformPricingDto,
  ): Promise<PlatformPricingResponseDto> {
    const { lowerBound, upperBound, fee } = createPlatformPricingDto;

    // Validate that lowerBound < upperBound
    if (lowerBound >= upperBound) {
      throw new CustomBadRequestException(
        'Lower bound must be less than upper bound',
        ErrorCode.PLATFORM_PRICING_INVALID_RANGE,
      );
    }

    // Validate that lowerBound and upperBound are less than 151
    // Amounts >= 151 use a fixed 15% fee instead of pricing tiers
    if (lowerBound >= 151) {
      throw new CustomBadRequestException(
        'Lower bound must be less than 151. Amounts >= 151 use a fixed 15% fee.',
        ErrorCode.PLATFORM_PRICING_INVALID_RANGE,
      );
    }

    if (upperBound >= 151) {
      throw new CustomBadRequestException(
        'Upper bound must be less than 151. Amounts >= 151 use a fixed 15% fee.',
        ErrorCode.PLATFORM_PRICING_INVALID_RANGE,
      );
    }

    // Check for overlapping ranges
    // A range overlaps if:
    // - new lowerBound is within an existing range, OR
    // - new upperBound is within an existing range, OR
    // - new range completely contains an existing range
    const allPricings = await this.platformPricingRepository.find();

    const hasOverlap = allPricings.some((pricing) => {
      return (
        (lowerBound >= pricing.lowerBound && lowerBound <= pricing.upperBound) ||
        (upperBound >= pricing.lowerBound && upperBound <= pricing.upperBound) ||
        (lowerBound <= pricing.lowerBound && upperBound >= pricing.upperBound)
      );
    });

    if (hasOverlap) {
      throw new CustomBadRequestException(
        'Pricing range overlaps with existing range',
        ErrorCode.PLATFORM_PRICING_OVERLAP,
      );
    }

    const pricing = this.platformPricingRepository.create({
      lowerBound,
      upperBound,
      fee,
    });

    const savedPricing = await this.platformPricingRepository.save(pricing);
    return this.platformPricingMapper.toPlatformPricingResponse(savedPricing);
  }

  /**
   * Get all platform pricing records with pagination
   * Filters by lowerBound and/or upperBound if provided.
   * When filtering, finds pricing tiers that contain the specified values.
   */
  async findAll(
    query: FindPlatformPricingQueryDto,
  ): Promise<PaginatedPlatformPricingResponseDto> {
    const { page = 1, limit = 10, lowerBound, upperBound } = query;

    const queryBuilder = this.platformPricingRepository
      .createQueryBuilder('pricing')
      .orderBy('pricing.lowerBound', 'ASC');

    // Apply filters if provided
    // Find pricing tiers that contain the specified lowerBound value
    if (lowerBound !== undefined && upperBound === undefined) {
      queryBuilder.andWhere(
        'pricing.lowerBound <= :lowerBound AND pricing.upperBound >= :lowerBound',
        { lowerBound },
      );
    }
    // Find pricing tiers that contain the specified upperBound value
    else if (upperBound !== undefined && lowerBound === undefined) {
      queryBuilder.andWhere(
        'pricing.lowerBound <= :upperBound AND pricing.upperBound >= :upperBound',
        { upperBound },
      );
    }
    // Find pricing tiers that overlap with the range [lowerBound, upperBound]
    else if (lowerBound !== undefined && upperBound !== undefined) {
      queryBuilder.andWhere(
        '(pricing.lowerBound <= :upperBound AND pricing.upperBound >= :lowerBound)',
        { lowerBound, upperBound },
      );
    }

    const total = await queryBuilder.getCount();

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const pricings = await queryBuilder.getMany();

    const data = this.platformPricingMapper.toPlatformPricingResponseList(pricings);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single platform pricing record by ID
   */
  async findOne(id: number): Promise<PlatformPricingResponseDto> {
    const pricing = await this.platformPricingRepository.findOne({
      where: { id },
    });

    if (!pricing) {
      throw new CustomNotFoundException(
        'Platform pricing not found',
        ErrorCode.PLATFORM_PRICING_NOT_FOUND,
      );
    }

    return this.platformPricingMapper.toPlatformPricingResponse(pricing);
  }

  /**
   * Update a platform pricing record
   */
  async update(
    id: number,
    updatePlatformPricingDto: UpdatePlatformPricingDto,
  ): Promise<PlatformPricingResponseDto> {
    const pricing = await this.platformPricingRepository.findOne({
      where: { id },
    });

    if (!pricing) {
      throw new CustomNotFoundException(
        'Platform pricing not found',
        ErrorCode.PLATFORM_PRICING_NOT_FOUND,
      );
    }

    const { lowerBound, upperBound, fee } = updatePlatformPricingDto;

    // Get final values (use existing if not provided in update)
    const finalLowerBound = lowerBound !== undefined ? lowerBound : pricing.lowerBound;
    const finalUpperBound = upperBound !== undefined ? upperBound : pricing.upperBound;

    // Validate that final lowerBound and upperBound are less than 151
    // Amounts >= 151 use a fixed 15% fee instead of pricing tiers
    if (finalLowerBound >= 151) {
      throw new CustomBadRequestException(
        'Lower bound must be less than 151. Amounts >= 151 use a fixed 15% fee.',
        ErrorCode.PLATFORM_PRICING_INVALID_RANGE,
      );
    }

    if (finalUpperBound >= 151) {
      throw new CustomBadRequestException(
        'Upper bound must be less than 151. Amounts >= 151 use a fixed 15% fee.',
        ErrorCode.PLATFORM_PRICING_INVALID_RANGE,
      );
    }

    // Validate bounds if both are provided
    if (lowerBound !== undefined && upperBound !== undefined) {
      if (lowerBound >= upperBound) {
        throw new CustomBadRequestException(
          'Lower bound must be less than upper bound',
          ErrorCode.PLATFORM_PRICING_INVALID_RANGE,
        );
      }

      // Check for overlapping ranges (excluding current record)
      const allPricings = await this.platformPricingRepository.find({
        where: { id: Not(id) },
      });

      const hasOverlap = allPricings.some((existingPricing) => {
        return (
          (finalLowerBound >= existingPricing.lowerBound && finalLowerBound <= existingPricing.upperBound) ||
          (finalUpperBound >= existingPricing.lowerBound && finalUpperBound <= existingPricing.upperBound) ||
          (finalLowerBound <= existingPricing.lowerBound && finalUpperBound >= existingPricing.upperBound)
        );
      });

      if (hasOverlap) {
        throw new CustomBadRequestException(
          'Pricing range overlaps with existing range',
          ErrorCode.PLATFORM_PRICING_OVERLAP,
        );
      }
    }

    // Update fields
    if (lowerBound !== undefined) pricing.lowerBound = lowerBound;
    if (upperBound !== undefined) pricing.upperBound = upperBound;
    if (fee !== undefined) pricing.fee = fee;

    const updatedPricing = await this.platformPricingRepository.save(pricing);
    return this.platformPricingMapper.toPlatformPricingResponse(updatedPricing);
  }

  /**
   * Delete a platform pricing record
   */
  async remove(id: number): Promise<void> {
    const pricing = await this.platformPricingRepository.findOne({
      where: { id },
    });

    if (!pricing) {
      throw new CustomNotFoundException(
        'Platform pricing not found',
        ErrorCode.PLATFORM_PRICING_NOT_FOUND,
      );
    }

    await this.platformPricingRepository.remove(pricing);
  }

  /**
   * Calculate platform fee based on traveler payment amount
   * This method finds the appropriate pricing tier and returns the fee
   */
  async calculateFee(travelerPayment: number): Promise<number> {
    if (travelerPayment <= 0) {
      return 0;
    }

    // Get all pricing tiers ordered by lowerBound
    const allPricings = await this.platformPricingRepository.find({
      order: { lowerBound: 'ASC' },
    });

    // Find the pricing tier that contains the travelerPayment amount
    const matchingPricing = allPricings.find(
      (p) => travelerPayment >= Number(p.lowerBound) && travelerPayment <= Number(p.upperBound),
    );

    if (!matchingPricing) {
      throw new CustomBadRequestException(
        `No pricing tier found for amount ${travelerPayment} EUR`,
        ErrorCode.PLATFORM_PRICING_TIER_NOT_FOUND,
      );
    }

    return Number(matchingPricing.fee);
  }

  /**
   * Calculate total amount requester needs to pay
   * Formula: travelerPayment + fee + (TVA/100 * fee)
   * TVA = 20%
   */
  async calculateTotalAmount(
    travelerPayment: number,
    tvaPercentage: number = 20,
  ): Promise<{
    travelerPayment: number;
    fee: number;
    tvaAmount: number;
    totalAmount: number;
  }> {
    let fee = 0;

    if (travelerPayment <= 151) { //for traveler amount less than or equal 151, get the corresponding fee
      fee = await this.calculateFee(travelerPayment);

    }
    fee = this.roundToNearestHalf(0.15 * travelerPayment) //for traveler amount greater than 151, a fee of 15% is automatically applied and rounded to 0.5€

    const tvaAmount = (tvaPercentage / 100) * fee;
    const totalAmount = travelerPayment + fee + tvaAmount;

    return {
      travelerPayment,
      fee,
      tvaAmount: Number(tvaAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  }

  /**
 * Rounds a number to the nearest 0.5 increment (e.g., 1.2 becomes 1.0, 1.3 becomes 1.5, 1.7 becomes 1.5, 1.8 becomes 2.0).
 * @param value The number to round.
 * @returns The number rounded to the nearest 0.5.
 */
 roundToNearestHalf(value: number): number {
  return Math.round(value * 2) / 2;
}
}
