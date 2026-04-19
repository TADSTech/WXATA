import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Shield, Activity, Lock } from 'lucide-react';

const Dashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        const mockLogs = [
          `[${new Date().toLocaleTimeString()}] INFO: Socket connection stable`,
          `[${new Date().toLocaleTimeString()}] DEBUG: Received message from +123456789`,
          `[${new Date().toLocaleTimeString()}] INFO: Auto-reply sent to group ID: 987654`,
          `[${new Date().toLocaleTimeString()}] WARN: Retrying connection...`,
        ];
        setLogs(prev => [...prev, mockLogs[Math.floor(Math.random() * mockLogs.length)]].slice(-20));
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'wxata-admin') { // Placeholder auth
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
            <Activity className="w-4 h-4 animate-pulse" />
            <span>SYSTEM: ONLINE</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400">ENCRYPTION: ACTIVE</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Logs Panel */}
        <div className="lg:col-span-2 bg-black border border-green-500/20 rounded p-4 flex flex-col gap-4">
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
          </div>
        </div>

        {/* Status Panel */}
        <div className="flex flex-col gap-6">
          <div className="bg-black border border-green-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-green-500/10 pb-2">Bot Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Connection</span>
                <span className="text-green-400">Connected</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Uptime</span>
                <span>02h 14m 55s</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Memory</span>
                <span>124MB / 512MB</span>
              </div>
            </div>
          </div>

          <div className="bg-black border border-green-500/20 rounded p-4 space-y-4">
            <h3 className="text-xs uppercase tracking-widest opacity-50 border-b border-green-500/10 pb-2">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button className="border border-green-500/30 hover:bg-green-500/10 p-2 text-xs transition-colors">RESTART BOT</button>
              <button className="border border-red-500/30 text-red-500 hover:bg-red-500/10 p-2 text-xs transition-colors">TERMINATE</button>
              <button className="border border-green-500/30 hover:bg-green-500/10 p-2 text-xs transition-colors">CLEAR LOGS</button>
              <button className="border border-green-500/30 hover:bg-green-500/10 p-2 text-xs transition-colors">EXPORT DATA</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
