import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import pino from "pino";
import crypto from "crypto";
import {
  findApiKeyBy,
  insertApiKey,
  updateApiKeyById,
  insertUserCode,
  findUserCodeByCode,
  listUserCodes,
  updateUserCodeById,
  deleteUserCodeById,
  updateUserCodesWhere,
  listAllExtensions,
  updateExtensionById,
  deleteExtensionById,
  insertUsageLog,
  getServiceConfigValue,
  listServiceConfig,
  upsertServiceConfig,
  listApiKeys,
  verifyIdToken,
} from "./firebase";
import nodemailer from "nodemailer";
import { generateLicenseKey } from "./licenseValidator";
import type { WASocket } from "@whiskeysockets/baileys";
import { fetchTweetContent } from "./twitter_grabber.js";
import { scheduleTweetPost } from "./tv_miniapp.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Helper: generate a 16-char cryptographically random alphanumeric user code
// ---------------------------------------------------------------------------
export function generateUserCode(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.randomBytes(16);
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars[bytes[i]! % chars.length];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: send credentials email via Nodemailer
// ---------------------------------------------------------------------------
export async function sendCredentialsEmail(
  to: string,
  userCode: string,
  licenseKey: string,
  tier: "self-host" | "hosted" = "self-host",
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const selfHostInstructions = [
    "── SELF-HOST SETUP ──────────────────────────────────────────",
    "",
    "1. Clone the bot binary repository:",
    "   git clone https://github.com/tadstech/wxata-public.git",
    "   cd wxata-public",
    "",
    "2. Copy the example env file and fill in your values:",
    "   cp .env.example .env",
    "",
    "3. Set your License Key in .env:",
    `   LICENSE_KEY=${licenseKey}`,
    "",
    "4. Start the bot with Docker:",
    "   docker compose up -d",
    "",
    "5. Open the dashboard at http://your-server-ip:5000",
    "   Connect your WhatsApp via QR code or phone pairing.",
    "",
    "6. Create your dashboard account at:",
    "   https://wxata.tadstech.dev/register",
    `   Use this Registration Code: ${userCode}`,
    "",
    "Full deployment guide: https://wxata.tadstech.dev/docs",
    "─────────────────────────────────────────────────────────────",
  ].join("\n");

  const hostedInstructions = [
    "── HOSTED SETUP ─────────────────────────────────────────────",
    "",
    "Your bot is managed and hosted for you — no server setup needed.",
    "",
    "1. Create your dashboard account at:",
    "   https://wxata.tadstech.dev/register",
    `   Use this Registration Code: ${userCode}`,
    "",
    "2. Once logged in, your bot dashboard is live at:",
    "   https://wxata.tadstech.dev/dashboard/<your-username>",
    "",
    "3. Connect your WhatsApp from the dashboard using QR or phone pairing.",
    "",
    "Your License Key (keep this safe — do not share it):",
    `   ${licenseKey}`,
    "",
    "Full guide: https://wxata.tadstech.dev/docs",
    "─────────────────────────────────────────────────────────────",
  ].join("\n");

  const instructions =
    tier === "self-host" ? selfHostInstructions : hostedInstructions;
  const subject =
    tier === "self-host"
      ? "Your WXATA Self-Host Access — Bot Binary + License Key"
      : "Your WXATA Hosted Access — Dashboard Credentials";

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "WXATA <noreply@wxata.app>",
    to,
    subject,
    text: [
      "Thank you for your purchase! Here are your credentials:",
      "",
      `Registration Code : ${userCode}`,
      `License Key       : ${licenseKey}`,
      "",
      instructions,
      "",
      "Need help? DM us on WhatsApp: https://wa.me/2347041029093",
      "Or on X: https://x.com/tads_tech",
    ].join("\n"),
  });
}

function normalizeEmail(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePhone(value?: string): string {
  return value?.trim().replace(/[^\d+]/g, "") ?? "";
}

function generateVerificationToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function hashVerificationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function extractBearerToken(header?: string): string | null {
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function getPublicAppUrl(): string {
  return (
    process.env.PUBLIC_WEB_URL ??
    process.env.APP_URL ??
    "https://wxata.tadstech.dev"
  ).replace(/\/+$/, "");
}

async function findDeveloperAccount(identifiers: {
  email?: string;
  recoveryEmail?: string;
  recoveryPhone?: string;
}) {
  const searchOrder = [
    ["owner_email", normalizeEmail(identifiers.email)],
    ["recovery_email", normalizeEmail(identifiers.email)],
    ["recovery_email", normalizeEmail(identifiers.recoveryEmail)],
    ["recovery_phone", normalizePhone(identifiers.recoveryPhone)],
  ] as const;

  for (const [column, value] of searchOrder) {
    if (!value) continue;
    const row = await findApiKeyBy(column, value);
    if (row) return row;
  }

  return null;
}

async function sendDeveloperVerificationEmail(payload: {
  to: string;
  name?: string;
  verificationToken: string;
  recoveryEmail?: string;
  recoveryPhone?: string;
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const verifyUrl = new URL("/confirm", getPublicAppUrl());
  verifyUrl.searchParams.set("developer_token", payload.verificationToken);

  const textLines = [
    `Hi ${payload.name?.trim() || "there"},`,
    "",
    "Verify your WXATA developer email to activate your API profile:",
    verifyUrl.toString(),
    "",
    "Once confirmed, your dashboard key will be unlocked.",
  ];

  if (payload.recoveryEmail) {
    textLines.push("", `Recovery email: ${payload.recoveryEmail}`);
  }

  if (payload.recoveryPhone) {
    textLines.push("", `Recovery phone: ${payload.recoveryPhone}`);
  }

  textLines.push(
    "",
    "If you didn't request this, you can ignore this message.",
  );

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "WXATA <noreply@wxata.app>",
    to: payload.to,
    subject: "Verify your WXATA developer email",
    text: textLines.join("\n"),
  });
}

const logger = pino({ level: "warn" });

export type LogType = "INFO" | "WARN" | "DEBUG" | "ERROR" | "SUCCESS" | "MSG";

export interface DashboardLog {
  timestamp: string;
  type: LogType;
  message: string;
}

export interface SystemStatus {
  connection: Record<string, "CONNECTED" | "DISCONNECTED" | "CONNECTING">;
  uptime: string;
  memory: string;
  pm2: boolean;
}

// Detect whether we are running under PM2
const IS_PM2 = !!(
  process.env.PM2_HOME ||
  process.env.pm_id !== undefined ||
  process.env.PM2_USAGE
);

// ---------------------------------------------------------------------------
// CORS helper — applied to all /api/* endpoints
// ---------------------------------------------------------------------------
function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-API-Key, Authorization",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

class DashboardServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private startTime: number = Date.now();
  private currentConnection: Record<string, "CONNECTED" | "DISCONNECTED" | "CONNECTING"> = { primary: "DISCONNECTED", secondary: "DISCONNECTED" };

  // ── WhatsApp API fields ───────────────────────────────────────────────────
  private socks: Record<string, WASocket> = {};
  private pendingTopups = new Map<string, string>();

  constructor() {
    const port = parseInt(process.env.PORT || "5000", 10);

    // ── HTTP server ───────────────────────────────────────────────────────────
    const httpServer = http.createServer((req, res) => {
      // Health check — used by Docker healthcheck and Oracle load balancer
      if (req.url === "/health" || req.url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            connection: this.currentConnection,
            uptime: this.getUptime(),
            memory: this.getMemoryUsage(),
            pm2: IS_PM2,
          }),
        );
        return;
      }

      // PM2 status endpoint — queried by the dashboard to show process manager info
      if (req.url === "/pm2") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            managed: IS_PM2,
            pid: process.pid,
            uptime: this.getUptime(),
            restartBehaviour: {
              restart: "exit(0) → PM2 restarts automatically",
              terminate: "exit(2) → PM2 stops, no restart",
            },
          }),
        );
        return;
      }

      // ── POST /webhooks/flutterwave ──────────────────────────────────────────
      if (req.method === "POST" && req.url === "/webhooks/flutterwave") {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          // 1. Verify verif-hash header (direct string equality)
          const receivedHash = req.headers["verif-hash"] as string | undefined;
          const expectedHash = process.env.FLW_SECRET_HASH ?? "";
          if (!receivedHash || receivedHash !== expectedHash) {
            res.writeHead(401);
            res.end("Unauthorized");
            return;
          }

          // 2. Parse body
          const rawBody = Buffer.concat(chunks).toString("utf-8");
          let event: {
            event: string;
            data: {
              status: string;
              customer: { email: string; name: string };
              amount: number;
              currency: string;
              tx_ref: string;
            };
          };
          try {
            event = JSON.parse(rawBody);
          } catch {
            res.writeHead(400);
            res.end("Bad Request");
            return;
          }

          // 3. Process event with 4.5s timeout
          const processEvent = async () => {
            const hmacSecret = process.env.LICENSE_HMAC_SECRET ?? "";
            const customerEmail = event.data?.customer?.email ?? "";

            if (event.event === "charge.completed") {
              if (event.data.status === "successful") {
                // Provision: generate code + license key, insert into DB, send email
                const userCode = generateUserCode();
                const licenseKey = generateLicenseKey(
                  customerEmail,
                  hmacSecret,
                );

                try {
                  await insertUserCode({
                    code: userCode,
                    used: false,
                    suspended: false,
                    created_at: new Date().toISOString(),
                  });
                } catch (dbError) {
                  logger.error(
                    { dbError },
                    "Flutterwave webhook: Firestore insert failed",
                  );
                  throw new Error("DB write failed");
                }

                await sendCredentialsEmail(
                  customerEmail,
                  userCode,
                  licenseKey,
                  "self-host",
                );
              } else if (
                event.data.status === "failed" ||
                event.data.status === "cancelled"
              ) {
                // Suspend: set suspended=true where used_by = customerEmail
                try {
                  await updateUserCodesWhere("used_by", customerEmail, {
                    suspended: true,
                  });
                } catch (dbError) {
                  logger.error(
                    { dbError },
                    "Flutterwave webhook: suspend update failed",
                  );
                  throw new Error("DB update failed");
                }

                // Send failure notification email
                const failTransporter = nodemailer.createTransport({
                  host: process.env.SMTP_HOST,
                  port: Number(process.env.SMTP_PORT ?? 587),
                  auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                  },
                });
                await failTransporter.sendMail({
                  from: process.env.SMTP_FROM ?? "WXATA <noreply@wxata.app>",
                  to: customerEmail,
                  subject: "WXATA — Payment Failed / Access Suspended",
                  text: [
                    "Your WXATA payment failed or was cancelled.",
                    "",
                    "Your bot access has been suspended.",
                    "",
                    "To reactivate, please retry your payment or contact us:",
                    "WhatsApp: https://wa.me/2347041029093",
                    "X: https://x.com/tads_tech",
                  ].join("\n"),
                });
              }
              // charge.completed with other status: acknowledge silently
            }
            // Unknown event types: acknowledge silently to prevent Flutterwave retries
          };

          const timeout = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 4500),
          );

          try {
            await Promise.race([processEvent(), timeout]);
            res.writeHead(200);
            res.end("OK");
          } catch (err) {
            logger.error({ err }, "Flutterwave webhook processing error");
            res.writeHead(500);
            res.end("Internal Server Error");
          }
        });
        return;
      }

      // ── POST /admin/generate-license ────────────────────────────────────────
      if (req.method === "POST" && req.url === "/admin/generate-license") {
        const authHeader = req.headers["authorization"] ?? "";
        const adminSecret = process.env.ADMIN_SECRET ?? "";
        if (
          !authHeader.startsWith("Bearer ") ||
          authHeader.slice(7) !== adminSecret
        ) {
          res.writeHead(401);
          res.end("Unauthorized");
          return;
        }

        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          try {
            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as { username?: string };
            const username = body.username?.trim();
            if (!username) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: "username is required" }));
              return;
            }
            const hmacSecret = process.env.LICENSE_HMAC_SECRET ?? "";
            const key = generateLicenseKey(username, hmacSecret);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ key }));
          } catch {
            res.writeHead(400);
            res.end("Bad Request");
          }
        });
        return;
      }

      // ── OPTIONS preflight — CORS for WhatsApp API endpoints ──────────────
      if (
        req.method === "OPTIONS" &&
        (req.url === "/api/keys/create" ||
          req.url === "/api/keys/github/upsert" ||
          req.url === "/api/keys/verify" ||
          req.url === "/api/keys/usage" ||
          req.url === "/api/twitter/grab" ||
          req.url === "/api/twitter/schedule" ||
          req.url === "/api/twitter/send-to-sudo" ||
          req.url === "/api/send" ||
          req.url === "/api/keys/topup/init" ||
          req.url === "/api/admin/config" ||
          req.url === "/api/admin/keys")
      ) {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
      }

      // ── POST /api/keys/github/upsert ─────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/keys/github/upsert") {
        setCorsHeaders(res);
        (async () => {
          try {
            const bearer = extractBearerToken(req.headers.authorization);
            if (!bearer) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing bearer token" }));
              return;
            }

            let decodedUser;
            try {
              decodedUser = await verifyIdToken(bearer);
            } catch {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid auth token" }));
              return;
            }

            const hasGithubIdentity =
              decodedUser.firebase?.sign_in_provider === "github.com";

            if (!hasGithubIdentity) {
              res.writeHead(403, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "GitHub sign-in required" }));
              return;
            }

            const email = normalizeEmail(decodedUser.email ?? undefined);
            if (!email) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "GitHub account email is required" }));
              return;
            }

            const githubUserId = decodedUser.uid;
            const displayName =
              decodedUser.name ??
              decodedUser.email?.split("@")[0] ??
              "GitHub Developer";

            const freeLimit = await this.getServiceConfig("api_free_limit", "100");

            const existingByGithub = await findApiKeyBy(
              "github_user_id",
              githubUserId,
            );

            if (existingByGithub) {
              await updateApiKeyById(existingByGithub.id, {
                owner_email: email,
                owner_name: displayName,
                auth_provider: "github",
                email_verified_at: new Date().toISOString(),
                profile_completed_at: new Date().toISOString(),
                active: true,
                verification_token_hash: null,
              });

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  key: existingByGithub.key,
                  limit: existingByGithub.messages_limit,
                  created: false,
                  verified: true,
                  pending: false,
                  provider: "github",
                  messages_sent: existingByGithub.messages_sent,
                }),
              );
              return;
            }

            const existingByEmail = await findApiKeyBy("owner_email", email);

            if (existingByEmail) {
              await updateApiKeyById(existingByEmail.id, {
                owner_name: displayName,
                github_user_id: githubUserId,
                auth_provider: "github",
                email_verified_at: new Date().toISOString(),
                profile_completed_at: new Date().toISOString(),
                active: true,
                verification_token_hash: null,
              });

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  key: existingByEmail.key,
                  limit: existingByEmail.messages_limit,
                  created: false,
                  verified: true,
                  pending: false,
                  provider: "github",
                  messages_sent: existingByEmail.messages_sent,
                }),
              );
              return;
            }

            const apiKey = this.generateApiKey();
            await insertApiKey({
              key: apiKey,
              owner_email: email,
              owner_name: displayName,
              recovery_email: "",
              recovery_phone: "",
              github_user_id: githubUserId,
              auth_provider: "github",
              messages_sent: 0,
              messages_limit: parseInt(freeLimit, 10),
              paid_credits: 0,
              active: true,
              email_verified_at: new Date().toISOString(),
              profile_completed_at: new Date().toISOString(),
              verification_token_hash: null,
              verification_sent_at: null,
              created_at: new Date().toISOString(),
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                key: apiKey,
                limit: parseInt(freeLimit, 10),
                created: true,
                verified: true,
                pending: false,
                provider: "github",
              }),
            );
          } catch (err) {
            logger.error({ err }, "POST /api/keys/github/upsert error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        })();
        return;
      }

      // ── POST /api/keys/create ─────────────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/keys/create") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as {
              email?: string;
              name?: string;
              recoveryEmail?: string;
              recoveryPhone?: string;
            };
            const email = normalizeEmail(body.email);
            if (!email) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "email is required" }));
              return;
            }

            const recoveryEmail = normalizeEmail(body.recoveryEmail);
            const recoveryPhone = normalizePhone(body.recoveryPhone);
            const name = body.name?.trim() ?? "";

            if (!recoveryEmail || !recoveryPhone) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: "recoveryEmail and recoveryPhone are required",
                }),
              );
              return;
            }

            const existing = await findDeveloperAccount({
              email,
              recoveryEmail,
              recoveryPhone,
            });

            if (existing) {
              if (existing.email_verified_at) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    key: existing.key,
                    limit: existing.messages_limit,
                    created: false,
                    messages_sent: existing.messages_sent,
                    verified: true,
                    pending: false,
                  }),
                );
                return;
              }

              const verificationToken = generateVerificationToken();
              await updateApiKeyById(existing.id, {
                verification_token_hash: hashVerificationToken(
                  verificationToken,
                ),
                verification_sent_at: new Date().toISOString(),
                active: false,
              });

              await sendDeveloperVerificationEmail({
                to: existing.owner_email,
                name: existing.owner_name,
                verificationToken,
                recoveryEmail: existing.recovery_email,
                recoveryPhone: existing.recovery_phone,
              });

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  key: null,
                  created: false,
                  pending: true,
                  verified: false,
                  email: existing.owner_email,
                }),
              );
              return;
            }

            const apiKey = this.generateApiKey();
            const verificationToken = generateVerificationToken();
            const freeLimit = await this.getServiceConfig(
              "api_free_limit",
              "100",
            );

            await insertApiKey({
              key: apiKey,
              owner_email: email,
              owner_name: name,
              recovery_email: recoveryEmail,
              recovery_phone: recoveryPhone,
              messages_sent: 0,
              messages_limit: parseInt(freeLimit, 10),
              paid_credits: 0,
              active: false,
              email_verified_at: null,
              profile_completed_at: null,
              verification_token_hash: hashVerificationToken(
                verificationToken,
              ),
              verification_sent_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });

            await sendDeveloperVerificationEmail({
              to: email,
              name,
              verificationToken,
              recoveryEmail,
              recoveryPhone,
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                key: null,
                limit: parseInt(freeLimit, 10),
                created: true,
                pending: true,
                verified: false,
                email,
              }),
            );
          } catch (err) {
            logger.error({ err }, "POST /api/keys/create error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── POST /api/keys/verify ─────────────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/keys/verify") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as { token?: string };
            const token = body.token?.trim();
            if (!token) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "token is required" }));
              return;
            }

            const tokenHash = hashVerificationToken(token);
            const row = await findApiKeyBy("verification_token_hash", tokenHash);

            if (!row) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid verification token" }));
              return;
            }

            if (!row.email_verified_at) {
              await updateApiKeyById(row.id, {
                email_verified_at: new Date().toISOString(),
                profile_completed_at: new Date().toISOString(),
                verification_token_hash: null,
                active: true,
              });
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                key: row.key,
                limit: row.messages_limit,
                created: false,
                verified: true,
                pending: false,
                email: row.owner_email,
                messages_sent: row.messages_sent,
                name: row.owner_name,
              }),
            );
          } catch (err) {
            logger.error({ err }, "POST /api/keys/verify error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── GET /api/keys/usage ───────────────────────────────────────────────
      if (req.method === "GET" && req.url === "/api/keys/usage") {
        setCorsHeaders(res);
        (async () => {
          try {
            const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
            if (!apiKeyHeader) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing API key or email" }));
              return;
            }

            const isEmail = apiKeyHeader.includes("@");
            const isPhone = /^[+\d][\d\s-]{7,}$/.test(apiKeyHeader);
            const row = await findDeveloperAccount({
              email: isEmail ? apiKeyHeader : undefined,
              recoveryEmail: isEmail ? apiKeyHeader : undefined,
              recoveryPhone: isPhone ? apiKeyHeader : undefined,
            }) ??
              (isEmail || isPhone
                ? null
                : await findApiKeyBy("key", apiKeyHeader));

            if (!row) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid API key or email" }));
              return;
            }

            if (!row.email_verified_at) {
              res.writeHead(403, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Email verification pending" }));
              return;
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                email: row.owner_email,
                name: row.owner_name,
                messages_sent: row.messages_sent,
                messages_limit: row.messages_limit,
                paid_credits: row.paid_credits,
                active: row.active,
                total_quota: (row.messages_limit ?? 0) + (row.paid_credits ?? 0),
              }),
            );
          } catch (err) {
            logger.error({ err }, "GET /api/keys/usage error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        })();
        return;
      }

      // ── POST /api/twitter/grab ───────────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/twitter/grab") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            if (!body.url) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing Twitter URL" }));
              return;
            }
            console.log(`[Twitter Grab] Fetching URL: ${body.url}`);
            const tweetData = await fetchTweetContent(body.url);
            console.log(`[Twitter Grab] Success:`, tweetData);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(tweetData));
          } catch (err: any) {
            console.error(`[Twitter Grab] Error:`, err.message);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "Failed to fetch tweet" }));
          }
        });
        return;
      }

      // ── POST /api/twitter/schedule ───────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/twitter/schedule") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            if (!body.postAt || !body.text) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing postAt or text" }));
              return;
            }
            scheduleTweetPost({
              id: crypto.randomUUID(),
              postAt: body.postAt,
              text: body.text,
              imageUrls: body.imageUrls || [],
              applyStickers: !!body.applyStickers,
              imageDataBase64: body.imageDataBase64
            });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "Failed to schedule" }));
          }
        });
        return;
      }

      // ── POST /api/twitter/send-to-sudo ───────────────────────────────────
      if (req.method === "POST" && req.url === "/api/twitter/send-to-sudo") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            if (!body.imageDataBase64) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Missing image data" }));
              return;
            }

            const accountId = body.accountId || "primary";
            console.log(`[send-to-sudo] Received request for account: ${accountId}`);

            const sock = this.socks[accountId] || this.socks["primary"];
            if (!sock) {
              console.error(`[send-to-sudo] Socket for ${accountId} is not connected.`);
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: `WhatsApp [${accountId}] is not connected in the dashboard.` }));
              return;
            }

            // Get the data dir
            const DATA_DIR = fs.existsSync("/data") ? "/data" : path.resolve(__dirname, "..");
            const botInfoPath = path.resolve(DATA_DIR, accountId, "botinfo.json");
            
            let ownerJid: string | null = null;
            try {
              if (fs.existsSync(botInfoPath)) {
                const raw = await fs.promises.readFile(botInfoPath, "utf-8");
                const botInfo = JSON.parse(raw);
                const target = botInfo?.root?.target || "";
                if (target) {
                  const cleanNumber = target.replace(/\D/g, "");
                  if (cleanNumber) {
                    ownerJid = `${cleanNumber}@s.whatsapp.net`;
                  }
                }
              }
            } catch (e) {
              console.error("[send-to-sudo] Failed to read botinfo:", e);
            }

            if (!ownerJid) {
              // Fallback to the default sudo number from the prompt if botinfo resolution fails
              ownerJid = "2348083696903@s.whatsapp.net";
              console.log("[send-to-sudo] Using default fallback JID: 2348083696903@s.whatsapp.net");
            }

            console.log(`[send-to-sudo] Sending to JID: ${ownerJid}`);

            // Convert base64 to buffer
            const base64Data = body.imageDataBase64.replace(/^data:image\/\w+;base64,/, "");
            const imageBuffer = Buffer.from(base64Data, "base64");

            // Send image message with caption
            await sock.sendMessage(ownerJid, {
              image: imageBuffer,
              caption: body.caption || "Saved X Card Preview"
            });

            console.log(`[send-to-sudo] Successfully sent to ${ownerJid}`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            console.error("[send-to-sudo] Error:", err);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "Failed to send to sudo" }));
          }
        });
        return;
      }

      // ── POST /api/send ────────────────────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/send") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
            if (!apiKeyHeader) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid API key" }));
              return;
            }

            const row = await findApiKeyBy("key", apiKeyHeader);

            if (!row) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid API key" }));
              return;
            }

            if (row.active === false) {
              res.writeHead(403, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "API key suspended" }));
              return;
            }

            if (!row.email_verified_at) {
              res.writeHead(403, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Email verification pending" }));
              return;
            }

            if (row.messages_sent >= row.messages_limit + row.paid_credits) {
              res.writeHead(402, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: "Quota exceeded. Please top up your credits.",
                }),
              );
              return;
            }

            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as { to?: string; message?: string };
            if (!body.to || !body.message) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "to and message are required" }));
              return;
            }

            const sock = this.socks["primary"];
            if (!sock) {
              res.writeHead(503, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({ error: "WhatsApp bot is not connected" }),
              );
              return;
            }

            await sock.sendMessage(this.normalizeJid(body.to), {
              text: body.message,
            });

            await updateApiKeyById(row.id, {
              messages_sent: row.messages_sent + 1,
              last_used: new Date().toISOString(),
            });

            await insertUsageLog({
              api_key_id: row.id,
              to_number: body.to,
              message_text: body.message.slice(0, 200),
              status: "sent",
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                sent: true,
                remaining:
                  row.messages_limit +
                  row.paid_credits -
                  (row.messages_sent + 1),
              }),
            );
          } catch (err) {
            logger.error({ err }, "POST /api/send error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── POST /api/keys/topup/init ─────────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/keys/topup/init") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const apiKeyHeader = req.headers["x-api-key"] as string | undefined;
            if (!apiKeyHeader) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid API key" }));
              return;
            }

            const row = await findApiKeyBy("key", apiKeyHeader);

            if (!row) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid API key" }));
              return;
            }

            if (row.active === false) {
              res.writeHead(403, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "API key suspended" }));
              return;
            }

            if (!row.email_verified_at) {
              res.writeHead(403, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Email verification pending" }));
              return;
            }

            const [amount, credits] = await Promise.all([
              this.getServiceConfig("api_topup_amount_ngn", "2000"),
              this.getServiceConfig("api_topup_credits", "500"),
            ]);

            const txRef = `WXAPI-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
            this.pendingTopups.set(txRef, apiKeyHeader);
            // Auto-expire after 30 minutes
            setTimeout(() => this.pendingTopups.delete(txRef), 30 * 60 * 1000);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                tx_ref: txRef,
                amount: parseInt(amount, 10),
                credits: parseInt(credits, 10),
                flw_public_key: process.env.FLW_PUBLIC_KEY ?? "",
              }),
            );
          } catch (err) {
            logger.error({ err }, "POST /api/keys/topup/init error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── POST /webhooks/flutterwave/api ────────────────────────────────────
      if (req.method === "POST" && req.url === "/webhooks/flutterwave/api") {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const receivedHash = req.headers["verif-hash"] as
              | string
              | undefined;
            const expectedHash = process.env.FLW_SECRET_HASH ?? "";
            if (!receivedHash || receivedHash !== expectedHash) {
              res.writeHead(401);
              res.end("Unauthorized");
              return;
            }

            const rawBody = Buffer.concat(chunks).toString("utf-8");
            let event: {
              event: string;
              data: { status: string; tx_ref: string; amount: number };
            };
            try {
              event = JSON.parse(rawBody);
            } catch {
              res.writeHead(400);
              res.end("Bad Request");
              return;
            }

            if (
              event.event === "charge.completed" &&
              event.data.status === "successful"
            ) {
              const txRef = event.data.tx_ref;
              const apiKey = this.pendingTopups.get(txRef);

              if (apiKey) {
                try {
                  const row = await findApiKeyBy("key", apiKey);

                  if (row) {
                    const creditsStr = await this.getServiceConfig(
                      "api_topup_credits",
                      "500",
                    );
                    const credits = parseInt(creditsStr, 10);
                    await updateApiKeyById(row.id, {
                      paid_credits: (row.paid_credits ?? 0) + credits,
                      last_used: new Date().toISOString(),
                    });
                    logger.info(
                      { apiKey, credits, txRef },
                      "API key topped up via Flutterwave",
                    );
                  } else {
                    logger.warn(
                      { txRef, apiKey },
                      "Flutterwave API webhook: API key not found",
                    );
                  }
                } catch (topupErr) {
                  logger.error(
                    { err: topupErr, txRef, apiKey },
                    "Error crediting API key in Flutterwave webhook",
                  );
                }

                this.pendingTopups.delete(txRef);
              } else {
                logger.warn(
                  { txRef },
                  "Flutterwave API webhook: unknown tx_ref (may have expired)",
                );
              }
            }

            res.writeHead(200);
            res.end("OK");
          } catch (err) {
            logger.error({ err }, "POST /webhooks/flutterwave/api error");
            // Return 200 to prevent Flutterwave from retrying
            res.writeHead(200);
            res.end("OK");
          }
        });
        return;
      }

      // ── GET /api/admin/config ─────────────────────────────────────────────
      if (req.method === "GET" && req.url === "/api/admin/config") {
        setCorsHeaders(res);
        (async () => {
          try {
            const authHeader = req.headers["authorization"] ?? "";
            const adminSecret = process.env.ADMIN_SECRET ?? "";
            if (
              !authHeader.startsWith("Bearer ") ||
              authHeader.slice(7) !== adminSecret
            ) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }

            const data = await listServiceConfig();

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data ?? []));
          } catch (err) {
            logger.error({ err }, "GET /api/admin/config error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        })();
        return;
      }

      // ── POST /api/admin/config ────────────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/admin/config") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const authHeader = req.headers["authorization"] ?? "";
            const adminSecret = process.env.ADMIN_SECRET ?? "";
            if (
              !authHeader.startsWith("Bearer ") ||
              authHeader.slice(7) !== adminSecret
            ) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }

            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as { key?: string; value?: string };
            if (!body.key || body.value === undefined) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "key and value are required" }));
              return;
            }

            await upsertServiceConfig(body.key, body.value);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            logger.error({ err }, "POST /api/admin/config error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── GET /api/admin/keys ───────────────────────────────────────────────
      if (req.method === "GET" && req.url === "/api/admin/keys") {
        setCorsHeaders(res);
        (async () => {
          try {
            const authHeader = req.headers["authorization"] ?? "";
            const adminSecret = process.env.ADMIN_SECRET ?? "";
            if (
              !authHeader.startsWith("Bearer ") ||
              authHeader.slice(7) !== adminSecret
            ) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }

            const data = await listApiKeys();

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data ?? []));
          } catch (err) {
            logger.error({ err }, "GET /api/admin/keys error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        })();
        return;
      }

      // ── Helper: ADMIN_SECRET bearer guard ─────────────────────────────────
      const isAdmin = (): boolean => {
        const authHeader = req.headers["authorization"] ?? "";
        const adminSecret = process.env.ADMIN_SECRET ?? "";
        return (
          authHeader.startsWith("Bearer ") &&
          authHeader.slice(7) === adminSecret
        );
      };

      // ── GET /api/admin/codes ──────────────────────────────────────────────
      if (req.method === "GET" && req.url === "/api/admin/codes") {
        setCorsHeaders(res);
        (async () => {
          try {
            if (!isAdmin()) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            const data = await listUserCodes();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data ?? []));
          } catch (err) {
            logger.error({ err }, "GET /api/admin/codes error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        })();
        return;
      }

      // ── POST /api/admin/codes/create ──────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/admin/codes/create") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            if (!isAdmin()) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as Record<string, unknown>;
            const code =
              typeof body.code === "string" && body.code.trim()
                ? body.code.trim()
                : generateUserCode();
            const id = await insertUserCode({
              code,
              used: Boolean(body.used),
              suspended: Boolean(body.suspended),
              created_at: new Date().toISOString(),
            });
            res.writeHead(201, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, id, code }));
          } catch (err) {
            logger.error({ err }, "POST /api/admin/codes/create error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── POST /api/admin/codes/update ──────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/admin/codes/update") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            if (!isAdmin()) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as { id?: string; patch?: Record<string, unknown> };
            if (!body.id || !body.patch) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "id and patch are required" }));
              return;
            }
            await updateUserCodeById(body.id, body.patch);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            logger.error({ err }, "POST /api/admin/codes/update error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── POST /api/admin/codes/delete ──────────────────────────────────────
      if (req.method === "POST" && req.url === "/api/admin/codes/delete") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            if (!isAdmin()) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as { id?: string };
            if (!body.id) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "id is required" }));
              return;
            }
            await deleteUserCodeById(body.id);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            logger.error({ err }, "POST /api/admin/codes/delete error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── GET /api/admin/extensions ─────────────────────────────────────────
      if (req.method === "GET" && req.url === "/api/admin/extensions") {
        setCorsHeaders(res);
        (async () => {
          try {
            if (!isAdmin()) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            const data = await listAllExtensions();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data ?? []));
          } catch (err) {
            logger.error({ err }, "GET /api/admin/extensions error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        })();
        return;
      }

      // ── POST /api/admin/extensions/update ─────────────────────────────────
      if (req.method === "POST" && req.url === "/api/admin/extensions/update") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            if (!isAdmin()) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as { id?: string; patch?: Record<string, unknown> };
            if (!body.id || !body.patch) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "id and patch are required" }));
              return;
            }
            await updateExtensionById(body.id, body.patch);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            logger.error({ err }, "POST /api/admin/extensions/update error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── POST /api/admin/extensions/delete ─────────────────────────────────
      if (req.method === "POST" && req.url === "/api/admin/extensions/delete") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            if (!isAdmin()) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as { id?: string };
            if (!body.id) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "id is required" }));
              return;
            }
            await deleteExtensionById(body.id);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            logger.error({ err }, "POST /api/admin/extensions/delete error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      // ── POST /api/codes/redeem ────────────────────────────────────────────
      // Marks a user_code as used, authenticated via Firebase idToken so that
      // client-side writes to the user_codes collection can be locked down.
      if (req.method === "POST" && req.url === "/api/codes/redeem") {
        setCorsHeaders(res);
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", async () => {
          try {
            const authHeader = req.headers["authorization"] ?? "";
            const idToken = extractBearerToken(authHeader);
            if (!idToken) {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            let email = "";
            try {
              const decoded = await verifyIdToken(idToken);
              email = decoded.email ?? "";
            } catch {
              res.writeHead(401, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Unauthorized" }));
              return;
            }
            if (!email) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Email is required" }));
              return;
            }

            const body = JSON.parse(
              Buffer.concat(chunks).toString("utf-8"),
            ) as { code?: string };
            if (!body.code) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "code is required" }));
              return;
            }

            const codeData = await findUserCodeByCode(body.code);
            if (!codeData) {
              res.writeHead(404, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Invalid code" }));
              return;
            }
            if (codeData.suspended) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Code has been suspended" }));
              return;
            }
            if (codeData.used) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Code has already been used" }));
              return;
            }

            const id = String(codeData.id);
            await updateUserCodeById(id, {
              used: true,
              used_by: email,
              used_at: new Date().toISOString(),
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, id }));
          } catch (err) {
            logger.error({ err }, "POST /api/codes/redeem error");
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    httpServer.listen(port, () => {
      console.log(
        `🌐 Server (HTTP & WS) listening on port ${port}${IS_PM2 ? " [PM2 managed]" : ""}`,
      );
    });

    // ── Self-ping keep-alive ──────────────────────────────────────────────────
    // Pings the local /health endpoint every 10 minutes.
    // On Render free tier this prevents the dyno from sleeping.
    // On Oracle VPS this keeps the event loop active and prevents the OS
    // from killing an "idle" process (common with systemd/OOM killer).
    const externalUrl =
      process.env.RENDER_EXTERNAL_URL ?? process.env.SELF_URL ?? null;
    const selfUrl = externalUrl
      ? `${externalUrl}/health`
      : `http://127.0.0.1:${port}/health`;

    setInterval(
      () => {
        http
          .get(selfUrl, (res) => {
            logger.debug(`Self-ping: ${res.statusCode}`);
            res.resume(); // consume response body to free socket
          })
          .on("error", (err) => {
            logger.warn({ err }, "Self-ping failed");
          });
      },
      10 * 60 * 1000,
    ); // every 10 minutes
    console.log(`🔁 Self-ping keep-alive active → ${selfUrl}`);

    // ── WebSocket server ──────────────────────────────────────────────────────
    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on("connection", (ws) => {
      // Mark alive for heartbeat tracking
      (ws as any).isAlive = true;

      this.clients.add(ws);
      console.log("🖥️  Dashboard: Frontend client connected");

      ws.on("pong", () => {
        (ws as any).isAlive = true;
      });

      ws.on("message", (message) => {
        try {
          const payload = JSON.parse(message.toString());
          this.handleCommand(payload);
        } catch (err) {
          logger.error({ err }, "Failed to parse dashboard command");
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log("🖥️  Dashboard: Frontend client disconnected");
      });

      ws.on("error", (err) => {
        logger.warn({ err }, "WebSocket client error");
        this.clients.delete(ws);
      });

      // Send current state immediately on connect
      this.sendStatus();
    });

    // ── Heartbeat — detect and clean up dead connections ─────────────────────
    // Without this, stale connections accumulate and the dashboard appears
    // connected even after a network drop.
    setInterval(() => {
      this.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) {
          logger.warn("Terminating stale WebSocket connection");
          this.clients.delete(ws);
          ws.terminate();
          return;
        }
        (ws as any).isAlive = false;
        ws.ping();
      });
    }, 30_000);

    // Status broadcast every 5 s
    setInterval(() => this.sendStatus(), 5000);
  }

  private onCommandCallback: ((cmd: any) => void) | null = null;

  public onCommand(callback: (cmd: any) => void) {
    this.onCommandCallback = callback;
  }

  public handleCommand(payload: any) {
    if (this.onCommandCallback) {
      this.onCommandCallback(payload);
    }
  }

  public sendQR(accountId: string, qr: string) {
    this.broadcast({ event: "qr", accountId, data: qr });
  }

  public sendPairingCode(accountId: string, code: string) {
    this.broadcast({ event: "pairing-code", accountId, data: code });
  }

  public setConnectionStatus(
    accountId: string,
    status: "CONNECTED" | "DISCONNECTED" | "CONNECTING",
  ) {
    this.currentConnection[accountId] = status;
    this.sendStatus();
  }

  public broadcast(data: any) {
    const payload = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  public log(accountId: string, type: LogType, message: string) {
    const logEntry: DashboardLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    this.broadcast({ event: "log", accountId, data: logEntry });
  }

  public sendStatus() {
    const status: SystemStatus = {
      connection: this.currentConnection,
      uptime: this.getUptime(),
      memory: this.getMemoryUsage(),
      pm2: IS_PM2,
    };
    this.broadcast({ event: "status", data: status });
  }

  private getUptime(): string {
    const seconds = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  }

  private getMemoryUsage(): string {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    return `${Math.round(used)}MB`;
  }

  // ── WhatsApp API: register the socket once it's ready ─────────────────────
  public setSock(accountId: string, sock: WASocket): void {
    this.socks[accountId] = sock;
  }

  // ── WhatsApp API: normalise a phone number to a Baileys JID ───────────────
  private normalizeJid(to: string): string {
    // Strip every non-digit character; if the original already contained '@'
    // the digits-only string will never match, so we fall through and always
    // produce <digits>@s.whatsapp.net — which is the correct normalisation.
    const digits = to.replace(/\D/g, "");
    return digits.includes("@") ? to : `${digits}@s.whatsapp.net`;
  }

  // ── WhatsApp API: generate a new API key ──────────────────────────────────
  private generateApiKey(): string {
    const bytes = crypto.randomBytes(24);
    return "wxata_live_" + bytes.toString("hex");
  }

  // ── WhatsApp API: read a value from the service_config collection ───────
  private async getServiceConfig(
    key: string,
    fallback: string,
  ): Promise<string> {
    try {
      return await getServiceConfigValue(key, fallback);
    } catch {
      return fallback;
    }
  }
}

export const dashboard = new DashboardServer();
