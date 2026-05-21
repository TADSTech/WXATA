import fs from 'fs/promises';
import path from 'path';

async function fix() {
  const file = path.resolve(__dirname, 'backend/index.ts');
  let content = await fs.readFile(file, 'utf-8');

  // Fix fs imports
  content = content.replace(/require\("fs"\)\.existsSync/g, 'require("fs").existsSync');
  content = content.replace(/fs\.existsSync/g, 'require("fs").existsSync');
  content = content.replace(/fs\.mkdirSync/g, 'require("fs").mkdirSync');
  
  // Create a proper startBot function block replacement
  const startBotStartIdx = content.indexOf('async function startBot() {');
  if (startBotStartIdx === -1) throw new Error("Could not find startBot");
  
  const startBotEndIdx = content.indexOf('startBot().catch(', startBotStartIdx);
  
  const newStartBot = `
const connectionManagers = new Map<string, WXATAConnection>();
const lastConnectionParamsMap = new Map<string, { method: string; phoneNumber?: string }>();
const lastMessageAtMap = new Map<string, number>();

async function startBot() {
  await validateLicense();
  console.log("🚀 Initializing WXATA Backend for Dual Accounts...");
  
  await ensureConfigFiles("primary");
  await ensureConfigFiles("secondary");

  // Start the watchdog
  const WATCHDOG_TIMEOUT_MS = 4 * 60 * 1000;
  setInterval(async () => {
    for (const accountId of ["primary", "secondary"]) {
      const connectionManager = connectionManagers.get(accountId);
      const lastConnectionParams = lastConnectionParamsMap.get(accountId);
      
      if (!connectionManager || !lastConnectionParams) continue;
      const sock = connectionManager.getSocket();
      if (!sock) continue;

      const lastMessageAt = lastMessageAtMap.get(accountId) || Date.now();
      const silentMs = Date.now() - lastMessageAt;
      
      if (silentMs > WATCHDOG_TIMEOUT_MS) {
        dashboard.log(accountId, "WARN", \`Watchdog: No messages for \${Math.round(silentMs / 1000)}s — force reconnecting...\`);
        console.log(\`🔁 Watchdog triggered after \${Math.round(silentMs / 1000)}s silence for \${accountId} — reconnecting\`);
        lastMessageAtMap.set(accountId, Date.now());

        try {
          await connectionManager.destroy();
          const newManager = new WXATAConnection({
            accountId: accountId as "primary"|"secondary",
            phoneNumber: lastConnectionParams.phoneNumber,
            usePairingCode: lastConnectionParams.method === "PHONE",
            onQR: (qr) => { dashboard.sendQR(accountId, qr); qrcode.generate(qr, { small: true }); },
            onPairingCode: (code) => { dashboard.sendPairingCode(accountId, code); },
            onSocketCreated: (sock) => { dashboard.setSock(accountId, sock); attachMessageHandler(sock, accountId, () => lastMessageAtMap.set(accountId, Date.now())); },
            onOpen: () => { dashboard.log(accountId, "SUCCESS", "Watchdog reconnect successful"); },
            onLogout: () => { dashboard.log(accountId, "WARN", "Session expired during watchdog reconnect"); }
          });
          connectionManagers.set(accountId, newManager);
          await newManager.createConnection();
        } catch (err) {
          dashboard.log(accountId, "ERROR", \`Watchdog reconnect failed: \${err}\`);
        }
      }
    }
  }, 60_000);

  dashboard.onCommand(async (payload) => {
    try {
      const accountId = payload.data?.accountId || "primary";
      
      if (payload.command === "START_CONNECTION") {
        const { method, phoneNumber } = payload.data;
        lastConnectionParamsMap.set(accountId, { method, phoneNumber });

        dashboard.log(accountId, "INFO", \`Starting connection via \${method}...\`);
        let connectionManager = connectionManagers.get(accountId);
        if (connectionManager) {
          await connectionManager.destroy();
        }

        connectionManager = new WXATAConnection({
          accountId: accountId as "primary"|"secondary",
          phoneNumber,
          usePairingCode: method === "PHONE",
          onQR: (qr) => { dashboard.sendQR(accountId, qr); qrcode.generate(qr, { small: true }); },
          onPairingCode: (code) => { dashboard.sendPairingCode(accountId, code); },
          onSocketCreated: (sock) => { dashboard.setSock(accountId, sock); attachMessageHandler(sock, accountId, () => lastMessageAtMap.set(accountId, Date.now())); },
          onOpen: () => { dashboard.log(accountId, "SUCCESS", "Bot is now fully operational"); }
        });
        
        connectionManagers.set(accountId, connectionManager);
        await connectionManager.createConnection();
      }

      if (payload.command === "GET_BOT_INFO") {
        const botInfo = await readBotInfo(accountId);
        // Note: frontend should filter based on its active accountId
        dashboard.broadcast({ event: "bot-info", accountId, data: botInfo });
      }

      if (payload.command === "UPDATE_BOT_INFO") {
        const updated = await updateBotInfo(accountId, payload.data ?? {});
        dashboard.broadcast({ event: "bot-info", accountId, data: updated });
        dashboard.log(accountId, "SUCCESS", "Bot script configuration updated");
      }

      if (payload.command === "QUICK_ACTION") {
        const { action } = payload.data;
        dashboard.log(accountId, "WARN", \`Executing Quick Action: \${action}\`);

        let connectionManager = connectionManagers.get(accountId);
        switch (action) {
          case "RESTART_BOT":
            dashboard.log(accountId, "INFO", "Restarting bot process via PM2...");
            if (connectionManager) { await connectionManager.destroy(); connectionManagers.delete(accountId); }
            dashboard.setConnectionStatus(accountId, "DISCONNECTED");
            dashboard.log(accountId, "SUCCESS", "Graceful shutdown complete. PM2 will restart the process.");
            setTimeout(() => process.exit(0), 500);
            break;
          case "TERMINATE":
            dashboard.log(accountId, "WARN", "Terminating bot process and clearing session...");
            if (connectionManager) {
              await connectionManager.logout();
              await connectionManager.destroy();
              connectionManagers.delete(accountId);
            }
            dashboard.setConnectionStatus(accountId, "DISCONNECTED");
            setTimeout(() => process.exit(2), 500);
            break;
          case "LOGOUT":
            dashboard.log(accountId, "WARN", "Logging out and clearing session data...");
            if (connectionManager) {
              await connectionManager.logout();
              await connectionManager.destroy();
              connectionManagers.delete(accountId);
            }
            dashboard.setConnectionStatus(accountId, "DISCONNECTED");
            dashboard.log(accountId, "SUCCESS", "Session cleared. System ready for new pairing.");
            break;
        }
      }
    } catch (err) {
      console.error("Dashboard command failed", err);
    }
  });
}
`;

  content = content.substring(0, startBotStartIdx) + newStartBot + content.substring(startBotEndIdx);

  await fs.writeFile(file, content, 'utf-8');
}

fix().catch(console.error);
