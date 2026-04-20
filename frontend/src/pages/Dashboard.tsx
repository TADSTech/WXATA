import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Shield, Activity, QrCode, Phone, Wifi, RefreshCw, LogOut } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

interface BotInfo {
  prefix: string;
  scripts: Record<string, BotScript>;
  root: BotRoot;
  welcome: BotWelcome;
}

interface BotScript {
  trigger: string;
  response: string;
  target: string;
  code?: string;
  defaultArgument?: string;
  arguments?: Record<string, BotScriptArgument>;
}

interface BotScriptArgument {
  target?: string;
  response?: string;
}

interface BotWelcome {
  enabled: boolean;
  text: string;
}

interface BotRoot {
  target: string;
}

const Dashboard = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [userData, setUserData] = useState<any>(null);

  const handleSignOut = () => {
    auth.signOut();
    navigate('/');
  };

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState({
    connection: 'DISCONNECTED',
    uptime: '00h 00m 00s',
    memory: '0MB / 512MB'
  });

  const [authMethod, setAuthMethod] = useState<'NONE' | 'QR' | 'PHONE'>('NONE');
  const [qrData, setQrData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [botInfo, setBotInfo] = useState<BotInfo>({
    prefix: '!',
    scripts: {
      summoner: {
        trigger: 'summon',
        response: 'WXATA summoned successfully.',
        target: 'self',
        defaultArgument: 'self',
        arguments: {
          here: {
            target: 'chat'
          },
          self: {
            target: 'self'
          }
        }
      }
    },
    root: {
      target: 'self'
    },
    welcome: {
      enabled: false,
      text: ''
    }
  });

  const [configStatus, setConfigStatus] = useState('');

  const wsRef = useRef<WebSocket | null>(null);

  // Check auth & fetch user data
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (!user) {
        navigate('/login');
      } else {
        // Verify username matched params (skip full check for speed but robust enough)
        getDoc(doc(db, 'users', username || '')).then(snap => {
          if (snap.exists() && snap.data().uid === user.uid) {
            setUserData(snap.data());
            setIsAuthenticated(true);
          } else if (username === 'user') { // Generic fallback
             setUserData({ name: user.email, username: username });
             setIsAuthenticated(true);
          } else {
            navigate('/login');
          }
        });
      }
    });
    return unsub;
  }, [username, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      const wsUrl = window.location.hostname === 'localhost' ? 'ws://localhost:4000' : 'wss://wxata.onrender.com';
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        
        if (payload.event === 'log') {
          const { timestamp, type, message } = payload.data;
          const formattedLog = `[${timestamp}] ${type}: ${message}`;
          setLogs(prev => [...prev, formattedLog].slice(-50));
        }

        if (payload.event === 'status') {
          setStatus(payload.data);
          if (payload.data.connection === 'CONNECTED') {
            setAuthMethod('NONE');
            setQrData(null);
            setPairingCode(null);
            setIsConnecting(false);
          }
        }

        if (payload.event === 'qr') {
          setQrData(payload.data);
          setIsConnecting(false);
        }

        if (payload.event === 'pairing-code') {
          setPairingCode(payload.data);
          setIsConnecting(false);
        }

        if (payload.event === 'bot-info') {
          // If we arrived to dashboard with an extension to install
          let updatedBotInfo = payload.data;
          const extToInstall = location.state?.installExtension;
          
          if (extToInstall) {
             const keyName = extToInstall.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
             updatedBotInfo = {
                ...updatedBotInfo,
                scripts: {
                  ...updatedBotInfo.scripts,
                  [keyName]: {
                    trigger: extToInstall.trigger,
                    response: extToInstall.response,
                    code: extToInstall.code,
                    target: 'chat',
                    defaultArgument: 'self',
                    desc: extToInstall.description || `Installed extension: ${extToInstall.name}`
                  }
                }
             };
             // Clear state so we don't install it again incorrectly
             navigate(location.pathname, { replace: true, state: {} });
             setConfigStatus('New extension added - Unsaved changes');
          } else {
             setConfigStatus('Config synced');
          }
          setBotInfo(updatedBotInfo);
        }
      };

      socket.onopen = () => {
        console.log('Connected to WXATA backend');
        socket.send(JSON.stringify({ command: 'GET_BOT_INFO' }));
      };

      socket.onclose = () => {
        console.log('Disconnected from WXATA backend');
        setStatus(prev => ({ ...prev, connection: 'DISCONNECTED' }));
      };

      return () => socket.close();
    }
  }, [isAuthenticated]);

  const sendCommand = (command: string, data?: any) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }
    wsRef.current.send(JSON.stringify({ command, data }));
  };

  const startConnection = (method: 'QR' | 'PHONE') => {
    setIsConnecting(true);
    setAuthMethod(method);
    sendCommand('START_CONNECTION', {
      method,
      phoneNumber: method === 'PHONE' ? phoneNumber : undefined
    });
  };

  const handleQuickAction = (action: string) => {
    if (action === 'CLEAR_LOGS') {
      setLogs([]);
      return;
    }
    sendCommand('QUICK_ACTION', { action });
  };

  const handlePrefixChange = (value: string) => {
    setBotInfo((prev) => ({
      ...prev,
      prefix: value
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleScriptChange = (field: keyof BotScript, value: string) => {
    setBotInfo((prev) => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        summoner: {
          ...prev.scripts.summoner,
          [field]: value
        }
      }
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleScriptArgumentChange = (argumentName: string, field: keyof BotScriptArgument, value: string) => {
    setBotInfo((prev) => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        summoner: {
          ...prev.scripts.summoner,
          arguments: {
            ...prev.scripts.summoner.arguments,
            [argumentName]: {
              ...prev.scripts.summoner.arguments?.[argumentName],
              [field]: value
            }
          }
        }
      }
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleDefaultArgumentChange = (value: string) => {
    setBotInfo((prev) => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        summoner: {
          ...prev.scripts.summoner,
          defaultArgument: value
        }
      }
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleWelcomeChange = (field: keyof BotWelcome, value: string | boolean) => {
    setBotInfo((prev) => ({
      ...prev,
      welcome: {
        ...prev.welcome,
        [field]: value
      }
    }));
    setConfigStatus('Unsaved changes');
  };

  const handleRootChange = (value: string) => {
    setBotInfo((prev) => ({
      ...prev,
      root: {
        ...prev.root,
        target: value
      }
    }));
    setConfigStatus('Unsaved changes');
  };

  const saveBotInfo = () => {
    sendCommand('UPDATE_BOT_INFO', botInfo);
    setConfigStatus('Saving...');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-4">
          <Activity className="text-emerald-400 w-8 h-8 animate-pulse" />
          <h2 className="text-emerald-400 text-lg tracking-widest">AUTHENTICATING...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-emerald-400 font-mono p-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-emerald-500/20 pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tighter">WXATA_DASHBOARD v1.0.0</h1>
          {userData && <span className="ml-4 text-sm text-emerald-400/50">Welcome, {userData.name || userData.username}</span>}
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${status.connection === 'CONNECTED' ? 'animate-pulse text-emerald-300' : 'text-red-500'}`} />
            <span>SYSTEM: {status.connection}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400">ENCRYPTION: ACTIVE</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
        {/* Left/Middle: Connection & Logs */}
        <div className="lg:col-span-2 flex flex-col gap-6 overflow-hidden">
          
          {/* Connection Controls (Visible until fully connected) */}
          <AnimatePresence>
            {status.connection !== 'CONNECTED' && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-slate-800 border border-emerald-500/30 rounded p-6 overflow-hidden"
              >
                <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                  {/* QR Method */}
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="p-4 bg-slate-900 border border-emerald-500/20 rounded-xl">
                      {qrData ? (
                        <div className="p-2 bg-white rounded">
                          <QRCodeSVG value={qrData} size={150} />
                        </div>
                      ) : (
                        <div className="w-[150px] h-[150px] flex items-center justify-center border border-dashed border-emerald-500/20">
                          {isConnecting && authMethod === 'QR' ? <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" /> : <QrCode className="w-12 h-12 text-emerald-700" />}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => startConnection('QR')}
                      disabled={isConnecting}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 text-black px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
                    >
                      <Wifi className="w-4 h-4" /> Link via QR
                    </button>
                  </div>

                  <div className="hidden md:block h-32 w-px bg-green-500/10" />

                  {/* Phone Method */}
                  <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                    {pairingCode ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xs uppercase text-slate-400">Pairing Code</span>
                        <div className="text-4xl font-mono font-black tracking-widest text-emerald-300 bg-slate-900 px-6 py-3 border border-emerald-500/30 rounded">
                          {pairingCode}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 w-full">
                        <input 
                          type="text" 
                          placeholder="Phone (e.g. 551199999999)"
                          className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 text-center font-mono focus:border-emerald-500 outline-none placeholder:text-emerald-700/50"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                        <button 
                          onClick={() => startConnection('PHONE')}
                          disabled={isConnecting || !phoneNumber}
                          className="w-full flex items-center justify-center gap-2 bg-slate-900 border border-emerald-500 hover:bg-emerald-500/10 disabled:border-gray-800 disabled:text-gray-800 text-emerald-400 px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
                        >
                          <Phone className="w-4 h-4" /> Link via Phone
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logs Panel */}
          <div className="flex-1 bg-slate-900 border border-emerald-500/20 rounded p-4 flex flex-col gap-4 overflow-hidden min-h-[300px]">
          <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
            <span className="text-xs uppercase tracking-widest opacity-50">Real-time System Logs</span>
            <span className="text-[10px] text-emerald-700">BAILEYS_SOCKET_STREAM</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm font-mono custom-scrollbar">
            {logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="hover:bg-emerald-500/5 p-1 rounded"
              >
                {log}
              </motion.div>
            ))}
            {logs.length === 0 && <div className="text-emerald-700 opacity-30 text-center mt-20 italic">Waiting for backend data...</div>}
          </div>
        </div>
        </div>

        {/* Status Panel */}
        <div className="flex flex-col gap-6">
          <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-emerald-500/10 pb-2">Bot Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Connection</span>
                <span className={status.connection === 'CONNECTED' ? 'text-emerald-300' : 'text-red-500'}>{status.connection}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Uptime</span>
                <span>{status.uptime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Memory</span>
                <span>{status.memory}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-emerald-500/10 pb-2">Bot Summoner</h3>
            <div className="space-y-3 text-xs">
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Prefix (emoji or punctuation)</span>
                <input
                  type="text"
                  value={botInfo.prefix}
                  onChange={(e) => handlePrefixChange(e.currentTarget.value)}
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Script name</span>
                <input
                  type="text"
                  value="summoner"
                  disabled
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-slate-400 outline-none opacity-70"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Trigger word</span>
                <input
                  type="text"
                  value={botInfo.scripts.summoner.trigger}
                  onChange={(e) => handleScriptChange('trigger', e.currentTarget.value)}
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Target (self or phone number)</span>
                <input
                  type="text"
                  value={botInfo.scripts.summoner.target}
                  onChange={(e) => handleScriptChange('target', e.currentTarget.value)}
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Response</span>
                <input
                  type="text"
                  value={botInfo.scripts.summoner.response}
                  onChange={(e) => handleScriptChange('response', e.currentTarget.value)}
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Default argument</span>
                <input
                  type="text"
                  value={botInfo.scripts.summoner.defaultArgument ?? 'self'}
                  onChange={(e) => handleDefaultArgumentChange(e.currentTarget.value)}
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
              <div className="grid grid-cols-1 gap-3 rounded border border-emerald-500/20 p-3">
                <div className="text-slate-400 uppercase tracking-wider text-[10px]">Arguments</div>
                <label className="block space-y-1">
                  <span className="text-slate-400 uppercase tracking-wider">here.target</span>
                  <input
                    type="text"
                    value={botInfo.scripts.summoner.arguments?.here?.target ?? 'chat'}
                    onChange={(e) => handleScriptArgumentChange('here', 'target', e.currentTarget.value)}
                    className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400 uppercase tracking-wider">self.target</span>
                  <input
                    type="text"
                    value={botInfo.scripts.summoner.arguments?.self?.target ?? 'self'}
                    onChange={(e) => handleScriptArgumentChange('self', 'target', e.currentTarget.value)}
                    className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400 uppercase tracking-wider">here.response override</span>
                  <input
                    type="text"
                    value={botInfo.scripts.summoner.arguments?.here?.response ?? ''}
                    onChange={(e) => handleScriptArgumentChange('here', 'response', e.currentTarget.value)}
                    placeholder="optional"
                    className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500 placeholder:text-emerald-700/50"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-slate-400 uppercase tracking-wider">self.response override</span>
                  <input
                    type="text"
                    value={botInfo.scripts.summoner.arguments?.self?.response ?? ''}
                    onChange={(e) => handleScriptArgumentChange('self', 'response', e.currentTarget.value)}
                    placeholder="optional"
                    className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500 placeholder:text-emerald-700/50"
                  />
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-4 pt-4 border-t border-emerald-500/20">
              <span className="text-[10px] text-emerald-700 uppercase tracking-wider">{configStatus || 'Ready'}</span>
              <button
                onClick={saveBotInfo}
                className="border border-emerald-500/30 bg-green-900/20 hover:bg-emerald-500/10 px-4 py-2 text-sm font-bold transition-colors shadow-[0_0_10px_rgba(34,197,94,0.1)]"
              >
                SAVE CONFIG
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-4">
            <div className="flex justify-between items-center border-b border-emerald-500/10 pb-2">
              <h3 className="text-xs uppercase tracking-widest opacity-50">Installed Extensions</h3>
              <button onClick={() => navigate('/extensions')} className="text-xs text-blue-400 hover:text-blue-300">Browse Marketplace</button>
            </div>
            
            {Object.entries(botInfo.scripts || {}).filter(([k]) => !['summoner', 'menu', 'perm'].includes(k)).length === 0 ? (
               <div className="text-xs text-gray-600 italic py-4 text-center border border-dashed border-gray-800 rounded">
                 No custom extensions installed. Go to the Marketplace to add new capabilities!
               </div>
            ) : (
               <div className="space-y-3">
                 {Object.entries(botInfo.scripts || {})
                   .filter(([k]) => !['summoner', 'menu', 'perm'].includes(k))
                   .map(([key, script]) => (
                      <div key={key} className="border border-emerald-500/20 p-3 rounded bg-green-900/5 text-xs flex justify-between items-center">
                         <div>
                            <div className="font-bold text-emerald-300 capitalize">{key}</div>
                            <div className="text-slate-400 mt-1">Trigger: <span className="text-green-300">!{script.trigger}</span></div>
                            <div className="text-slate-400 truncate w-48 sm:w-auto">Response: <span className="text-green-300">{script.response}</span></div>
                         </div>
                         <button 
                           onClick={() => {
                             const newScripts = { ...botInfo.scripts };
                             delete newScripts[key];
                             setBotInfo({ ...botInfo, scripts: newScripts });
                             setConfigStatus('Removed extension - Unsaved changes');
                           }}
                           className="text-red-500 hover:text-red-400 border border-red-500/30 p-1 rounded"
                         >
                           Remove
                         </button>
                      </div>
                 ))}
               </div>
            )}
          </div>

          <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-emerald-500/10 pb-2">Welcome On Connect</h3>
            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between gap-3 border border-emerald-500/20 p-2 rounded">
                <span className="text-slate-400 uppercase tracking-wider">Enabled</span>
                <input
                  type="checkbox"
                  checked={botInfo.welcome.enabled}
                  onChange={(e) => handleWelcomeChange('enabled', e.currentTarget.checked)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Welcome text</span>
                <textarea
                  value={botInfo.welcome.text}
                  onChange={(e) => handleWelcomeChange('text', e.currentTarget.value)}
                  rows={5}
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500 font-mono whitespace-pre-wrap"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400 uppercase tracking-wider">Root target (self or phone number)</span>
                <input
                  type="text"
                  value={botInfo.root.target}
                  onChange={(e) => handleRootChange(e.currentTarget.value)}
                  className="w-full bg-slate-900 border border-emerald-500/30 p-2 text-emerald-400 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
          </div>

          <div className="bg-slate-900 border border-emerald-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-emerald-500/10 pb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleQuickAction('RESTART_BOT')}
                className="border border-emerald-500/30 hover:bg-emerald-500/10 p-2 text-xs transition-colors"
              >
                RESTART BOT
              </button>
              <button 
                onClick={() => handleQuickAction('TERMINATE')}
                className="border border-red-500/30 text-red-500 hover:bg-red-500/10 p-2 text-xs transition-colors"
              >
                TERMINATE
              </button>
              <button 
                onClick={() => handleQuickAction('CLEAR_LOGS')}
                className="border border-emerald-500/30 hover:bg-emerald-500/10 p-2 text-xs transition-colors"
              >
                CLEAR LOGS
              </button>
              <button 
                onClick={() => handleQuickAction('EXPORT_DATA')}
                className="border border-primary/30 hover:bg-primary/10 p-2 text-xs transition-colors"
              >
                EXPORT DATA
              </button>
              <button
                onClick={handleSignOut}
                className="border border-red-500/50 hover:bg-red-500/20 text-red-500 p-2 text-xs transition-colors flex items-center justify-center gap-2 mt-4 w-full"
              >
                <LogOut size={14} /> SIGN OUT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
