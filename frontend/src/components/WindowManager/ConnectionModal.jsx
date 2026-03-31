import React, { useState } from 'react';
import { Database, Server, Key, User, Save, Link, AlertCircle } from 'lucide-react';
import { useWindowManager } from '../../context/WindowManagerContext';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';

const ConnectionModal = ({ onClose }) => {
    const { setConnectionId } = useWindowManager();
    const [config, setConfig] = useState({
        db_type: 'postgresql',
        host: '',
        port: '5432',
        database: '',
        username: '',
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
        const timeoutId = setTimeout(() => {
            logger.warn('⏱️ Connection timeout reached (120s). Aborting request.');
            controller.abort();
        }, 120000);

        try {
            const portNum = parseInt(config.port, 10);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                setError('Port must be a number between 1 and 65535.');
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }

            const payload = {
                ...config,
                host: config.host.trim(),
                database: config.database.trim(),
                username: config.username.trim(),
                port: portNum
            };
            const response = await apiClient.post('/connect', payload, {
                signal: controller.signal
            });

            // Clear password from state — don't keep credentials in memory after connect
            setConfig(prev => ({ ...prev, password: '' }));
            setConnectionId(response.connection_id);
            onClose();

        } catch (err) {
            if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                logger.error('Request was aborted');
                setError('Connection timed out (120s). Please check if your database is accessible and your firewall allows the connection.');
            } else {
                logger.error('Connection failed');
                setError(err.message || 'An unexpected error occurred');
            }
        } finally {
            setLoading(false);
            clearTimeout(timeoutId);
        }
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
                        {error}
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
                                type="number"
                                min="1"
                                max="65535"
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

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full text-center text-sm text-gray-500 hover:text-white mt-2"
                    >
                        Cancel (Run in Offline Mode)
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ConnectionModal;
