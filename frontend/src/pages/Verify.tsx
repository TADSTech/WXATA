import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { supabase } from '../supabase';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get('email') ?? '';
  const username = searchParams.get('username') ?? '';

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState('');

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setResendError('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err: any) {
      setResendError(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
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

        {/* Animated envelope */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 180 }}
          className="flex justify-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center">
            <Mail className="w-10 h-10 text-accent-primary" />
          </div>
        </motion.div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-text-main">Check your email</h1>
          {username && (
            <p className="text-text-muted text-sm">
              Welcome, <span className="text-accent-light font-bold">{username}</span>!
            </p>
          )}
          <p className="text-text-muted text-sm leading-relaxed">
            We sent a confirmation link to{' '}
            {email
              ? <span className="text-accent-light font-semibold">{email}</span>
              : 'your email address'
            }.
            <br />
            Click the link to activate your account.
          </p>
        </div>

        {/* Steps */}
        <div className="bg-bg-base border border-border-subtle rounded-xl p-4 text-left space-y-3">
          {[
            { n: '1', text: 'Open your email inbox' },
            { n: '2', text: 'Find the email from WXATA' },
            { n: '3', text: 'Click "Confirm Email"' },
            { n: '4', text: "You'll be taken to your dashboard" },
          ].map(step => (
            <div key={step.n} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-accent-primary/20 border border-accent-primary/40 flex items-center justify-center text-accent-primary text-xs font-bold shrink-0">
                {step.n}
              </div>
              <span className="text-sm text-text-muted">{step.text}</span>
            </div>
          ))}
        </div>

        {/* Resend */}
        <div className="space-y-2">
          {resent ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-2 text-green-400 text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Email resent successfully!
            </motion.div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending || !email}
              className="flex items-center justify-center gap-2 w-full border border-border-strong text-text-muted hover:text-text-main hover:border-accent-primary/50 py-2.5 rounded-xl transition-colors text-sm disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
              {resending ? 'Resending...' : "Didn't get it? Resend email"}
            </button>
          )}
          {resendError && (
            <p className="text-red-400 text-xs">{resendError}</p>
          )}
        </div>

        <div className="pt-2 border-t border-border-subtle space-y-2">
          <p className="text-xs text-text-muted">
            Wrong email?{' '}
            <Link to="/register" className="text-accent-primary hover:underline">
              Register again
            </Link>
          </p>
          <p className="text-xs text-text-muted">
            Already confirmed?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-accent-primary hover:underline"
            >
              Sign in
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
