import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type Contact,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import fs from 'fs/promises';
import { dashboard } from './DashboardServer';

/**
 * WXATA Connection Manager
 * Implements stability patterns for Baileys/WhatsApp Protocol
 */

const logger = pino({ level: 'warn' });

import fsSync from 'fs';

const RECONNECT_INTERVALS = [5000, 15000, 30000, 60000]; // Exponential backoff

interface ConnectionOptions {
  accountId: "primary" | "secondary";
  phoneNumber?: string;
  usePairingCode?: boolean;
  onQR?: (qr: string) => void;
  onPairingCode?: (code: string) => void;
  onOpen?: () => void;
  onLogout?: () => void;
  onSocketCreated?: (sock: WASocket) => void;
}

export class WXATAConnection {
  private sock: WASocket | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private isShuttingDown = false;

  constructor(private options: ConnectionOptions) {}

  public get accountId() {
    return this.options.accountId;
  }

  private getAuthDir() {
    return fsSync.existsSync('/data')
      ? `/data/auth_info_${this.options.accountId}`
      : path.resolve(__dirname, `auth_info_${this.options.accountId}`);
  }

  /**
   * Initialize the connection with robust state handling
   */
  public async createConnection(): Promise<WASocket> {
    const authDir = this.getAuthDir();
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    dashboard.setConnectionStatus(this.options.accountId, 'CONNECTING');

    this.sock = makeWASocket({
      version,
      printQRInTerminal: false,
      mobile: false,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      // Fingerprinting: Use a more stable, standard browser string
      browser: ['Mac OS', 'Chrome', '121.0.0.0'],
      connectTimeoutMs: 120000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 15000,    // more frequent pings to detect stalls earlier
      retryRequestDelayMs: 250,      // faster retry on failed requests
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,

      // Ignore status broadcasts entirely — they flood the buffer with
      // undecryptable group-cipher messages causing "Buffer timeout reached"
      // stalls that freeze normal message processing.
      shouldIgnoreJid: (jid) => {
        return jid === 'status@broadcast' || jid?.endsWith('@broadcast');
      },

      // Fix for Bun's websocket implementation
      patchMessageBeforeSending: (message) => {
        return message;
      },
      // Return empty message for unknown keys so Baileys doesn't stall
      // waiting for a retry that will never come.
      getMessage: async (_key) => {
        return { conversation: '' };
      },
    });

    if (this.options.onSocketCreated) {
      this.options.onSocketCreated(this.sock);
    }

    // Handle Pairing Code
    if (this.options.usePairingCode && !this.sock.authState.creds.registered && this.options.phoneNumber) {
      const phoneNumber = this.options.phoneNumber;
      this.sock.ev.on('connection.update', async (update) => {
        if (update.qr && this.sock && !this.sock.authState.creds.registered) {
          try {
            const code = await this.sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
            if (this.options.onPairingCode) this.options.onPairingCode(code);
            dashboard.log(this.options.accountId, 'SUCCESS', `Pairing code generated for ${phoneNumber}`);
          } catch (err) {
            logger.error({ err }, 'Failed to request pairing code');
            dashboard.log(this.options.accountId, 'ERROR', 'Failed to generate pairing code');
          }
        }
      });
    }

    // Connection events
    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !this.options.usePairingCode && this.options.onQR) {
        this.options.onQR(qr);
      }

      if (connection === 'close') {
        this.isConnected = false;
        dashboard.setConnectionStatus(this.options.accountId, 'DISCONNECTED');
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const reason = lastDisconnect?.error;

        console.log(`[${this.options.accountId.toUpperCase()}] Connection closed. Reason: ${statusCode} (${reason})`);
        dashboard.log(this.options.accountId, 'ERROR', `Connection closed: ${statusCode}`);

        if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 428) {
          logger.warn(`Auth failure (${statusCode}). Clearing session and stopping — manual re-pair required.`);
          dashboard.log(this.options.accountId, 'WARN', `Auth failure (${statusCode}). Session cleared. Please re-pair from the dashboard.`);
          await this.clearSession();
          this.reconnectAttempts = 0;
          if (this.options.onLogout) this.options.onLogout();
          // Do NOT reconnect — credentials are gone. The dashboard must issue a new START_CONNECTION.
        } else if (statusCode === DisconnectReason.connectionReplaced || statusCode === 440) {
          logger.error('Connection replaced by another session. Stopping reconnects to prevent conflict loops.');
          dashboard.log(this.options.accountId, 'ERROR', 'Session taken over by another instance. Please restart the container if this is unexpected.');
          // Do not automatically reconnect on 440. This allows PaaS rolling-deployments to cleanly transition
          // by letting the old container die instead of fighting the new container for the session.
        } else {
          // Make sure to clean up the old socket before reconnecting to prevent memory leaks and zombie listeners
          try { this.sock?.ws?.close(); } catch {}
          this.sock?.ev.removeAllListeners('connection.update');
          this.sock?.ev.removeAllListeners('creds.update');
          if (!this.isShuttingDown) {
            this.handleReconnect();
          }
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        dashboard.setConnectionStatus(this.options.accountId, 'CONNECTED');
        console.log('\n----------------------------------------');
        console.log(`🟢 WXATA: Protocol connection established (${this.options.accountId.toUpperCase()})`);
        console.log('----------------------------------------\n');
        dashboard.log(this.options.accountId, 'SUCCESS', 'WhatsApp Protocol connection established');
        if (this.options.onOpen) this.options.onOpen();
      }
    });

    // Handle History Sync
    this.sock.ev.on('messaging-history.set', ({ isLatest }) => {
      const msg = `Syncing chat history (isLatest: ${isLatest}). Please wait...`;
      console.log(`📡 WXATA (${this.options.accountId.toUpperCase()}): ${msg}`);
      dashboard.log(this.options.accountId, 'INFO', msg);
      if (isLatest) {
        dashboard.log(this.options.accountId, 'SUCCESS', 'Initial history sync completed! Bot is ready to receive commands.');
      }
    });

    // Atomic credential updates
    this.sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
      } catch (err) {
        logger.error({ err }, 'Failed to save credentials atomically');
      }
    });

    return this.sock;
  }

  /**
   * Exponential backoff reconnection logic
   */
  private handleReconnect() {
    const delay = RECONNECT_INTERVALS[Math.min(this.reconnectAttempts, RECONNECT_INTERVALS.length - 1)] ?? 60000;
    this.reconnectAttempts++;
    
    logger.info(`Reconnecting in ${delay / 1000}s (Attempt ${this.reconnectAttempts})...`);
    setTimeout(() => this.createConnection(), delay);
  }

  /**
   * Cleanly wipe session data to prevent corruption loops
   */
  public async clearSession() {
    try {
      const authDir = this.getAuthDir();
      await fs.rm(authDir, { recursive: true, force: true });
      logger.info(`Session data wiped successfully for ${this.options.accountId}`);
    } catch (err) {
      logger.error({ err }, `Failed to wipe session data for ${this.options.accountId}`);
    }
  }

  public getSocket() {
    return this.sock;
  }

  /**
   * Explicitly logout and clear session data
   */
  public async logout() {
    try {
      if (this.sock) {
        await this.sock.logout();
      }
    } catch (err) {
      logger.error({ err }, 'Error during socket logout');
    } finally {
      await this.clearSession();
    }
  }

  /**
   * Completely shut down the connection and prevent reconnects
   */
  public async destroy() {
    this.isShuttingDown = true;
    try {
      if (this.sock) {
        this.sock.ev.removeAllListeners('connection.update');
        this.sock.ev.removeAllListeners('creds.update');
        this.sock.ev.removeAllListeners('messaging-history.set');
        this.sock.ws.close();
      }
    } catch (err) {
      logger.error({ err }, 'Error during socket destruction');
    }
  }
}
