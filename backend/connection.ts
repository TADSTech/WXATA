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

// Configuration constants
const AUTH_DIR = path.resolve(__dirname, 'auth_info');
const RECONNECT_INTERVALS = [5000, 15000, 30000, 60000]; // Exponential backoff

interface ConnectionOptions {
  phoneNumber?: string;
  usePairingCode?: boolean;
  onQR?: (qr: string) => void;
  onPairingCode?: (code: string) => void;
  onOpen?: () => void;
  onLogout?: () => void;
}

export class WXATAConnection {
  private sock: WASocket | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;

  constructor(private options: ConnectionOptions) {}

  /**
   * Initialize the connection with robust state handling
   */
  public async createConnection(): Promise<WASocket> {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    dashboard.setConnectionStatus('CONNECTING');

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
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 15000,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      // Fix for Bun's websocket implementation
      patchMessageBeforeSending: (message) => {
        return message;
      },
    });

    // Handle Pairing Code
    if (this.options.usePairingCode && !this.sock.authState.creds.registered && this.options.phoneNumber) {
      const phoneNumber = this.options.phoneNumber;
      this.sock.ev.on('connection.update', async (update) => {
        if (update.qr && this.sock && !this.sock.authState.creds.registered) {
          try {
            const code = await this.sock.requestPairingCode(phoneNumber.replace(/\D/g, ''));
            if (this.options.onPairingCode) this.options.onPairingCode(code);
            dashboard.log('SUCCESS', `Pairing code generated for ${phoneNumber}`);
          } catch (err) {
            logger.error({ err }, 'Failed to request pairing code');
            dashboard.log('ERROR', 'Failed to generate pairing code');
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
        dashboard.setConnectionStatus('DISCONNECTED');
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const reason = lastDisconnect?.error;

        console.log(`Connection closed. Reason: ${statusCode} (${reason})`);
        dashboard.log('ERROR', `Connection closed: ${statusCode}`);

        if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
          logger.warn(`Auth failure (${statusCode}). Clearing session and restarting clean...`);
          dashboard.log('WARN', 'Auth failure. Resetting session...');
          await this.clearSession();
          this.reconnectAttempts = 0; // Reset backoff
          if (this.options.onLogout) this.options.onLogout();
          setTimeout(() => this.createConnection(), 2000);
        } else {
          this.handleReconnect();
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        dashboard.setConnectionStatus('CONNECTED');
        console.log('\n----------------------------------------');
        console.log('🟢 WXATA: Protocol connection established');
        console.log('----------------------------------------\n');
        dashboard.log('SUCCESS', 'WhatsApp Protocol connection established');
        if (this.options.onOpen) this.options.onOpen();
      }
    });

    // Handle History Sync (to keep logs clean)
    this.sock.ev.on('messaging-history.set', ({ isLatest }) => {
      const msg = `Syncing chat history (isLatest: ${isLatest})...`;
      console.log(`📡 WXATA: ${msg}`);
      dashboard.log('DEBUG', msg);
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
  private async clearSession() {
    try {
      await fs.rm(AUTH_DIR, { recursive: true, force: true });
      logger.info('Session data wiped successfully');
    } catch (err) {
      logger.error({ err }, 'Failed to wipe session data');
    }
  }

  public getSocket() {
    return this.sock;
  }
}
