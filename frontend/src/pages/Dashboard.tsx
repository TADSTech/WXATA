import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Shield, Activity, Lock, QrCode, Phone, Wifi, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const Dashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
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
  
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      const socket = new WebSocket('ws://localhost:4000');
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
      };

      socket.onopen = () => {
        console.log('Connected to WXATA backend');
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'wxata-admin') {
      setIsAuthenticated(true);
    } else {
      alert('Unauthorized access');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900 p-8 border border-green-500/30 rounded-lg shadow-[0_0_30px_rgba(34,197,94,0.1)] w-full max-w-md"
        >
          <div className="flex flex-col items-center gap-4 mb-8">
            <Lock className="text-green-500 w-12 h-12" />
            <h2 className="text-green-500 text-xl font-bold tracking-widest uppercase">System Auth</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="ENTER ADMIN KEY"
              className="w-full bg-black border border-green-500/50 p-3 text-green-500 focus:outline-none focus:border-green-400 placeholder:text-green-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="w-full bg-green-600 hover:bg-green-500 text-black font-bold p-3 transition-colors uppercase tracking-widest">
              Unlock Console
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-green-500 font-mono p-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex justify-between items-center border-b border-green-500/20 pb-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-6 h-6" />
          <h1 className="text-xl font-bold tracking-tighter">WXATA_DASHBOARD v1.0.0</h1>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${status.connection === 'CONNECTED' ? 'animate-pulse text-green-400' : 'text-red-500'}`} />
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
                className="bg-gray-900/50 border border-green-500/30 rounded p-6 overflow-hidden"
              >
                <div className="flex flex-col md:flex-row gap-8 items-center justify-center">
                  {/* QR Method */}
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="p-4 bg-black border border-green-500/20 rounded-xl">
                      {qrData ? (
                        <div className="p-2 bg-white rounded">
                          <QRCodeSVG value={qrData} size={150} />
                        </div>
                      ) : (
                        <div className="w-[150px] h-[150px] flex items-center justify-center border border-dashed border-green-500/20">
                          {isConnecting && authMethod === 'QR' ? <RefreshCw className="w-8 h-8 animate-spin text-green-500" /> : <QrCode className="w-12 h-12 text-green-900" />}
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => startConnection('QR')}
                      disabled={isConnecting}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 text-black px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
                    >
                      <Wifi className="w-4 h-4" /> Link via QR
                    </button>
                  </div>

                  <div className="hidden md:block h-32 w-px bg-green-500/10" />

                  {/* Phone Method */}
                  <div className="flex flex-col items-center gap-4 w-full max-w-xs">
                    {pairingCode ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xs uppercase text-gray-500">Pairing Code</span>
                        <div className="text-4xl font-mono font-black tracking-widest text-green-400 bg-black px-6 py-3 border border-green-500/30 rounded">
                          {pairingCode}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 w-full">
                        <input 
                          type="text" 
                          placeholder="Phone (e.g. 551199999999)"
                          className="w-full bg-black border border-green-500/30 p-2 text-green-500 text-center font-mono focus:border-green-500 outline-none placeholder:text-green-900/50"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                        />
                        <button 
                          onClick={() => startConnection('PHONE')}
                          disabled={isConnecting || !phoneNumber}
                          className="w-full flex items-center justify-center gap-2 bg-black border border-green-500 hover:bg-green-500/10 disabled:border-gray-800 disabled:text-gray-800 text-green-500 px-6 py-2 rounded font-bold transition-all uppercase text-sm tracking-widest"
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
          <div className="flex-1 bg-black border border-green-500/20 rounded p-4 flex flex-col gap-4 overflow-hidden min-h-[300px]">
          <div className="flex justify-between items-center border-b border-green-500/10 pb-2">
            <span className="text-xs uppercase tracking-widest opacity-50">Real-time System Logs</span>
            <span className="text-[10px] text-green-900">BAILEYS_SOCKET_STREAM</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 text-sm font-mono custom-scrollbar">
            {logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="hover:bg-green-500/5 p-1 rounded"
              >
                {log}
              </motion.div>
            ))}
            {logs.length === 0 && <div className="text-green-900 opacity-30 text-center mt-20 italic">Waiting for backend data...</div>}
          </div>
        </div>
        </div>

        {/* Status Panel */}
        <div className="flex flex-col gap-6">
          <div className="bg-black border border-green-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-green-500/10 pb-2">Bot Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Connection</span>
                <span className={status.connection === 'CONNECTED' ? 'text-green-400' : 'text-red-500'}>{status.connection}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Uptime</span>
                <span>{status.uptime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Memory</span>
                <span>{status.memory}</span>
              </div>
            </div>
          </div>

          <div className="bg-black border border-green-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-green-500/10 pb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleQuickAction('RESTART_BOT')}
                className="border border-green-500/30 hover:bg-green-500/10 p-2 text-xs transition-colors"
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
                className="border border-green-500/30 hover:bg-green-500/10 p-2 text-xs transition-colors"
              >
                CLEAR LOGS
              </button>
              <button 
                onClick={() => handleQuickAction('EXPORT_DATA')}
                className="border border-green-500/30 hover:bg-green-500/10 p-2 text-xs transition-colors"
              >
                EXPORT DATA
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
