import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, addDoc, query, where, doc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Package, Download, ArrowLeft, PlusCircle, ShieldAlert, Edit2 } from 'lucide-react';

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
  const [editingExtId, setEditingExtId] = useState<string | null>(null);
  
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
      if (editingExtId) {
        await updateDoc(doc(db, 'extensions', editingExtId), {
          name: newName,
          description: newDesc,
          trigger: newTrigger,
          response: newResponse,
          code: newCode,
          status: 'pending'
        });
        setSubmitMsg('Extension updated successfully! Awaiting admin approval.');
      } else {
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
      }
      setNewName('');
      setNewDesc('');
      setNewTrigger('');
      setNewResponse('');
      setNewCode('');
      setEditingExtId(null);
      fetchExtensions(); // Refresh the list
    } catch (err: any) {
      setSubmitMsg('Error: ' + err.message);
    }
  };

  const handleEdit = (ext: Extension) => {
    setNewName(ext.name);
    setNewDesc(ext.description);
    setNewTrigger(ext.trigger);
    setNewResponse(ext.response || '');
    setNewCode(ext.code || '');
    setEditingExtId(ext.id);
    setShowCreate(true);
    setSubmitMsg('');
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
    <div className="min-h-screen bg-bg-base text-text-main font-mono p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-border-subtle pb-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="text-text-muted hover:text-text-main transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Package className="w-8 h-8 text-accent-light" />
            <h1 className="text-3xl font-bold tracking-tighter text-accent-light">Extension Marketplace</h1>
          </div>
          <div>
            {!showCreate ? (
              <button onClick={() => { setEditingExtId(null); setShowCreate(true); setNewName(''); setNewDesc(''); setNewTrigger(''); setNewResponse(''); setNewCode(''); setSubmitMsg(''); }} className="flex items-center gap-2 bg-accent-primary hover:bg-accent-hover px-4 py-2 rounded text-sm font-bold">
                <PlusCircle className="w-4 h-4" /> Publish Extension
              </button>
            ) : (
              <button onClick={() => setShowCreate(false)} className="flex items-center gap-2 bg-bg-panel-hover hover:bg-gray-700 px-4 py-2 rounded text-sm font-bold">
                Browse Marketplace
              </button>
            )}
          </div>
        </header>

        {showCreate ? (
          <div className="max-w-2xl mx-auto bg-bg-panel p-8 rounded-lg border border-border-strong">
            <h2 className="text-2xl font-bold mb-6 text-accent-light">{editingExtId ? 'Edit Extension' : 'Publish a New Extension'}</h2>
            {!user && <div className="p-4 mb-4 bg-red-900/30 text-red-400 border border-red-500/50 rounded">You must be logged in.</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Extension Name</label>
                <input 
                  required
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none" 
                  placeholder="e.g. Weather Bot"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Description</label>
                <textarea 
                  required
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none h-24" 
                  placeholder="What does this extension do?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-muted mb-1">Trigger Command</label>
                  <input 
                    required
                    type="text" 
                    value={newTrigger}
                    onChange={e => setNewTrigger(e.target.value)}
                    className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none" 
                    placeholder="e.g. weather"
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Bot Response</label>
                  <input
                    type="text"
                    value={newResponse}
                    onChange={e => setNewResponse(e.target.value)}
                    className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none"
                    placeholder="e.g. The weather is sunny! (Optional if JS is used)"
                  />
                </div>
              </div>
              <div className="my-4">
                  <label className="block text-sm text-text-muted mb-1">Custom JS / TypeScript Execution (Advanced)</label>
                  <textarea
                    rows={4}
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    className="w-full bg-bg-base font-mono text-sm border border-border-subtle focus:border-border-strong text-green-400 p-3 rounded outline-none"
                    placeholder="async (sock, msg, botInfo, remoteJid, argumentName, sendTrackedMessage, dashboard) => { ... }"
                  />
              </div>

              <button
                type="submit" 
                disabled={!user}
                className="w-full mt-4 bg-accent-primary hover:bg-accent-hover disabled:opacity-50 text-text-main font-bold p-3 rounded transition-colors"
              >
                {editingExtId ? 'Update and Submit for Review' : 'Submit for Review'}
              </button>

              {submitMsg && (
                <div className="mt-4 p-3 rounded bg-accent-subtle border border-border-strong text-accent-light text-center text-sm">
                  {submitMsg}
                </div>
              )}
            </form>
          </div>
        ) : (
          <div>
            {loading ? (
              <div className="text-center text-text-muted py-12">Loading extensions...</div>
            ) : extensions.length === 0 ? (
              <div className="text-center text-text-muted py-12">No approved extensions exist yet. Be the first to publish one!</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {extensions.map(ext => (
                  <div key={ext.id} className="bg-bg-panel border border-border-strong hover:border-border-strong transition-colors p-6 rounded-lg flex flex-col">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-accent-light mb-2">{ext.name}</h3>
                      <p className="text-sm text-text-muted mb-4 h-10 overflow-hidden line-clamp-2">{ext.description}</p>
                      
                      <div className="bg-bg-base p-3 rounded border border-border-strong mb-4 font-mono text-xs">
                        <div className="text-text-muted">Trigger: <span className="text-text-main">!{ext.trigger}</span></div>
                        <div className="text-text-muted truncate">Response: <span className="text-text-main">{ext.response || '<from JS code>'}</span></div>
                        {ext.code && <div className="text-green-500 truncate mt-1">Runs Custom Extensible JS</div>}
                      </div>

                      <div className="flex justify-between items-center text-xs text-text-muted mt-2">
                        <span>By {ext.author}</span>
                        <div className="flex items-center gap-2">
                          {ext.untrusted && <span className="flex items-center gap-1 text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded font-bold"><ShieldAlert className="w-3 h-3"/> UNTRUSTED</span>}
                          <span>{ext.downloads || 0} Downloads</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-border-strong flex flex-col gap-2">
                      <button 
                        onClick={() => handleInstall(ext)}
                        disabled={ext.disabled}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded transition-colors text-sm font-bold ${
                          ext.disabled 
                            ? 'bg-bg-panel-hover text-text-muted border border-border-subtle cursor-not-allowed' 
                            : 'bg-accent-subtle hover:bg-accent-subtle text-accent-light border border-border-strong'
                        }`}
                      >
                        {ext.disabled ? 'Installation Disabled' : <><Download className="w-4 h-4" /> {user ? 'Install to Bot' : 'Log in to Install'}</>}
                      </button>
                      
                      {user && user.uid === ext.authorUid && (
                        <button 
                          onClick={() => handleEdit(ext)}
                          className="w-full flex items-center justify-center gap-2 py-1.5 rounded transition-colors text-xs font-bold bg-bg-panel-hover hover:bg-gray-700 text-text-muted border border-border-subtle"
                        >
                          <Edit2 className="w-3 h-3" /> Edit Extension
                        </button>
                      )}
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
