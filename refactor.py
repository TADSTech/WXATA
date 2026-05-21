import re
import os

filepath = 'backend/index.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update DATA_DIR
content = re.sub(
    r'const DATA_DIR = [^;]+;',
    r'const DATA_DIR = require("fs").existsSync("/data") ? "/data" : path.resolve(__dirname, "..");\nfunction getAccountDir(accountId: string) { const dir = path.resolve(DATA_DIR, accountId); if (!require("fs").existsSync(dir)) require("fs").mkdirSync(dir, { recursive: true }); return dir; }\n',
    content
)

# 2. Remove BOT_INFO_PATH
content = re.sub(r'const BOT_INFO_PATH = [^;]+;\n', '', content)

# 3. ensureConfigFiles
content = re.sub(r'async function ensureConfigFiles\(\) \{', r'async function ensureConfigFiles(accountId: string) {', content)
content = re.sub(r'const dir = DATA_DIR;', r'const dir = getAccountDir(accountId);', content)
content = re.sub(r'await fs\.access\(BOT_INFO_PATH\);', r'const botInfoPath = path.resolve(dir, "botinfo.json");\n    await fs.access(botInfoPath);', content)
content = re.sub(r'await fs\.writeFile\(BOT_INFO_PATH,', r'await fs.writeFile(botInfoPath,', content)

# 4. readBotInfo and updateBotInfo
content = re.sub(r'async function readBotInfo\(\): Promise<BotInfo> \{', r'async function readBotInfo(accountId: string): Promise<BotInfo> {\n  const BOT_INFO_PATH = path.resolve(getAccountDir(accountId), "botinfo.json");', content)
content = re.sub(r'async function updateBotInfo\(patch: Partial<BotInfo>\): Promise<BotInfo> \{', r'async function updateBotInfo(accountId: string, patch: Partial<BotInfo>): Promise<BotInfo> {\n  const BOT_INFO_PATH = path.resolve(getAccountDir(accountId), "botinfo.json");', content)
content = re.sub(r'await readBotInfo\(\)', r'await readBotInfo(accountId)', content)
content = re.sub(r'updateBotInfo\(\{', r'updateBotInfo(accountId, {', content)
content = re.sub(r'updateBotInfo\(parsed\)', r'updateBotInfo(accountId, parsed)', content)

# 5. attachMessageHandler
content = re.sub(
    r'function attachMessageHandler\(\s*sock: Awaited<ReturnType<WXATAConnection\["createConnection"\]>>,\s*onMessage\?: \(\) => void,\s*\) \{',
    r'function attachMessageHandler(sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>, accountId: string, onMessage?: () => void) {',
    content
)

# 6. dashboard calls
def dashboard_repl(m):
    return f'dashboard.{m.group(1)}(accountId, '

content = re.sub(r'dashboard\.(log|setConnectionStatus|sendQR|sendPairingCode)\(', dashboard_repl, content)

# 7. __rootdir in attachMessageHandler
content = re.sub(r'const __rootdir = DATA_DIR;', r'const __rootdir = getAccountDir(accountId);', content)

# sendWelcomeMessage fix
content = re.sub(
    r'async function sendWelcomeMessage\(\s*sock: Awaited<ReturnType<WXATAConnection\["createConnection"\]>>,\s*\) \{',
    r'async function sendWelcomeMessage(sock: Awaited<ReturnType<WXATAConnection["createConnection"]>>, accountId: string) {',
    content
)

# 8. StartBot Replacement
start_bot_pattern = r'async function startBot\(\) \{.*?(?=// ── Global error handlers)'
new_start_bot = """
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
        dashboard.log(accountId, "WARN", `Watchdog: No messages for ${Math.round(silentMs / 1000)}s — force reconnecting...`);
        console.log(`🔁 Watchdog triggered after ${Math.round(silentMs / 1000)}s silence for ${accountId} — reconnecting`);
        lastMessageAtMap.set(accountId, Date.now());

        try {
          await connectionManager.destroy();
          const newManager = new WXATAConnection({
            accountId: accountId as "primary"|"secondary",
            phoneNumber: lastConnectionParams.phoneNumber,
            usePairingCode: lastConnectionParams.method === "PHONE",
            onQR: (qr) => { dashboard.sendQR(accountId, qr); require('qrcode-terminal').generate(qr, { small: true }); },
            onPairingCode: (code) => { dashboard.sendPairingCode(accountId, code); },
            onSocketCreated: (sock) => { dashboard.setSock(accountId, sock); attachMessageHandler(sock, accountId, () => lastMessageAtMap.set(accountId, Date.now())); },
            onOpen: () => { dashboard.log(accountId, "SUCCESS", "Watchdog reconnect successful"); },
            onLogout: () => { dashboard.log(accountId, "WARN", "Session expired during watchdog reconnect"); }
          });
          connectionManagers.set(accountId, newManager);
          await newManager.createConnection();
        } catch (err) {
          dashboard.log(accountId, "ERROR", `Watchdog reconnect failed: ${err}`);
        }
      }
    }
  }, 60_000);

  dashboard.onCommand(async (payload) => {
    try {
      const accountId = payload.accountId || "primary";
      
      if (payload.command === "START_CONNECTION") {
        const { method, phoneNumber } = payload.data;
        lastConnectionParamsMap.set(accountId, { method, phoneNumber });

        dashboard.log(accountId, "INFO", `Starting connection via ${method}...`);
        let connectionManager = connectionManagers.get(accountId);
        if (connectionManager) {
          await connectionManager.destroy();
        }

        connectionManager = new WXATAConnection({
          accountId: accountId as "primary"|"secondary",
          phoneNumber,
          usePairingCode: method === "PHONE",
          onQR: (qr) => { dashboard.sendQR(accountId, qr); require('qrcode-terminal').generate(qr, { small: true }); },
          onPairingCode: (code) => { dashboard.sendPairingCode(accountId, code); },
          onSocketCreated: (sock) => { dashboard.setSock(accountId, sock); attachMessageHandler(sock, accountId, () => lastMessageAtMap.set(accountId, Date.now())); },
          onOpen: () => { 
            dashboard.log(accountId, "SUCCESS", "Bot is now fully operational"); 
            setTimeout(() => {
                const socketForWelcome = connectionManager?.getSocket();
                if (socketForWelcome) {
                    sendWelcomeMessage(socketForWelcome, accountId).catch(err => {
                        console.error("Failed to send welcome message", err);
                        dashboard.log(accountId, "ERROR", "Failed to send welcome message");
                    });
                }
            }, 15000);
          }
        });
        
        connectionManagers.set(accountId, connectionManager);
        await connectionManager.createConnection();
      }

      if (payload.command === "GET_BOT_INFO") {
        const botInfo = await readBotInfo(accountId);
        dashboard.broadcast({ event: "bot-info", accountId, data: botInfo });
      }

      if (payload.command === "UPDATE_BOT_INFO") {
        const updated = await updateBotInfo(accountId, payload.data ?? {});
        dashboard.broadcast({ event: "bot-info", accountId, data: updated });
        dashboard.log(accountId, "SUCCESS", "Bot script configuration updated");
      }

      if (payload.command === "QUICK_ACTION") {
        const { action } = payload.data;
        dashboard.log(accountId, "WARN", `Executing Quick Action: ${action}`);

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

startBot().catch((err) => {
  console.error("CRITICAL: Failed to start WXATA system", err);
});

"""

content = re.sub(start_bot_pattern, new_start_bot, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("done")
