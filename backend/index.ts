import makeWASocket, { 
    DisconnectReason, 
    useMultiFileAuthState, 
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
// @ts-ignore
import * as qrcode from 'qrcode-terminal';
import path from 'path';

// Set up logger
const logger = pino({ level: 'info' });

async function connectToWhatsApp() {
    // 1. Setup Authentication
    // This will save the session in the 'auth_info' folder
    const authPath = path.resolve(__dirname, 'auth_info');
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    
    // 2. Fetch Latest Baileys Version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WhatsApp Web v${version.join('.')}, isLatest: ${isLatest}`);

    // 3. Create Socket Connection
    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            /** caching makes the store faster to send/receive messages */
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: true,
        logger,
        browser: ['WXATA', 'Safari', '3.0'],
    });

    // 4. Handle Connection Updates
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('--- SCAN QR CODE BELOW ---');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            
            // Reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp();
            } else {
                console.log('Logged out. Please delete auth_info folder and scan again.');
            }
        } else if (connection === 'open') {
            console.log('🟢 WXATA: Connection successfully opened!');
        }
    });

    // 5. Handle Credential Updates (Crucial for session persistence)
    sock.ev.on('creds.update', saveCreds);

    // 6. Basic Message Handler (Placeholder for Command System)
    sock.ev.on('messages.upsert', async m => {
        console.log(JSON.stringify(m, undefined, 2));

        const msg = m.messages[0];
        if (msg && !msg.key.fromMe && m.type === 'notify') {
            const remoteJid = msg.key.remoteJid;
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

            if (text?.toLowerCase() === 'ping') {
                await sock.sendMessage(remoteJid!, { text: 'pong 🟢' });
            }
        }
    });

    return sock;
}

// Start the bot
console.log('🚀 Initializing WXATA Backend...');
connectToWhatsApp().catch(err => console.error('Unexpected error:', err));
