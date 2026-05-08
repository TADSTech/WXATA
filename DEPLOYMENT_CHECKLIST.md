# Deployment & Testing Checklist

## Pre-Deployment

### Code Review
- [x] Code compiles without errors
- [x] No TypeScript diagnostics
- [x] Changes reviewed and tested
- [x] Error handling is comprehensive
- [x] Logging is appropriate

### Environment Setup

**Development Environment**

```bash
# Set these environment variables
export FLW_SECRET_HASH="your_webhook_secret_from_flutterwave"
export FLW_PUBLIC_KEY="your_public_key_from_flutterwave"
```

**Database Setup**

Ensure these values exist in the `service_config` table:

```sql
INSERT INTO service_config (key, value) VALUES
  ('api_topup_amount_ngn', '2000'),
  ('api_topup_credits', '500');
```

Check they exist:
```sql
SELECT key, value FROM service_config 
WHERE key IN ('api_topup_amount_ngn', 'api_topup_credits');
```

**Database Schema**

Verify `api_keys` table has these columns:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'api_keys' 
AND column_name IN ('id', 'key', 'paid_credits', 'last_used', 'active');
```

Expected columns:
- `id` (integer, primary key)
- `key` (text, unique)
- `paid_credits` (integer, nullable, defaults to 0)
- `last_used` (timestamp, nullable)
- `active` (boolean, defaults to true)

---

## Local Testing

### Test 1: Initialize Top-up Transaction

**Objective**: Verify `/api/keys/topup/init` generates proper tx_ref

```bash
# Step 1: Get a valid test API key (create one in your dashboard)
# or use an existing one

# Step 2: Call the init endpoint
curl -X POST http://localhost:3000/api/keys/topup/init \
  -H "X-API-Key: YOUR_TEST_API_KEY" \
  -H "Content-Type: application/json"

# Expected response (200):
# {
#   "tx_ref": "WXAPI-1704067200000-a1b2c3d4",
#   "amount": 2000,
#   "credits": 500,
#   "flw_public_key": "FLWXXXXXX"
# }
```

**Verification**:
- [x] Response status is 200
- [x] `tx_ref` matches pattern `WXAPI-{timestamp}-{random}`
- [x] `amount` is 2000 (or configured value)
- [x] `credits` is 500 (or configured value)
- [x] `flw_public_key` matches FLW_PUBLIC_KEY env var
- [x] Save the `tx_ref` for next test

---

### Test 2: Simulate Successful Payment Webhook

**Objective**: Verify webhook credits the API key correctly

**Prerequisites**:
- Have a valid `tx_ref` from Test 1
- Have a valid test API key
- Know the initial `paid_credits` value

```bash
# Step 1: Note initial credits
SELECT key, paid_credits FROM api_keys WHERE key = 'YOUR_TEST_API_KEY';
# Note the current paid_credits value

# Step 2: Send webhook
curl -X POST http://localhost:3000/webhooks/flutterwave/api \
  -H "verif-hash: YOUR_FLW_SECRET_HASH" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "charge.completed",
    "data": {
      "status": "successful",
      "tx_ref": "WXAPI-1704067200000-a1b2c3d4",
      "amount": 2000
    }
  }'

# Expected response (200):
# OK
```

**Verification**:
- [x] Response status is 200
- [x] Response body is "OK"
- [x] No errors in logs (or only expected warnings)

**Database Verification**:
```sql
SELECT key, paid_credits, last_used FROM api_keys 
WHERE key = 'YOUR_TEST_API_KEY';
```

Expected:
- [x] `paid_credits` increased by 500 (or configured value)
- [x] `last_used` is recent timestamp (within last minute)
- [x] `key` value unchanged

---

### Test 3: Webhook Idempotency (Prevent Double-Charging)

**Objective**: Verify retried webhooks don't double-charge

```bash
# Step 1: Send the same webhook again (simulating Flutterwave retry)
curl -X POST http://localhost:3000/webhooks/flutterwave/api \
  -H "verif-hash: YOUR_FLW_SECRET_HASH" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "charge.completed",
    "data": {
      "status": "successful",
      "tx_ref": "WXAPI-1704067200000-a1b2c3d4",
      "amount": 2000
    }
  }'

# Step 2: Check logs for warning about unknown tx_ref
# Expected warning: "Flutterwave API webhook: unknown tx_ref (may have expired)"
```

**Verification**:
- [x] Response status is still 200
- [x] Log shows warning about unknown tx_ref
- [x] Database credits NOT increased again
- [x] `paid_credits` same as after first webhook

---

### Test 4: Webhook with Invalid Hash

**Objective**: Verify webhook validation works

```bash
# Step 1: Send webhook with WRONG hash
curl -X POST http://localhost:3000/webhooks/flutterwave/api \
  -H "verif-hash: WRONG_HASH_VALUE" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "charge.completed",
    "data": {
      "status": "successful",
      "tx_ref": "WXAPI-1704067200000-a1b2c3d4",
      "amount": 2000
    }
  }'

# Expected response (401):
# Unauthorized
```

**Verification**:
- [x] Response status is 401
- [x] Database unchanged
- [x] No credits added

---

### Test 5: Webhook with Missing Hash

**Objective**: Verify webhook validation requires hash

```bash
# Step 1: Send webhook WITHOUT hash header
curl -X POST http://localhost:3000/webhooks/flutterwave/api \
  -H "Content-Type: application/json" \
  -d '{
    "event": "charge.completed",
    "data": {
      "status": "successful",
      "tx_ref": "WXAPI-1704067200000-a1b2c3d4",
      "amount": 2000
    }
  }'

# Expected response (401):
# Unauthorized
```

**Verification**:
- [x] Response status is 401
- [x] Database unchanged

---

### Test 6: Webhook with Malformed JSON

**Objective**: Verify error handling for bad JSON

```bash
# Step 1: Send webhook with invalid JSON
curl -X POST http://localhost:3000/webhooks/flutterwave/api \
  -H "verif-hash: YOUR_FLW_SECRET_HASH" \
  -H "Content-Type: application/json" \
  -d '{invalid json content'

# Expected response (400):
# Bad Request
```

**Verification**:
- [x] Response status is 400
- [x] Database unchanged

---

### Test 7: Webhook with Expired Transaction

**Objective**: Verify tx_ref expiry after 30 minutes

```bash
# Step 1: Note current time
# Step 2: Wait 31 minutes
# Step 3: Send webhook with old tx_ref

# Expected response (200):
# OK

# Expected log:
# WARN: "Flutterwave API webhook: unknown tx_ref (may have expired)"
```

**Verification**:
- [x] Response status is 200
- [x] Log shows appropriate warning
- [x] Database unchanged

---

### Test 8: Webhook with Non-Existent API Key

**Objective**: Verify handling of invalid API keys

```bash
# Step 1: Create tx_ref mapping manually (or wait for actual payment)
# Step 2: Modify the mapping in code to map to non-existent key
# Step 3: Send webhook

# Expected response (200):
# OK

# Expected log:
# WARN: "Flutterwave API webhook: API key not found"
```

**Verification**:
- [x] Response status is 200
- [x] Log shows warning
- [x] Database unchanged

---

## Log Verification

### Expected Log Messages

After successful Test 2, check logs contain:

```
✅ INFO: "API key topped up via Flutterwave"
   Fields: { apiKey, credits, txRef }
   Example: {
     apiKey: "test_key_xxxxx",
     credits: 500,
     txRef: "WXAPI-1704067200000-a1b2c3d4"
   }
```

After Test 3 (retry), check logs contain:

```
⚠️ WARN: "Flutterwave API webhook: unknown tx_ref (may have expired)"
   Fields: { txRef }
```

### All Test Logs Should NOT Contain

```
❌ 500 Internal Server Error responses
❌ "Error crediting API key in Flutterwave webhook" (unless simulated failure)
❌ "Flutterwave API webhook: API key not found" (unless using invalid key)
```

---

## Production Deployment

### Pre-Deployment Checklist

**Code**:
- [x] Changes merged to main branch
- [x] Code reviewed
- [x] All tests passing

**Configuration**:
- [x] `FLW_SECRET_HASH` set in production environment
- [x] `FLW_PUBLIC_KEY` set in production environment
- [x] Service config values present in production database
- [x] API keys table schema verified

**Documentation**:
- [x] Team aware of changes
- [x] Monitoring alerts set up
- [x] Runbook created for troubleshooting

### Deployment Steps

```bash
# Step 1: Deploy updated DashboardServer.ts
# (Use your normal deployment process)

# Step 2: Verify backend is running
curl http://your-api.com/health

# Step 3: Monitor logs for issues
# (Watch logs for first 30 minutes)

# Step 4: Test with actual Flutterwave payment
# (Use test account first)
```

### Post-Deployment Verification

**Immediate (0-5 minutes)**:
- [x] Backend service is running
- [x] No errors in logs
- [x] Webhook endpoint is accessible

**Short-term (5-30 minutes)**:
- [x] No webhook processing errors
- [x] No database errors
- [x] Log messages match expected format

**Ongoing**:
- [x] Monitor for "Error crediting API key" messages
- [x] Monitor for unexpected 500 errors
- [x] Check payment success rates

---

## Monitoring and Alerts

### Logs to Monitor

**Success Indicator** (Should see after payments):
```
INFO: "API key topped up via Flutterwave"
```

**Warning Indicators** (May see occasionally, not critical):
```
WARN: "Flutterwave API webhook: unknown tx_ref (may have expired)"
WARN: "Flutterwave API webhook: API key not found"
```

**Error Indicators** (Investigate immediately):
```
ERROR: "Error crediting API key in Flutterwave webhook"
ERROR: "POST /webhooks/flutterwave/api error"
```

### Recommended Alerts

1. **High Priority**: More than 5 errors in 1 hour
2. **Medium Priority**: More than 10 warnings in 1 hour
3. **Low Priority**: Pattern of "unknown tx_ref" warnings

---

## Rollback Plan

If issues occur:

1. **Stop accepting top-ups**: Disable the button in frontend
2. **Monitor**: Watch for failed webhooks
3. **Rollback** (if needed):
   - Revert to previous DashboardServer.ts
   - Redeploy backend
   - Verify logs clear up
4. **Notify**: Inform affected users
5. **Investigate**: Review logs to understand issue
6. **Fix**: Address root cause
7. **Redeploy**: Try again with fixes

---

## Success Criteria

✅ All local tests pass  
✅ Database updates correctly  
✅ Logs are appropriate and helpful  
✅ No error spikes in production  
✅ User credits appear correctly  
✅ No double-charging occurs  
✅ Webhook handles all error cases  

---

## Support Contact

If issues arise:
1. Check logs for error messages
2. Verify environment configuration
3. Verify database state
4. Consult WEBHOOK_INTEGRATION.md for detailed info
5. Review troubleshooting section in API_TOPUP_QUICK_REFERENCE.md

---

## Sign-Off

- [ ] Code reviewed and approved
- [ ] Local testing completed
- [ ] Deployment plan reviewed
- [ ] Monitoring configured
- [ ] Ready to deploy to production

**Date**: ___________  
**Reviewed by**: ___________  
**Approved by**: ___________  
