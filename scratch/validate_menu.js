const fs = require('fs');
const botInfo = JSON.parse(fs.readFileSync('c:/Users/TADS/WORK/TADSTech/WXATA/botinfo.json', 'utf8'));
const menuCode = botInfo.scripts.menu.code;

const lines = menuCode.split('\n');
lines.forEach((line, i) => console.log(`${i + 1}: ${line}`));

try {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    new AsyncFunction('sock', 'msg', 'botInfo', 'remoteJid', 'argumentName', 'sendTrackedMessage', 'dashboard', 'require', '__rootdir', menuCode);
    console.log("Syntax OK");
} catch (e) {
    console.error("Syntax Error:", e.message);
}
