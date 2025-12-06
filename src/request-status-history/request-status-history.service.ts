import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestStatusHistoryEntity } from './RequestStatusHistory.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RequestStatusHistoryService {
    constructor(@InjectRepository(RequestStatusHistoryEntity) private RequestStatusHistoryRepo: Repository<RequestStatusHistoryEntity>){

    }

   async record(requestId: number, requestStatusId: number): Promise<RequestStatusHistoryEntity>{

    if(!requestId || !requestStatusId){
        throw new BadRequestException(`request and status are required`)
    }
    const newRecord =  this.RequestStatusHistoryRepo.create({
          requestId:requestId,
          requestStatusId: requestStatusId
        })
        return await this.RequestStatusHistoryRepo.save(newRecord);
    }

    // Add this new method to delete status history records by request ID
    async deleteByRequestId(requestId: number): Promise<void> {
        await this.RequestStatusHistoryRepo.delete({ requestId });
    }
}
