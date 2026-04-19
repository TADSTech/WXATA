import { WXATAConnection } from './connection';
// @ts-ignore
import * as qrcode from 'qrcode-terminal';
import { dashboard } from './DashboardServer';

function attachMessageHandler(sock: Awaited<ReturnType<WXATAConnection['createConnection']>>) {
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (msg && !msg.key?.fromMe && m.type === 'notify') {
      const remoteJid = msg.key?.remoteJid;
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

      if (text?.toLowerCase() === 'ping' && remoteJid) {
        await sock.sendMessage(remoteJid, { text: 'pong 🟢' });
        dashboard.log('SUCCESS', `Auto-reply [pong] sent to ${remoteJid}`);
      }

      const logMsg = `From: ${remoteJid} | Text: ${text}`;
      console.log(`[MSG] ${logMsg}`);
      dashboard.log('MSG', logMsg);
    }
  });
}

async function startBot() {
  dashboard.log('INFO', 'Initializing WXATA Backend System...');
  console.log('🚀 Initializing WXATA Backend...');

  let connectionManager: WXATAConnection | null = null;

  // Listen for commands from the dashboard
  dashboard.onCommand(async (payload) => {
    try {
      if (payload.command === 'START_CONNECTION') {
        const { method, phoneNumber } = payload.data;

        dashboard.log('INFO', `Starting connection via ${method}...`);

        connectionManager = new WXATAConnection({
          phoneNumber,
          usePairingCode: method === 'PHONE',
          onQR: (qr) => {
            dashboard.sendQR(qr);
            qrcode.generate(qr, { small: true });
          },
          onPairingCode: (code) => {
            dashboard.sendPairingCode(code);
          },
          onOpen: () => {
            dashboard.log('SUCCESS', 'Bot is now fully operational');
          }
        });

        const sock = await connectionManager.createConnection();
        attachMessageHandler(sock);
      }

      if (payload.command === 'QUICK_ACTION') {
        const { action } = payload.data;
        dashboard.log('WARN', `Executing Quick Action: ${action}`);

        switch (action) {
          case 'RESTART_BOT':
            dashboard.log('INFO', 'Restarting bot system...');
            process.exit(0); // PM2 or a wrapper script should handle restart
            break;
          case 'TERMINATE':
            dashboard.log('ERROR', 'Terminating bot system...');
            process.exit(1);
            break;
          case 'EXPORT_DATA':
            dashboard.log('INFO', 'Exporting session logs...');
            // Logic for export could go here
            break;
        }
      }
    } catch (err) {
      console.error('Dashboard command failed', err);
      dashboard.log('ERROR', 'Failed to execute dashboard command');
      dashboard.setConnectionStatus('DISCONNECTED');
    }
  });

  dashboard.setConnectionStatus('DISCONNECTED');
  dashboard.log('INFO', 'Backend ready. Waiting for START_CONNECTION command from dashboard.');
}

startBot().catch((err) => {
  console.error('CRITICAL: Failed to start WXATA system', err);
});
