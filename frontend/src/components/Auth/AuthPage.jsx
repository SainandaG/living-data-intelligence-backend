import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Key, ArrowRight, Lock, Fingerprint, ShieldCheck, User, Mail, Building, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';

const AuthPage = ({ onLoginSuccess }) => {
    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState('viewer');
    const [organization, setOrganization] = useState('');
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // MFA State
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaToken, setMfaToken] = useState('');
    const [mfaCode, setMfaCode] = useState('');

    // --- VALIDATION ---
    const isEmailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);
    const isPasswordStrong = useMemo(() => {
        if (password.length < 8) return { score: 0, label: 'Weak', color: 'text-red-400' };
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        const hasNum = /\d/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        
        let strength = 1;
        if (hasSpecial) strength++;
        if (hasNum) strength++;
        if (hasUpper) strength++;
        
        if (strength >= 4) return { score: 3, label: 'Strong', color: 'text-green-400' };
        if (strength >= 2) return { score: 2, label: 'Medium', color: 'text-yellow-400' };
        return { score: 1, label: 'Weak', color: 'text-red-400' };
    }, [password]);

    const passwordsMatch = password === confirmPassword && confirmPassword !== '';

    const canSubmitRegister = isEmailValid && password.length >= 8 && passwordsMatch && agreeTerms && fullName.length > 0;

    // --- HANDLERS ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
            const payload = mode === 'login' 
                ? { email, password }
                : { full_name: fullName, email, password, role, tenant_id: organization || 'default' };

            const data = await apiClient.post(endpoint, payload);

            if (data.mfa_required) {
                setMfaRequired(true);
                setMfaToken(data.mfa_token);
                setLoading(false);
                return;
            }

            if (data.access_token) {
                handleSuccess(data);
            } else {
                setError('Invalid server response');
            }
        } catch (err) {
            logger.error(`[Auth] ${mode} Failed`);
            setError(err.message || 'Authentication failed. Please check your inputs.');
        } finally {
            if (!mfaRequired) setLoading(false);
        }
    };

    const handleMfaVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const data = await apiClient.post('/mfa/verify', {
                mfa_token: mfaToken,
                code: mfaCode
            });

            if (data.access_token) {
                handleSuccess(data);
            } else {
                setError('MFA verification failed');
            }
        } catch (err) {
            logger.error('[MFA] Verification failed');
            setError(err.message || 'Invalid MFA code');
        } finally {
            setLoading(false);
        }
    };

    const handleSuccess = (data) => {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        if (rememberMe) {
            localStorage.setItem('remembered_email', email);
        }
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
        onLoginSuccess(data.access_token, data.user);
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <div className="h-screen w-screen bg-[#020617] overflow-y-auto font-inter text-slate-200 relative custom-scrollbar">
            {/* Cinematic Background Elements */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-20 pointer-events-none">
                    <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent"></div>
                </div>
            </div>

            <div className="min-h-full flex items-center justify-center p-4 py-12 relative z-10">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-lg bg-slate-900/40 backdrop-blur-2xl border border-slate-800/50 p-8 rounded-3xl shadow-2xl"
                >
                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div 
                        layoutId="logo"
                        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-6 shadow-lg shadow-blue-500/20"
                    >
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </motion.div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-1">
                        {mfaRequired ? 'Multi-Factor Validation' : mode === 'login' ? 'System Login' : 'Create Network Identity'}
                    </h1>
                    <p className="text-slate-500 text-[10px] tracking-[0.2em] uppercase font-mono">
                        {mfaRequired ? 'IDENTITY_VERIFICATION_REQUIRED' : `ACCESS_LEVEL_${mode.toUpperCase()}_v3.2`}
                    </p>
                </div>

                {/* Tabs */}
                {!mfaRequired && (
                    <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800/50 mb-8">
                        <button 
                            onClick={() => switchMode('login')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${mode === 'login' ? 'bg-slate-800 text-blue-400 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Sign In
                        </button>
                        <button 
                            onClick={() => switchMode('register')}
                            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${mode === 'register' ? 'bg-slate-800 text-blue-400 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Register
                        </button>
                    </div>
                )}

                {error && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-start gap-3"
                    >
                        <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        {error}
                    </motion.div>
                )}

                {!mfaRequired ? (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <AnimatePresence mode="wait">
                            {mode === 'register' && (
                                <motion.div 
                                    key="register-fields"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="space-y-5 overflow-hidden"
                                >
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                            <input
                                                type="text"
                                                required
                                                placeholder="John Doe"
                                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-all"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Assigned Role</label>
                                            <select 
                                                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                                                value={role}
                                                onChange={(e) => setRole(e.target.value)}
                                            >
                                                <option value="viewer">Viewer</option>
                                                <option value="editor">Editor</option>
                                                <option value="analyst">Analyst</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Organisation</label>
                                            <div className="relative">
                                                <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                                <input
                                                    type="text"
                                                    placeholder="Acme Corp"
                                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-all"
                                                    value={organization}
                                                    onChange={(e) => setOrganization(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Network Identity (Email)</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                <input
                                    type="email"
                                    required
                                    placeholder="operator@livingdata.net"
                                    className={`w-full bg-slate-950/50 border rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none transition-all ${email && !isEmailValid ? 'border-rose-500/50' : 'border-slate-800 focus:border-blue-500/50'}`}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2 px-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Access Key</label>
                                {mode === 'login' && (
                                    <button type="button" className="text-[10px] text-blue-500 hover:text-blue-400 font-bold uppercase tracking-wider transition-colors">Forgot?</button>
                                )}
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl pl-12 pr-12 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            
                            {/* Strength Indicator */}
                            {mode === 'register' && password.length > 0 && (
                                <div className="mt-2 flex items-center gap-2 px-1">
                                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden flex">
                                        {[0, 1, 2].map((i) => (
                                            <div key={i} className={`flex-1 h-full border-r border-slate-900 last:border-0 ${i <= isPasswordStrong.score ? (isPasswordStrong.score === 0 ? 'bg-rose-500' : isPasswordStrong.score === 3 ? 'bg-emerald-500' : 'bg-amber-500') : ''}`} />
                                        ))}
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${isPasswordStrong.color}`}>{isPasswordStrong.label}</span>
                                </div>
                            )}
                        </div>

                        {mode === 'register' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Confirm Access Key</label>
                                <div className="relative">
                                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                    <input
                                        type="password"
                                        required
                                        placeholder="••••••••"
                                        className={`w-full bg-slate-950/50 border rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-slate-700 focus:outline-none transition-all ${confirmPassword && !passwordsMatch ? 'border-rose-500/50' : 'border-slate-800 focus:border-blue-500/50'}`}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    {confirmPassword && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            {passwordsMatch ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-rose-500" />}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Options */}
                        <div className="flex items-center justify-between px-1">
                            {mode === 'login' ? (
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only"
                                            checked={rememberMe}
                                            onChange={(e) => setRememberMe(e.target.checked)}
                                        />
                                        <div className={`w-4 h-4 border rounded border-slate-700 transition-all ${rememberMe ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 group-hover:border-slate-500'}`}>
                                            {rememberMe && <CheckCircle2 className="w-full h-full text-white" />}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-300 transition-colors">Remember Session</span>
                                </label>
                            ) : (
                                <label className="flex items-start gap-2 cursor-pointer group">
                                    <div className="relative flex items-center mt-0.5">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only"
                                            checked={agreeTerms}
                                            onChange={(e) => setAgreeTerms(e.target.checked)}
                                        />
                                        <div className={`w-4 h-4 border rounded border-slate-700 transition-all ${agreeTerms ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 group-hover:border-slate-500'}`}>
                                            {agreeTerms && <CheckCircle2 className="w-full h-full text-white" />}
                                        </div>
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed group-hover:text-slate-300 transition-colors">
                                        I accept the <span className="text-blue-500">Service Protocols</span> and <span className="text-blue-500">Security Privacy Policy</span>
                                    </span>
                                </label>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading || (mode === 'register' && !canSubmitRegister)}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black text-[10px] tracking-[0.3em] uppercase hover:from-blue-500 hover:to-cyan-500 transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] disabled:opacity-30 disabled:grayscale disabled:active:scale-100 flex items-center justify-center gap-2 overflow-hidden relative group"
                        >
                            <span className="relative z-10">{loading ? 'Processing...' : mode === 'login' ? 'Execute Handshake' : 'Initialize Identity'}</span>
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                        </button>

                        <div className="text-center">
                            <button 
                                type="button"
                                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                                className="text-[10px] font-bold text-slate-500 hover:text-blue-400 uppercase tracking-widest transition-colors"
                            >
                                {mode === 'login' ? "Don't have an account? Create one →" : "Already have an account? Sign in →"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleMfaVerify} className="space-y-6">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 text-center">Security Verification Code</label>
                            <div className="flex justify-center gap-2">
                                <input
                                    id="mfa-code"
                                    type="text"
                                    required
                                    autoFocus
                                    maxLength={6}
                                    placeholder="000000"
                                    className="w-full max-w-[240px] bg-slate-950 border border-slate-800 rounded-2xl px-4 py-5 text-white text-center text-3xl font-black tracking-[0.5em] focus:outline-none focus:border-blue-500 shadow-inner transition-all"
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                />
                            </div>
                            <p className="mt-4 text-center text-[10px] text-slate-500 font-mono tracking-widest">Awaiting TOTP response cluster...</p>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || mfaCode.length !== 6}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-[10px] tracking-[0.3em] uppercase hover:from-cyan-500 hover:to-blue-500 transition-all shadow-xl shadow-blue-900/20 active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Verifying...' : 'Validate Authentication'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setMfaRequired(false)}
                            className="w-full py-2 text-[10px] font-bold text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
                        >
                            Abort MFA Sequence
                        </button>
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-slate-800/30 text-center">
                    <div className="flex items-center justify-center gap-4">
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] text-slate-700 font-mono">TLS_AES_256_GCM</span>
                        </div>
                        <div className="w-1 h-1 rounded-full bg-slate-800" />
                        <div className="flex flex-col items-center">
                            <span className="text-[8px] text-slate-700 font-mono">ENCRYPTED_ENDPOINT</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    </div>
    );
};

export default AuthPage;
