# Onfido KYC Integration

This module provides KYC (Know Your Customer) verification using Onfido's identity verification services. It allows users to complete identity verification using Onfido's SDK on the client-side.

## Features

- **Applicant Creation**: Creates applicants in Onfido with user information
- **Workflow Run**: Initiates verification workflows for applicants
- **SDK Token Generation**: Provides tokens for client-side verification
- **Webhook Handling**: Processes status updates from Onfido
- **Status Tracking**: Tracks verification status in the database

## API Endpoints

### 1. Start KYC Process
```
POST /api/onfido-kyc/start
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "sdkToken": "token_abc123...",
  "workflowRunId": "workflow_run_xyz789...",
  "message": "Onfido KYC session created successfully. Use SDK token for client-side verification."
}
```

### 2. Get KYC Status
```
GET /api/onfido-kyc/status
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "kycStatus": "pending",
  "kycUpdatedAt": "2024-01-15T10:30:00Z",
  "kycProvider": "onfido",
  "isVerified": false
}
```

### 3. Get Workflow Run Details
```
GET /api/onfido-kyc/workflow-run-details
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "workflowRunId": "workflow_run_xyz789...",
  "kycStatus": "pending",
  "workflowRunStatus": "in_progress",
  "applicantId": "applicant_abc123...",
  "provider": "onfido",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### 4. Webhook Endpoint
```
POST /api/onfido-kyc/webhook
X-Onfido-Signature: <webhook-signature>
```

This endpoint is called by Onfido to notify about status changes.

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Onfido Configuration
ONFIDO_API_TOKEN=api_sandbox.tSPKdq27PPh.CAE8Q0No3InM9-5gVtQhz30SWyZv_BD2
ONFIDO_BASE_URL=https://api.onfido.com/v3.6
ONFIDO_WORKFLOW_ID=dad1cc96-a456-4379-b2d6-6c03a22c1593
ONFIDO_WEBHOOK_TOKEN=Es7JRVKWnNgWpSvDB9HXvZ09t95YHqvc

# Application URLs
PUBLIC_APP_URL=https://gohappygo.fr
BACKEND_URL=https://api.gohappygo.fr
```

## Client-Side Integration

### React/JavaScript SDK

1. Install the Onfido SDK:
```bash
npm install @onfido/onfido-sdk-ui
```

2. Use the SDK token from the API response:

```javascript
import { init } from '@onfido/onfido-sdk-ui';

// Get SDK token from your backend
const response = await fetch('/api/onfido-kyc/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  }
});

const { sdkToken } = await response.json();

// Initialize Onfido SDK
const onfido = init({
  token: sdkToken,
  containerId: 'onfido-mount',
  onComplete: (data) => {
    console.log('Verification completed:', data);
    // Handle completion
  },
  onError: (error) => {
    console.error('Verification error:', error);
    // Handle error
  }
});
```

### HTML Integration

```html
<div id="onfido-mount"></div>
<script src="https://assets.onfido.com/web-sdk-releases/7.0.0/onfido.min.js"></script>
<script>
  Onfido.init({
    token: 'YOUR_SDK_TOKEN',
    containerId: 'onfido-mount',
    onComplete: function(data) {
      console.log('Verification completed:', data);
    },
    onError: function(error) {
      console.error('Verification error:', error);
    }
  });
</script>
```

## Webhook Configuration

Configure your Onfido webhook with these settings:

- **Webhook URL**: `https://api.gohappygo.fr/api/onfido-kyc/webhook`
- **Events**: 
  - `workflow_run.started`
  - `workflow_run.completed`
  - `workflow_task.completed`
- **Webhook Token**: `Es7JRVKWnNgWpSvDB9HXvZ09t95YHqvc`

## Status Mapping

The service maps Onfido statuses to internal statuses:

| Onfido Status | Internal Status | Description |
|---------------|-----------------|-------------|
| `completed` | `approved` | Verification completed successfully |
| `failed` | `failed` | Verification failed |
| `cancelled` | `rejected` | Verification was cancelled |
| `in_progress` | `pending` | Verification in progress |
| `awaiting_input` | `pending` | Waiting for user input |

## Database Updates

The service updates the following user fields:

- `kycProvider`: Set to 'onfido'
- `kycReference`: Set to the workflow run ID
- `kycStatus`: Updated based on webhook events
- `isVerified`: Set to true when status is 'approved'
- `kycUpdatedAt`: Timestamp of last status update

## Error Handling

The service handles various error scenarios:

- **Invalid API credentials**: Returns 400 with appropriate message
- **Missing webhook signature**: Returns 400 with error message
- **Invalid webhook signature**: Returns 401 with error message
- **User not found**: Logs warning and continues
- **API errors**: Logs error details and returns appropriate HTTP status

## Logging

The service provides comprehensive logging for:

- KYC process initiation
- Webhook processing
- Status updates
- Error conditions
- API interactions

## Security

- Webhook signature verification using HMAC SHA256
- JWT authentication for protected endpoints
- Environment variable configuration for sensitive data
- Input validation and sanitization

## Testing

To test the integration:

1. Set up the environment variables
2. Start the KYC process using the `/start` endpoint
3. Use the returned SDK token in your client application
4. Complete the verification process
5. Check the webhook endpoint receives status updates
6. Verify the user's status is updated in the database
