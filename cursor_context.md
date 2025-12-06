\# GoHappyGo Platform – AI Context Overview



\## 🎯 Project Summary

GoHappyGo is a peer-to-peer delivery platform connecting travelers and package senders. Users can publish \*\*delivery requests ("demands")\*\* or declare \*\*upcoming travels\*\*, and the platform enables matching between the two based on key logistics like \*\*flight number and weight\*\*.



The system prioritizes \*\*trust, identity verification, traceability, and transactional integrity\*\*.



---



\## 🧑‍💼 User Onboarding \& Verification Flow



\### Step-by-Step Flow:

1\. \*\*Register with phone number\*\*

&nbsp;  - `POST /auth/register`

2\. \*\*Phone number verification (SMS code)\*\*

&nbsp;  - `POST /auth/verify-phone`

&nbsp;  - Marks `isPhoneVerified = true`

3\. \*\*Upload ID + selfie for identity verification\*\*

&nbsp;  - `POST /auth/upload-verification`

&nbsp;  - User uploads 2-sided ID and a selfie

4\. \*\*Admin reviews and validates the user\*\*

&nbsp;  - `PATCH /auth/verify/:id`

&nbsp;  - Marks `isVerified = true`

&nbsp;  - Review logged in `UserVerificationAuditEntity`



\### Entities:

\- `UserEntity`: contains fields `isPhoneVerified`, `isVerified`

\- `UploadedFileEntity`: holds ID/selfie files

\- `UserVerificationAuditEntity`: audit trail of admin actions



---



\## 🧾 Demand \& Travel Posting



\### A. Demands (delivery requests)

\- `POST /announces`: create a demand

\- Fields: origin, destination, weight, flightNumber, deliveryDate, description, pricePerKg

\- Stored in `DemandEntity`

\- Status: `active`, `expired`, `cancelled`



\### B. Travels

\- `POST /travels`: declare an upcoming trip

\- Fields: origin, destination, availableWeight, flightNumber, travelDate

\- Stored in `TravelEntity`



---



\## 🤝 Request Lifecycle



When a user wants to engage with a posted demand/travel:



\### `POST /requests` – Create a request

\- Links a demand and a travel

\- Stored in `RequestEntity`

\- First status is `NEGOTIATING` (stored via `RequestStatusHistoryEntity`)

\- Status values stored in `RequestStatusEntity`



\### Status Flow (example):

\- `NEGOTIATING` → `ACCEPTED` → `IN\_TRANSIT` → `DELIVERED`



\### Each status change is tracked in:

\- `RequestStatusHistoryEntity`, with `requestId`, `requestStatusId`, `createdAt`



---



\## 💳 Transaction \& Booking



\### `POST /transactions`

\- Created after a request is `ACCEPTED`

\- Represents a confirmed delivery agreement

\- Fields: `requestId`, `paidAmount`, `status` (`PENDING`, `PAID`, `CANCELLED`, etc.)

\- Stored in `TransactionEntity`



---



\## 💬 Internal Messaging

\- Users can message each other after a request is accepted

\- `POST /messages`

\- Threaded by `requestId`

\- Stored in `MessageEntity`



---



\## 🌟 Review System

\- `POST /reviews`: reviewer → reviewee, 1 review per request

\- Fields: rating (1–5), comment

\- Stored in `ReviewEntity`

\- Constraint: `@Unique(\['reviewerId', 'revieweeId', 'requestId'])`



---



\## 🔐 Access Control

\- Admin endpoints guarded with:

&nbsp; - `@Roles(UserRole.ADMIN)`

&nbsp; - `@UseGuards(JwtAuthGuard, RolesGuard)`

\- Users access their own resources via `@CurrentUser()`



---



\## ✅ Implemented Endpoints



\### AuthController

\- `POST /auth/register`

\- `POST /auth/verify-phone`

\- `POST /auth/upload-verification`

\- `PATCH /auth/verify/:id`

\- `POST /auth/login`

\- `POST /auth/refresh`

\- `GET /auth/profile`



\### UserController

\- `GET /users`

\- `GET /users/:idUser`

\- `POST /users/create-staff`

\- `POST /users/update-staff`



\### RoleController

\- `GET /roles`

\- `POST /roles`

\- `PUT /roles/:id`

\- `DELETE /roles/:id`



---



\## 📌 Planned Endpoints to Implement



\### TravelController

\- `POST /travels`

\- `GET /travels`

\- `GET /travels/:id`

\- `GET /travels/me` (all travels posted by current user)

\- `PATCH /travels/:id`

\- `DELETE /travels/:id`



\### DemandController

\- `POST /demand`

\- `GET /demands`

\- `GET /demand/:id`

\- `GET /demands/me` (all demands posted by current user)

\- `PATCH /demand/:id`

\- `DELETE /demand/:id`



\### RequestController

\- `POST /requests`

\- `GET /requests/me`(all requests posted by current user)

\- `PATCH /requests/:id/status`



\### TransactionController

\- `POST /transactions`

\- `GET /transactions/me` 

\- `PATCH /transactions/:id/status`



\### MessageController

\- `POST /messages`

\- `GET /messages/thread/:requestId`

\- `GET /messages/unread-count`



\### ReviewController

\- `POST /reviews`

\- `GET /reviews/user/:id`

\- `GET /reviews/me`



---



\## 💡 Matching Logic Summary



Matching is \*\*based solely on\*\*:

\- `flightNumber`

\- `weight`



To find matches:

\- A demand user searches travels by flightNumber + minWeight

\- A traveler searches demands by flightNumber + maxWeight



---



\## 🛡️ Admin Features (Planned)

\- View all users and demands

\- Verify uploaded documents

\- Moderate messages or requests

\- View transactions and disputes



