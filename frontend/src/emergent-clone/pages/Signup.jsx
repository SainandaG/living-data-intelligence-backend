import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Database, Loader2 } from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { signInWithPopup } from 'firebase/auth';
import { auth as firebaseAuth, googleProvider } from '../../config/firebase';

const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

function handleSuccess(data) {
  localStorage.setItem('token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  window.location.href = '/';
}

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.post('/auth/register', {
        full_name: fullName, email, password, role: 'viewer', tenant_id: 'default'
      });
      if (data.access_token) handleSuccess(data);
      else setError('Registration failed');
    } catch (err) {
      setError(err.message || 'Registration failed. Email may already exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      if (!firebaseAuth) throw new Error('Google Sign-In not configured.');
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const idToken = await result.user.getIdToken();
      const data = await apiClient.post('/auth/google', { id_token: idToken });
      if (data.access_token) handleSuccess(data);
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-dark)] text-[var(--text-main)] min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--primary)]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--secondary)]/5 rounded-full blur-[120px]" />
      </div>
      <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }} className="w-full max-w-sm relative z-10">
        <motion.div variants={fadeUp} className="text-center mb-8">
          <Link to="/site" className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center shadow-[0_0_20px_rgba(13,231,242,0.3)]">
              <Database size={20} className="text-black" />
            </div>
          </Link>
          <h1 className="text-2xl font-display font-bold">Create Network Identity</h1>
          <p className="text-[var(--text-muted)] text-[10px] font-mono tracking-widest uppercase mt-1">ACCESS_LEVEL_REGISTER_v3.2</p>
        </motion.div>

        {error && (
          <motion.div variants={fadeUp} className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <button onClick={handleGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 glass-panel rounded-xl text-sm hover:border-[var(--primary)]/30 transition-all cursor-pointer mb-4 disabled:opacity-50">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
            Continue with Google
          </button>
        </motion.div>

        <motion.div variants={fadeUp} className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--glass-border)]" />
          <span className="text-xs text-[var(--text-muted)] font-mono">or</span>
          <div className="flex-1 h-px bg-[var(--glass-border)]" />
        </motion.div>

        <motion.form variants={fadeUp} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="signup-name" className="block text-sm text-[var(--text-muted)] mb-1">Full Name</label>
            <input id="signup-name" type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--glass-border)] rounded-lg text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_8px_rgba(13,231,242,0.15)] transition-all" />
          </div>
          <div>
            <label htmlFor="signup-email" className="block text-sm text-[var(--text-muted)] mb-1">Email</label>
            <input id="signup-email" type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--glass-border)] rounded-lg text-[var(--text-main)] placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_8px_rgba(13,231,242,0.15)] transition-all" />
          </div>
          <div>
            <label htmlFor="signup-pass" className="block text-sm text-[var(--text-muted)] mb-1">Password</label>
            <input id="signup-pass" type="password" required value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="w-full px-4 py-2.5 bg-[var(--bg-dark)] border border-[var(--glass-border)] rounded-lg text-[var(--text-main)] placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--primary)] focus:shadow-[0_0_8px_rgba(13,231,242,0.15)] transition-all" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-[var(--primary)] text-black font-semibold rounded-xl hover:shadow-[0_0_16px_rgba(13,231,242,0.4)] transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={18} className="animate-spin" /> Creating Account...</> : 'Create Account'}
          </button>
        </motion.form>

        <motion.p variants={fadeUp} className="text-center text-sm text-[var(--text-muted)] mt-6">
          Already have an account?{' '}
          <Link to="/site/login" className="text-[var(--primary)] hover:text-[var(--primary)]/80 cursor-pointer">Sign in</Link>
        </motion.p>
        <motion.p variants={fadeUp} className="text-center text-xs text-[var(--text-muted)]/60 mt-4">
          By continuing, you agree to our <a href="#" className="underline cursor-pointer">Terms of Service</a> and <a href="#" className="underline cursor-pointer">Privacy Policy</a>.
        </motion.p>
      </motion.div>
    </div>
  );
}
