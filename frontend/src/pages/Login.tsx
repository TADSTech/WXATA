import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: session, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      // Look up the username tied to this uid so we can route to the correct dashboard
      const { data: userRow } = await supabase
        .from('users')
        .select('username')
        .eq('uid', session.user.id)
        .single();

      if (userRow?.username) {
        navigate(`/dashboard/${userRow.username}`);
      } else {
        // Fallback: generic route (handles accounts without a users row)
        navigate('/dashboard/user');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4">
      <div className="bg-bg-base border border-border-strong p-8 rounded-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-accent-primary mb-6 text-center">Login</h2>
        {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Email</label>
            <input 
              type="email" 
              required
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Password</label>
            <input 
              type="password" 
              required
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full bg-accent-primary hover:bg-accent-hover text-bg-base font-bold py-2 px-4 rounded transition-colors">
            Sign In
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-text-muted">
          Don't have an account? <Link to="/register" className="text-accent-primary hover:underline">Register here</Link>
        </p>
      </div>
    </div>
  );
}
