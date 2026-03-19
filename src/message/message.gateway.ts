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
import { OnEvent } from '@nestjs/event-emitter';
import { UserEventType } from 'src/events/event-types';
import { RequestEvent } from 'src/events/user-events.service';
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
      // Handle specific JWT errors
      let errorMessage = 'Authentication failed';
      let errorCode = 'AUTH_FAILED';

      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Token has expired. Please refresh your token and reconnect.';
        errorCode = 'TOKEN_EXPIRED';
        this.logger.warn(`❌ Client ${client.id} - Token expired`);
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Invalid token format';
        errorCode = 'INVALID_TOKEN';
        this.logger.warn(`❌ Client ${client.id} - Invalid token: ${error.message}`);
      } else if (error.name === 'NotBeforeError') {
        errorMessage = 'Token not active yet';
        errorCode = 'TOKEN_NOT_ACTIVE';
        this.logger.warn(`❌ Client ${client.id} - Token not active`);
      } else {
        this.logger.error(`❌ Authentication failed for client ${client.id}: ${error.message}`);
        this.logger.error(`❌ Error stack:`, error.stack);
      }

      client.emit('error', { 
        message: errorMessage,
        code: errorCode,
        error: error.name || 'UnknownError'
      });
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
    @UseGuards(WsJwtGuard)
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
      
      // Add check for user authentication (defensive check even with guard)
      if (!user) {
        this.logger.error(`❌ Client ${client.id} - User not authenticated for join-thread`);
        client.emit('error', { message: 'User not authenticated. Please reconnect.' });
        return;
      }
      
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
      
      // Add logging to verify room join
      const rooms = Array.from(client.rooms);
      this.logger.log(`✅ User ${user.id} joined room ${roomName}. Current rooms: ${rooms.join(', ')}`);
      console.log('🔥 Joined room:', roomName);
      console.log('🔥 Client rooms:', rooms);
      
      // Send confirmation
      const response = {
        requestId: requestId,
        message: `Joined thread for request ${requestId}`,
        roomName: roomName, // Include room name in response for debugging
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
      
      console.log(' All done with join-thread');
    }

    /**
     * Bridge internal request events to WebSockets.
     * This acts as a "Trigger Signal" for the frontend to re-fetch GET /request.
     */
    @OnEvent(UserEventType.REQUEST_CREATED)
    @OnEvent(UserEventType.REQUEST_ACCEPTED)
    @OnEvent(UserEventType.REQUEST_COMPLETED)
    @OnEvent(UserEventType.REQUEST_CANCELLED)
    @OnEvent(UserEventType.REQUEST_REJECTED)
    @OnEvent(UserEventType.CANCELLATION_CONFIRMATION_REQUESTED)
    @OnEvent(UserEventType.CANCELLATION_CONFIRMED)
    @OnEvent(UserEventType.CANCELLATION_DISPUTED)
    @OnEvent(UserEventType.REQUEST_AUTO_COMPLETED)
    handleRequestUpdateEvent(event: RequestEvent) {
      const payload = {
        requestId: event.requestId,
        event: event.isForOwner ? 'owner-update' : 'requester-update',
        timestamp: event.timestamp
      };

      // 1. Notify the specific user rooms. 
      // Every user is automatically joined to a room named "user:{userId}" on connection.
      if (event.ownerId) {
        this.server.to(`user:${event.ownerId}`).emit('request-list-refresh', payload);
      }
      
      if (event.requesterId) {
        this.server.to(`user:${event.requesterId}`).emit('request-list-refresh', payload);
      }
      
      this.logger.log(`🔄 Sent refresh signal to User:${event.ownerId} and User:${event.requesterId} for Request:${event.requestId}`);
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
        
        // Add logging to verify broadcast (with safe access)
        let roomSize = 0;
        let clientIds: string[] = [];
        try {
          // For namespaced servers, access adapter directly, not through sockets
          // this.server is already the namespace server, so use this.server.adapter
          // The adapter might be a getter function, so we need to call it or access it properly
          const adapter = (this.server as any)?.adapter || (this.server as any)?.sockets?.adapter;
          if (adapter && typeof adapter === 'object' && adapter.rooms) {
            const room = adapter.rooms.get(roomName);
            if (room) {
              roomSize = room.size;
              clientIds = Array.from(room);
            }
          }
        } catch (error) {
          // Adapter access failed, but we can still broadcast
          this.logger.warn(`Could not access room adapter for ${roomName}, but continuing with broadcast`);
        }
        
        this.logger.log(`📤 Broadcasting message to room ${roomName}. Room has ${roomSize} clients`);
        console.log(`🔥 Room ${roomName} has ${roomSize} clients`);
        if (clientIds.length > 0) {
          console.log(`🔥 Clients in room:`, clientIds);
          // Verify these sockets are actually connected (safe access for namespaced servers)
          try {
            const socketsCollection = (this.server as any).sockets?.sockets || (this.server as any).sockets;
            if (socketsCollection && typeof socketsCollection.get === 'function') {
              clientIds.forEach(socketId => {
                const socket = socketsCollection.get(socketId);
                if (socket) {
                  const socketUser = (socket as any).data?.user;
                  this.logger.log(`  ✓ Socket ${socketId} is connected (User: ${socketUser?.id || 'unknown'})`);
                } else {
                  this.logger.warn(`  ✗ Socket ${socketId} is NOT connected (might have disconnected)`);
                }
              });
            } else {
              this.logger.warn(`  ⚠️ Could not access sockets collection for verification`);
            }
          } catch (error) {
            this.logger.warn(`  ⚠️ Error verifying socket connections: ${error.message}`);
          }
        }
        
        // Broadcast to the room (excludes sender, which is what we want)
        // All clients in the room will receive the message
        this.logger.log(`📡 Broadcasting 'new-message' to room ${roomName}`);
        this.server.to(roomName).emit('new-message', messagePayload);
        
        // Also send to receiver's personal room (for notifications even if not in thread)
        // This ensures the receiver gets notified even if they haven't joined the thread yet
        const userRoomName = `user:${fullMessage.receiver.id}`; // Use actual receiver ID from message
        this.logger.log(`📡 Sending 'message-notification' to personal room ${userRoomName}`);
        this.server.to(userRoomName).emit('message-notification', {
          ...messagePayload,
          unreadCount: await this.messageService.getUnreadCount(fullMessage.receiver),
        });
        
        // Log the actual socket IDs that should receive the message
        this.logger.log(`📤 Message broadcasted. Sender: ${client.id} (User: ${user.id}), Receiver ID: ${fullMessage.receiver.id}, Room: ${roomName}`);
  
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