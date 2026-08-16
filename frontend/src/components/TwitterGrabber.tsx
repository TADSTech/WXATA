import { useState, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { toPng } from 'html-to-image';

interface TwitterGrabberProps {
  addToast: (msg: string, type?: 'success' | 'error') => void;
  selectedAccountId: 'primary' | 'secondary';
}

export function TwitterGrabber({ addToast, selectedAccountId }: TwitterGrabberProps) {
  const [url, setUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [tweetData, setTweetData] = useState<{ text: string, imageUrls: string[], user?: {name: string, handle: string, profileImage: string} } | null>(null);
  const [error, setError] = useState('');
  const [savingToPc, setSavingToPc] = useState(false);
  const [sendingToSudo, setSendingToSudo] = useState(false);
  const [applyStickers, setApplyStickers] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState('+2348083696903');
  
  const cardRef = useRef<HTMLDivElement>(null);

  const getBackendUrl = () => {
    return ((import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:5000')
      .replace('ws://', 'http://')
      .replace('wss://', 'https://');
  };

  const getAuthHeaders = () => {
    const password = localStorage.getItem('wxata_dashboard_password') || '';
    return password ? { 'Authorization': `Bearer ${password}` } : {};
  };

  const handleFetch = async () => {
    if (!url) return;
    setFetching(true);
    setError('');
    try {
      const res = await fetch(`${getBackendUrl()}/api/twitter/grab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || `Server error: ${res.status}`;
        throw new Error(errorMsg);
      }
      const normalizedData = {
        text: data.text || '',
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
        user: data.user
      };
      setTweetData(normalizedData);
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      setError(errorMsg);
    } finally {
      setFetching(false);
    }
  };

  const generateImageData = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    try {
      return await toPng(cardRef.current, { cacheBust: false, pixelRatio: 2 });
    } catch (err) {
      console.error('Failed to generate image', err);
      return null;
    }
  };

  const handleSaveToPc = async () => {
    if (!tweetData) return;
    setSavingToPc(true);
    addToast('Generating image for download...', 'success');
    try {
      const base64 = await generateImageData();
      if (!base64) throw new Error("Could not generate image.");
      
      const link = document.createElement('a');
      link.href = base64;
      link.download = `tweet-card-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      addToast('Draft saved & image downloaded!', 'success');
    } catch (err: any) {
      addToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setSavingToPc(false);
    }
  };

  const handleSendToSudo = async () => {
    if (!tweetData) return;
    setSendingToSudo(true);
    addToast('Sending preview to mobile WhatsApp...', 'success');
    try {
      const base64 = await generateImageData();
      if (!base64) throw new Error("Could not generate image.");

      const response = await fetch(`${getBackendUrl()}/api/twitter/send-to-sudo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          imageDataBase64: base64,
          caption: tweetData.text,
          accountId: selectedAccountId
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        addToast('Preview sent to mobile!', 'success');
      } else {
        throw new Error(data.error || response.statusText);
      }
    } catch (err: any) {
      console.error('Failed to send to sudo number:', err);
      addToast(`Mobile send failed: ${err.message}`, 'error');
    } finally {
      setSendingToSudo(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Paste Tweet URL..." 
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetch()}
          className="flex-1 bg-bg-panel border border-border-strong p-2.5 text-text-main outline-none text-xs rounded hover:border-accent-primary/50 focus:border-accent-primary"
        />
        <button 
          onClick={handleFetch} 
          disabled={fetching || !url}
          className="border border-border-strong bg-accent-subtle hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-accent-light px-4 py-2.5 text-xs font-bold rounded transition-colors"
        >
          {fetching ? '⟳ Fetching...' : '📥 Grab'}
        </button>
      </div>
      
      {error && (
        <div className="border border-danger-subtle bg-danger-subtle/30 text-danger-text p-2 rounded text-[10px]">
          ⚠ {error}
        </div>
      )}

      {tweetData && (
        <div className="border border-border-strong/50 rounded-lg overflow-hidden bg-bg-panel/50">
          {/* Preview Section */}
          <div className="border-b border-border-strong/30 p-4 space-y-3 flex flex-col items-center">
            <div className="w-full text-xs uppercase tracking-widest text-text-muted font-bold text-left mb-2">Preview</div>
            
            {/* The generated square card */}
            <div 
              ref={cardRef}
              className="relative flex flex-col justify-center items-stretch overflow-hidden"
              style={{
                width: '400px',
                height: '400px',
                background: 'radial-gradient(circle at 0% 0%, rgba(0,0,0,0.3) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(0,0,0,0.3) 0%, transparent 60%), repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 2px, transparent 2px, transparent 12px), #7c3aed',
                borderRadius: '16px',
                paddingTop: '48px',
                paddingBottom: '48px',
                paddingLeft: '24px',
                paddingRight: '24px'
              }}
            >
              {applyStickers && (
                <>
                  {/* Phone Number / Branding Text - moved to top corner, shrunk, no background, custom font */}
                  <div 
                    className="absolute top-4 left-6 text-white text-[10px] tracking-wider opacity-95 flex flex-col text-left pointer-events-none"
                    style={{ fontFamily: '"Space Grotesk", "Inter", "Noto Color Emoji", sans-serif' }}
                  >
                     <span className="text-[8px] uppercase tracking-widest opacity-80 font-bold mb-0.5">Tadstech Entertainment</span>
                     <span className="font-semibold">{phoneNumber}</span>
                  </div>
                  
                  {/* Shrink QR Code */}
                  <div className="absolute bottom-3 right-3 w-10 h-10 bg-white rounded p-0.5 shadow-md pointer-events-none">
                     <img src="/qr_code.png" alt="QR Code" className="w-full h-full object-cover" 
                          onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjYyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjIyIiBmaWxsPSIjMzMzIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjMiPlFSPC90ZXh0Pjwvc3ZnPg==' }} />
                  </div>
                </>
              )}

              <div className="w-full flex-1 flex flex-col gap-4 bg-white border border-slate-100 rounded-xl p-4 shadow-lg overflow-hidden">
                <div 
                  className="text-slate-900 text-sm font-semibold whitespace-pre-wrap flex-shrink-0 leading-relaxed"
                  style={{ fontFamily: '"Inter", "Noto Color Emoji", sans-serif' }}
                >
                  {tweetData.text}
                </div>
                
                {tweetData.imageUrls && tweetData.imageUrls.length > 0 && (
                  <div className="flex-1 w-full relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <img 
                      src={tweetData.imageUrls[0]} 
                      alt="Tweet media"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="w-full mt-4 flex justify-between items-center bg-bg-panel border border-border-strong/30 rounded p-3">
               <textarea 
                  value={tweetData.text} 
                  onChange={e => setTweetData({ ...tweetData, text: e.target.value })}
                  className="w-full bg-bg-base border border-border-strong/50 p-2 text-text-main text-xs h-16 rounded outline-none focus:border-accent-primary/50"
                  placeholder="Edit text..."
                />
            </div>

            <div className="w-full flex items-center gap-2 mt-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-accent-light transition-colors">
                <input 
                  type="checkbox" 
                  checked={applyStickers} 
                  onChange={e => setApplyStickers(e.target.checked)}
                  className="cursor-pointer"
                />
                <span>Apply Branding (QR & Number)</span>
              </label>
              
              {applyStickers && (
                <input 
                  type="text" 
                  value={phoneNumber} 
                  onChange={e => setPhoneNumber(e.target.value)}
                  className="flex-1 bg-bg-base border border-border-strong/50 p-1.5 text-text-main text-xs rounded outline-none focus:border-accent-primary/50"
                  placeholder="Enter phone number"
                />
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                onClick={handleSaveToPc}
                disabled={savingToPc}
                className="flex items-center justify-center gap-2 border border-info-base bg-info-subtle hover:bg-info-base/20 disabled:opacity-50 disabled:cursor-not-allowed text-info-text px-4 py-3 text-xs font-bold rounded-lg transition-all"
              >
                {savingToPc ? <RefreshCw className="w-3 h-3 animate-spin" /> : '💾'} 
                {savingToPc ? 'Saving...' : 'Save to Computer'}
              </button>
              
              <button 
                onClick={handleSendToSudo}
                disabled={sendingToSudo}
                className="flex items-center justify-center gap-2 border border-accent-primary bg-accent-subtle hover:bg-accent-primary/20 disabled:opacity-50 disabled:cursor-not-allowed text-accent-light px-4 py-3 text-xs font-bold rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.1)]"
              >
                {sendingToSudo ? <RefreshCw className="w-3 h-3 animate-spin" /> : '📱'} 
                {sendingToSudo ? 'Sending...' : 'Send to Mobile (Sudo)'}
              </button>
            </div>
            
            <button 
              onClick={() => setTweetData(null)}
              className="w-full border border-border-strong text-text-muted hover:text-danger-text p-2.5 text-[10px] uppercase tracking-widest rounded transition-colors"
            >
              Discard Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
