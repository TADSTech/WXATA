# Implementation Plan: WXATA Production-Ready

## Overview

Bring WXATA to a production-ready state across six areas: repository hygiene, RLS fix, backend changes (Flutterwave webhook + new bot commands), frontend page restoration (Dashboard + Admin), UX improvements, and property-based tests. Tasks are ordered by dependency — cleanup and env changes first, then backend, then frontend, then tests.

## Tasks

- [x] 1. Repository hygiene and environment variable cleanup
  - [x] 1.1 Update `.gitignore` files to exclude secrets and dev artifacts
    - Add `backend/auth_info/` to `backend/.gitignore`
    - Add `backend/botinfo.json`, `backend/warns.json`, `backend/vars.json`, `backend/antidel.json`, `backend/antibc.json` to `backend/.gitignore`
    - Add `botinfo.json`, `warns.json`, `vars.json`, `antidel.json`, `antibc.json`, `root.env` to root `.gitignore`
    - Add `scratch/`, `refactor_v2.js`, `frontend/refactor_themes.js` to root `.gitignore`
    - Add `wxata-public/` to root `.gitignore` (Requirement 19.2)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 18.4, 19.2_

  - [x] 1.2 Remove dev artifact files from the repository
    - Delete `scratch/validate_menu.js` and the `scratch/` directory
    - Delete `refactor_v2.js` from the repository root
    - Delete `frontend/refactor_themes.js`
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 1.3 Update `backend/.env.example` for Flutterwave
    - Remove `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_HOSTED_INITIAL`, `PAYSTACK_PLAN_HOSTED_RECURRING`
    - Add `FLW_SECRET_HASH=your-flutterwave-secret-hash-here`
    - Ensure all sensitive fields use placeholder strings, not real values
    - _Requirements: 12.4, 22.1, 22.3, 22.5_

  - [x] 1.4 Update `frontend/.env.example` for Flutterwave
    - Remove `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_PAYSTACK_PLAN_HOSTED_INITIAL`
    - Add `VITE_FLW_PUBLIC_KEY=your-flutterwave-public-key-here`
    - _Requirements: 12.5, 22.2, 22.4_

  - [x] 1.5 Update `README.md` stack table
    - Replace "Firebase (Auth + Firestore)" with "Supabase (Auth + PostgreSQL)" in the stack table
    - Replace Render deployment reference with Oracle VPS (backend) + Vercel (frontend)
    - Remove all Firebase/Firestore references from stack description and quick-start
    - _Requirements: 17.1, 17.2, 17.3_

  - [x] 1.6 Update `INSTRUCTIONS.md` for Flutterwave
    - Remove all Paystack env var references (`PAYSTACK_SECRET_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_PAYSTACK_PLAN_HOSTED_INITIAL`)
    - Add `FLW_SECRET_HASH` (backend) and `VITE_FLW_PUBLIC_KEY` (frontend) documentation
    - Document the Flutterwave webhook verification method: compare `verif-hash` header against `FLW_SECRET_HASH` using direct string equality
    - _Requirements: 21.1, 21.2, 21.3_

- [x] 2. Database migration — RLS policy fix
  - [x] 2.1 Create `supabase/migrations/002_rls_user_codes_anon.sql`
    - Add `CREATE POLICY "user_codes_select_anon" ON user_codes FOR SELECT USING (true);`
    - Preserve the existing `user_codes_select_own` policy for authenticated users
    - Ensure INSERT, UPDATE, DELETE remain restricted to the service role
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Backend — Flutterwave webhook handler
  - [x] 3.1 Remove the Paystack webhook route from `backend/DashboardServer.ts`
    - Delete the entire `POST /webhooks/paystack` block including HMAC verification and event handlers
    - _Requirements: 12.1_

  - [x] 3.2 Add the Flutterwave webhook route to `backend/DashboardServer.ts`
    - Add `POST /webhooks/flutterwave` route handler
    - Implement direct string equality check: `req.headers['verif-hash'] !== process.env.FLW_SECRET_HASH` → 401
    - On `charge.completed` + `data.status === 'successful'`: call `generateUserCode()`, `generateLicenseKey(customerEmail, hmacSecret)`, insert into `user_codes` (used: false, suspended: false), send credentials email via SMTP_Mailer
    - On `charge.completed` + `data.status !== 'successful'`: respond 200, no provisioning
    - On failure events (status `'failed'` or `'cancelled'`): set `suspended: true` on `user_codes` row where `used_by` matches customer email, send failure notification email
    - Wrap processing in `Promise.race` with 4.5-second timeout (same pattern as existing Paystack handler)
    - Return 200 for unknown event types to prevent Flutterwave retries
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 15.1, 15.2, 15.3, 15.4_

- [x] 4. Backend — New bot commands in `backend/index.ts`
  - [x] 4.1 Implement the `!pm` permission manager command
    - Add `!pm` entry to `DEFAULT_BOT_INFO.scripts` with `type: "core"`
    - Implement sub-commands: `chat` (add JID to permissions.chats), `all` (set allowAll: true), `+<number>` (add to permissions.numbers)
    - Implement revoke sub-commands: `revoke chat`, `revoke all`, `revoke +<number>`
    - Call `saveBotInfo()` after any mutation
    - Reply with usage help for unrecognised arguments
    - Check `botInfo.permissions.numbers` and `fromMe` before executing; reply with permission-denied if not authorised
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 4.2 Implement the `!dc` docs command
    - Add `!dc` entry to `DEFAULT_BOT_INFO.scripts` with `type: "core"`
    - Send static message containing `https://wxata.tadstech.dev/docs` to the current chat
    - _Requirements: 5.1, 5.2_

  - [x] 4.3 Implement the `!owner` command
    - Add `!owner` entry to `DEFAULT_BOT_INFO.scripts` with `type: "core"`
    - Send vCard contact message using `sock.sendMessage` with owner number from `botInfo.root.target`
    - Use vCard format: `BEGIN:VCARD\nVERSION:3.0\nFN:Bot Owner\nTEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\nEND:VCARD`
    - Wrap `sock.sendMessage` in try/catch; log errors via dashboard logger
    - _Requirements: 6.1, 6.2_

  - [x] 4.4 Implement the `!antibc` command
    - Add `!antibc` entry to `DEFAULT_BOT_INFO.scripts` with `type: "core"`
    - Implement sub-commands: `on` (set enabled: true in antibc.json), `off` (set enabled: false), `message <text>` (update message field)
    - On no argument: reply with current status and configured rejection message
    - Persist `backend/antibc.json` after mutations; catch file write failures and reply with error
    - Check `botInfo.permissions.numbers` and `fromMe`; reply with permission-denied if not authorised
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5. Checkpoint — Backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Frontend — `useWXATASocket` hook
  - [x] 6.1 Create `frontend/src/hooks/useWXATASocket.ts`
    - Define `WXATASocketState` interface: `{ socket, status, attempt, send, lastMessage }`
    - Implement `BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]` array
    - On unexpected close: schedule reconnect with `BACKOFF_DELAYS[Math.min(attempt, 5)]`, set status `'reconnecting'`
    - On open: reset attempt to 0, set status `'connected'`
    - On unmount: `clearTimeout` + `socket.close()` (intentional close, no reconnect)
    - Upgrade `ws://` to `wss://` when `window.location.protocol === 'https:'`
    - Dispatch incoming messages to `lastMessage` state
    - _Requirements: 1.3, 1.9, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 7. Frontend — `ThemeProvider.tsx` unknown theme validation
  - [x] 7.1 Add unknown theme validation to `ThemeProvider.tsx`
    - Define `KNOWN_THEMES` array: `['midnight', 'nord', 'cyberpunk', 'rose', 'ocean', 'forest', 'minimal', 'sepia', 'hacker', 'sunset']`
    - In the `useState` lazy initializer: if stored value is not in `KNOWN_THEMES`, call `localStorage.removeItem('wxata-theme')` and return `'midnight'`
    - Wrap `localStorage` reads and writes in try/catch to handle private browsing
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 8. Frontend — `Dashboard.tsx` rebuild
  - [x] 8.1 Implement auth guard and WebSocket wiring in `Dashboard.tsx`
    - On mount: call `supabase.auth.getSession()`; redirect to `/login` if no session or username mismatch
    - Instantiate `useWXATASocket(VITE_BACKEND_URL)` and route `lastMessage` by `event` field in a `useEffect`
    - Implement `useToast()` hook backed by `useState<Toast[]>`; auto-dismiss after 2 seconds via `setTimeout`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.22_

  - [x] 8.2 Implement `StatusBar` and `ConnectionPanel` sub-components
    - `StatusBar`: display connection state, uptime, memory, reconnecting indicator (shows attempt count when status is `'reconnecting'`)
    - `ConnectionPanel`: QR code display using `qrcode.react`, pairing code display, Connect QR / Connect Phone / Restart / Logout / Terminate buttons
    - Wire buttons to send `START_CONNECTION`, `RESTART`, `LOGOUT`, `TERMINATE` over WebSocket
    - Connect Phone flow: prompt for phone number before sending `START_CONNECTION` with `method: "PHONE"`
    - _Requirements: 1.4, 1.6, 1.7, 1.10, 1.11, 1.12, 1.13, 1.14, 8.3_

  - [x] 8.3 Implement `LogPanel` sub-component
    - Display last 50 log entries from `log` WebSocket events
    - Auto-scroll to bottom on new entries
    - Color-code entries by `type` field
    - _Requirements: 1.5_

  - [x] 8.4 Implement `ScriptManager` sub-component with drag-reorder
    - Render script list with expand/collapse per row
    - Add form: validate trigger is non-empty before adding to local BotInfo state
    - Delete button: remove non-core scripts from local state
    - Drag-reorder: `draggable` attribute + `onDragStart`/`onDragOver`/`onDrop` handlers using HTML5 Drag and Drop API
    - On drop: reorder scripts array in local state and immediately send `UPDATE_BOT_INFO`
    - Visually distinct drag handle separate from expand/collapse toggle
    - _Requirements: 1.15, 1.16, 1.17, 11.1, 11.2, 11.3_

  - [x] 8.5 Implement `PermissionsEditor` and `WelcomeEditor` sub-components
    - `PermissionsEditor`: allowAll toggle, chats list (add/remove), numbers list (add/remove)
    - `WelcomeEditor`: enabled toggle + text area
    - Both: on Save click, send `UPDATE_BOT_INFO` with updated BotInfo and display "Saved" toast (2 s); if WebSocket not open, display "Not connected" error toast
    - _Requirements: 1.15, 10.1, 10.2, 10.3_

  - [x] 8.6 Implement `MiniMarketplace` and `ThemeSwitcher` sub-components
    - `MiniMarketplace`: fetch approved extensions from `marketplace_extensions` sorted by `downloads` descending; "Add" button merges extension into local BotInfo scripts and increments `downloads` in Supabase
    - `ThemeSwitcher`: dropdown of 10 known themes; on select, call `setTheme` from `ThemeProvider` context
    - _Requirements: 1.18, 1.19, 1.20, 1.21_

  - [x] 8.7 Implement Sign Out and `bot-info` sync
    - "Sign Out" button: call `supabase.auth.signOut()` and redirect to `/`
    - On `bot-info` WebSocket event: update local BotInfo state and display "Config synced" status indicator
    - _Requirements: 1.8, 1.22_

- [x] 9. Frontend — `Admin.tsx` rebuild
  - [x] 9.1 Implement `PassphraseGate` and unlock logic in `Admin.tsx`
    - Render only the passphrase form until correct passphrase is entered
    - Check against `import.meta.env.VITE_ADMIN_PASS ?? 'ROOT_ACCESS'`
    - Display "Unauthorized" alert on incorrect passphrase; store passphrase in component state only
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 9.2 Implement `CodeGenerator` and `IssuedCodesTable` sub-components
    - `CodeGenerator`: generate random code in `WX-XXXXXXXX` format; "Push to Database" inserts row into `user_codes` (used: false, suspended: false) and refreshes table
    - `IssuedCodesTable`: fetch all `user_codes` rows ordered by `created_at` descending; Suspend / Reinstate / Delete (with confirm dialog) actions
    - Wrap all Supabase operations in try/catch; display errors as inline red alert banners
    - _Requirements: 2.4, 2.6, 2.7, 2.10, 2.11, 2.12_

  - [x] 9.3 Implement `LicenseGenerator` sub-component
    - Input for username; "Generate" calls `POST /admin/generate-license` with `Authorization: Bearer <passphrase>`
    - Display returned license key; "Copy" button copies to clipboard and shows "✓ Copied" confirmation
    - _Requirements: 2.8, 2.9_

  - [x] 9.4 Implement `PendingExtensions`, `ActiveExtensions`, and `EditModal` sub-components
    - Fetch all `marketplace_extensions` rows; separate into pending and approved lists
    - `PendingExtensions`: Approve (set status: "approved"), Delete (with confirm dialog)
    - `ActiveExtensions`: Mark Untrusted / Mark Trusted, Disable Install / Enable Install, Edit, Delete (with confirm dialog)
    - `EditModal`: pre-populate with current name, description, trigger, response, code fields; save updates row in Supabase
    - _Requirements: 2.5, 2.13, 2.14, 2.15, 2.16, 2.17, 2.18, 2.19, 2.20_

- [x] 10. Frontend — Flutterwave checkout on `Pricing.tsx`
  - [x] 10.1 Replace Paystack with Flutterwave in `Pricing.tsx`
    - Remove all Paystack types, declarations, and script injection
    - Declare `Window.FlutterwaveCheckout` global type
    - Inject `https://checkout.flutterwave.com/v3.js` once on mount (only when `VITE_FLW_PUBLIC_KEY` is set); use `id="flw-inline-js"` guard to prevent double injection
    - Generate `tx_ref` as `WXATA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    - On payment button click: call `window.FlutterwaveCheckout` with `public_key`, `tx_ref`, `amount`, `currency: "NGN"`, `customer.email`, `customer.name`
    - On success callback: set local `paid` state to `true` and render inline confirmation message
    - When `VITE_FLW_PUBLIC_KEY` is not set: do not render payment button, do not inject script
    - _Requirements: 12.2, 12.3, 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 11. Frontend — Documentation and Marketplace fixes
  - [x] 11.1 Update `Docs.tsx` architecture diagram
    - Replace Firestore references with Supabase (PostgreSQL) in the `DOC_OVERVIEW` constant
    - Replace Paystack references with Flutterwave in the payment section
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 11.2 Fix Marketplace JSON export preview and add author search
    - Wrap JSON export preview in a scrollable container so long strings are fully accessible
    - Add author search input field to the browse view; filter extensions to those whose `author` field contains the search string (case-insensitive)
    - Clear filter when search field is emptied; combine with existing tag/keyword filters
    - _Requirements: 24.1, 24.2, 25.1, 25.2, 25.3_

- [x] 12. Checkpoint — Frontend builds and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Property-based and unit tests — Backend
  - [x] 13.1 Create `backend/__tests__/flutterwaveWebhook.test.ts` — Property 3: Flutterwave webhook auth rejects all non-matching hashes
    - Build a minimal test HTTP server replicating the Flutterwave webhook logic (same pattern as `webhook.test.ts`)
    - For any random string ≠ `FLW_SECRET_HASH`, assert HTTP 401 and zero side effects (no Supabase insert, no email send)
    - **Property 3: Flutterwave webhook auth rejects all non-matching hashes**
    - **Validates: Requirements 13.2, 13.3**
    - Minimum 100 iterations
    - _Requirements: 13.2, 13.3_

  - [x] 13.2 Add unit tests to `backend/__tests__/flutterwaveWebhook.test.ts`
    - `charge.completed` + `status: "successful"` → 200, Supabase insert called, email sent
    - `charge.completed` + `status: "failed"` → 200, suspend called, no provisioning
    - Unknown event type → 200, no side effects
    - Supabase insert failure → 500
    - Email send failure → 500
    - Missing `verif-hash` header → 401
    - _Requirements: 13.1, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

  - [x] 13.3 Add Property 7 test to `backend/__tests__/flutterwaveWebhook.test.ts` — User code uniqueness
    - Generate N codes via `generateUserCode()`, assert all N values are distinct
    - **Property 7: User code uniqueness**
    - **Validates: Requirements 13.4, 15.1**
    - Minimum 100 iterations
    - _Requirements: 13.4, 15.1_

- [x] 14. Property-based and unit tests — Frontend
  - [x] 14.1 Create `frontend/src/__tests__/useWXATASocket.test.ts` — Property 4: WebSocket reconnect backoff
    - Export the `BACKOFF_DELAYS` array (or a pure `getDelay(attempt)` function) from `useWXATASocket.ts` for direct testing
    - For any attempt index N in [0..20], assert `delay(N) === Math.min(1000 * Math.pow(2, N), 30000)`
    - Assert `delay(N) >= delay(N-1)` for all N ≥ 1 (non-decreasing)
    - Assert `delay(N) <= 30000` for all N (bounded)
    - **Property 4: WebSocket reconnect backoff is non-decreasing and bounded**
    - **Validates: Requirements 1.9, 8.2**
    - Minimum 100 iterations
    - _Requirements: 1.9, 8.2_

  - [x] 14.2 Add unit tests to `frontend/src/__tests__/useWXATASocket.test.ts`
    - Status transitions: `'connecting'` → `'connected'` on open, `'reconnecting'` on unexpected close
    - Attempt counter resets to 0 on successful reconnect
    - No reconnect triggered on intentional close (unmount)
    - `ws://` upgraded to `wss://` when protocol is `https:`
    - _Requirements: 1.3, 8.1, 8.4, 8.5_

  - [x] 14.3 Create `frontend/src/__tests__/themeProvider.test.tsx` — Properties 5 & 6: Theme persistence
    - Mock `localStorage` for all tests
    - Property 5: For any valid theme name in `KNOWN_THEMES`, assert `setTheme(name)` writes to `localStorage` and re-initialising `ThemeProvider` restores the same theme
    - **Property 5: Theme persistence round-trip**
    - **Validates: Requirements 1.18, 1.19, 9.1, 9.2**
    - Property 6: For any string not in `KNOWN_THEMES`, assert `ThemeProvider` initialises with `'midnight'` and clears the invalid value from `localStorage`
    - **Property 6: Unknown theme falls back to default**
    - **Validates: Requirements 9.4**
    - Minimum 100 iterations each
    - _Requirements: 1.18, 1.19, 9.1, 9.2, 9.3, 9.4_

  - [x] 14.4 Create `frontend/src/__tests__/marketplace.test.tsx` — Property 8: Marketplace author search
    - Generate random extension lists and search strings using fast-check
    - Assert every returned extension has `author` containing the search string (case-insensitive)
    - Assert every extension whose `author` does not contain the search string is excluded
    - Assert clearing the search field returns all extensions
    - **Property 8: Marketplace author search filters correctly**
    - **Validates: Requirements 25.1**
    - Minimum 100 iterations
    - _Requirements: 25.1, 25.2, 25.3_

  - [x] 14.5 Add unit tests to `frontend/src/__tests__/themeProvider.test.tsx`
    - Default theme `'midnight'` when localStorage is empty
    - `localStorage` write on `setTheme` call
    - Graceful fallback when `localStorage` is unavailable (throws on access)
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 15. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Properties 1 & 2 (license key round-trip and tamper detection) are already covered by the existing `backend/__tests__/licenseValidator.test.ts` — no new tests needed
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties; unit tests validate specific examples and edge cases
