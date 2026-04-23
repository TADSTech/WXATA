import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';

interface UserCode {
  id: string;
  code: string;
  used: boolean;
  createdAt: string;
  usedBy?: string;
  usedAt?: string;
}

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

export default function Admin() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [codesList, setCodesList] = useState<UserCode[]>([]);
  const [pendingExtensions, setPendingExtensions] = useState<Extension[]>([]);
  const [approvedExtensions, setApprovedExtensions] = useState<Extension[]>([]);
  const [loading, setLoading] = useState(true);
  const [extLoading, setExtLoading] = useState(true);

  // Edit Modal State
  const [adminEditingExt, setAdminEditingExt] = useState<Extension | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', trigger: '', response: '', code: '' });

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

  const fetchExtensions = async () => {
    try {
      const q = query(collection(db, 'extensions'));
      const querySnapshot = await getDocs(q);
      const fetchedPending: Extension[] = [];
      const fetchedApproved: Extension[] = [];
      querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() } as Extension;
        if (data.status === 'pending') fetchedPending.push(data);
        if (data.status === 'approved') fetchedApproved.push(data);
      });
      setPendingExtensions(fetchedPending);
      setApprovedExtensions(fetchedApproved);
    } catch (err) {
      console.error('Failed to fetch extensions', err);
    } finally {
      setExtLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchCodes();
      fetchExtensions();
    }
  }, [isAdminUnlocked]);

  const handleExtStatus = async (id: string, status: 'approved' | 'rejected') => {
     try {
        await updateDoc(doc(db, 'extensions', id), { status });
        fetchExtensions(); // Refresh the list
     } catch(e) {
        console.error(e);
     }
  };

  const handleToggleExtField = async (id: string, field: 'untrusted' | 'disabled', currentValue: boolean | undefined) => {
    try {
      await updateDoc(doc(db, 'extensions', id), { [field]: !currentValue });
      fetchExtensions();
    } catch(e) {
      console.error(e);
    }
  };

  const handleDeleteExt = async (id: string) => {
    if (confirm("Are you sure you want to permanently delete this extension from the marketplace?")) {
      try {
        await deleteDoc(doc(db, 'extensions', id));
        fetchExtensions();
      } catch(e) {
        console.error(e);
      }
    }
  };

  const handleEditExtClick = (ext: Extension) => {
    setAdminEditingExt(ext);
    setEditForm({
      name: ext.name,
      description: ext.description,
      trigger: ext.trigger,
      response: ext.response || '',
      code: ext.code || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!adminEditingExt) return;
    try {
      await updateDoc(doc(db, 'extensions', adminEditingExt.id), {
        name: editForm.name,
        description: editForm.description,
        trigger: editForm.trigger,
        response: editForm.response,
        code: editForm.code
      });
      setAdminEditingExt(null);
      fetchExtensions();
    } catch(e: any) {
      console.error(e);
      alert('Failed to save edit: ' + e.message);
    }
  };

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
      <div className="min-h-screen bg-bg-base text-accent-primary flex items-center justify-center font-mono p-4">
        <div className="border border-border-strong p-8 bg-bg-base w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-6 text-accent-light drop-shadow-[0_0_10px_var(--accent-subtle)]">ROOT ADMIN PANEL</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Admin Passphrase" 
              value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              className="w-full bg-transparent border-b border-border-strong py-2 text-center text-text-main focus:outline-none focus:border-accent-light transition-colors"
            />
            <button type="submit" className="w-full border border-border-strong text-accent-light hover:bg-accent-primary hover:text-text-main py-3 transition-colors">
              AUTHENTICATE
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-main p-8 font-mono">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-accent-light border-b border-border-subtle pb-4">WXATA Registration Manager</h1>
        
        {/* Code Generator Card */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg flex flex-col md:flex-row gap-6 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-2 text-indigo-400">Generate Access Code</h2>
            <p className="text-text-muted text-sm mb-4">Create a unique token to allow a new user to securely register on the platform.</p>
            <div className="flex items-center gap-4 mb-4">
              <input 
                type="text" 
                readOnly 
                value={code} 
                placeholder="Click generate ->"
                className="flex-1 bg-bg-base border border-border-subtle focus:border-border-strong text-accent-light px-4 py-3 rounded outline-none"
              />
              <button onClick={generateRandomCode} className="bg-accent-subtle hover:bg-accent-subtle text-accent-light px-6 py-3 rounded border border-border-strong transition-colors">
                Generate
              </button>
            </div>
            <button 
              onClick={saveCode}
              disabled={!code}
              className="w-full bg-accent-primary hover:bg-accent-hover text-text-main font-bold py-3 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Push to Database
            </button>
            
            {message && (
              <div className={`mt-4 p-3 rounded text-sm ${message.startsWith('Error') ? 'bg-red-900/50 text-red-200 border border-red-500' : 'bg-accent-subtle text-accent-light border border-border-strong'}`}>
                {message}
              </div>
            )}
          </div>
        </div>

        {/* Existing Codes List */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-indigo-400 border-b border-border-strong pb-2">Issued Codes Register</h2>
          {loading ? (
            <p className="text-text-muted">Loading token database...</p>
          ) : codesList.length === 0 ? (
            <p className="text-text-muted">No codes issued yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-muted border-b border-border-strong">
                    <th className="py-3 px-2">Access Token</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Claimed By (UID)</th>
                    <th className="py-3 px-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {codesList.map(c => (
                    <tr key={c.id} className="border-b border-border-strong/50 hover:bg-bg-panel-hover/30">
                      <td className="py-3 px-2 font-bold text-accent-light">{c.code}</td>
                      <td className="py-3 px-2">
                        {c.used 
                          ? <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded text-xs">USED</span> 
                          : <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs">AVAILABLE</span>
                        }
                      </td>
                      <td className="py-3 px-2 text-text-muted font-mono text-xs">{c.usedBy || '-'}</td>
                      <td className="py-3 px-2 text-text-muted">{new Date(c.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pending Extensions List */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-indigo-400 border-b border-border-strong pb-2">Pending Marketplace Extensions</h2>
          {extLoading ? (
            <p className="text-text-muted">Loading extensions database...</p>
          ) : pendingExtensions.length === 0 ? (
            <p className="text-text-muted">No pending extensions awaiting approval.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-muted border-b border-border-strong">
                    <th className="py-3 px-2">Name / Desc</th>
                    <th className="py-3 px-2">Trigger & Response</th>
                    <th className="py-3 px-2">Author (UID)</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingExtensions.map(ext => (
                    <tr key={ext.id} className="border-b border-border-strong/50 hover:bg-bg-panel-hover/30">
                      <td className="py-3 px-2">
                        <div className="font-bold text-accent-light">{ext.name}</div>
                        <div className="text-text-muted text-xs truncate max-w-xs">{ext.description}</div>
                      </td>
                      <td className="py-3 px-2">
                         <div className="text-xs">
                           <span className="text-text-muted">Trigger:</span> <span className="font-mono text-accent-light px-1">!{ext.trigger}</span><br/>
                           <span className="text-text-muted">Resp:</span> <span className="font-mono text-text-muted">{ext.response || '<script>'}</span>
                         </div>
                         {ext.code && <div className="text-green-500 text-[10px] mt-1">Contains JS Code</div>}
                      </td>
                      <td className="py-3 px-2 text-text-muted">
                        {ext.author}<br/>
                        <span className="font-mono text-[10px] opacity-50">{ext.authorUid}</span>
                      </td>
                      <td className="py-3 px-2 text-right space-x-2">
                         <button onClick={() => handleEditExtClick(ext)} className="text-xs bg-accent-subtle hover:bg-accent-subtle border border-border-strong text-accent-light px-3 py-1 rounded">Edit</button>
                         <button onClick={() => handleExtStatus(ext.id, 'approved')} className="text-xs bg-green-900/30 hover:bg-green-800/50 border border-green-500/50 text-green-400 px-3 py-1 rounded">Approve</button>
                         <button onClick={() => handleDeleteExt(ext.id)} className="text-xs bg-red-900/30 hover:bg-red-800/50 border border-red-500/50 text-red-400 px-3 py-1 rounded">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Approved Marketplace Extensions */}
        <div className="bg-bg-panel border border-border-strong p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-accent-light border-b border-border-strong pb-2">Active Marketplace Extensions</h2>
          {extLoading ? (
            <p className="text-text-muted">Loading extensions database...</p>
          ) : approvedExtensions.length === 0 ? (
            <p className="text-text-muted">No approved extensions exist yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-text-muted border-b border-border-strong">
                    <th className="py-3 px-2">Extension</th>
                    <th className="py-3 px-2">Status Tags</th>
                    <th className="py-3 px-2 text-right">Admin Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedExtensions.map(ext => (
                    <tr key={ext.id} className="border-b border-border-strong/50 hover:bg-bg-panel-hover/30">
                      <td className="py-3 px-2">
                        <div className="font-bold text-accent-light">{ext.name}</div>
                        <div className="text-text-muted text-xs">Installs: {ext.downloads || 0}</div>
                      </td>
                      <td className="py-3 px-2 space-y-1">
                        {ext.untrusted && <span className="inline-block bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded text-[10px] font-bold mr-2">⚠️ UNTRUSTED</span>}
                        {ext.disabled ? (
                          <span className="inline-block bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[10px] font-bold">INSTALL DISABLED</span>
                        ) : (
                          <span className="inline-block bg-accent-subtle text-accent-light border border-border-strong px-2 py-0.5 rounded text-[10px] font-bold">ACTIVE</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex flex-col gap-1 items-end">
                          <div className="space-x-1">
                            <button 
                              onClick={() => handleToggleExtField(ext.id, 'untrusted', ext.untrusted)} 
                              className={`text-[10px] px-2 py-1 rounded border transition-colors ${ext.untrusted ? 'bg-bg-panel-hover text-text-muted border-gray-600' : 'bg-orange-900/30 text-orange-400 border-orange-500/50 hover:bg-orange-800/50'}`}
                            >
                              {ext.untrusted ? 'Mark Trusted' : 'Mark Untrusted'}
                            </button>
                            <button 
                              onClick={() => handleToggleExtField(ext.id, 'disabled', ext.disabled)} 
                              className={`text-[10px] px-2 py-1 rounded border transition-colors ${ext.disabled ? 'bg-bg-panel-hover text-text-muted border-gray-600' : 'bg-orange-900/30 text-orange-400 border-orange-500/50 hover:bg-orange-800/50'}`}
                            >
                              {ext.disabled ? 'Enable Install' : 'Disable Install'}
                            </button>
                            <button 
                              onClick={() => handleEditExtClick(ext)} 
                              className="text-[10px] bg-accent-subtle hover:bg-accent-subtle border border-border-strong text-accent-light px-2 py-1 rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteExt(ext.id)} 
                              className="text-[10px] bg-red-900/30 hover:bg-red-800/50 border border-red-500/50 text-red-400 px-2 py-1 rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {adminEditingExt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg-base/80 backdrop-blur-sm">
          <div className="bg-bg-panel border border-border-strong p-6 rounded-lg w-full max-w-2xl shadow-[0_0_20px_var(--accent-subtle)] max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-accent-light border-b border-border-subtle pb-4">Edit Extension: {adminEditingExt.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Extension Name</label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none" 
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-muted mb-1">Description</label>
                <textarea 
                  value={editForm.description}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none h-20" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-muted mb-1">Trigger Command</label>
                  <input 
                    type="text" 
                    value={editForm.trigger}
                    onChange={e => setEditForm(prev => ({ ...prev, trigger: e.target.value }))}
                    className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Bot Response</label>
                  <input
                    type="text"
                    value={editForm.response}
                    onChange={e => setEditForm(prev => ({ ...prev, response: e.target.value }))}
                    className="w-full bg-bg-base border border-border-subtle focus:border-border-strong text-text-main p-3 rounded outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-muted mb-1">Custom JS / TypeScript Execution (Advanced)</label>
                <textarea
                  rows={6}
                  value={editForm.code}
                  onChange={e => setEditForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full bg-bg-base font-mono text-sm border border-border-subtle focus:border-border-strong text-green-400 p-3 rounded outline-none"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-border-strong">
                <button 
                  onClick={handleSaveEdit}
                  className="flex-1 bg-accent-primary hover:bg-accent-hover text-text-main font-bold py-3 px-4 rounded transition-colors"
                >
                  Save Changes
                </button>
                <button 
                  onClick={() => setAdminEditingExt(null)}
                  className="flex-1 bg-bg-panel-hover hover:bg-gray-700 text-text-muted font-bold py-3 px-4 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
