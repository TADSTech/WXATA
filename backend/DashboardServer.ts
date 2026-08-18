import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import pino from "pino";
import type { WASocket } from "@whiskeysockets/baileys";
import { fetchTweetContent } from "./twitter_grabber.js";
import { scheduleTweetPost } from "./tv_miniapp.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({ level: "warn" });

const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "";

function checkAuth(req: http.IncomingMessage): boolean {
  if (!DASHBOARD_PASSWORD) return true;
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return token === DASHBOARD_PASSWORD;
}

function rejectAuth(res: http.ServerResponse): void {
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized" }));
}

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

const IS_PM2 = !!(
  process.env.PM2_HOME ||
  process.env.pm_id !== undefined ||
  process.env.PM2_USAGE
);

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

class DashboardServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private startTime: number = Date.now();
  private currentConnection: Record<string, "CONNECTED" | "DISCONNECTED" | "CONNECTING"> = { primary: "DISCONNECTED", secondary: "DISCONNECTED" };
  private socks: Record<string, WASocket> = {};

  constructor() {
    const port = parseInt(process.env.PORT || "5000", 10);

    const httpServer = http.createServer((req, res) => {
      // Serve landing page at /
      if (req.url === "/") {
        const landingPath = path.join(__dirname, "../index.html");
        try {
          const html = fs.readFileSync(landingPath, "utf-8");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(html);
        } catch {
          // Fallback to health JSON if landing page missing
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
        }
        return;
      }

      if (req.url === "/health") {
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

      if (req.method === "OPTIONS" && req.url?.startsWith("/api/")) {
        setCorsHeaders(res);
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url?.startsWith("/api/")) {
        if (!checkAuth(req)) { rejectAuth(res); return; }
      }

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
            const tweetData = await fetchTweetContent(body.url);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(tweetData));
          } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "Failed to fetch tweet" }));
          }
        });
        return;
      }

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
            const sock = this.socks[accountId] || this.socks["primary"];
            if (!sock) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: `WhatsApp [${accountId}] is not connected.` }));
              return;
            }

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
                  if (cleanNumber) ownerJid = `${cleanNumber}@s.whatsapp.net`;
                }
              }
            } catch (e) {
              console.error("[send-to-sudo] Failed to read botinfo:", e);
            }

            if (!ownerJid) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Could not resolve owner JID from botinfo.json" }));
              return;
            }

            const base64Data = body.imageDataBase64.replace(/^data:image\/\w+;base64,/, "");
            const imageBuffer = Buffer.from(base64Data, "base64");
            await sock.sendMessage(ownerJid, {
              image: imageBuffer,
              caption: body.caption || "Saved X Card Preview"
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: err.message || "Failed to send to sudo" }));
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
            res.resume();
          })
          .on("error", (err) => {
            logger.warn({ err }, "Self-ping failed");
          });
      },
      10 * 60 * 1000,
    );
    console.log(`🔁 Self-ping keep-alive active → ${selfUrl}`);

    this.wss = new WebSocketServer({ server: httpServer });

    this.wss.on("connection", (ws, req) => {
      // If password is set, require auth via query param or first message
      if (DASHBOARD_PASSWORD) {
        const url = new URL(req.url || "/", `http://${req.headers.host}`);
        const qp = url.searchParams.get("password") || "";
        if (qp === DASHBOARD_PASSWORD) {
          (ws as any).authenticated = true;
        } else {
          (ws as any).authenticated = false;
          (ws as any).authTimeout = setTimeout(() => {
            if (!(ws as any).authenticated) {
              ws.close(4001, "Auth required");
            }
          }, 5000);
          const authHandler = (msg: any) => {
            try {
              const data = JSON.parse(msg.toString());
              if (data.type === "auth" && data.password === DASHBOARD_PASSWORD) {
                (ws as any).authenticated = true;
                clearTimeout((ws as any).authTimeout);
                ws.removeListener("message", authHandler);
                this.sendStatus();
                console.log("🖥️  Dashboard: Client authenticated");
              } else {
                ws.close(4001, "Auth required");
              }
            } catch {
              ws.close(4001, "Auth required");
            }
          };
          ws.on("message", authHandler);
        }
      }

      (ws as any).isAlive = true;
      this.clients.add(ws);
      console.log("🖥️  Dashboard: Frontend client connected");

      ws.on("pong", () => { (ws as any).isAlive = true; });

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

      this.sendStatus();
    });

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

  public setSock(accountId: string, sock: WASocket): void {
    this.socks[accountId] = sock;
  }
}

export const dashboard = new DashboardServer();
