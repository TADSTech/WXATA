import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { supabase } from '../supabase';

type State = 'loading' | 'success' | 'error';

export default function Confirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>('loading');
  const [username, setUsername] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const run = async () => {
      // Supabase appends token_hash + type to the confirmation URL.
      // When the user clicks the link, Supabase JS SDK picks up the
      // hash fragment automatically and exchanges it for a session.
      // We just need to wait for the session to be established.
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type') as 'signup' | 'recovery' | null;

      if (tokenHash && type) {
        // Exchange the token for a session
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          setErrorMsg(error.message);
          setState('error');
          return;
        }
      }

      // Get the now-active session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No token in URL and no session — might be a direct visit
        setErrorMsg('No confirmation token found. Please check your email link.');
        setState('error');
        return;
      }

      // Look up the username so we can redirect to the right dashboard
      const { data: userRow } = await supabase
        .from('users')
        .select('username')
        .eq('uid', session.user.id)
        .maybeSingle();

      setUsername(userRow?.username ?? '');
      setState('success');

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        if (userRow?.username) {
          navigate(`/dashboard/${userRow.username}`);
        } else {
          navigate('/login');
        }
      }, 3000);
    };

    run();
  }, []);

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-bg-panel border border-border-strong rounded-2xl p-10 w-full max-w-md text-center space-y-6"
      >
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-accent-primary rounded-xl flex items-center justify-center font-black text-bg-base text-2xl">
            W
          </div>
        </div>

        {state === 'loading' && (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="flex justify-center"
            >
              <Loader className="w-10 h-10 text-accent-primary" />
            </motion.div>
            <h2 className="text-xl font-bold text-text-main">Confirming your account...</h2>
            <p className="text-text-muted text-sm">Just a moment.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="flex justify-center"
            >
              <CheckCircle className="w-14 h-14 text-green-400" />
            </motion.div>
            <h2 className="text-2xl font-black text-text-main">Email confirmed!</h2>
            <p className="text-text-muted text-sm">
              {username
                ? <>Welcome, <span className="text-accent-light font-bold">{username}</span>. Redirecting to your dashboard...</>
                : 'Account confirmed. Redirecting to login...'}
            </p>
            <div className="w-full bg-border-subtle rounded-full h-1 overflow-hidden">
              <motion.div
                className="h-full bg-accent-primary"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 3, ease: 'linear' }}
              />
            </div>
            <button
              onClick={() => username ? navigate(`/dashboard/${username}`) : navigate('/login')}
              className="w-full bg-accent-primary hover:bg-accent-hover text-bg-base font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-widest"
            >
              Go to Dashboard
            </button>
          </>
        )}

        {state === 'error' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="flex justify-center"
            >
              <XCircle className="w-14 h-14 text-red-400" />
            </motion.div>
            <h2 className="text-2xl font-black text-text-main">Confirmation failed</h2>
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              {errorMsg}
            </p>
            <p className="text-text-muted text-sm">
              The link may have expired or already been used.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/register')}
                className="w-full bg-accent-primary hover:bg-accent-hover text-bg-base font-bold py-3 rounded-xl transition-colors text-sm uppercase tracking-widest"
              >
                Try Registering Again
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full border border-border-strong text-text-muted hover:text-text-main py-3 rounded-xl transition-colors text-sm"
              >
                Go to Login
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
