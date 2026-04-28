import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { SocialBanner } from '../components/SocialBanner';

const WHATSAPP_LINK = 'https://wa.me/2347041029093';

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
      // 1. Verify user_code exists and is valid
      const { data: codeData, error: codeError } = await supabase
        .from('user_codes')
        .select('id, used, suspended')
        .eq('code', userCode)
        .single();

      if (codeError || !codeData) {
        throw new Error(`Invalid User Code. DM us to purchase access: ${WHATSAPP_LINK}`);
      }

      if (codeData.suspended) {
        throw new Error(`This code has been suspended. Contact us: ${WHATSAPP_LINK}`);
      }

      if (codeData.used) {
        throw new Error(`This code has already been used. DM us if you need help: ${WHATSAPP_LINK}`);
      }

      // 2. Check if username is taken
      const { data: existingUser, error: usernameError } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (usernameError) {
        throw new Error('Error checking username availability. Please try again.');
      }

      if (existingUser) {
        throw new Error('Username is already taken.');
      }

      // 3. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError || !authData.user) {
        throw new Error(signUpError?.message ?? 'Failed to create account. Please try again.');
      }

      const uid = authData.user.id;

      // 4. Insert user record
      const { error: insertError } = await supabase.from('users').insert({
        uid,
        name,
        username,
        email,
        user_code: userCode,
        created_at: new Date().toISOString(),
      });

      if (insertError) {
        throw new Error('Failed to save user profile. Please contact support.');
      }

      // 5. Mark code as used
      const { error: updateError } = await supabase
        .from('user_codes')
        .update({
          used: true,
          used_by: email,
          used_at: new Date().toISOString(),
        })
        .eq('id', codeData.id);

      if (updateError) {
        // Non-fatal: user is created, just log the issue
        console.error('Failed to mark user_code as used:', updateError);
      }

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
        <h2 className="text-3xl font-bold text-accent-primary mb-6 text-center">Register</h2>
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded mb-4 break-words">
            {error}
          </div>
        )}
        <SocialBanner variant="register" />
        <form onSubmit={handleRegister} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Full Name</label>
            <input
              type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Username</label>
            <input
              type="text" required value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Password</label>
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-muted">Registration Code</label>
            <input
              type="text" required value={userCode} onChange={(e) => setUserCode(e.target.value)}
              placeholder="Provided by administrator"
              className="w-full bg-bg-panel-hover border border-border-subtle rounded px-4 py-2 text-text-main focus:outline-none focus:border-accent-primary"
            />
          </div>
          <button
            disabled={loading}
            type="submit"
            className="w-full bg-accent-primary hover:bg-accent-hover text-bg-base font-bold py-2 px-4 rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-accent-primary hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
