# FCM Mobile Integration Guide

This document describes how the mobile app integrates with the GoHappyGo backend for push notifications.

## Prerequisites

1. Use the same Firebase project as backend `FIREBASE_PROJECT_ID`.
2. Integrate Firebase Messaging SDK (`@react-native-firebase/messaging`, Flutter `firebase_messaging`, or native FCM).
3. Request notification permission (iOS prompt; Android 13+ `POST_NOTIFICATIONS`).
4. Upload APNs Authentication Key (.p8) in Firebase Console for iOS.

## Token registration API

### Register or refresh token

```http
PUT /api/notification/device-token
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "fcmToken": "<token from Firebase>",
  "platform": "ios",
  "deviceId": "<optional-stable-device-uuid>"
}
```

- Use `"platform": "android"` on Android.
- Call after login, on app launch, and on `onTokenRefresh`.
- Idempotent upsert; safe to call repeatedly.

**Response `200`:**

```json
{
  "success": true,
  "registeredAt": "2026-05-30T12:00:00.000Z"
}
```

### Unregister on logout

```http
DELETE /api/notification/device-token
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "fcmToken": "<same token>"
}
```

**Response `204`:** No content. Call before clearing the local JWT.

## Push payload format

### Display (`notification` — OS banner when backgrounded)

```json
{
  "title": "Request Accepted",
  "body": "Your request was accepted."
}
```

### Data (routing — all values are strings)

```json
{
  "notificationId": "42",
  "notificationType": "REQUEST_ACCEPTED",
  "entityType": "REQUEST",
  "entityId": "15",
  "actorUserId": "7",
  "priority": "HIGH",
  "clickAction": "OPEN_NOTIFICATION"
}
```

Empty optional fields are sent as `""`.

## Deep-link routing

| `notificationType` | Navigate to |
|--------------------|-------------|
| `REQUEST_*` | Request detail (`entityId` = requestId) |
| `REVIEW_RECEIVED` | Reviews / profile |
| `TRAVEL_PUBLISHED`, `TRAVEL_MATCHED` | Travel detail (`entityId` = travelId) |
| `DEMAND_PUBLISHED`, `DEMAND_MATCHED` | Demand detail (`entityId` = demandId) |
| `PAYMENT_RECEIVED`, `TRANSACTION_*` | Transaction detail |
| `ACCOUNT_VERIFIED`, `VERIFICATION_*` | Profile / KYC |
| `SYSTEM_ANNOUNCEMENT` | Notifications inbox |

On tap, optionally mark read: `PATCH /api/notification/:id/read`.

## Mobile implementation steps

1. After login: `const fcmToken = await messaging().getToken()`
2. `PUT /api/notification/device-token` with JWT
3. Foreground: `messaging().onMessage(...)` — refresh inbox or show in-app banner
4. Background tap: `onNotificationOpenedApp` / `getInitialNotification` → route via `data`
5. Logout: `DELETE /api/notification/device-token`

## Inbox APIs (unchanged)

- `GET /api/notification` — paginated inbox
- `GET /api/notification/counts` — badge count
- `PATCH /api/notification/:id/read`

Push is a delivery channel; the inbox API remains the source of truth.

## Backend enablement

Set `FCM_ENABLED=true` in server environment to activate push sends. Without it, notifications are still saved to the database but no FCM messages are sent.

## Testing checklist

1. Login → register token → trigger a notification in staging (e.g. accept a request)
2. App backgrounded → OS banner with correct title/body
3. Tap → correct screen via `entityType` + `entityId`
4. App foreground → `onMessage` fires
5. Logout → DELETE token → no more pushes for that user on that device
6. Login as different user → PUT reassigns token to new user
