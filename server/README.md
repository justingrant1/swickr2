# Swickr Server

A high-performance messaging service backend with focus on speed and simplicity.

## Key Features

- WebSocket-based real-time communication
- JWT authentication
- Contact management
- Direct and group conversations
- End-to-end encryption
- PostgreSQL + Redis for storage and caching

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Start the development server:

```bash
npm run dev
```

The server will start on port 3001 by default.

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate user & get token
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout user & invalidate token

### Contacts

- `GET /api/contacts` - Get user contacts
- `POST /api/contacts` - Add a contact by contactId, username, or email

### Conversations

- `GET /api/conversations` - Get user conversations
- `POST /api/conversations` - Create a new group conversation
- `POST /api/conversations/direct` - Create or get a direct conversation with another user
- `GET /api/conversations/:id` - Get conversation details

### Messages

- `POST /api/messages` - Send a message
- `GET /api/messages/:conversationId` - Get messages for a conversation

## WebSocket Integration

Swickr uses Socket.IO for real-time messaging. The WebSocket server is integrated with the Express server and provides the following events:

### Client Events (to be implemented)

- `join` - Join a conversation room
- `leave` - Leave a conversation room
- `typing` - Indicate that the user is typing
- `message` - Send a message to a conversation

### Server Events (to be implemented)

- `message` - New message received
- `typing` - User is typing
- `read` - Message read by recipient
- `user_status` - User status changed (online/offline)

### WebSocket Authentication

WebSocket connections are authenticated using JWT tokens. Clients should provide the token in the `auth` object when connecting:

```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket']
});
```

## Testing

The server includes several test scripts to validate functionality:

### Test Contacts API

```bash
node src/scripts/testContactsAPIFinal.js
```

This script tests:
- User registration
- User login
- Adding contacts by ID
- Adding contacts by username
- Getting contacts

### Test Direct Conversation

```bash
node src/scripts/testDirectConversationSimple.js
```

This script tests:
- User registration
- User login
- Creating a direct conversation between two users

### Test Full Messaging Flow

```bash
node src/scripts/testFullMessagingFlowFinal.js
```

This script tests the complete messaging flow:
- User registration
- User login
- Adding contacts by ID and username
- Getting contacts
- Creating a direct conversation
- Sending messages
- Getting messages

### Test WebSocket Messaging (Requires WebSocket Implementation)

```bash
node src/scripts/testWebSocketMessaging.js
```

This script tests the WebSocket integration:
- User registration
- User login
- Creating a direct conversation
- Connecting to WebSocket
- Sending messages via REST API
- Receiving real-time notifications via WebSocket

## Next Steps

1. **Implement WebSocket Server**:
   - Integrate Socket.IO with the Express server
   - Implement authentication middleware for WebSocket connections
   - Create event handlers for real-time messaging

2. **Enhance Message Functionality**:
   - Implement message read receipts
   - Add support for message editing and deletion
   - Implement typing indicators

3. **Group Conversations**:
   - Complete implementation of group conversation creation
   - Add support for adding/removing participants
   - Implement group conversation settings

4. **Media Sharing**:
   - Implement file upload functionality
   - Add support for image, video, and document sharing
   - Implement media preview and download

## Development Status

- Authentication system
- Contact management
- Direct conversations
- Messaging API
- WebSocket integration (in progress)
- Group conversations (planned)
- Media sharing (planned)

## Brand Identity

- Primary color: Purple (#6200ee)
- Accent color: Blue (#0284c7)
- Focus on speed and simplicity
