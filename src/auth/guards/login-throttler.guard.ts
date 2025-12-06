import { Injectable } from "@nestjs/common";
import { ThrottlerException, ThrottlerGuard } from "@nestjs/throttler";
import { CustomThrottlerException } from "src/common/exception/custom-exceptions";
import { ErrorCode } from "src/common/exception/error-codes";

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard{

    protected async getTracker(req: Record<string, any>): Promise<string>{

        const email = req.body?.email || 'anonymous'
        return `login-${email}`;
    }

    //set limit to 5attempsts
    protected getLimit(): Promise<number>{
        return Promise.resolve(5)
    }

    //time window of 1 minute
    protected getTtl():Promise<number>{
        return Promise.resolve(60000)
    }

    protected async throwThrottlingException(): Promise<void>{
        throw new CustomThrottlerException(`Too many attempts. Please try again after 1 minute`, ErrorCode.AUTH_THROTTLE)
    }
}