import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Key, ArrowRight, Lock, Fingerprint, ShieldCheck } from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';

const LoginPage = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [mfaRequired, setMfaRequired] = useState(false);
    const [mfaToken, setMfaToken] = useState('');
    const [mfaCode, setMfaCode] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const data = await apiClient.post('/auth/login', { email, password });

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
            logger.error('[Login] Failed');
            setError(err.message || 'Authentication failed. Please check your credentials.');
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
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
        onLoginSuccess(data.access_token, data.user);
        setPassword('');
        setMfaCode('');
    };

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-inter text-slate-200 overflow-hidden relative">
            {/* Cinematic Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 mb-6 shadow-lg shadow-blue-500/20">
                        {mfaRequired ? (
                            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <path d="M12 8v4" />
                                <path d="M12 16h.01" />
                            </svg>
                        ) : (
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        )}
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">
                        {mfaRequired ? 'MFA Validation' : 'Living Data Network'}
                    </h1>
                    <p className="text-slate-500 text-sm">{mfaRequired ? 'Enter security verification code' : 'SECURE ACCESS PORTAL // V2.1.0'}</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

                {!mfaRequired ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="login-email" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Network ID</label>
                            <input
                                id="login-email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="admin@livingdata.network"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-colors"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div>
                            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Access Key</label>
                            <input
                                id="login-password"
                                type="password"
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-colors"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm tracking-widest uppercase hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Authenticating...' : 'Execute Handshake'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleMfaVerify} className="space-y-6">
                        <div>
                            <label htmlFor="mfa-code" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Verification Code</label>
                            <input
                                id="mfa-code"
                                type="text"
                                required
                                maxLength={6}
                                placeholder="000000"
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-center text-2xl font-bold tracking-[0.5em] focus:outline-none focus:border-blue-500/50 transition-colors"
                                value={mfaCode}
                                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || mfaCode.length !== 6}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold text-sm tracking-widest uppercase hover:from-cyan-500 hover:to-blue-500 transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Verifying...' : 'Confirm Identity'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setMfaRequired(false)}
                            className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            Back to Login
                        </button>
                    </form>
                )}


                <div className="mt-10 pt-6 border-t border-slate-800/50 text-center">
                    <p className="text-slate-600 text-[10px] tracking-widest uppercase">
                        Authorized Personnel Only • IP Logger Active
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
