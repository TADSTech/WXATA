import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Login() {
  const [identifier, setIdentifier] = useState(''); // email or username
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const input = identifier.trim();
      let emailToUse = input;

      // If the input doesn't look like an email, treat it as a username
      // and look up the associated email first
      if (!input.includes('@')) {
        const { data: userRow, error: lookupError } = await supabase
          .from('users')
          .select('email')
          .eq('username', input)
          .maybeSingle();

        if (lookupError) {
          throw new Error(`Username lookup failed: ${lookupError.message}`);
        }
        if (!userRow) {
          throw new Error(`No account found with username "${input}". Check the spelling or use your email instead.`);
        }
        emailToUse = userRow.email;
      }

      const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (signInError) throw signInError;

      // Look up username to route to the correct dashboard
      const { data: userRow } = await supabase
        .from('users')
        .select('username')
        .eq('uid', session.user.id)
        .maybeSingle();

      if (userRow?.username) {
        navigate(`/dashboard/${userRow.username}`);
      } else {
        navigate('/dashboard/user');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4">
      <div className="bg-bg-base border border-border-strong p-8 rounded-xl w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-10 h-10 bg-accent-primary rounded-lg font-black text-bg-base text-lg mb-3">W</div>
          <h2 className="text-3xl font-bold text-accent-primary">Sign In</h2>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">
              Username or Email
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              placeholder="yourname or you@email.com"
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary placeholder:text-text-muted/40"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Password</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-primary hover:bg-accent-hover text-bg-base font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-text-muted">
          Don't have an account?{' '}
          <Link to="/register" className="text-accent-primary hover:underline">Register here</Link>
        </p>
      </div>
    </div>
  );
}
