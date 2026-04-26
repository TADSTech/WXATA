import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import pino from 'pino';

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

      res.writeHead(404);
      res.end('Not found');
    });

    httpServer.listen(port, () => {
      console.log(`🌐 Server (HTTP & WS) listening on port ${port}${IS_PM2 ? ' [PM2 managed]' : ''}`);
    });

    // ── Self-ping keep-alive (Render free tier only) ──────────────────────────
    const selfUrl = process.env.RENDER_EXTERNAL_URL
      ? `${process.env.RENDER_EXTERNAL_URL}/health`
      : null;

    if (selfUrl) {
      setInterval(() => {
        http.get(selfUrl, (res) => {
          logger.debug(`Self-ping: ${res.statusCode}`);
        }).on('error', (err) => {
          logger.warn({ err }, 'Self-ping failed');
        });
      }, 10 * 60 * 1000);
      console.log(`🔁 Self-ping keep-alive active → ${selfUrl}`);
    }

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
