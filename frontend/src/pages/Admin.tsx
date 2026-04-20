import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, orderBy } from 'firebase/firestore';

interface UserCode {
  id: string;
  code: string;
  used: boolean;
  createdAt: string;
  usedBy?: string;
  usedAt?: string;
}

export default function Admin() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [codesList, setCodesList] = useState<UserCode[]>([]);
  const [loading, setLoading] = useState(true);

  // Simplified protection for the admin panel demonstration
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPass, setAdminPass] = useState('');

  const fetchCodes = async () => {
    try {
      const q = query(collection(db, 'user_codes'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetched: UserCode[] = [];
      querySnapshot.forEach((doc) => {
        fetched.push({ id: doc.id, ...doc.data() } as UserCode);
      });
      setCodesList(fetched);
    } catch (err) {
      console.error('Failed to fetch codes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchCodes();
    }
  }, [isAdminUnlocked]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPass === 'ROOT_ACCESS') { // Standard placeholder admin pass
      setIsAdminUnlocked(true);
    } else {
      alert('Unauthorized');
    }
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'WX-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(result);
  };

  const saveCode = async () => {
    if (!code) return;
    try {
      await setDoc(doc(db, 'user_codes', code), {
        code: code,
        used: false,
        createdAt: new Date().toISOString()
      });
      setMessage(`Code ${code} saved successfully!`);
      setCode('');
      fetchCodes(); // Refresh the list
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  if (!isAdminUnlocked) {
    return (
      <div className="min-h-screen bg-[#050505] text-blue-500 flex items-center justify-center font-mono p-4">
        <div className="border border-blue-500/30 p-8 bg-black w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-6 text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">ROOT ADMIN PANEL</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Admin Passphrase" 
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              className="w-full bg-transparent border-b border-blue-500/50 py-2 text-center text-white focus:outline-none focus:border-blue-400 transition-colors"
            />
            <button type="submit" className="w-full border border-blue-500/50 text-blue-400 hover:bg-blue-600 hover:text-white py-3 transition-colors">
              AUTHENTICATE
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 font-mono">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-blue-400 border-b border-blue-500/20 pb-4">WXATA Registration Manager</h1>
        
        {/* Code Generator Card */}
        <div className="bg-gray-900/50 border border-blue-500/30 p-6 rounded-lg flex flex-col md:flex-row gap-6 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2 text-indigo-400">Generate Access Code</h2>
            <p className="text-gray-400 text-sm mb-4">Create a unique token to allow a new user to securely register on the platform.</p>
            <div className="flex items-center gap-4 mb-4">
              <input 
                type="text" 
                readOnly 
                value={code} 
                placeholder="Click generate ->"
                className="flex-1 bg-black border border-gray-700 focus:border-blue-500 text-blue-400 px-4 py-3 rounded outline-none"
              />
              <button onClick={generateRandomCode} className="bg-blue-900/30 hover:bg-blue-800/50 text-blue-400 px-6 py-3 rounded border border-blue-500/50 transition-colors">
                Generate
              </button>
            </div>
            <button 
              onClick={saveCode}
              disabled={!code}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Push to Database
            </button>
            
            {message && (
              <div className={`mt-4 p-3 rounded text-sm ${message.startsWith('Error') ? 'bg-red-900/50 text-red-200 border border-red-500' : 'bg-blue-900/30 text-blue-300 border border-blue-500/50'}`}>
                {message}
              </div>
            )}
          </div>
        </div>

        {/* Existing Codes List */}
        <div className="bg-gray-900/50 border border-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-indigo-400 border-b border-gray-800 pb-2">Issued Codes Register</h2>
          {loading ? (
            <p className="text-gray-500">Loading token database...</p>
          ) : codesList.length === 0 ? (
            <p className="text-gray-500">No codes issued yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="py-3 px-2">Access Token</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Claimed By (UID)</th>
                    <th className="py-3 px-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {codesList.map(c => (
                    <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-3 px-2 font-bold text-blue-400">{c.code}</td>
                      <td className="py-3 px-2">
                        {c.used 
                          ? <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded text-xs">USED</span> 
                          : <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs">AVAILABLE</span>
                        }
                      </td>
                      <td className="py-3 px-2 text-gray-400 font-mono text-xs">{c.usedBy || '-'}</td>
                      <td className="py-3 px-2 text-gray-500">{new Date(c.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
