import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { Logger, UseGuards } from '@nestjs/common';
  import { MessageService } from './message.service';
  import { SendMessageDto } from './dto/SendMessage.dto';
  import { WsJwtGuard } from './guards/ws-jwt.guard';
  import { JwtService } from '@nestjs/jwt';  // Add this
import { number, boolean } from 'joi';
import { UserService } from 'src/user/user.service';
  @WebSocketGateway({
    cors: {
      origin: '*', // In production, specify your frontend URL
      credentials: true,
    },
    namespace: 'messages', // This creates a namespace: ws://localhost:3000/messages
  })
  export class MessageGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    private logger = new Logger('MessageGateway');
  
    constructor(private readonly messageService: MessageService,
         private readonly jwtService: JwtService, 
        private readonly userService: UserService) {}
  
   /**
   * Called when a client connects to the WebSocket
   * We authenticate HERE, not in guards
   */
  async handleConnection(client: Socket) {
    //this.logger.log(`🔌 Client attempting to connect: ${client.id}`);
    //this.logger.log(`�� Handshake headers:`, client.handshake.headers);
    //this.logger.log(`🔍 Handshake auth:`, client.handshake.auth);
    //this.logger.log(`�� Handshake query:`, client.handshake.query);
    
    try {
      // Extract token from various possible locations
      const token = 
        client.handshake?.auth?.token || 
        client.handshake?.headers?.authorization?.split(' ')[1] ||
        client.handshake?.query?.token;

      this.logger.log(`🔑 Token found: ${token ? 'YES' : 'NO'}`);
      //this.logger.log(`🔑 Token value: ${token ? token.substring(0, 20) + '...' : 'NONE'}`);

      if (!token) {
        this.logger.warn(`❌ Client ${client.id} - No token provided`);
        client.emit('error', { message: 'Authentication token is required' });
        client.disconnect();
        return;
      }

      // Verify token
      const payload = this.jwtService.verify(token, {
        secret: 'jwt_secret',
      });

      //this.logger.log(`✅ Token verified for user: ${payload.sub}`);

      // Get user from database
      const user = await this.userService.getUserById(payload.sub);
      
      if (!user) {
        //this.logger.warn(`❌ Client ${client.id} - User not found`);
        client.emit('error', { message: 'User not found' });
        client.disconnect();
        return;
      }

      // Store user in socket data for later use
      client.data.user = user;

      //this.logger.log(`✅ User ${user.id} (${user.email}) connected with socket ${client.id}`);
      
      // Join user to their personal room (for direct notifications)
      client.join(`user:${user.id}`);
      
      // Send success confirmation
      client.emit('connected', {
        message: 'Successfully connected to chat server',
        userId: user.id,
      });

    } catch (error) {
      //this.logger.error(`❌ Authentication failed for client ${client.id}: ${error.message}`);
      this.logger.error(`❌ Error stack:`, error.stack);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }
    /**
     * Called when a client disconnects
     */
    handleDisconnect(client: Socket) {
      const user = client.data.user;
      //this.logger.log(`Client disconnected: ${client.id} (User: ${user?.id})`);
    }
  
    /**
     * Handle when a user joins a specific chat thread (request-based chat)
     */
    @SubscribeMessage('join-thread')
    //@UseGuards(WsJwtGuard)
    async handleJoinThread(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: any, // Change to any to handle both string and object
    ) {
      console.log('🔥 JOIN-THREAD EVENT RECEIVED:', data);
      console.log('🔥 Data type:', typeof data);
      
      // Parse JSON string if needed
      let parsedData = data;
      if (typeof data === 'string') {
        try {
          parsedData = JSON.parse(data);
          console.log('🔥 Parsed data:', parsedData);
        } catch (error) {
          console.log('🔥 Failed to parse JSON:', error.message);
          client.emit('error', { message: 'Invalid JSON format' });
          return;
        }
      }
      
      console.log('�� requestId value:', parsedData.requestId);
      console.log('🔥 requestId type:', typeof parsedData.requestId);
      
      const user = client.data.user;
      
      // Ensure requestId is a number
      const requestId = Number(parsedData.requestId);

      if (isNaN(requestId)) {
        console.log('🔥 Invalid requestId:', parsedData.requestId);
        client.emit('error', { message: 'Invalid requestId' });
        return;
      }
      
      console.log('🔥 Parsed requestId:', requestId);
      
      this.logger.log(`User ${user.id} joining thread for request ${requestId}`);
      
      // Join the room for this specific request
      const roomName = `request:${requestId}`;
      client.join(roomName);
      
      console.log('🔥 Joined room:', roomName);
      
      // Send confirmation
      const response = {
        requestId: requestId,
        message: `Joined thread for request ${requestId}`,
      };
      
      console.log('🔥 Sending response:', response);
      client.emit('joined-thread', response);
      
      // Optionally, mark messages as read when joining thread
      try {
        await this.messageService.markThreadAsRead(requestId, user);
        console.log('�� Messages marked as read');
      } catch (error) {
        console.log('🔥 Error marking as read:', error.message);
      }
      
      // Notify others in the room that someone joined
      client.to(roomName).emit('user-joined-thread', {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
      });
      
      console.log('�� All done with join-thread');
    }
  
    /**
     * Handle when a user leaves a specific chat thread
     */
    @SubscribeMessage('leave-thread')
    @UseGuards(WsJwtGuard)
    async handleLeaveThread(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { requestId: number },
    ) {
      const user = client.data.user;
      const roomName = `request:${data.requestId}`;
      
      client.leave(roomName);
      //this.logger.log(`User ${user.id} left thread for request ${data.requestId}`);
      
      // Notify others that user left
      client.to(roomName).emit('user-left-thread', {
        userId: user.id,
      });
    }
  
    /**
     * Handle sending a message
     */
    @SubscribeMessage('send-message')
    @UseGuards(WsJwtGuard)
    async handleSendMessage(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: any, // Change to any to handle string parsing
    ) {
      const user = client.data.user;
      
      try {
        // Parse JSON string if needed (same as join-thread)
        let dto = data;
        if (typeof data === 'string') {
          try {
            dto = JSON.parse(data);
            console.log('🔥 Parsed send-message data:', dto);
          } catch (error) {
            console.log('🔥 Failed to parse JSON:', error.message);
            client.emit('message-error', { message: 'Invalid JSON format' });
            return;
          }
        }
        
        console.log('�� Sending message to request:', dto);
        
        // Save message to database
        const savedMessage = await this.messageService.sendMessage(user, dto);
        
        // Load the full message with relations for the response
        const fullMessage = await this.messageService.getMessageById(savedMessage.id);
        
        // Prepare the message payload
        const messagePayload = {
          id: fullMessage.id,
          content: fullMessage.content,
          createdAt: fullMessage.createdAt,
          isRead: fullMessage.isRead,
          sender: {
            id: fullMessage.sender.id,
            firstName: fullMessage.sender.firstName,
            lastName: fullMessage.sender.lastName,
            profilePictureUrl: fullMessage.sender.profilePictureUrl,
          },
          requestId: dto.requestId,
        };
  
        // Send to the specific request room
        const roomName = `request:${dto.requestId}`;
        this.server.to(roomName).emit('new-message', messagePayload);
        
        // Also send to receiver's personal room (for notifications even if not in thread)
        this.server.to(`user:${dto.receiverId}`).emit('message-notification', {
          ...messagePayload,
          unreadCount: await this.messageService.getUnreadCount(fullMessage.receiver),
        });
  
        // Send acknowledgment to sender
        client.emit('message-sent', {
          success: true,
          message: messagePayload,
        });
  
      } catch (error) {
        this.logger.error(`Error sending message: ${error.message}`);
        client.emit('message-error', {
          success: false,
          error: error.message,
        });
      }
    }
  
    /**
     * Handle typing indicator
     */
    @SubscribeMessage('typing')
    @UseGuards(WsJwtGuard)
    handleTyping(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { requestId: number; isTyping: boolean },
    ) {
      const user = client.data.user;
      const roomName = `request:${data.requestId}`;
      
      // Broadcast to others in the room (not to sender)
      client.to(roomName).emit('user-typing', {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        isTyping: data.isTyping,
      });
    }
  
    /**
     * Handle mark messages as read
     */
    @SubscribeMessage('mark-read')
    @UseGuards(WsJwtGuard)
    async handleMarkRead(
      @ConnectedSocket() client: Socket,
      @MessageBody() data: { requestId: number },
    ) {
      const user = client.data.user;
      
      try {
        await this.messageService.markThreadAsRead(data.requestId, user);
        
        client.emit('marked-read', {
          success: true,
          requestId: data.requestId,
        });
        
        // Notify sender that their messages were read
        const roomName = `request:${data.requestId}`;
        client.to(roomName).emit('messages-read', {
          userId: user.id,
          requestId: data.requestId,
        });
      } catch (error) {
        client.emit('mark-read-error', {
          success: false,
          error: error.message,
        });
      }
    }
  }