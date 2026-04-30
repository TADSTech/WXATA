import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import pino from 'pino';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { generateLicenseKey } from './licenseValidator';

// ---------------------------------------------------------------------------
// Supabase service-role client (lazy — initialized on first use)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabaseAdmin: ReturnType<typeof createClient<any>> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabaseAdmin(): ReturnType<typeof createClient<any>> {
  if (!_supabaseAdmin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _supabaseAdmin = createClient<any>(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    );
  }
  return _supabaseAdmin;
}

// ---------------------------------------------------------------------------
// Helper: generate a 16-char cryptographically random alphanumeric user code
// ---------------------------------------------------------------------------
export function generateUserCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(16);
  let result = '';
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
  tier: 'self-host' | 'hosted' = 'self-host'
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
    '── SELF-HOST SETUP ──────────────────────────────────────────',
    '',
    '1. Clone the bot binary repository:',
    '   git clone https://github.com/tadstech/wxata-public.git',
    '   cd wxata-public',
    '',
    '2. Copy the example env file and fill in your values:',
    '   cp .env.example .env',
    '',
    '3. Set your License Key in .env:',
    `   LICENSE_KEY=${licenseKey}`,
    '',
    '4. Start the bot with Docker:',
    '   docker compose up -d',
    '',
    '5. Open the dashboard at http://your-server-ip:5000',
    '   Connect your WhatsApp via QR code or phone pairing.',
    '',
    '6. Create your dashboard account at:',
    '   https://wxata.tadstech.dev/register',
    `   Use this Registration Code: ${userCode}`,
    '',
    'Full deployment guide: https://wxata.tadstech.dev/docs',
    '─────────────────────────────────────────────────────────────',
  ].join('\n');

  const hostedInstructions = [
    '── HOSTED SETUP ─────────────────────────────────────────────',
    '',
    'Your bot is managed and hosted for you — no server setup needed.',
    '',
    '1. Create your dashboard account at:',
    '   https://wxata.tadstech.dev/register',
    `   Use this Registration Code: ${userCode}`,
    '',
    '2. Once logged in, your bot dashboard is live at:',
    '   https://wxata.tadstech.dev/dashboard/<your-username>',
    '',
    '3. Connect your WhatsApp from the dashboard using QR or phone pairing.',
    '',
    'Your License Key (keep this safe — do not share it):',
    `   ${licenseKey}`,
    '',
    'Full guide: https://wxata.tadstech.dev/docs',
    '─────────────────────────────────────────────────────────────',
  ].join('\n');

  const instructions = tier === 'self-host' ? selfHostInstructions : hostedInstructions;
  const subject = tier === 'self-host'
    ? 'Your WXATA Self-Host Access — Bot Binary + License Key'
    : 'Your WXATA Hosted Access — Dashboard Credentials';

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'WXATA <noreply@wxata.app>',
    to,
    subject,
    text: [
      'Thank you for your purchase! Here are your credentials:',
      '',
      `Registration Code : ${userCode}`,
      `License Key       : ${licenseKey}`,
      '',
      instructions,
      '',
      'Need help? DM us on WhatsApp: https://wa.me/2347041029093',
      'Or on X: https://x.com/tads_tech',
    ].join('\n'),
  });
}

const logger = pino({ level: 'warn' });

export type LogType = 'INFO' | 'WARN' | 'DEBUG' | 'ERROR' | 'SUCCESS' | 'MSG';

export interface DashboardLog {
  timestamp: string;
  type: LogType;
  message: string;
}

export interface SystemStatus {
  connection: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  uptime: string;
  memory: string;
  pm2: boolean;
}

// Detect whether we are running under PM2
const IS_PM2 = !!(process.env.PM2_HOME || process.env.pm_id !== undefined || process.env.PM2_USAGE);

class DashboardServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private startTime: number = Date.now();
  private currentConnection: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' = 'DISCONNECTED';

  constructor() {
    const port = parseInt(process.env.PORT || '5000', 10);

    // ── HTTP server ───────────────────────────────────────────────────────────
    const httpServer = http.createServer((req, res) => {
      // Health check — used by Docker healthcheck and Oracle load balancer
      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          connection: this.currentConnection,
          uptime: this.getUptime(),
          memory: this.getMemoryUsage(),
          pm2: IS_PM2,
        }));
        return;
      }

      // PM2 status endpoint — queried by the dashboard to show process manager info
      if (req.url === '/pm2') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          managed: IS_PM2,
          pid: process.pid,
          uptime: this.getUptime(),
          restartBehaviour: {
            restart: 'exit(0) → PM2 restarts automatically',
            terminate: 'exit(2) → PM2 stops, no restart',
          },
        }));
        return;
      }

      // ── POST /webhooks/flutterwave ──────────────────────────────────────────
      if (req.method === 'POST' && req.url === '/webhooks/flutterwave') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          // 1. Verify verif-hash header (direct string equality)
          const receivedHash = req.headers['verif-hash'] as string | undefined;
          const expectedHash = process.env.FLW_SECRET_HASH ?? '';
          if (!receivedHash || receivedHash !== expectedHash) {
            res.writeHead(401);
            res.end('Unauthorized');
            return;
          }

          // 2. Parse body
          const rawBody = Buffer.concat(chunks).toString('utf-8');
          let event: { event: string; data: { status: string; customer: { email: string; name: string }; amount: number; currency: string; tx_ref: string } };
          try {
            event = JSON.parse(rawBody);
          } catch {
            res.writeHead(400);
            res.end('Bad Request');
            return;
          }

          // 3. Process event with 4.5s timeout
          const processEvent = async () => {
            const hmacSecret = process.env.LICENSE_HMAC_SECRET ?? '';
            const customerEmail = event.data?.customer?.email ?? '';

            if (event.event === 'charge.completed') {
              if (event.data.status === 'successful') {
                // Provision: generate code + license key, insert into DB, send email
                const userCode = generateUserCode();
                const licenseKey = generateLicenseKey(customerEmail, hmacSecret);

                const { error: dbError } = await getSupabaseAdmin().from('user_codes').insert({
                  code: userCode,
                  used: false,
                  suspended: false,
                  created_at: new Date().toISOString(),
                });

                if (dbError) {
                  logger.error({ dbError }, 'Flutterwave webhook: Supabase insert failed');
                  throw new Error('DB write failed');
                }

                await sendCredentialsEmail(customerEmail, userCode, licenseKey, 'self-host');
              } else if (event.data.status === 'failed' || event.data.status === 'cancelled') {
                // Suspend: set suspended=true where used_by = customerEmail
                const { error: dbError } = await getSupabaseAdmin()
                  .from('user_codes')
                  .update({ suspended: true })
                  .eq('used_by', customerEmail);

                if (dbError) {
                  logger.error({ dbError }, 'Flutterwave webhook: suspend update failed');
                  throw new Error('DB update failed');
                }

                // Send failure notification email
                const failTransporter = nodemailer.createTransport({
                  host: process.env.SMTP_HOST,
                  port: Number(process.env.SMTP_PORT ?? 587),
                  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
                });
                await failTransporter.sendMail({
                  from: process.env.SMTP_FROM ?? 'WXATA <noreply@wxata.app>',
                  to: customerEmail,
                  subject: 'WXATA — Payment Failed / Access Suspended',
                  text: [
                    'Your WXATA payment failed or was cancelled.',
                    '',
                    'Your bot access has been suspended.',
                    '',
                    'To reactivate, please retry your payment or contact us:',
                    'WhatsApp: https://wa.me/2347041029093',
                    'X: https://x.com/tads_tech',
                  ].join('\n'),
                });
              }
              // charge.completed with other status: acknowledge silently
            }
            // Unknown event types: acknowledge silently to prevent Flutterwave retries
          };

          const timeout = new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 4500)
          );

          try {
            await Promise.race([processEvent(), timeout]);
            res.writeHead(200);
            res.end('OK');
          } catch (err) {
            logger.error({ err }, 'Flutterwave webhook processing error');
            res.writeHead(500);
            res.end('Internal Server Error');
          }
        });
        return;
      }

      // ── POST /admin/generate-license ────────────────────────────────────────
      if (req.method === 'POST' && req.url === '/admin/generate-license') {
        const authHeader = req.headers['authorization'] ?? '';
        const adminSecret = process.env.ADMIN_SECRET ?? '';
        if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== adminSecret) {
          res.writeHead(401);
          res.end('Unauthorized');
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as { username?: string };
            const username = body.username?.trim();
            if (!username) {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'username is required' }));
              return;
            }
            const hmacSecret = process.env.LICENSE_HMAC_SECRET ?? '';
            const key = generateLicenseKey(username, hmacSecret);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ key }));
          } catch {
            res.writeHead(400);
            res.end('Bad Request');
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    httpServer.listen(port, () => {
      console.log(`🌐 Server (HTTP & WS) listening on port ${port}${IS_PM2 ? ' [PM2 managed]' : ''}`);
    });

    // ── Self-ping keep-alive ──────────────────────────────────────────────────
    // Pings the local /health endpoint every 10 minutes.
    // On Render free tier this prevents the dyno from sleeping.
    // On Oracle VPS this keeps the event loop active and prevents the OS
    // from killing an "idle" process (common with systemd/OOM killer).
    const externalUrl = process.env.RENDER_EXTERNAL_URL ?? process.env.SELF_URL ?? null;
    const selfUrl = externalUrl ? `${externalUrl}/health` : `http://127.0.0.1:${port}/health`;

    setInterval(() => {
      http.get(selfUrl, (res) => {
        logger.debug(`Self-ping: ${res.statusCode}`);
        res.resume(); // consume response body to free socket
      }).on('error', (err) => {
        logger.warn({ err }, 'Self-ping failed');
      });
    }, 10 * 60 * 1000); // every 10 minutes
    console.log(`🔁 Self-ping keep-alive active → ${selfUrl}`);

    // ── WebSocket server ──────────────────────────────────────────────────────
    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on('connection', (ws) => {
      // Mark alive for heartbeat tracking
      (ws as any).isAlive = true;

      this.clients.add(ws);
      console.log('🖥️  Dashboard: Frontend client connected');

      ws.on('pong', () => {
        (ws as any).isAlive = true;
      });

      ws.on('message', (message) => {
        try {
          const payload = JSON.parse(message.toString());
          this.handleCommand(payload);
        } catch (err) {
          logger.error({ err }, 'Failed to parse dashboard command');
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('🖥️  Dashboard: Frontend client disconnected');
      });

      ws.on('error', (err) => {
        logger.warn({ err }, 'WebSocket client error');
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
          logger.warn('Terminating stale WebSocket connection');
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

  public sendQR(qr: string) {
    this.broadcast({ event: 'qr', data: qr });
  }

  public sendPairingCode(code: string) {
    this.broadcast({ event: 'pairing-code', data: code });
  }

  public setConnectionStatus(status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING') {
    this.currentConnection = status;
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

  public log(type: LogType, message: string) {
    const logEntry: DashboardLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    };
    this.broadcast({ event: 'log', data: logEntry });
  }

  public sendStatus() {
    const status: SystemStatus = {
      connection: this.currentConnection,
      uptime: this.getUptime(),
      memory: this.getMemoryUsage(),
      pm2: IS_PM2,
    };
    this.broadcast({ event: 'status', data: status });
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
}

export const dashboard = new DashboardServer();
