import re

filepath = 'frontend/src/pages/Dashboard.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add selectedAccountId state
state_pattern = r"  const \[botStatus, setBotStatus\] = useState\(\{ connection: 'DISCONNECTED', uptime: '00h 00m 00s', memory: '0MB / 512MB' \}\);"
state_replacement = """  const [selectedAccountId, setSelectedAccountId] = useState<'primary' | 'secondary'>('primary');
  const [botStatus, setBotStatus] = useState({ connection: 'DISCONNECTED', uptime: '00h 00m 00s', memory: '0MB / 512MB' });"""
content = re.sub(state_pattern, state_replacement, content)

# 2. Add GET_BOT_INFO trigger on account change
get_bot_info_pattern = r"  // ── Send GET_BOT_INFO on connect ────────────────────────────────────────────\n  useEffect\(\(\) => \{\n    if \(isAuthenticated && wsStatus === 'connected'\) \{\n      send\(\{ command: 'GET_BOT_INFO' \}\);\n    \}\n  \}, \[isAuthenticated, wsStatus, send\]\);"
get_bot_info_replacement = """  // ── Send GET_BOT_INFO on connect & account switch ─────────────────────────────
  useEffect(() => {
    if (isAuthenticated && wsStatus === 'connected') {
      setLogs([]);
      setQrData(null);
      setPairingCode(null);
      setBotInfo(DEFAULT_BOT_INFO);
      send({ command: 'GET_BOT_INFO', accountId: selectedAccountId });
    }
  }, [isAuthenticated, wsStatus, send, selectedAccountId]);"""
content = re.sub(get_bot_info_pattern, get_bot_info_replacement, content)

# 3. Update lastMessage handler to filter by accountId
last_message_pattern = r"  // ── Route lastMessage by event field ────────────────────────────────────────\n  useEffect\(\(\) => \{\n    if \(!lastMessage \|\| typeof lastMessage !== 'object'\) return;\n    const msg = lastMessage as Record<string, unknown>;\n    const event = msg\.event as string;\n    const data = msg\.data;\n\n    if \(event === 'status' && data && typeof data === 'object'\) \{\n      const s = data as Record<string, unknown>;\n      setBotStatus\(\{\n        connection: \(s\.connection as string\) \?\? 'DISCONNECTED',\n        uptime: \(s\.uptime as string\) \?\? '00h 00m 00s',\n        memory: \(s\.memory as string\) \?\? '0MB / 512MB',\n      \}\);\n      if \(s\.connection === 'CONNECTED'\) \{\n        setAuthMethod\('NONE'\);\n        setQrData\(null\);\n        setPairingCode\(null\);\n        setIsConnecting\(false\);\n      \}\n    \} else if \(event === 'log' && data && typeof data === 'object'\) \{\n      const l = data as Record<string, unknown>;\n      const entry: LogEntry = \{\n        timestamp: \(l\.timestamp as string\) \?\? '',\n        type: \(l\.type as string\) \?\? 'INFO',\n        message: \(l\.message as string\) \?\? '',\n      \};\n      setLogs\(prev => \[\.\.\.prev, entry\]\.slice\(-50\)\);\n    \} else if \(event === 'qr'\) \{\n      setQrData\(data as string\);\n      setIsConnecting\(false\);\n    \} else if \(event === 'pairing-code'\) \{\n      setPairingCode\(data as string\);\n      setIsConnecting\(false\);\n    \} else if \(event === 'bot-info' && data\) \{\n      setBotInfo\(data as BotInfo\);\n      setConfigStatus\('Config synced'\);\n      addToast\('Config synced', 'success'\);\n    \}\n  \}, \[lastMessage, addToast\]\);"

last_message_replacement = """  // ── Route lastMessage by event field ────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage || typeof lastMessage !== 'object') return;
    const msg = lastMessage as Record<string, unknown>;
    const event = msg.event as string;
    const data = msg.data;
    const msgAccountId = msg.accountId as string | undefined;

    if (event === 'status' && data && typeof data === 'object') {
      const s = data as Record<string, unknown>;
      const connections = s.connection as Record<string, string>;
      const conn = connections?.[selectedAccountId] ?? 'DISCONNECTED';
      setBotStatus({
        connection: conn,
        uptime: (s.uptime as string) ?? '00h 00m 00s',
        memory: (s.memory as string) ?? '0MB / 512MB',
      });
      if (conn === 'CONNECTED') {
        setAuthMethod('NONE');
        setQrData(null);
        setPairingCode(null);
        setIsConnecting(false);
      }
    } else {
      // For all other events, filter by selectedAccountId
      if (msgAccountId && msgAccountId !== selectedAccountId) return;

      if (event === 'log' && data && typeof data === 'object') {
        const l = data as Record<string, unknown>;
        const entry: LogEntry = {
          timestamp: (l.timestamp as string) ?? '',
          type: (l.type as string) ?? 'INFO',
          message: (l.message as string) ?? '',
        };
        setLogs(prev => [...prev, entry].slice(-50));
      } else if (event === 'qr') {
        setQrData(data as string);
        setIsConnecting(false);
      } else if (event === 'pairing-code') {
        setPairingCode(data as string);
        setIsConnecting(false);
      } else if (event === 'bot-info' && data) {
        setBotInfo(data as BotInfo);
        setConfigStatus('Config synced');
        addToast('Config synced', 'success');
      }
    }
  }, [lastMessage, addToast, selectedAccountId]);"""
content = re.sub(last_message_pattern, last_message_replacement, content)

# 4. Update sendCommand and startConnection
send_command_pattern = r"    send\(\{ command, data \}\);"
send_command_replacement = r"    send({ command, data, accountId: selectedAccountId });"
content = re.sub(send_command_pattern, send_command_replacement, content)

start_connection_pattern = r"    send\(\{\n      command: 'START_CONNECTION',\n      data: \{ method, phoneNumber: method === 'PHONE' \? phoneNumber : undefined \},\n    \}\);"
start_connection_replacement = r"""    send({
      command: 'START_CONNECTION',
      accountId: selectedAccountId,
      data: { method, phoneNumber: method === 'PHONE' ? phoneNumber : undefined },
    });"""
content = re.sub(start_connection_pattern, start_connection_replacement, content)

# 5. Add Account Selector UI at the top of the main container
main_container_pattern = r"        <div className=\"flex flex-col lg:flex-row gap-6 items-stretch\">"
account_selector_ui = """        {/* Account Selector */}
        <div className="flex justify-center gap-4 mb-6">
          <button 
            onClick={() => setSelectedAccountId('primary')}
            className={`px-8 py-3 rounded-full font-bold uppercase tracking-widest text-sm transition-all border ${selectedAccountId === 'primary' ? 'bg-accent-primary text-bg-base border-accent-primary shadow-[0_0_20px_rgba(var(--color-accent-primary),0.3)]' : 'bg-bg-panel text-text-muted border-border-strong hover:border-accent-subtle'}`}
          >
            Primary Account
          </button>
          <button 
            onClick={() => setSelectedAccountId('secondary')}
            className={`px-8 py-3 rounded-full font-bold uppercase tracking-widest text-sm transition-all border ${selectedAccountId === 'secondary' ? 'bg-accent-primary text-bg-base border-accent-primary shadow-[0_0_20px_rgba(var(--color-accent-primary),0.3)]' : 'bg-bg-panel text-text-muted border-border-strong hover:border-accent-subtle'}`}
          >
            Secondary Account
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-stretch">"""
content = re.sub(main_container_pattern, account_selector_ui, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("done")
