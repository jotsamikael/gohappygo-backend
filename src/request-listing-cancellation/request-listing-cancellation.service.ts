import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EntityManager, Repository } from 'typeorm';
import { RequestEntity } from 'src/request/request.entity';
import { TravelEntity } from 'src/travel/travel.entity';
import { RequestStatusHistoryService } from 'src/request-status-history/request-status-history.service';
import { RequestStatusService } from 'src/request-status/request-status.service';
import { TransactionService } from 'src/transaction/transaction.service';
import { StripeService } from 'src/stripe/stripe.service';
import { UserService } from 'src/user/user.service';
import { UserEventsService } from 'src/events/user-events.service';
import {
  CustomBadRequestException,
  CustomNotFoundException,
} from 'src/common/exception/custom-exceptions';
import { ErrorCode } from 'src/common/exception/error-codes';

const TERMINAL_REQUEST_STATUSES = ['COMPLETED', 'CANCELLED', 'REJECTED', 'RESOLVED'];

@Injectable()
export class RequestListingCancellationService {
  private readonly logger = new Logger(RequestListingCancellationService.name);

  constructor(
    @InjectRepository(RequestEntity)
    private readonly requestRepository: Repository<RequestEntity>,
    private readonly requestStatusHistoryService: RequestStatusHistoryService,
    private readonly requestStatusService: RequestStatusService,
    @Inject(forwardRef(() => TransactionService))
    private readonly transactionService: TransactionService,
    @Inject(forwardRef(() => StripeService))
    private readonly stripeService: StripeService,
    private readonly userService: UserService,
    private readonly userEventService: UserEventsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Cancels a request when its parent travel/demand listing is cancelled.
   * Skips terminal requests. Refunds paid transactions (partial) and releases reserved travel weight.
   */
  async cancelRequestForListingCancellation(
    requestId: number,
    listingOwnerUserId: number,
  ): Promise<boolean> {
    const request = await this.findRequestById(requestId);
    if (!request || TERMINAL_REQUEST_STATUSES.includes(request.currentStatus?.status ?? '')) {
      return false;
    }

    const transaction = await this.transactionService.findTransactionByRequestId(requestId);
    if (transaction?.status === 'pending') {
      await this.transactionService.updateTransactionStatus(transaction.id, 'cancelled');
    } else {
      try {
        await this.refundRequestTransaction(requestId);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to refund request ${requestId} during listing cancellation: ${message}`,
        );
      }
    }

    const cancelledStatus = await this.requestStatusService.getRequestByStatus('CANCELLED');
    if (!cancelledStatus) {
      throw new CustomNotFoundException('CANCELLED request status not found', ErrorCode.REQUEST_STATUS_NOT_FOUND);
    }

    await this.requestRepository.manager.transaction(async (transactionalEntityManager) => {
      const lockedRequest = await transactionalEntityManager.findOne(RequestEntity, {
        where: { id: requestId },
        relations: ['currentStatus'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedRequest || TERMINAL_REQUEST_STATUSES.includes(lockedRequest.currentStatus?.status ?? '')) {
        return;
      }

      lockedRequest.currentStatusId = cancelledStatus.id;
      lockedRequest.currentStatus = cancelledStatus;
      await transactionalEntityManager.save(RequestEntity, lockedRequest);
      await this.requestStatusHistoryService.record(requestId, cancelledStatus.id, transactionalEntityManager);
      await this.releaseReservedTravelWeightIfNeeded(requestId, transactionalEntityManager);
    });

    const requester = await this.userService.findOne({ id: request.requesterId });
    if (requester) {
      request.currentStatusId = cancelledStatus.id;
      request.currentStatus = cancelledStatus;
      this.userEventService.emitRequestCancelled(requester, request, false, listingOwnerUserId);
    }

    await this.clearRequestListCacheForUsers([request.requesterId, listingOwnerUserId]);
    return true;
  }

  private async findRequestById(id: number): Promise<RequestEntity | null> {
    return this.requestRepository.findOne({
      where: { id },
      relations: ['demand', 'travel', 'demand.user', 'travel.user', 'requester', 'currentStatus'],
    });
  }

  private async refundRequestTransaction(requestId: number): Promise<void> {
    const transaction = await this.transactionService.findTransactionByRequestId(requestId);
    if (!transaction) {
      return;
    }
    if (transaction.stripeTransferId) {
      this.logger.warn(
        `Refund skipped for request ${requestId}: funds already transferred (transfer ${transaction.stripeTransferId}).`,
      );
      return;
    }
    if (transaction.status === 'refunded') {
      this.logger.debug(`Refund skipped for request ${requestId}: transaction already refunded`);
      return;
    }
    if (transaction.status === 'paid' && transaction.stripePaymentIntentId) {
      let travelerPaymentUSD: number;
      if (transaction.travelerPayment !== null && transaction.travelerPayment !== undefined) {
        travelerPaymentUSD = await this.stripeService.convertToUSD(
          transaction.travelerPayment,
          transaction.currencyCode || 'USD',
        );
      } else {
        throw new CustomBadRequestException(
          'Traveler payment amount not found in transaction',
          ErrorCode.INTERNAL_ERROR,
        );
      }
      await this.stripeService.refundPaymentIntentPartial(
        transaction.stripePaymentIntentId,
        travelerPaymentUSD,
        `refund-request-${requestId}-traveler`,
      );
      await this.transactionService.updateTransactionStatus(transaction.id, 'refunded');
    }
  }

  private async releaseReservedTravelWeightIfNeeded(
    requestId: number,
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    const request = await transactionalEntityManager.findOne(RequestEntity, {
      where: { id: requestId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!request || !request.travelId) {
      return;
    }

    if (!request.isWeightReserved || !!request.weightReleasedAt) {
      return;
    }

    const travel = await transactionalEntityManager.findOne(TravelEntity, {
      where: { id: request.travelId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!travel) {
      throw new CustomNotFoundException('Travel not found', ErrorCode.TRAVEL_NOT_FOUND);
    }

    const travelWeightAvailable = Number(travel.weightAvailable) || 0;
    const requestWeight = Number(request.weight) || 0;
    const totalWeightAllowance = Number(travel.totalWeightAllowance) || 0;
    const nextAvailableWeight = Math.min(
      totalWeightAllowance,
      travelWeightAvailable + requestWeight,
    );

    travel.weightAvailable = nextAvailableWeight;
    if (nextAvailableWeight > 0 && travel.status === 'filled') {
      travel.status = 'active';
    }
    await transactionalEntityManager.save(TravelEntity, travel);

    request.weightReleasedAt = new Date();
    request.isWeightReserved = false;
    await transactionalEntityManager.save(RequestEntity, request);
  }

  private async clearRequestListCacheForUsers(affectedUserIds: number[]): Promise<void> {
    const commonQueryCombinations = [
      { page: 1, limit: 10 },
      { page: 1, limit: 20 },
      { page: 1, limit: 50 },
    ];

    const cacheKeysToDelete: string[] = [];
    for (const userId of affectedUserIds) {
      for (const query of commonQueryCombinations) {
        cacheKeysToDelete.push(this.generateRequestListCacheKey(query, userId));
      }
    }

    await Promise.all(cacheKeysToDelete.map((key) => this.cacheManager.del(key)));
  }

  private generateRequestListCacheKey(
    query: { page: number; limit: number },
    userId: number,
  ): string {
    const { page, limit } = query;
    return `requests_list_user${userId}_page${page}_limit${limit}_idall_requesterall_travelall_demandall_typeall_descall_minWeightall_maxWeightall_dateall_statusall_ordercreatedAt:desc_requesterEmailall_travelerEmailall`;
  }
}
