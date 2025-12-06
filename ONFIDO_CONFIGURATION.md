# Onfido KYC Configuration Guide

## Environment Variables Required

Add these environment variables to your `.env` file for Onfido KYC integration:

```env
# Onfido KYC Configuration
ONFIDO_API_TOKEN=api_sandbox.tSPKdq27PPh.CAE8Q0No3InM9-5gVtQhz30SWyZv_BD2
ONFIDO_BASE_URL=https://api.onfido.com/v3.6
ONFIDO_WORKFLOW_ID=dad1cc96-a456-4379-b2d6-6c03a22c1593
ONFIDO_WEBHOOK_TOKEN=Es7JRVKWnNgWpSvDB9HXvZ09t95YHqvc

# Application URLs (if not already set)
PUBLIC_APP_URL=https://gohappygo.fr
BACKEND_URL=https://api.gohappygo.fr
```

## Onfido Dashboard Configuration

### 1. API Token
- **Token**: `api_sandbox.tSPKdq27PPh.CAE8Q0No3InM9-5gVtQhz30SWyZv_BD2`
- **Environment**: Sandbox
- **Permissions**: Full API access

### 2. Workflow Configuration
- **Workflow ID**: `dad1cc96-a456-4379-b2d6-6c03a22c1593`
- **Type**: Document & Motion Basic
- **Required Fields**: First Name, Last Name
- **Document Types**: Passport, Driving License, National ID
- **Motion Check**: Basic motion detection

### 3. Webhook Configuration
- **Webhook URL**: `https://api.gohappygo.fr/api/onfido-kyc/webhook`
- **Events**:
  - `workflow_run.started` - When verification starts
  - `workflow_run.completed` - When verification completes
  - `workflow_task.completed` - When individual tasks complete
- **Webhook Token**: `Es7JRVKWnNgWpSvDB9HXvZ09t95YHqvc`
- **Webhook ID**: `0d48d77c-f7c7-4b41-815e-d90e97e4429b`

## API Endpoints

### Start KYC Process
```http
POST /api/onfido-kyc/start
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Response:**
```json
{
  "sdkToken": "token_abc123...",
  "workflowRunId": "workflow_run_xyz789...",
  "message": "Onfido KYC session created successfully. Use SDK token for client-side verification."
}
```

### Get KYC Status
```http
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

### Webhook Endpoint
```http
POST /api/onfido-kyc/webhook
X-Onfido-Signature: <webhook-signature>
Content-Type: application/json
```

## Client-Side Integration

### React Example
```javascript
import { init } from '@onfido/onfido-sdk-ui';

const startVerification = async () => {
  try {
    // Get SDK token from backend
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
        // Redirect or show success message
      },
      onError: (error) => {
        console.error('Verification error:', error);
        // Handle error
      }
    });
  } catch (error) {
    console.error('Failed to start verification:', error);
  }
};
```

### HTML Example
```html
<!DOCTYPE html>
<html>
<head>
  <title>Onfido Verification</title>
</head>
<body>
  <div id="onfido-mount"></div>
  
  <script src="https://assets.onfido.com/web-sdk-releases/7.0.0/onfido.min.js"></script>
  <script>
    // Get SDK token from your backend
    fetch('/api/onfido-kyc/start', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + userToken,
        'Content-Type': 'application/json'
      }
    })
    .then(response => response.json())
    .then(data => {
      Onfido.init({
        token: data.sdkToken,
        containerId: 'onfido-mount',
        onComplete: function(data) {
          console.log('Verification completed:', data);
        },
        onError: function(error) {
          console.error('Verification error:', error);
        }
      });
    });
  </script>
</body>
</html>
```

## Status Flow

1. **User initiates KYC**: Frontend calls `/api/onfido-kyc/start`
2. **Backend creates applicant**: Creates applicant in Onfido with user details
3. **Backend creates workflow run**: Initiates verification workflow
4. **Backend generates SDK token**: Provides token for client-side verification
5. **Frontend shows verification**: User completes verification using Onfido SDK
6. **Onfido sends webhook**: Status updates sent to `/api/onfido-kyc/webhook`
7. **Backend updates user**: User status updated in database
8. **Frontend checks status**: Frontend can check status via `/api/onfido-kyc/status`

## Testing

### Sandbox Testing
- Use the provided sandbox API token
- Test with sample documents
- Verify webhook delivery
- Check status updates

### Production Deployment
- Replace sandbox token with production token
- Update webhook URL to production domain
- Test with real documents
- Monitor webhook delivery and processing

## Troubleshooting

### Common Issues

1. **Invalid API Token**
   - Verify token is correct
   - Check token permissions
   - Ensure token is for correct environment

2. **Webhook Not Received**
   - Verify webhook URL is accessible
   - Check webhook configuration in Onfido dashboard
   - Test webhook endpoint manually

3. **SDK Token Issues**
   - Verify applicant was created successfully
   - Check workflow run was created
   - Ensure SDK token generation succeeded

4. **Status Not Updating**
   - Check webhook signature verification
   - Verify webhook payload parsing
   - Check database update queries

### Debug Logging

Enable debug logging by setting:
```env
NODE_ENV=development
```

This will provide detailed logs for:
- API requests to Onfido
- Webhook processing
- Status updates
- Error conditions
