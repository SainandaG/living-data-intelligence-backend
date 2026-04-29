import React, { useState } from 'react';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';

const LoginPage = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const data = await apiClient.post('/auth/login', { email, password });

            if (data.access_token) {
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
                
                // data contains: { access_token, refresh_token, user: { role, permissions, ... } }
                onLoginSuccess(data.access_token, data.user);
                
                // Clear password from state before handing off — don't leave credentials in memory
                setPassword('');
            } else {
                setError('Invalid server response');
            }
        } catch (err) {
            logger.error('[Login] Failed');
            // apiClient normalizes errors — use err.message which is already safe/user-friendly
            setError(err.message || 'Authentication failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
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
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mb-2">
                        Living Data Network
                    </h1>
                    <p className="text-slate-500 text-sm">SECURE ACCESS PORTAL // V2.1.0</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-3">
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {error}
                    </div>
                )}

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
                        className={`w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-sm tracking-widest uppercase hover:from-blue-500 hover:to-cyan-500 transition-all shadow-lg shadow-blue-900/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2`}
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Authenticating...
                            </>
                        ) : (
                            'Execute Handshake'
                        )}
                    </button>
                </form>

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
