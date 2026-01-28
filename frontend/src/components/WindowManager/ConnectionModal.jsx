import React, { useState } from 'react';
import { Database, Server, Key, User, Save, Link, AlertCircle } from 'lucide-react';
import { useWindowManager } from '../../context/WindowManagerContext';

const ConnectionModal = ({ onClose }) => {
    const { setConnectionId } = useWindowManager();
    const [config, setConfig] = useState({
        db_type: 'postgresql',
        host: 'localhost',
        port: '5432',
        database: 'postgres',
        username: 'postgres',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleDatabaseTypeChange = (e) => {
        const type = e.target.value;
        const defaultPorts = {
            postgresql: '5432',
            neon: '5432',
            mysql: '3306',
            mongodb: '27017'
        };
        setConfig({
            ...config,
            db_type: type,
            port: defaultPorts[type] || config.port
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Abort controller for timeout
        const controller = new AbortController();
        const TIMEOUT_MS = 120000; // 120s for slow DB wake-ups

        const timeoutId = setTimeout(() => {
            console.warn(`⏱️ Connection timeout reached (${TIMEOUT_MS / 1000}s). Aborting request.`);
            controller.abort();
        }, TIMEOUT_MS);

        try {
            // Ensure port is an integer
            const payload = {
                ...config,
                port: parseInt(config.port, 10)
            };

            console.log('Attempting to connect with:', payload);

            const response = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errorMessage = 'Connection failed';
                try {
                    const errData = await response.json();
                    console.error('Connection error response (JSON):', errData);
                    if (errData.detail) {
                        errorMessage = typeof errData.detail === 'object'
                            ? (errData.detail.message || JSON.stringify(errData.detail))
                            : errData.detail;
                    }
                } catch (jsonErr) {
                    try {
                        const textErr = await response.text();
                        errorMessage = textErr || `Server returned ${response.status}: ${response.statusText}`;
                    } catch (textErr) {
                        errorMessage = `Server error ${response.status}`;
                    }
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            console.log('Connection successful:', data);
            setConnectionId(data.connection_id);
            onClose();
        } catch (err) {
            if (err.name === 'AbortError') {
                console.error('🚫 Request was aborted:', err);
                const isNeon = config.host.includes('neon.tech');
                setError(isNeon
                    ? 'Connection timed out (120s). This usually happens if your Neon database is "sleeping". Please refresh your Neon dashboard to wake it up and try again.'
                    : 'Connection timed out (120s). Please check if your host is correct and your database is accessible (not blocked by a firewall).');
            } else {
                console.error('⚠️ Caught error during connection:', err);
                setError(err.message || 'An unexpected error occurred');
            }
        } finally {
            setLoading(false);
            clearTimeout(timeoutId);
        }
    };

    const handleDemoMode = () => {
        setConnectionId('conn_mock');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-panel p-8 w-[400px] relative">
                <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                    <Database className="text-[var(--accent-primary)]" />
                    <h2 className="text-xl font-bold text-white">Connect Database</h2>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded flex items-center gap-2 text-sm text-red-100">
                        <AlertCircle size={16} />
                        <div className="flex flex-col gap-1">
                            <span>{error}</span>
                            <button
                                type="button"
                                onClick={handleDemoMode}
                                className="text-xs font-bold underline text-left hover:text-white"
                            >
                                Try Demo Mode with Sample Data Instead →
                            </button>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">DB Type</label>
                        <select
                            className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]"
                            value={config.db_type}
                            onChange={handleDatabaseTypeChange}
                        >
                            <option value="postgresql">PostgreSQL</option>
                            <option value="neon">Neon DB (Cloud Postgres)</option>
                            <option value="mysql">MySQL</option>
                            <option value="mongodb">MongoDB</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Host</label>
                            <input
                                type="text"
                                className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]"
                                value={config.host}
                                onChange={e => setConfig({ ...config, host: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Port</label>
                            <input
                                type="text"
                                className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]"
                                value={config.port}
                                onChange={e => setConfig({ ...config, port: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Database</label>
                        <input
                            type="text"
                            className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]"
                            value={config.database}
                            onChange={e => setConfig({ ...config, database: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Username</label>
                            <input
                                type="text"
                                className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]"
                                value={config.username}
                                onChange={e => setConfig({ ...config, username: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Password</label>
                            <input
                                type="password"
                                className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]"
                                value={config.password}
                                onChange={e => setConfig({ ...config, password: e.target.value })}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[var(--accent-primary)] text-black font-bold py-3 rounded hover:bg-white transition-colors mt-4 flex items-center justify-center gap-2"
                    >
                        {loading ? <span className="animate-spin">⌛</span> : <Link size={18} />}
                        {loading ? 'Connecting...' : 'Establish Link'}
                    </button>

                    <div className="flex flex-col gap-2 mt-2">
                        <button
                            type="button"
                            onClick={handleDemoMode}
                            className="w-full text-center text-xs text-cyan-400 hover:text-white font-bold uppercase tracking-wider"
                        >
                            🚀 Load Demo Intelligence
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full text-center text-[10px] text-gray-500 hover:text-white uppercase tracking-wider"
                        >
                            Cancel (Stay Offline)
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConnectionModal;
