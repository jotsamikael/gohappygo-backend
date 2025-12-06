# Support Module Documentation

## Overview
A comprehensive support request system that allows visitors and users to submit support requests, communicate with operators, and track resolution status.

## Features Implemented

### 1. Support Request Creation
- **Endpoint**: `POST /api/support`
- **Access**: Public (visitors and users)
- **Description**: Create a new support request
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "message": "I need help with...",
    "supportRequesterType": "USER" | "VISITOR",
    "supportCategory": "TECHNICAL" | "BILLING" | "FINANCIAL" | "INFORMATIONAL" | "GENERAL" | "OTHER"
  }
  ```
- **Functionality**:
  - Creates a support request with PENDING status
  - Sends confirmation email to requester
  - Sends notification email to SUPPORT_EMAIL

### 2. List Support Requests
- **Endpoint**: `GET /api/support`
- **Access**: Public (with optional authentication)
- **Description**: List all support requests with filtering and pagination
- **Authorization**:
  - Non-admin/operator users: Can only see their own requests
  - Admin/Operator users: Can see all requests
- **Query Parameters**:
  - `page` (optional, default: 1)
  - `limit` (optional, default: 10)
  - `status` (optional): PENDING | RESOLVED | CLOSED
  - `category` (optional): TECHNICAL | BILLING | etc.
  - `email` (optional): Filter by email address
- **Response**: Paginated list of support requests with logs

### 3. Get Single Support Request
- **Endpoint**: `GET /api/support/:id`
- **Access**: Public (with optional authentication)
- **Description**: Get detailed information about a specific support request
- **Authorization**:
  - Non-admin/operator users: Can only view their own requests
  - Admin/Operator users: Can view any request
- **Response**: Full support request with all logs and user information

### 4. Operator Response
- **Endpoint**: `POST /api/support/:id/respond`
- **Access**: Authenticated (Admin/Operator only)
- **Description**: Operator responds to a support request
- **Request Body**:
  ```json
  {
    "message": "Thank you for contacting us. Here's the solution..."
  }
  ```
- **Functionality**:
  - Creates a support log (isGohappyGoTeam: true)
  - Updates status from PENDING to RESOLVED
  - Sends email notification to requester
  - Cannot respond to CLOSED requests

### 5. User/Visitor Reply
- **Endpoint**: `POST /api/support/:id/reply`
- **Access**: Public (with optional authentication)
- **Description**: User/visitor replies to operator's response
- **Authorization**: Can only reply to own support requests
- **Request Body**:
  ```json
  {
    "message": "Thank you for the response. I have a follow-up question..."
  }
  ```
- **Functionality**:
  - Creates a support log (isGohappyGoTeam: false)
  - Updates status from RESOLVED back to PENDING
  - Sends email notification to SUPPORT_EMAIL
  - Cannot reply to CLOSED requests

### 6. Close Support Request
- **Endpoint**: `PATCH /api/support/:id/close`
- **Access**: Authenticated (Admin/Operator only)
- **Description**: Mark a support request as resolved and close it
- **Functionality**:
  - Updates status to CLOSED
  - Sends closure notification email to requester
  - Cannot close already CLOSED requests

## Database Schema

### SupportRequestEntity
- `id`: Primary key
- `email`: Requester email
- `message`: Initial support request message
- `supportRequesterType`: VISITOR | USER
- `status`: PENDING | RESOLVED | CLOSED
- `supportCategory`: TECHNICAL | BILLING | FINANCIAL | INFORMATIONAL | GENERAL | OTHER
- `logs`: One-to-many relation with SupportLogEntity
- `createdAt`, `updatedAt`, `deletedAt`: Timestamps

### SupportLogEntity
- `id`: Primary key
- `supportRequestId`: Foreign key to SupportRequestEntity
- `message`: Log message content
- `isRead`: Whether the log has been read
- `isGohappyGoTeam`: true if from operator, false if from requester
- `userId`: User who created the log (nullable for visitors)
- `createdAt`: Timestamp
- `supportRequest`: Many-to-one relation with SupportRequestEntity

## Email Templates

### 1. Support Request Received (to requester)
- Confirms receipt of support request
- Includes request ID and category
- Automated confirmation

### 2. New Support Request (to support team)
- Notifies support team of new request
- Includes full request details
- Internal notification

### 3. Operator Response (to requester)
- Notifies requester of operator's response
- Includes full message
- Link to view support request

### 4. User Reply (to support team)
- Notifies support team of user's reply
- Includes full reply message
- Internal notification

### 5. Support Request Closed (to requester)
- Notifies requester that issue is resolved
- Thanks them for using the service
- Link to submit new request if needed

## Error Codes

- `SUPPORT_REQUEST_NOT_FOUND`: Support request does not exist
- `SUPPORT_REQUEST_UNAUTHORIZED`: User not authorized to access this request
- `SUPPORT_REQUEST_ALREADY_CLOSED`: Cannot modify a closed request
- `SUPPORT_REQUEST_CANNOT_RESPOND`: Invalid state for responding
- `SUPPORT_OPERATOR_REQUIRED`: Only operators/admins can perform this action
- `SUPPORT_LOG_NOT_FOUND`: Support log not found

## Environment Variables Required

Add to your `.env` file:
```
SUPPORT_EMAIL=support@gohappygo.fr
```

This email address will receive notifications when:
- New support requests are created
- Users reply to operator responses

## Status Flow

```
PENDING (initial) 
    ↓
RESOLVED (after operator response)
    ↓ (if user replies)
PENDING (reopened)
    ↓
RESOLVED (after operator responds again)
    ↓
CLOSED (operator closes the request)
```

## Authorization Rules

### Non-Admin/Operator Users:
- ✅ Can create support requests
- ✅ Can view their own support requests only
- ✅ Can reply to their own support requests
- ❌ Cannot respond as operator
- ❌ Cannot close support requests
- ❌ Cannot view other users' requests

### Admin/Operator Users:
- ✅ Can view all support requests
- ✅ Can respond to any support request
- ✅ Can close any support request
- ✅ Full access to support system

### Visitors (not authenticated):
- ✅ Can create support requests
- ❌ Cannot view support requests (no authentication)
- ❌ Cannot reply (need to authenticate or use email link)

## API Response Examples

### Create Support Request Response:
```json
{
  "id": 1,
  "email": "user@example.com",
  "message": "I need help with...",
  "supportRequesterType": "USER",
  "status": "PENDING",
  "supportCategory": "TECHNICAL",
  "logs": [],
  "createdAt": "2025-12-04T10:00:00.000Z",
  "updatedAt": "2025-12-04T10:00:00.000Z"
}
```

### List Support Requests Response:
```json
{
  "data": [
    {
      "id": 1,
      "email": "user@example.com",
      "message": "I need help...",
      "supportRequesterType": "USER",
      "status": "RESOLVED",
      "supportCategory": "TECHNICAL",
      "logs": [
        {
          "id": 1,
          "supportRequestId": 1,
          "message": "Thank you for contacting us...",
          "isRead": false,
          "isGohappyGoTeam": true,
          "userId": 5,
          "userFullName": "Patrick O.",
          "createdAt": "2025-12-04T10:15:00.000Z"
        }
      ],
      "createdAt": "2025-12-04T10:00:00.000Z",
      "updatedAt": "2025-12-04T10:15:00.000Z"
    }
  ],
  "page": 1,
  "limit": 10,
  "total": 15,
  "totalPages": 2
}
```

## Integration Points

- **EmailService**: Sends all notification emails
- **EmailTemplatesService**: Provides HTML templates for emails
- **CommonService**: Formats user full names as "Firstname L."
- **UserEntity**: Links support logs to authenticated users
- **TypeORM**: Handles database operations and relations

## Testing Recommendations

1. **Create Support Request**: Test as visitor and user
2. **List Requests**: Test with different user roles (visitor, user, operator, admin)
3. **Operator Response**: Test authorization, email sending
4. **User Reply**: Test reopening RESOLVED requests
5. **Close Request**: Test authorization, finality of CLOSED status
6. **Email Notifications**: Verify all emails are sent correctly
7. **Pagination**: Test with various page/limit parameters
8. **Filtering**: Test all filter combinations

## Future Enhancements (Optional)

- Real-time notifications via WebSocket
- Support request priority levels
- File attachments in support messages
- Support request assignment to specific operators
- SLA tracking and automatic escalation
- Support analytics dashboard
- Auto-close after X days of inactivity
- Support request ratings/feedback

