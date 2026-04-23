import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      // Look up the username tied to this uid so we can route to the correct dashboard
      const q = query(collection(db, 'users'), where('uid', '==', credential.user.uid));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const username = snap.docs[0]!.data().username as string;
        navigate(`/dashboard/${username}`);
      } else {
        // Fallback: uid-based generic route (handles legacy accounts without a users doc)
        navigate('/dashboard/user');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4">
      <div className="bg-bg-base border border-border-strong p-8 rounded-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-primary mb-6 text-center">Login</h2>
        {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Email</label>
            <input 
              type="email" 
              required
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-primary"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Password</label>
            <input 
              type="password" 
              required
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-primary"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-2 px-4 rounded transition-colors">
            Sign In
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Don't have an account? <Link to="/register" className="text-primary hover:underline">Register here</Link>
        </p>
      </div>
    </div>
  );
}
