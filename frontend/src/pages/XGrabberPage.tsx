import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Terminal, ChevronLeft, LayoutDashboard } from 'lucide-react';
import { supabase } from '../supabase';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';
import { TwitterGrabber } from '../components/TwitterGrabber';

const XGrabberPage = () => {
  const navigate = useNavigate();
  const { username } = useParams();
  const { toasts, addToast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      setLoading(false);
    };
    checkSession();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-main font-mono p-4 md:p-8">
      <ToastContainer toasts={toasts} />
      
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-accent-primary" />
            <h1 className="text-xl font-bold tracking-tighter">X_GRABBER v1.0</h1>
          </div>
          <div className="flex gap-2">
             <button
                onClick={() => navigate(`/tv/${username}`)}
                className="flex items-center gap-2 text-text-muted hover:text-accent-light transition-colors uppercase text-[10px] tracking-widest border border-border-strong px-2 py-1 rounded"
              >
                <LayoutDashboard className="w-3 h-3" /> Dashboard
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-text-muted hover:text-accent-light transition-colors uppercase text-[10px] tracking-widest border border-border-strong px-2 py-1 rounded"
              >
                <ChevronLeft className="w-3 h-3" /> Home
              </button>
          </div>
        </header>

        <div className="bg-bg-panel border border-border-strong rounded-xl p-6 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold uppercase tracking-widest flex items-center gap-2">
              𝕏 Content Grabber
            </h2>
            <p className="text-text-muted text-xs mt-1">
              Optimized for mobile. Paste a tweet URL to generate your branded card.
            </p>
          </div>
          
          <TwitterGrabber addToast={addToast} selectedAccountId="secondary" />
        </div>

        <div className="text-center pt-4">
          <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] opacity-40">
            Powered by WXATA Engine • Premium Content Suite
          </p>
        </div>
      </div>
    </div>
  );
};

export default XGrabberPage;
