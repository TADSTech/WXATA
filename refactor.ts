import fs from 'fs';
import path from 'path';

const indexPath = path.resolve(__dirname, 'backend/index.ts');
let content = fs.readFileSync(indexPath, 'utf-8');

// 1. DATA_DIR logic
content = content.replace(
  /const DATA_DIR = [^;]+;/,
  `const DATA_DIR = require("fs").existsSync("/data") ? "/data" : path.resolve(__dirname, "..");
function getAccountDir(accountId: string) {
  const dir = path.resolve(DATA_DIR, accountId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}`
);

// Remove BOT_INFO_PATH
content = content.replace(/const BOT_INFO_PATH = path\.resolve\(DATA_DIR, "botinfo\.json"\);\n/, '');

// 2. ensureConfigFiles
content = content.replace(
  /async function ensureConfigFiles\(\) \{/,
  `async function ensureConfigFiles(accountId: string) {
  const dir = getAccountDir(accountId);`
);
content = content.replace(/const dir = DATA_DIR;/g, '');

// 3. readBotInfo / updateBotInfo
content = content.replace(
  /async function readBotInfo\(\): Promise<BotInfo> \{/g,
  `async function readBotInfo(accountId: string): Promise<BotInfo> {\n  const BOT_INFO_PATH = path.resolve(getAccountDir(accountId), 'botinfo.json');`
);
content = content.replace(
  /async function updateBotInfo\(patch: Partial<BotInfo>\): Promise<BotInfo> \{/g,
  `async function updateBotInfo(accountId: string, patch: Partial<BotInfo>): Promise<BotInfo> {\n  const BOT_INFO_PATH = path.resolve(getAccountDir(accountId), 'botinfo.json');`
);
content = content.replace(/await readBotInfo\(\)/g, 'await readBotInfo(accountId)');
content = content.replace(/updateBotInfo\(\{/g, 'updateBotInfo(accountId, {');
content = content.replace(/updateBotInfo\(parsed\)/g, 'updateBotInfo(accountId, parsed)');

// 4. attachMessageHandler
content = content.replace(
  /async function attachMessageHandler\(\n  sock: WASocket,\n  resetWatchdog: \(\) => void,\n\) \{/,
  `async function attachMessageHandler(
  sock: WASocket,
  accountId: string,
  resetWatchdog: () => void,
) {`
);

// 5. dashboard.log
// The regex here is tricky because we need to insert accountId as first argument.
content = content.replace(/dashboard\.log\(/g, 'dashboard.log(accountId, ');
// Wait, dashboard.setConnectionStatus in index.ts
content = content.replace(/dashboard\.setConnectionStatus\(/g, 'dashboard.setConnectionStatus(accountId, ');
content = content.replace(/dashboard\.sendQR\(/g, 'dashboard.sendQR(accountId, ');
content = content.replace(/dashboard\.sendPairingCode\(/g, 'dashboard.sendPairingCode(accountId, ');

// 6. fix dashboard.log(accountId, in startBot where accountId is not defined globally.
// In startBot, we will manage two accounts. So we'll pass accountId around.

fs.writeFileSync(indexPath, content, 'utf-8');
console.log("Refactor script complete!");
