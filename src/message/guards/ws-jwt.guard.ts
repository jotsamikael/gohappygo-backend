import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UserService } from 'src/user/user.service';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private logger = new Logger('WsJwtGuard');

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      
      // Get token from handshake auth or query
      const token = 
        client.handshake?.auth?.token || 
        client.handshake?.headers?.authorization?.split(' ')[1] ||
        client.handshake?.query?.token;

      if (!token) {
        this.logger.warn('No token provided');
        throw new WsException('Unauthorized: No token provided');
      }

      // Verify and decode token
      const payload = this.jwtService.verify(token, {
        secret: 'jwt_secret', // Use same secret as your JWT strategy
      });

      // Get user from database
      const user = await this.userService.getUserById(payload.sub);
      
      if (!user) {
        throw new WsException('Unauthorized: User not found');
      }

      // Attach user to socket for use in handlers
      client.data.user = user;
      
      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`);
      throw new WsException('Unauthorized');
    }
  }
}