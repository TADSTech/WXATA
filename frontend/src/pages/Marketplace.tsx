import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Package, Download, ArrowLeft, PlusCircle, ShieldAlert } from 'lucide-react';

interface Extension {
  id: string;
  name: string;
  description: string;
  trigger: string;
  response: string;
  code?: string;
  author: string;
  authorUid: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  downloads: number;
  untrusted?: boolean;
  disabled?: boolean;
}

export default function Marketplace() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  // Extension form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrigger, setNewTrigger] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [newCode, setNewCode] = useState('');
  const [submitMsg, setSubmitMsg] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setUser(u);
    });
    return unsub;
  }, []);

  const fetchExtensions = async () => {
    try {
      const q = query(
        collection(db, 'extensions'),
        where('status', '==', 'approved')
      );
      const snap = await getDocs(q);
      const list: Extension[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Extension));
      // Sort in memory to avoid requiring a composite Firestore index
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setExtensions(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setSubmitMsg('You must be logged in to publish extensions.');
      return;
    }
    try {
      await addDoc(collection(db, 'extensions'), {
        name: newName,
        description: newDesc,
        trigger: newTrigger,
        response: newResponse,
        code: newCode,
        author: user.email?.split('@')[0] || 'Unknown',
        authorUid: user.uid,
        status: 'pending',
        createdAt: new Date().toISOString(),
        downloads: 0
      });
      setSubmitMsg('Extension submitted successfully! Awaiting admin approval.');
      setNewName('');
      setNewDesc('');
      setNewTrigger('');
      setNewResponse('');
      setNewCode('');
    } catch (err: any) {
      setSubmitMsg('Error: ' + err.message);
    }
  };

  const handleInstall = async (ext: Extension) => {
    if (!user) {
      navigate('/login');
      return;
    }
    // Increment download count
    try {
      const docRef = doc(db, 'extensions', ext.id);
      await updateDoc(docRef, { downloads: (ext.downloads || 0) + 1 });
      
      // Navigate back to dashboard with the extension installation param
      // We pass the extension through state so dashboard can intercept it
      navigate(`/dashboard/${user.email?.split('@')[0]}`, { state: { installExtension: ext } });
    } catch(e) {
       console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-mono p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-blue-500/20 pb-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Package className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-bold tracking-tighter text-blue-400">Extension Marketplace</h1>
          </div>
          <div>
            {!showCreate ? (
              <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-bold">
                <PlusCircle className="w-4 h-4" /> Publish Extension
              </button>
            ) : (
              <button onClick={() => setShowCreate(false)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded text-sm font-bold">
                Browse Marketplace
              </button>
            )}
          </div>
        </header>

        {showCreate ? (
          <div className="max-w-2xl mx-auto bg-gray-900/50 p-8 rounded-lg border border-blue-500/30">
            <h2 className="text-2xl font-bold mb-6 text-blue-400">Publish a New Extension</h2>
            {!user && <div className="p-4 mb-4 bg-red-900/30 text-red-400 border border-red-500/50 rounded">You must be logged in.</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Extension Name</label>
                <input 
                  required
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-black border border-gray-700 focus:border-blue-500 text-white p-3 rounded outline-none" 
                  placeholder="e.g. Weather Bot"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea 
                  required
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-black border border-gray-700 focus:border-blue-500 text-white p-3 rounded outline-none h-24" 
                  placeholder="What does this extension do?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Trigger Command</label>
                  <input 
                    required
                    type="text" 
                    value={newTrigger}
                    onChange={e => setNewTrigger(e.target.value)}
                    className="w-full bg-black border border-gray-700 focus:border-blue-500 text-white p-3 rounded outline-none" 
                    placeholder="e.g. weather"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bot Response</label>
                  <input
                    type="text"
                    value={newResponse}
                    onChange={e => setNewResponse(e.target.value)}
                    className="w-full bg-black border border-gray-700 focus:border-blue-500 text-white p-3 rounded outline-none"
                    placeholder="e.g. The weather is sunny! (Optional if JS is used)"
                  />
                </div>
              </div>
              <div className="my-4">
                  <label className="block text-sm text-gray-400 mb-1">Custom JS / TypeScript Execution (Advanced)</label>
                  <textarea
                    rows={4}
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    className="w-full bg-black font-mono text-sm border border-gray-700 focus:border-blue-500 text-green-400 p-3 rounded outline-none"
                    placeholder="async (sock, msg, botInfo, remoteJid, argumentName, sendTrackedMessage, dashboard) => { ... }"
                  />
              </div>

              <button
                type="submit" 
                disabled={!user}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold p-3 rounded transition-colors"
              >
                Submit for Review
              </button>

              {submitMsg && (
                <div className="mt-4 p-3 rounded bg-blue-900/30 border border-blue-500/50 text-blue-300 text-center text-sm">
                  {submitMsg}
                </div>
              )}
            </form>
          </div>
        ) : (
          <div>
            {loading ? (
              <div className="text-center text-gray-500 py-12">Loading extensions...</div>
            ) : extensions.length === 0 ? (
              <div className="text-center text-gray-500 py-12">No approved extensions exist yet. Be the first to publish one!</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {extensions.map(ext => (
                  <div key={ext.id} className="bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 transition-colors p-6 rounded-lg flex flex-col">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-blue-400 mb-2">{ext.name}</h3>
                      <p className="text-sm text-gray-400 mb-4 h-10 overflow-hidden line-clamp-2">{ext.description}</p>
                      
                      <div className="bg-black p-3 rounded border border-gray-800 mb-4 font-mono text-xs">
                        <div className="text-gray-500">Trigger: <span className="text-white">!{ext.trigger}</span></div>
                        <div className="text-gray-500 truncate">Response: <span className="text-white">{ext.response || '<from JS code>'}</span></div>
                        {ext.code && <div className="text-green-500 truncate mt-1">Runs Custom Extensible JS</div>}
                      </div>

                      <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
                        <span>By {ext.author}</span>
                        <div className="flex items-center gap-2">
                          {ext.untrusted && <span className="flex items-center gap-1 text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded font-bold"><ShieldAlert className="w-3 h-3"/> UNTRUSTED</span>}
                          <span>{ext.downloads || 0} Downloads</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-gray-800">
                      <button 
                        onClick={() => handleInstall(ext)}
                        disabled={ext.disabled}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded transition-colors text-sm font-bold ${
                          ext.disabled 
                            ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed' 
                            : 'bg-blue-900/30 hover:bg-blue-800/50 text-blue-400 border border-blue-500/50'
                        }`}
                      >
                        {ext.disabled ? 'Installation Disabled' : <><Download className="w-4 h-4" /> {user ? 'Install to Bot' : 'Log in to Install'}</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
