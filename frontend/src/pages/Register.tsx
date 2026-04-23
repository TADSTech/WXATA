import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export default function Register() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userCode, setUserCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Verify user_code
      const codeRef = doc(db, 'user_codes', userCode);
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        throw new Error('Invalid User Code.');
      }

      const codeData = codeSnap.data();
      if (codeData.used) {
        throw new Error('User Code has already been used.');
      }

      // 2. Check if username is taken (simplified, for robust implementation use a batched write or specific collection)
      const userRef = doc(db, 'users', username);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        throw new Error('Username is already taken.');
      }

      // 3. Create auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 4. Save user document
      await setDoc(userRef, {
        uid: user.uid,
        name,
        username,
        email,
        userCode,
        createdAt: new Date().toISOString()
      });

      // 5. Mark code as used
      await updateDoc(codeRef, {
        used: true,
        usedBy: email,
        usedAt: new Date().toISOString()
      });

      navigate(`/dashboard/${username}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-4">
      <div className="bg-bg-base border border-border-strong p-8 rounded-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-primary mb-6 text-center">Register</h2>
        {error && <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4">{error}</div>}
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Full Name</label>
            <input 
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Username</label>
            <input 
              type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Email</label>
            <input 
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Password</label>
            <input 
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Registration Code</label>
            <input 
              type="text" required value={userCode} onChange={(e) => setUserCode(e.target.value)}
              placeholder="Provided by administrator"
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent"
            />
          </div>
          <button disabled={loading} type="submit" className="w-full bg-primary hover:bg-primary/90 text-black font-bold py-2 px-4 rounded transition-colors disabled:opacity-50">
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
