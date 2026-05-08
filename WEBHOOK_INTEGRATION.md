# Flutterwave Webhook Integration for API Credit Top-ups

## Overview

This document describes the complete flow for handling Flutterwave payments for API credit top-ups in the WXATA developer dashboard.

## Architecture

### Frontend Flow (DeveloperDashboard.tsx)

1. **User initiates top-up**
   - Calls `POST /api/keys/topup/init` with API key header
   - Backend responds with transaction reference (`tx_ref`), amount, and Flutterwave public key

2. **Flutterwave payment modal**
   - Opens Flutterwave checkout modal with transaction details
   - User completes payment
   - Modal closes with payment status

3. **Success handling**
   - On successful payment, reload API key usage data
   - Display success message to user

### Backend Flow (DashboardServer.ts)

#### Step 1: Initialize Top-up (`POST /api/keys/topup/init`)

```
Client Request:
  - Method: POST
  - Headers: X-API-Key: <api_key>
  - No body required

Backend Process:
  1. Validate API key exists and is active
  2. Get service config values:
     - api_topup_amount_ngn: NGN amount (default: 2000)
     - api_topup_credits: Credits to add (default: 500)
  3. Generate tx_ref: WXAPI-${timestamp}-${random}
  4. Store mapping in pendingTopups Map: txRef -> apiKey
  5. Set 30-minute expiry on stored transaction

Response:
  {
    "tx_ref": "WXAPI-1234567890-a1b2c3d4",
    "amount": 2000,
    "credits": 500,
    "flw_public_key": "FLWXXXXX"
  }
```

#### Step 2: Flutterwave Webhook (`POST /webhooks/flutterwave/api`)

The webhook validates incoming payment notifications from Flutterwave and credits the developer's API key.

**Request Validation:**
```
Headers:
  - verif-hash: Must match FLW_SECRET_HASH from environment

Body:
  {
    "event": "charge.completed",
    "data": {
      "status": "successful",
      "tx_ref": "WXAPI-1234567890-a1b2c3d4",
      "amount": 2000
    }
  }
```

**Processing:**
1. Validate `verif-hash` header matches `FLW_SECRET_HASH`
2. Parse event JSON
3. Check event type is `charge.completed` and status is `successful`
4. Extract `tx_ref` from event data
5. Look up `tx_ref` in `pendingTopups` Map
6. If found:
   - Query `api_keys` table for matching API key
   - Add configured credits to `paid_credits` field
   - Update `last_used` timestamp to current time (ISO 8601)
   - Remove transaction from pending map
   - Log success with details (apiKey, credits, txRef)
7. If not found:
   - Log warning (may have expired after 30 minutes)
8. Always return 200 OK (even on errors) to prevent Flutterwave retries

**Response:**
```
Status: 200 OK
Body: "OK"
```

## Data Model

### api_keys Table Updates

When webhook processes successful payment:

```sql
UPDATE api_keys
SET 
  paid_credits = paid_credits + 500,
  last_used = NOW()
WHERE key = $1
```

### pendingTopups Map

Temporary in-memory Map storing transaction state:

```typescript
private pendingTopups = new Map<string, string>();
// txRef -> apiKey mapping
// Auto-expires after 30 minutes
```

## Error Handling

### Webhook Error Cases

1. **Invalid verif-hash**: Return 401, log, webhook retries
2. **Malformed JSON**: Return 400, log, webhook retries
3. **Unknown tx_ref**: Log warning, return 200 OK (prevent retries)
4. **API key not found**: Log warning, return 200 OK (prevent retries)
5. **Database error**: Log error, return 200 OK (prevent retries)
6. **Other exceptions**: Log error, return 200 OK (prevent retries)

**Key principle**: Return 200 OK for all errors after processing to prevent Flutterwave from retrying indefinitely.

## Configuration

Required environment variables:

```
FLW_SECRET_HASH=xxxxx    # Webhook verification hash from Flutterwave
FLW_PUBLIC_KEY=FLWXXXXX  # Flutterwave public key for frontend
```

Service configuration (from database):

- `api_topup_amount_ngn`: Amount in NGN (default: "2000")
- `api_topup_credits`: Credits to award (default: "500")

## Security Considerations

1. **Webhook Verification**: All webhooks validated against `FLW_SECRET_HASH`
2. **API Key Validation**: Initial request validates API key is active
3. **Transaction Mapping**: Uses opaque tx_ref, API key never exposed in URL
4. **Expiry**: Pending transactions auto-expire after 30 minutes
5. **Idempotency**: If webhook retries, tx_ref already deleted, prevents double-crediting

## Monitoring and Logging

### Log Entries

**Success**: 
```
level: info
message: "API key topped up via Flutterwave"
data: { apiKey, credits, txRef }
```

**Warnings**:
```
level: warn
message: "Flutterwave API webhook: unknown tx_ref (may have expired)"
data: { txRef }

message: "Flutterwave API webhook: API key not found"
data: { txRef, apiKey }
```

**Errors**:
```
level: error
message: "Error crediting API key in Flutterwave webhook"
data: { err, txRef, apiKey }

message: "POST /webhooks/flutterwave/api error"
data: { err }
```

## Testing

To test the webhook locally:

```bash
# Set up environment
FLW_SECRET_HASH="test_hash"

# Generate a tx_ref by calling /api/keys/topup/init
# This stores the mapping in pendingTopups

# Simulate webhook
curl -X POST http://localhost:3000/webhooks/flutterwave/api \
  -H "verif-hash: test_hash" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "charge.completed",
    "data": {
      "status": "successful",
      "tx_ref": "WXAPI-1234567890-a1b2c3d4",
      "amount": 2000
    }
  }'
```

## Compliance

- ✅ Flutterwave webhook best practices
- ✅ Prevent duplicate credits with transaction expiry
- ✅ Proper error handling and logging
- ✅ Timestamp updates for usage tracking
- ✅ Atomic transaction processing
