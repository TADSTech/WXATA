import { WebSocketServer, WebSocket } from 'ws';
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
}

class DashboardServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private startTime: number = Date.now();
  private currentConnection: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' = 'DISCONNECTED';

  constructor(port: number = 4000) {
    this.wss = new WebSocketServer({ port });
    
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.log('🖥️  Dashboard: Frontend client connected');
      
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

      // Send initial status
      this.sendStatus();
    });

    // Periodically send status updates
    setInterval(() => this.sendStatus(), 5000);
  }

  private onCommandCallback: ((cmd: any) => void) | null = null;

  public onCommand(callback: (cmd: any) => void) {
    this.onCommandCallback = callback;
  }

  private handleCommand(payload: any) {
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
      memory: this.getMemoryUsage()
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
    return `${Math.round(used)}MB / 512MB`;
  }
}

export const dashboard = new DashboardServer();
