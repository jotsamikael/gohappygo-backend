import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext) {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (_) {
      // Allow request to continue without authentication
      return true;
    }
  }

  handleRequest(err: any, user: any) {
    // Do not throw on error; just return null user so endpoint remains public
    if (err) {
      return null;
    }
    return user || null;
  }
}


