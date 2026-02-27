import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestStatusHistoryEntity } from './RequestStatusHistory.entity';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class RequestStatusHistoryService {
    constructor(@InjectRepository(RequestStatusHistoryEntity) private RequestStatusHistoryRepo: Repository<RequestStatusHistoryEntity>){

    }

   async record(requestId: number, requestStatusId: number, entityManager?: EntityManager): Promise<RequestStatusHistoryEntity>{

    if(!requestId || !requestStatusId){
        throw new BadRequestException(`request and status are required`)
    }
    const newRecord = entityManager
        ? entityManager.create(RequestStatusHistoryEntity, {
            requestId,
            requestStatusId,
          })
        : this.RequestStatusHistoryRepo.create({
            requestId,
            requestStatusId,
          });
    return entityManager
        ? await entityManager.save(RequestStatusHistoryEntity, newRecord)
        : await this.RequestStatusHistoryRepo.save(newRecord);
    }

    // Add this new method to delete status history records by request ID
    async deleteByRequestId(requestId: number): Promise<void> {
        await this.RequestStatusHistoryRepo.delete({ requestId });
    }
}
