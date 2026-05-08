# WXATA Developer Account Setup — Complete Guide

## Overview

The Developer Account is a **separate product** for users who want to send WhatsApp messages programmatically via REST API, without needing a dashboard or bot commands.

Key differences:
- **Bot Account** → Dashboard, commands, extensions, marketplace
- **Developer Account** → REST API, programmatic control, 100 free messages + paid top-ups

---

## User Journey

### 1. Registration Path

**Option A: New Developer**
```
/register → Select "Developer Account" tab
  ↓
Enter email + name (optional)
  ↓
GET `/api/keys/create` (backend creates API key)
  ↓
Show API key → Copy to clipboard
  ↓
→ Can immediately start using the API
```

**Option B: Direct Portal**
```
/developer → Enter email in the form
  ↓
GET `/api/keys/create`
  ↓
Show API key
```

### 2. Login Path

**Developer Login**
```
/login → Select "Developer Account" tab
  ↓
Enter API key (or email to retrieve it)
  ↓
GET `/api/keys/usage` with `X-API-Key: <key>` header
  ↓
Validate → Store in localStorage
  ↓
Navigate to /developer/dashboard
```

### 3. Dashboard Usage

```
/developer/dashboard
  ↓
Auto-load API key from localStorage (if just logged in)
  ↓
Show stats: messages sent, free quota, paid credits, remaining
  ↓
Allow top-up → Flutterwave payment
  ↓
View code snippets (cURL, JS, Python)
```

---

## API Endpoints

### Get or Create API Key
```http
POST /api/keys/create
Content-Type: application/json

{
  "email": "dev@example.com",
  "name": "John Doe"
}
```

**Response (201 Created)**
```json
{
  "key": "wxata_live_abc123...",
  "limit": 100,
  "created": true,
  "messages_sent": 0
}
```

**Note**: If the email already has a key, it returns the existing one with `"created": false`.

---

### Check API Usage
```http
GET /api/keys/usage
X-API-Key: wxata_live_abc123...
```

**Response (200 OK)**
```json
{
  "email": "dev@example.com",
  "name": "John Doe",
  "messages_sent": 45,
  "messages_limit": 100,
  "paid_credits": 500,
  "active": true,
  "total_quota": 600
}
```

---

### Send a Message
```http
POST /api/send
X-API-Key: wxata_live_abc123...
Content-Type: application/json

{
  "to": "2348012345678",
  "message": "Hello from WXATA API!"
}
```

**Response (200 OK)**
```json
{
  "sent": true,
  "remaining": 599
}
```

**Status Codes**:
- `200 OK` → Message sent successfully
- `401 Unauthorized` → Invalid API key
- `402 Payment Required` → Quota exceeded
- `403 Forbidden` → API key suspended
- `503 Service Unavailable` → Bot not connected

---

### Initiate Top-Up Payment
```http
POST /api/keys/topup/init
X-API-Key: wxata_live_abc123...
```

**Response (200 OK)**
```json
{
  "tx_ref": "WXAPI-1704067200000-a1b2c3d4",
  "amount": 2000,
  "credits": 500,
  "flw_public_key": "FLWPUBK_TEST-..."
}
```

The frontend then opens Flutterwave with this `tx_ref` and `amount`.

---

### Flutterwave Webhook (Backend Only)
```http
POST /webhooks/flutterwave/api
verif-hash: <FLW_SECRET_HASH from env>
Content-Type: application/json

{
  "event": "charge.completed",
  "data": {
    "status": "successful",
    "amount": 2000,
    "customer": { "email": "dev@example.com" },
    "tx_ref": "WXAPI-1704067200000-a1b2c3d4"
  }
}
```

**Backend Processing**:
1. Validates `verif-hash` header
2. Looks up `tx_ref` in `pendingTopups` Map
3. Finds associated API key
4. Adds `paid_credits` to the key row
5. Updates `last_used` timestamp
6. Returns `200 OK`

---

## Configuration

### Environment Variables (`.env`)

**Backend**:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...service-role-key...
FLW_PUBLIC_KEY=FLWPUBK_TEST-...
FLW_SECRET_HASH=FLWSECK-...
```

**Frontend**:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...anon-key...
VITE_BACKEND_URL=https://your-bot-url/ws
```

### Admin Configuration (Dashboard)

In `/admin` → **API Service Config** section, admins can modify:
- `api_free_limit` (default: 100) → free messages per new key
- `api_topup_amount_ngn` (default: 2000) → price in ₦
- `api_topup_credits` (default: 500) → messages per top-up

Changes take effect immediately for new transactions.

---

## Database Schema

### `api_keys` table
```sql
id              UUID PRIMARY KEY
key             TEXT UNIQUE -- wxata_live_<48-char-hex>
owner_email     TEXT NOT NULL
owner_name      TEXT
messages_sent   INTEGER DEFAULT 0
messages_limit  INTEGER DEFAULT 100 -- free messages
paid_credits    INTEGER DEFAULT 0
active          BOOLEAN DEFAULT true
created_at      TIMESTAMPTZ
last_used       TIMESTAMPTZ
```

### `api_usage_log` table
```sql
id              UUID PRIMARY KEY
api_key_id      UUID REFERENCES api_keys(id)
to_number       TEXT NOT NULL
message_text    TEXT -- first 200 chars
status          TEXT DEFAULT 'sent'
created_at      TIMESTAMPTZ
```

### `service_config` table
```sql
key             TEXT PRIMARY KEY
value           TEXT NOT NULL
description     TEXT
updated_at      TIMESTAMPTZ
```

---

## Security

✅ **API Key Format**: `wxata_live_` prefix + 48 random hex chars (cryptographically secure)

✅ **Authentication**: `X-API-Key` header (not OAuth/JWT — simpler for CLI/SDKs)

✅ **Rate Limiting**: None built-in yet (consider adding per-key rate limit if needed)

✅ **Row Level Security**: Enabled on all tables:
- Service-role (backend) has full access
- Anonymous users can only read `service_config`
- `api_keys` and `api_usage_log` are backend-only

✅ **Flutterwave**: 
- Webhook validates `verif-hash` header
- `pendingTopups` Map prevents double-charging
- 30-minute expiry on pending transactions

---

## Testing Checklist

### Manual Testing

1. **Register Developer Account**
   - Go to `/register`
   - Select "Developer Account" tab
   - Enter email
   - Verify API key is generated and displayed

2. **Login with API Key**
   - Go to `/login`
   - Select "Developer Account" tab
   - Enter API key
   - Verify redirects to `/developer/dashboard`

3. **Dashboard**
   - Auto-loads key from localStorage
   - Shows usage stats
   - Copy button works
   - Tabs switch between code snippets

4. **Send Message via API**
   ```bash
   curl -X POST http://localhost:5000/api/send \
     -H "X-API-Key: wxata_live_..." \
     -H "Content-Type: application/json" \
     -d '{"to": "2348012345678", "message": "Hello!"}'
   ```
   - Verify bot sends message
   - Verify `messages_sent` increments
   - Verify remaining quota decreases

5. **Top-Up Payment**
   - Click "Top Up Credits" button
   - Flutterwave modal opens
   - Complete test payment
   - Verify credits added to account
   - Verify `paid_credits` increased

---

## Common Issues

### "API key required" error
- Make sure `X-API-Key` header is present
- Header name is case-sensitive
- Value must include the `wxata_live_` prefix

### "Invalid API key"
- API key may have been suspended (check `active` column)
- Email may have multiple keys (use the most recent)
- Check the exact key in database

### Flutterwave payment stuck
- Check `pendingTopups` Map is being populated
- Verify `verif-hash` matches `FLW_SECRET_HASH` env var
- Check webhook logs for errors
- Transactions expire after 30 minutes

### Messages not being sent
- Verify bot is connected (`/health` endpoint shows `CONNECTED`)
- Verify phone number format (e.g., `2348012345678` without +)
- Check quota hasn't been exceeded
- Check API key is `active: true`

---

## Future Enhancements

- [ ] Rate limiting per API key
- [ ] Usage analytics dashboard (requests/hour, top destinations, etc.)
- [ ] Webhook callbacks (notify users when message fails)
- [ ] API key rotation/revocation
- [ ] Usage alerts (email when quota is low)
- [ ] Monthly billing/subscription instead of pay-per-topup
- [ ] SDK libraries (JavaScript, Python, Go, etc.)
- [ ] Request logging with detailed error messages

