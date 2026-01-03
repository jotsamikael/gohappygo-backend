const io = require('socket.io-client');
const readline = require('readline');

// Configuration
const SERVER_URL = 'http://localhost:3000/messages';
const REQUEST_ID = 24; // Change this to your request ID

// Get JWT token from command line argument or use default
const JWT_TOKEN = process.argv[2] || process.env.JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';

if (JWT_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
  console.error('❌ Please provide a JWT token as an argument:');
  console.error('   node test-websocket.js YOUR_JWT_TOKEN');
  console.error('   OR set JWT_TOKEN environment variable');
  process.exit(1);
}

// Create readline interface for interactive commands
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\n💬 Enter command (help for commands): '
});

// Connect to Socket.IO server
const socket = io(SERVER_URL, {
  auth: {
    token: JWT_TOKEN
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Connection events
socket.on('connect', () => {
  console.log('\n✅ Connected to server');
  console.log('   Socket ID:', socket.id);
  
  // Automatically join the thread
  console.log(`\n📥 Joining thread for request ${REQUEST_ID}...`);
  socket.emit('join-thread', { requestId: REQUEST_ID });
  
  rl.prompt();
});

socket.on('disconnect', (reason) => {
  console.log('\n❌ Disconnected from server:', reason);
});

socket.on('connect_error', (error) => {
  console.error('\n❌ Connection error:', error.message);
  if (error.message.includes('jwt expired') || error.message.includes('TokenExpiredError')) {
    console.error('   Your token has expired. Please get a new token.');
  }
});

// Server events
socket.on('connected', (data) => {
  console.log('\n📨 Connected event received:');
  console.log('   Message:', data.message);
  console.log('   User ID:', data.userId);
});

socket.on('joined-thread', (data) => {
  console.log('\n✅ Joined thread successfully:');
  console.log('   Request ID:', data.requestId);
  console.log('   Room:', data.roomName);
  console.log('   Message:', data.message);
});

socket.on('error', (error) => {
  console.error('\n❌ Error event:', error);
});

// Message events
socket.on('new-message', (message) => {
  console.log('\n📨 NEW MESSAGE RECEIVED:');
  console.log('   ID:', message.id);
  console.log('   Content:', message.content);
  console.log('   From:', `${message.sender.firstName} ${message.sender.lastName} (ID: ${message.sender.id})`);
  console.log('   Request ID:', message.requestId);
  console.log('   Created:', new Date(message.createdAt).toLocaleString());
  console.log('   Is Read:', message.isRead);
});

socket.on('message-notification', (notification) => {
  console.log('\n🔔 MESSAGE NOTIFICATION:');
  console.log('   ID:', notification.id);
  console.log('   Content:', notification.content);
  console.log('   Unread Count:', notification.unreadCount);
});

socket.on('message-sent', (data) => {
  console.log('\n✅ Message sent successfully:');
  console.log('   Message ID:', data.message.id);
});

socket.on('message-error', (error) => {
  console.error('\n❌ Message error:', error);
});

// Typing events
socket.on('user-typing', (data) => {
  const status = data.isTyping ? 'is typing...' : 'stopped typing';
  console.log(`\n⌨️  ${data.userName} (ID: ${data.userId}) ${status}`);
});

// Mark read events
socket.on('marked-read', (data) => {
  console.log('\n✅ Messages marked as read:');
  console.log('   Request ID:', data.requestId);
  console.log('   Success:', data.success);
});

socket.on('messages-read', (data) => {
  console.log(`\n👁️  User ${data.userId} has read messages in request ${data.requestId}`);
});

socket.on('mark-read-error', (error) => {
  console.error('\n❌ Mark read error:', error);
});

// Thread events
socket.on('user-joined-thread', (data) => {
  console.log(`\n👋 User ${data.userName} (ID: ${data.userId}) joined the thread`);
});

socket.on('user-left-thread', (data) => {
  console.log(`\n👋 User ${data.userId} left the thread`);
});

// Interactive command handler
function handleCommand(input) {
  const command = input.trim().toLowerCase();
  const parts = command.split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      console.log('\n📋 Available commands:');
      console.log('   send <receiverId> <message>  - Send a message');
      console.log('   typing start                  - Start typing indicator');
      console.log('   typing stop                   - Stop typing indicator');
      console.log('   mark-read                     - Mark messages as read');
      console.log('   leave                         - Leave the thread');
      console.log('   join                          - Rejoin the thread');
      console.log('   status                        - Show connection status');
      console.log('   help                          - Show this help');
      console.log('   exit                          - Exit the program');
      break;

    case 'send':
      if (args.length < 2) {
        console.error('❌ Usage: send <receiverId> <message>');
        break;
      }
      const receiverId = parseInt(args[0]);
      const messageContent = args.slice(1).join(' ');
      
      if (isNaN(receiverId)) {
        console.error('❌ Invalid receiver ID');
        break;
      }
      
      console.log(`\n📤 Sending message to user ${receiverId}...`);
      socket.emit('send-message', {
        requestId: REQUEST_ID,
        receiverId: receiverId,
        content: messageContent
      });
      break;

    case 'typing':
      if (args.length === 0) {
        console.error('❌ Usage: typing <start|stop>');
        break;
      }
      const isTyping = args[0] === 'start';
      console.log(`\n⌨️  ${isTyping ? 'Starting' : 'Stopping'} typing indicator...`);
      socket.emit('typing', {
        requestId: REQUEST_ID,
        isTyping: isTyping
      });
      break;

    case 'mark-read':
      console.log(`\n👁️  Marking messages as read for request ${REQUEST_ID}...`);
      socket.emit('mark-read', {
        requestId: REQUEST_ID
      });
      break;

    case 'leave':
      console.log(`\n👋 Leaving thread for request ${REQUEST_ID}...`);
      socket.emit('leave-thread', {
        requestId: REQUEST_ID
      });
      break;

    case 'join':
      console.log(`\n📥 Joining thread for request ${REQUEST_ID}...`);
      socket.emit('join-thread', {
        requestId: REQUEST_ID
      });
      break;

    case 'status':
      console.log('\n📊 Connection Status:');
      console.log('   Connected:', socket.connected);
      console.log('   Socket ID:', socket.id);
      console.log('   Server URL:', SERVER_URL);
      console.log('   Request ID:', REQUEST_ID);
      break;

    case 'exit':
    case 'quit':
      console.log('\n👋 Disconnecting...');
      socket.disconnect();
      rl.close();
      process.exit(0);
      break;

    default:
      if (command) {
        console.error(`❌ Unknown command: ${command}`);
        console.log('   Type "help" for available commands');
      }
  }
  
  rl.prompt();
}

// Handle readline input
rl.on('line', (input) => {
  handleCommand(input);
});

// Handle Ctrl+C gracefully
rl.on('SIGINT', () => {
  console.log('\n\n👋 Disconnecting...');
  socket.disconnect();
  rl.close();
  process.exit(0);
});

// Show initial help
console.log('\n🚀 WebSocket Test Client');
console.log('========================');
console.log(`Server: ${SERVER_URL}`);
console.log(`Request ID: ${REQUEST_ID}`);
console.log('\nType "help" for available commands');
console.log('Waiting for connection...\n');

