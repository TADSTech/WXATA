# API Credit Top-up Implementation - Quick Reference

## What Was Done

Updated the `/webhooks/flutterwave/api` endpoint in `DashboardServer.ts` to properly handle developer API credit top-ups.

## Key Changes

### 1. Updated `last_used` Timestamp
When a payment succeeds, the webhook now updates the API key's `last_used` field with the current timestamp. This ensures usage tracking is accurate.

```typescript
await getSupabaseAdmin()
  .from("api_keys")
  .update({
    paid_credits: (row.paid_credits ?? 0) + credits,
    last_used: new Date().toISOString(),  // ← NEW
  })
  .eq("id", row.id);
```

### 2. Improved Error Handling
- Wrapped database operations in try-catch to handle errors gracefully
- Returns 200 OK even on errors to prevent Flutterwave from retrying indefinitely
- Added specific logging for API key not found scenario

```typescript
if (apiKey) {
  try {
    // ... database operations ...
  } catch (topupErr) {
    logger.error(
      { err: topupErr, txRef, apiKey },
      "Error crediting API key in Flutterwave webhook",
    );
  }
  this.pendingTopups.delete(txRef);
}
```

### 3. Return 200 OK on All Errors
Changed error response to always return 200 to comply with Flutterwave best practices:

```typescript
} catch (err) {
  logger.error({ err }, "POST /webhooks/flutterwave/api error");
  // Return 200 to prevent Flutterwave from retrying
  res.writeHead(200);
  res.end("OK");
}
```

## Flow Summary

```
1. User clicks "Top Up" in DeveloperDashboard.tsx
   ↓
2. Frontend calls POST /api/keys/topup/init
   - Backend validates API key
   - Generates tx_ref: WXAPI-${timestamp}-${random}
   - Stores mapping: tx_ref → apiKey in pendingTopups Map
   - Returns amount, credits, Flutterwave public key
   ↓
3. Flutterwave payment modal opens
   - User enters payment details
   - User completes payment
   ↓
4. Flutterwave sends webhook: POST /webhooks/flutterwave/api
   - Validates verif-hash header
   - Checks event type and status
   - Looks up api key from pendingTopups Map
   - Updates api_keys table:
     * Add credits to paid_credits
     * Set last_used = now
   - Deletes tx_ref from pendingTopups
   - Returns 200 OK
   ↓
5. Frontend detects success, reloads API key usage
   - Shows success message
   - Displays updated credit balance
```

## Configuration Required

Add to `.env`:

```
FLW_SECRET_HASH=your_webhook_secret_from_flutterwave
FLW_PUBLIC_KEY=your_public_key_from_flutterwave
```

Set in database service_config table:

| key | value | description |
|-----|-------|-------------|
| api_topup_amount_ngn | 2000 | Amount charged in Nigerian Naira |
| api_topup_credits | 500 | Number of API credits awarded |

## API Endpoints

### POST /api/keys/topup/init
Initialize a top-up transaction.

**Request:**
```
POST /api/keys/topup/init HTTP/1.1
X-API-Key: your_api_key
```

**Response (200):**
```json
{
  "tx_ref": "WXAPI-1704067200000-a1b2c3d4",
  "amount": 2000,
  "credits": 500,
  "flw_public_key": "FLWXXXXX"
}
```

### POST /webhooks/flutterwave/api
Receives payment notifications from Flutterwave.

**Request (from Flutterwave):**
```
POST /webhooks/flutterwave/api HTTP/1.1
verif-hash: your_webhook_secret
Content-Type: application/json

{
  "event": "charge.completed",
  "data": {
    "status": "successful",
    "tx_ref": "WXAPI-1704067200000-a1b2c3d4",
    "amount": 2000
  }
}
```

**Response (always 200):**
```
200 OK
OK
```

## Error Handling

| Error | HTTP Status | Behavior |
|-------|------------|----------|
| Missing/invalid verif-hash | 401 | Rejects webhook, Flutterwave retries |
| Malformed JSON | 400 | Bad request, Flutterwave retries |
| Unknown tx_ref | 200 | Logs warning, prevents retry loop |
| API key not found | 200 | Logs warning, prevents retry loop |
| Database error | 200 | Logs error, prevents retry loop |
| Other exceptions | 200 | Logs error, prevents retry loop |

## Testing Checklist

- [ ] Environment variables FLW_SECRET_HASH and FLW_PUBLIC_KEY are set
- [ ] Service config values are in database
- [ ] Test API key exists and is active
- [ ] Call `/api/keys/topup/init` to get tx_ref
- [ ] Verify tx_ref is stored in pendingTopups Map
- [ ] Send test webhook with valid verif-hash
- [ ] Verify paid_credits increased by configured amount
- [ ] Verify last_used timestamp was updated
- [ ] Verify tx_ref was deleted from pendingTopups
- [ ] Check logs for success message

## Files Modified

- `WXATA/backend/DashboardServer.ts` - Updated webhook endpoint
- `WXATA/frontend/src/pages/DeveloperDashboard.tsx` - Already has top-up UI (no changes needed)

## Monitoring

Check these logs to verify the implementation:

```
// Success
level: info
message: "API key topped up via Flutterwave"
data: { apiKey, credits, txRef }

// Warnings
level: warn
message: "Flutterwave API webhook: unknown tx_ref (may have expired)"

// Errors
level: error
message: "Error crediting API key in Flutterwave webhook"
```

## Security Notes

✅ **Webhook Verification**: Every webhook validated with FLW_SECRET_HASH  
✅ **No Double-Charging**: tx_ref deleted immediately after use  
✅ **Auto-Expiry**: Pending transactions expire after 30 minutes  
✅ **API Key Validation**: Initial request validates key is active  
✅ **Idempotent**: Retries won't cause duplicate credits  
✅ **Timestamp Tracking**: last_used field enables usage monitoring

## Support

If credits aren't being added:
1. Check FLW_SECRET_HASH is correct
2. Verify webhook is being called (check logs)
3. Confirm tx_ref exists in pendingTopups when webhook arrives
4. Check database service_config for topup values
5. Verify API key row exists in api_keys table
