# Requirements Document

## Introduction

WXATA is a WhatsApp automation platform built on Baileys + Bun. This spec covers the full set of changes required to bring the platform to a production-ready state. The work spans five areas: restoring two empty frontend pages (Dashboard and Admin), implementing missing bot commands, migrating the payment provider from Paystack to Flutterwave, cleaning up the repository of committed secrets and dev artifacts, and updating all documentation to reflect the current stack (Supabase, Flutterwave).

---

## Glossary

- **Dashboard**: The React page at `/dashboard/:username` that connects to the backend via WebSocket and provides bot control, log viewing, and config editing.
- **Admin_Panel**: The React page at `/admin` that provides passphrase-gated access to user code management, license key generation, and marketplace moderation.
- **DashboardServer**: The Bun HTTP + WebSocket server (`backend/DashboardServer.ts`) that handles all backend communication.
- **BotInfo**: The JSON configuration object (`botinfo.json`) that stores the bot prefix, scripts, permissions, welcome message, and root target.
- **User_Code**: A 16-character alphanumeric registration token stored in the Supabase `user_codes` table. Required to create a WXATA account.
- **License_Key**: An HMAC-SHA256 signed string in the format `username:hmac_hex`. Used to authenticate the self-hosted bot binary.
- **Flutterwave**: The payment provider replacing Paystack. Webhook verification uses a direct string comparison of the `verif-hash` header against the `FLW_SECRET_HASH` environment variable.
- **Paystack**: The legacy payment provider being removed from the codebase.
- **CommandHandler**: The typed command module system scaffolded in `backend/commands/CommandHandler.ts`, currently unused in the main bot loop.
- **Marketplace**: The extension marketplace backed by the `marketplace_extensions` Supabase table.
- **RLS**: Row Level Security — Supabase's per-row access control policies.
- **SMTP_Mailer**: The Nodemailer transporter configured via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` environment variables.
- **PM2**: The process manager used on the Oracle VPS to manage the backend process.
- **Supabase**: The PostgreSQL-backed backend-as-a-service used for authentication and the `users`, `user_codes`, and `marketplace_extensions` tables.

---

## Requirements

### Requirement 1: Restore the Dashboard Page

**User Story:** As a registered WXATA user, I want a fully functional dashboard page, so that I can monitor my bot's connection status, view real-time logs, and configure bot behaviour without editing files manually.

#### Acceptance Criteria

1. WHEN a user navigates to `/dashboard/:username` without an active Supabase session, THE Dashboard SHALL redirect the user to `/login`.
2. WHEN a user navigates to `/dashboard/:username` with a valid session but a username that does not match the authenticated user's record, THE Dashboard SHALL redirect the user to `/login`.
3. WHEN the Dashboard mounts with a valid authenticated session, THE Dashboard SHALL establish a WebSocket connection to the URL specified by `VITE_BACKEND_URL`, upgrading to `wss://` automatically when the page is served over HTTPS.
4. WHEN the WebSocket connection receives a `status` event, THE Dashboard SHALL update the displayed connection state, uptime, and memory usage values.
5. WHEN the WebSocket connection receives a `log` event, THE Dashboard SHALL append the formatted log entry to the real-time log panel and retain at most the 50 most recent entries.
6. WHEN the WebSocket connection receives a `qr` event, THE Dashboard SHALL render the QR code data using a QR code component so the user can scan it with WhatsApp.
7. WHEN the WebSocket connection receives a `pairing-code` event, THE Dashboard SHALL display the pairing code string prominently for the user to enter in WhatsApp.
8. WHEN the WebSocket connection receives a `bot-info` event, THE Dashboard SHALL update the local BotInfo state and display a "Config synced" status indicator.
9. WHEN the WebSocket connection closes unexpectedly, THE Dashboard SHALL attempt to reconnect using exponential backoff, starting at 1 second and doubling up to a maximum of 30 seconds, without requiring a page refresh.
10. WHEN the user clicks "Connect QR", THE Dashboard SHALL send a `START_CONNECTION` command with `method: "QR"` over the WebSocket.
11. WHEN the user clicks "Connect Phone" and enters a phone number, THE Dashboard SHALL send a `START_CONNECTION` command with `method: "PHONE"` and the entered phone number over the WebSocket.
12. WHEN the user clicks "Restart", THE Dashboard SHALL send a `RESTART` command over the WebSocket.
13. WHEN the user clicks "Logout", THE Dashboard SHALL send a `LOGOUT` command over the WebSocket.
14. WHEN the user clicks "Terminate", THE Dashboard SHALL send a `TERMINATE` command over the WebSocket.
15. WHEN the user edits a BotInfo field (prefix, welcome text, permissions, or a script field) and clicks Save, THE Dashboard SHALL send an `UPDATE_BOT_INFO` command with the updated BotInfo payload over the WebSocket and display a brief toast confirmation to the user.
16. WHEN the user adds a new script via the script editor form, THE Dashboard SHALL validate that the trigger field is non-empty before adding the script to the local BotInfo state.
17. WHEN the user deletes a non-core script, THE Dashboard SHALL remove it from the local BotInfo state and send an `UPDATE_BOT_INFO` command.
18. WHEN the user selects a theme from the theme switcher, THE Dashboard SHALL apply the selected theme immediately and persist the selection to `localStorage` so it is restored on the next visit.
19. WHEN the Dashboard mounts and `localStorage` contains a previously saved theme, THE Dashboard SHALL restore that theme before the first render to prevent a flash of the default theme.
20. WHEN the mini-marketplace panel loads, THE Dashboard SHALL fetch approved extensions from the `marketplace_extensions` Supabase table and display them sorted by download count descending.
21. WHEN the user clicks "Add" on a marketplace extension that is not already installed, THE Dashboard SHALL merge the extension into the local BotInfo scripts and increment the extension's `downloads` counter in Supabase.
22. WHEN the user clicks "Sign Out" in the dashboard header, THE Dashboard SHALL call `supabase.auth.signOut()` and redirect to `/`.

---

### Requirement 2: Restore the Admin Panel

**User Story:** As a WXATA administrator, I want a fully functional admin panel, so that I can manage user access codes, generate license keys, and moderate marketplace extensions.

#### Acceptance Criteria

1. WHEN a user navigates to `/admin` and has not entered the correct passphrase, THE Admin_Panel SHALL display only the passphrase authentication gate and no admin data.
2. WHEN the user submits the passphrase form and the value matches `VITE_ADMIN_PASS` (falling back to `ROOT_ACCESS` if the env var is not set), THE Admin_Panel SHALL unlock and display all admin sections.
3. WHEN the user submits an incorrect passphrase, THE Admin_Panel SHALL display an "Unauthorized" alert and remain locked.
4. WHEN the admin panel is unlocked, THE Admin_Panel SHALL fetch all rows from the `user_codes` table ordered by `created_at` descending and display them in the Issued Codes Register table.
5. WHEN the admin panel is unlocked, THE Admin_Panel SHALL fetch all rows from the `marketplace_extensions` table and separate them into pending and approved lists.
6. WHEN the administrator clicks "Generate" in the code generator section, THE Admin_Panel SHALL produce a random code in the format `WX-XXXXXXXX` and display it in the input field.
7. WHEN the administrator clicks "Push to Database" with a non-empty code, THE Admin_Panel SHALL insert a new row into the `user_codes` table with `used: false` and `suspended: false` and refresh the Issued Codes Register.
8. WHEN the administrator enters a username and clicks "Generate" in the license key section, THE Admin_Panel SHALL call the backend `POST /admin/generate-license` endpoint with a `Bearer` token equal to the entered passphrase and display the returned license key.
9. WHEN the administrator clicks "Copy" next to a generated license key, THE Admin_Panel SHALL copy the key to the clipboard and show a brief "✓ Copied" confirmation.
10. WHEN the administrator clicks "Suspend" on an available or used code, THE Admin_Panel SHALL update `suspended: true` on that row in Supabase and refresh the table.
11. WHEN the administrator clicks "Reinstate" on a suspended code, THE Admin_Panel SHALL update `suspended: false` on that row in Supabase and refresh the table.
12. WHEN the administrator clicks "Delete" on a code and confirms the dialog, THE Admin_Panel SHALL permanently delete that row from Supabase and refresh the table.
13. WHEN the administrator clicks "Approve" on a pending extension, THE Admin_Panel SHALL update `status: "approved"` on that row in Supabase and move it to the active extensions list.
14. WHEN the administrator clicks "Delete" on a pending or approved extension and confirms the dialog, THE Admin_Panel SHALL permanently delete that row from Supabase and refresh both lists.
15. WHEN the administrator clicks "Edit" on any extension, THE Admin_Panel SHALL open an edit modal pre-populated with the extension's current name, description, trigger, response, and code fields.
16. WHEN the administrator saves an edit, THE Admin_Panel SHALL update the corresponding row in Supabase and close the modal.
17. WHEN the administrator clicks "Mark Untrusted" on an approved extension, THE Admin_Panel SHALL set `untrusted: true` on that row and refresh the active list.
18. WHEN the administrator clicks "Mark Trusted" on an untrusted extension, THE Admin_Panel SHALL set `untrusted: false` on that row and refresh the active list.
19. WHEN the administrator clicks "Disable Install" on an approved extension, THE Admin_Panel SHALL set `disabled: true` on that row and refresh the active list.
20. WHEN the administrator clicks "Enable Install" on a disabled extension, THE Admin_Panel SHALL set `disabled: false` on that row and refresh the active list.

---

### Requirement 3: Fix the RLS Policy Gap on `user_codes`

**User Story:** As a prospective WXATA user, I want the registration page to validate my user code before I create an account, so that I receive a clear error if my code is invalid rather than a confusing database permission error.

#### Acceptance Criteria

1. THE Supabase `user_codes` table SHALL have an RLS policy that permits anonymous (unauthenticated) clients to SELECT rows by `code` value.
2. WHEN the Register page queries `user_codes` with a valid code using the anon Supabase client, THE Register page SHALL receive the row data without a permissions error.
3. WHEN the Register page queries `user_codes` with a code that does not exist, THE Register page SHALL receive a "not found" result and display the appropriate error message to the user.
4. THE anon SELECT policy on `user_codes` SHALL NOT permit anonymous clients to INSERT, UPDATE, or DELETE rows.

---

### Requirement 4: Implement the `!pm` Permission Manager Command

**User Story:** As a bot owner, I want a working `!pm` command, so that I can grant and revoke chat and number-level permissions from within WhatsApp without editing config files.

#### Acceptance Criteria

1. WHEN the bot receives `!pm chat`, THE Bot SHALL add the current chat's JID to `botInfo.permissions.chats`, persist the updated BotInfo to `botinfo.json`, and reply with a confirmation message.
2. WHEN the bot receives `!pm all`, THE Bot SHALL set `botInfo.permissions.allowAll` to `true`, persist the updated BotInfo, and reply with a confirmation message.
3. WHEN the bot receives `!pm +<number>` where `<number>` is a digit string, THE Bot SHALL add the number to `botInfo.permissions.numbers`, persist the updated BotInfo, and reply with a confirmation message.
4. WHEN the bot receives `!pm revoke chat`, THE Bot SHALL remove the current chat's JID from `botInfo.permissions.chats`, persist the updated BotInfo, and reply with a confirmation message.
5. WHEN the bot receives `!pm revoke all`, THE Bot SHALL set `botInfo.permissions.allowAll` to `false`, persist the updated BotInfo, and reply with a confirmation message.
6. WHEN the bot receives `!pm revoke +<number>`, THE Bot SHALL remove the number from `botInfo.permissions.numbers`, persist the updated BotInfo, and reply with a confirmation message.
7. WHEN the bot receives `!pm` with no argument or an unrecognised argument, THE Bot SHALL reply with a usage help message listing all valid sub-commands.
8. IF the sender of a `!pm` command is not in `botInfo.permissions.numbers` and the message is not `fromMe`, THEN THE Bot SHALL reply with a permission-denied message and take no action.

---

### Requirement 5: Implement the `!dc` Docs Command

**User Story:** As a bot user, I want a `!dc` command, so that I can quickly get a link to the WXATA documentation from within WhatsApp.

#### Acceptance Criteria

1. WHEN the bot receives `!dc`, THE Bot SHALL send a message containing the WXATA documentation URL (`https://wxata.tadstech.dev/docs`) to the current chat.
2. THE `dc` script SHALL be present in `DEFAULT_BOT_INFO.scripts` in `backend/index.ts` with `type: "core"` so it appears in the system menu.

---

### Requirement 6: Implement the `!owner` Command

**User Story:** As a bot user, I want an `!owner` command, so that I can receive the bot owner's contact card directly in WhatsApp.

#### Acceptance Criteria

1. WHEN the bot receives `!owner`, THE Bot SHALL send a vCard contact message to the current chat containing the owner's WhatsApp number derived from `botInfo.root.target`.
2. THE `owner` script SHALL be present in `DEFAULT_BOT_INFO.scripts` in `backend/index.ts` with `type: "core"`.

---

### Requirement 7: Implement the `!antibc` Command

**User Story:** As a bot owner, I want an `!antibc` command, so that I can toggle the anti-broadcast filter and set a custom rejection message from within WhatsApp.

#### Acceptance Criteria

1. WHEN the bot receives `!antibc on`, THE Bot SHALL set `enabled: true` in `backend/antibc.json`, persist the file, and reply with a confirmation message.
2. WHEN the bot receives `!antibc off`, THE Bot SHALL set `enabled: false` in `backend/antibc.json`, persist the file, and reply with a confirmation message.
3. WHEN the bot receives `!antibc message <text>`, THE Bot SHALL update the `message` field in `backend/antibc.json` to `<text>`, persist the file, and reply with a confirmation message.
4. WHEN the bot receives `!antibc` with no argument, THE Bot SHALL reply with the current anti-broadcast status (enabled/disabled) and the configured rejection message.
5. IF the sender of an `!antibc` command is not in `botInfo.permissions.numbers` and the message is not `fromMe`, THEN THE Bot SHALL reply with a permission-denied message and take no action.

---

### Requirement 8: WebSocket Auto-Reconnect with Exponential Backoff

**User Story:** As a dashboard user, I want the dashboard to automatically reconnect to the backend after a connection drop, so that I do not have to manually refresh the page to restore monitoring.

#### Acceptance Criteria

1. WHEN the Dashboard WebSocket connection closes unexpectedly (i.e., not due to the component unmounting), THE Dashboard SHALL schedule a reconnection attempt.
2. THE Dashboard SHALL use exponential backoff for reconnection delays: the first attempt after 1 second, doubling on each subsequent failure, up to a maximum delay of 30 seconds.
3. WHILE the Dashboard is attempting to reconnect, THE Dashboard SHALL display a visible reconnecting indicator to the user showing the current attempt count or countdown.
4. WHEN a reconnection attempt succeeds, THE Dashboard SHALL reset the backoff counter and remove the reconnecting indicator.
5. WHEN the Dashboard component unmounts, THE Dashboard SHALL cancel any pending reconnection timer and close the WebSocket connection cleanly.

---

### Requirement 9: Theme Persistence

**User Story:** As a dashboard user, I want my selected theme to be remembered between sessions, so that I do not have to re-select it every time I open the dashboard.

#### Acceptance Criteria

1. WHEN the user selects a theme from the theme switcher, THE ThemeProvider SHALL write the selected theme name to `localStorage` under the key `wxata-theme`.
2. WHEN the ThemeProvider initialises, THE ThemeProvider SHALL read the `wxata-theme` key from `localStorage` and apply that theme before the first render.
3. IF no theme is stored in `localStorage`, THE ThemeProvider SHALL apply the default theme.
4. WHEN the stored theme name does not match any known theme, THE ThemeProvider SHALL fall back to the default theme and clear the invalid value from `localStorage`.

---

### Requirement 10: Save Confirmation Toast

**User Story:** As a dashboard user, I want a brief confirmation message when I save bot configuration changes, so that I know the save was successful rather than wondering if anything happened.

#### Acceptance Criteria

1. WHEN the user saves BotInfo changes from the dashboard, THE Dashboard SHALL display a non-blocking toast notification with the text "Saved" for 2 seconds before automatically dismissing it.
2. THE toast SHALL appear without blocking interaction with the rest of the dashboard.
3. IF the save command cannot be sent because the WebSocket is not open, THE Dashboard SHALL display an error toast with the text "Not connected" instead.

---

### Requirement 11: Script Drag-Reorder

**User Story:** As a dashboard user, I want to drag and reorder scripts in the script list, so that I can control the order in which commands appear in the `!menu` output.

#### Acceptance Criteria

1. WHEN the user drags a script row to a new position in the script list, THE Dashboard SHALL reorder the scripts in the local BotInfo state to reflect the new position.
2. WHEN a reorder operation completes, THE Dashboard SHALL automatically send an `UPDATE_BOT_INFO` command with the reordered scripts so the change is persisted to `botinfo.json`.
3. THE drag handle SHALL be visually distinct from the expand/collapse toggle so users can clearly identify the draggable area.

---

### Requirement 12: Remove All Paystack Code

**User Story:** As a WXATA developer, I want all Paystack integration code removed from the codebase, so that there are no dead code paths or unused environment variables referencing the legacy payment provider.

#### Acceptance Criteria

1. THE DashboardServer SHALL NOT contain a `POST /webhooks/paystack` route handler after this change.
2. THE Pricing page SHALL NOT inject the Paystack inline JS script (`https://js.paystack.co/v1/inline.js`) into the document.
3. THE Pricing page SHALL NOT render a "Pay with Paystack" button.
4. THE `backend/.env.example` file SHALL NOT contain `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_HOSTED_INITIAL`, or `PAYSTACK_PLAN_HOSTED_RECURRING` keys.
5. THE `frontend/.env.example` file SHALL NOT contain `VITE_PAYSTACK_PUBLIC_KEY` or `VITE_PAYSTACK_PLAN_HOSTED_INITIAL` keys.
6. THE `INSTRUCTIONS.md` file SHALL NOT reference Paystack in any setup or configuration step.

---

### Requirement 13: Add Flutterwave Webhook Handler

**User Story:** As a WXATA operator, I want a Flutterwave webhook handler on the backend, so that successful payments automatically provision user access credentials without manual intervention.

#### Acceptance Criteria

1. THE DashboardServer SHALL expose a `POST /webhooks/flutterwave` route.
2. WHEN a request arrives at `POST /webhooks/flutterwave`, THE DashboardServer SHALL compare the `verif-hash` request header against the `FLW_SECRET_HASH` environment variable using a direct string equality check.
3. IF the `verif-hash` header does not match `FLW_SECRET_HASH`, THEN THE DashboardServer SHALL respond with HTTP 401 and take no further action.
4. WHEN the webhook body contains a `charge.completed` event with `data.status === "successful"`, THE DashboardServer SHALL generate a User_Code using `generateUserCode()`, generate a License_Key using `generateLicenseKey(customerEmail, hmacSecret)`, insert the User_Code into the Supabase `user_codes` table with `used: false` and `suspended: false`, and send a credentials email to the customer via SMTP_Mailer.
5. WHEN the webhook body contains a `charge.completed` event with `data.status !== "successful"`, THE DashboardServer SHALL respond with HTTP 200 and take no provisioning action.
6. WHEN the Supabase insert fails during webhook processing, THE DashboardServer SHALL log the error and respond with HTTP 500.
7. WHEN the email send fails during webhook processing, THE DashboardServer SHALL log the error and respond with HTTP 500.
8. THE DashboardServer SHALL respond to all valid (authenticated) webhook requests within 5 seconds using `Promise.race` with a 4.5-second timeout.
9. WHEN a chargeback or payment failure event is received (event type `charge.completed` with `status: "failed"` or a provider-specific failure event), THE DashboardServer SHALL set `suspended: true` on the `user_codes` row where `used_by` matches the customer email and send a payment failure notification email.

---

### Requirement 14: Add Flutterwave Inline Checkout on the Pricing Page

**User Story:** As a prospective WXATA customer, I want to pay directly on the Pricing page using Flutterwave, so that I can complete my purchase without leaving the site.

#### Acceptance Criteria

1. WHEN `VITE_FLW_PUBLIC_KEY` is set, THE Pricing page SHALL inject the Flutterwave inline JS script (`https://checkout.flutterwave.com/v3.js`) into the document once on mount.
2. WHEN the user clicks the payment button and `VITE_FLW_PUBLIC_KEY` is set, THE Pricing page SHALL open the Flutterwave payment modal with `public_key`, a unique `tx_ref`, `amount`, `currency: "NGN"`, `customer.email`, and `customer.name` fields populated.
3. WHEN the Flutterwave payment modal callback fires with a successful status, THE Pricing page SHALL display a confirmation message to the user.
4. WHEN `VITE_FLW_PUBLIC_KEY` is not set, THE Pricing page SHALL NOT render the Flutterwave payment button and SHALL NOT inject the Flutterwave script.
5. THE `tx_ref` field SHALL be unique per payment attempt, generated as a combination of a timestamp and a random string.

---

### Requirement 15: Automated Post-Payment Credential Delivery

**User Story:** As a WXATA customer who has just paid, I want to receive my registration code and license key by email immediately after payment, so that I can set up my bot without waiting for manual fulfilment.

#### Acceptance Criteria

1. WHEN the Flutterwave webhook handler successfully processes a `charge.completed` event with `status: "successful"`, THE DashboardServer SHALL insert a new row into the `user_codes` table within the same request handler execution.
2. WHEN the `user_codes` insert succeeds, THE DashboardServer SHALL send a credentials email to the customer's email address containing the User_Code, the License_Key, and setup instructions matching the purchased tier.
3. THE credentials email SHALL include the registration URL (`https://wxata.tadstech.dev/register`), the User_Code, the License_Key, and a link to the documentation.
4. THE License_Key format SHALL remain `username:hmac_hex` using HMAC-SHA256 with the `LICENSE_HMAC_SECRET` environment variable, consistent with the existing `generateLicenseKey` function.

---

### Requirement 16: Remove Committed Secrets and Session Files

**User Story:** As a WXATA developer, I want all committed secrets and session files removed from the repository, so that credentials are not exposed in version history and the repository is safe to share publicly.

#### Acceptance Criteria

1. THE `backend/auth_info/` directory SHALL be listed in `backend/.gitignore` so that WhatsApp session files are never tracked by git.
2. THE files `botinfo.json`, `warns.json`, `vars.json`, `antidel.json`, `antibc.json` at the repository root SHALL be listed in the root `.gitignore`.
3. THE files `backend/botinfo.json`, `backend/warns.json`, `backend/vars.json`, `backend/antidel.json`, `backend/antibc.json` SHALL be listed in `backend/.gitignore`.
4. THE file `root.env` SHALL be listed in the root `.gitignore`.
5. THE `backend/.env.example` file SHALL NOT contain real secret values; all secret fields SHALL use placeholder strings (e.g., `your-secret-here`).
6. WHEN a developer clones the repository and runs the bot for the first time, THE Bot SHALL generate `botinfo.json`, `warns.json`, `vars.json`, `antidel.json`, and `antibc.json` automatically from their example/default counterparts if they do not exist.

---

### Requirement 17: Update README Stack Table

**User Story:** As a developer evaluating WXATA, I want the README to accurately describe the current technology stack, so that I am not misled by outdated references to Firebase.

#### Acceptance Criteria

1. THE `README.md` stack table SHALL list "Supabase (Auth + PostgreSQL)" in the Auth/DB row, replacing "Firebase (Auth + Firestore)".
2. THE `README.md` SHALL NOT contain any reference to Firebase, Firestore, or Firebase-specific tooling in the stack description or quick-start instructions.
3. THE `README.md` deployment row SHALL reflect the current deployment targets: Oracle VPS (backend) + Vercel (frontend), replacing the outdated Render reference.

---

### Requirement 18: Remove Dev Artifacts

**User Story:** As a WXATA developer, I want development scratch files and one-off refactor scripts removed from the repository, so that the codebase is clean and does not confuse contributors.

#### Acceptance Criteria

1. THE `scratch/` directory SHALL be removed from the repository and added to the root `.gitignore`.
2. THE `refactor_v2.js` file at the repository root SHALL be removed from the repository.
3. THE `frontend/refactor_themes.js` file SHALL be removed from the repository.
4. AFTER removal, THE repository SHALL NOT contain any file matching the patterns `scratch/**`, `refactor_v2.js`, or `refactor_themes.js`.

---

### Requirement 19: Configure `wxata-public` as a Git Submodule

**User Story:** As a WXATA developer, I want the `wxata-public/` directory properly configured as a git submodule, so that it is not accidentally committed as part of the main repository and its history is managed independently.

#### Acceptance Criteria

1. THE `wxata-public/` directory SHALL be registered as a git submodule pointing to its upstream repository URL.
2. IF registering as a submodule is not feasible, THE `wxata-public/` directory SHALL be listed in the root `.gitignore` so it is excluded from the main repository's tracking.
3. THE root `.gitignore` SHALL NOT contain a conflicting entry that would prevent the submodule from being checked out by contributors who clone with `--recurse-submodules`.

---

### Requirement 20: Update the Docs Page Architecture Diagram

**User Story:** As a WXATA user reading the documentation, I want the architecture diagram to reflect the current stack, so that I understand how the system actually works.

#### Acceptance Criteria

1. THE `DOC_OVERVIEW` constant in `frontend/src/pages/Docs.tsx` SHALL NOT reference Firestore in the architecture section.
2. THE Docs page architecture section SHALL describe Supabase (PostgreSQL) as the database layer.
3. THE Docs page payment section SHALL reference Flutterwave as the payment provider, replacing any Paystack references.

---

### Requirement 21: Update `INSTRUCTIONS.md`

**User Story:** As a WXATA operator setting up the platform, I want `INSTRUCTIONS.md` to contain accurate setup steps, so that I configure the correct environment variables for the current payment provider.

#### Acceptance Criteria

1. THE `INSTRUCTIONS.md` file SHALL NOT contain any Paystack environment variable names (`PAYSTACK_SECRET_KEY`, `VITE_PAYSTACK_PUBLIC_KEY`, `VITE_PAYSTACK_PLAN_HOSTED_INITIAL`).
2. THE `INSTRUCTIONS.md` file SHALL document the Flutterwave environment variables: `FLW_SECRET_HASH` (backend) and `VITE_FLW_PUBLIC_KEY` (frontend).
3. THE `INSTRUCTIONS.md` file SHALL describe the Flutterwave webhook verification method: compare the `verif-hash` header against `FLW_SECRET_HASH` using direct string equality.

---

### Requirement 22: Update `.env.example` Files

**User Story:** As a developer setting up a WXATA instance, I want the `.env.example` files to list the correct environment variables, so that I know exactly what to configure without reading through source code.

#### Acceptance Criteria

1. THE `backend/.env.example` file SHALL contain a `FLW_SECRET_HASH` entry with a placeholder value.
2. THE `frontend/.env.example` file SHALL contain a `VITE_FLW_PUBLIC_KEY` entry with a placeholder value.
3. THE `backend/.env.example` file SHALL NOT contain `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_HOSTED_INITIAL`, or `PAYSTACK_PLAN_HOSTED_RECURRING`.
4. THE `frontend/.env.example` file SHALL NOT contain `VITE_PAYSTACK_PUBLIC_KEY` or `VITE_PAYSTACK_PLAN_HOSTED_INITIAL`.
5. THE `backend/.env.example` file SHALL NOT contain real secret values; all sensitive fields SHALL use clearly labelled placeholder strings.

---

### Requirement 23: Wire CommandHandler into the Main Bot Loop

**User Story:** As a WXATA developer, I want the typed CommandHandler module system wired into the main bot loop, so that commands defined in the module system are executed when messages arrive.

#### Acceptance Criteria

1. WHEN the bot receives a message that matches a command registered in `CommandHandler`, THE Bot SHALL execute that command handler.
2. THE CommandHandler integration SHALL not break or replace the existing dynamic script execution path in `backend/index.ts`; both systems SHALL coexist.
3. WHEN a command is registered in both the CommandHandler and `botInfo.scripts`, THE Bot SHALL prefer the CommandHandler implementation.

---

### Requirement 24: Fix Marketplace JSON Export Preview

**User Story:** As a marketplace extension author, I want the JSON export preview in the Build tab to show the complete extension JSON, so that I can verify my extension definition before submitting.

#### Acceptance Criteria

1. WHEN the user views the JSON export preview in the Marketplace Build tab, THE Marketplace page SHALL render the complete JSON string without truncation.
2. THE JSON preview area SHALL use a scrollable container so that long JSON strings are fully accessible without expanding the page layout.

---

### Requirement 25: Marketplace Author Search

**User Story:** As a marketplace user, I want to filter extensions by author name, so that I can find all extensions published by a specific developer.

#### Acceptance Criteria

1. WHEN the user types in the author search field in the Marketplace browse view, THE Marketplace page SHALL filter the displayed extensions to only those whose `author` field contains the search string (case-insensitive).
2. WHEN the author search field is cleared, THE Marketplace page SHALL display all approved extensions again.
3. THE author search filter SHALL work in combination with any existing tag or keyword filters.
