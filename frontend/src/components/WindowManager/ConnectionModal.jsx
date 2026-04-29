import React, { useState, useRef } from 'react';
import { Database, Link, AlertCircle, Upload, FileText, Table, CheckCircle, X } from 'lucide-react';
import { useWindowManager } from '../../context/WindowManagerContext';
import { authFetch } from '../../utils/apiClient';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';

// ─── Tab: Database Connection ─────────────────────────────────────────────────

const DatabaseTab = ({ onClose }) => {
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
        const defaultPorts = { postgresql: '5432', neon: '5432', mysql: '3306', mongodb: '27017' };
        setConfig({ ...config, db_type: type, port: defaultPorts[type] || config.port });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => { logger.warn('Connection timeout'); controller.abort(); }, 120000);
        try {
            const portNum = parseInt(config.port, 10);
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                setError('Port must be a number between 1 and 65535.');
                setLoading(false);
                clearTimeout(timeoutId);
                return;
            }
            const payload = { ...config, host: config.host.trim(), database: config.database.trim(), username: config.username.trim(), port: portNum };
            const response = await apiClient.post('/connect', payload, { signal: controller.signal });
            setConfig(prev => ({ ...prev, password: '' }));
            setConnectionId(response.connection_id);
            onClose();
        } catch (err) {
            if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
                setError('Connection timed out (120s). Please check if your database is accessible.');
            } else {
                setError(err.message || 'An unexpected error occurred');
            }
        } finally {
            setLoading(false);
            clearTimeout(timeoutId);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded flex items-center gap-2 text-sm text-red-100">
                    <AlertCircle size={16} />{error}
                </div>
            )}
            <div>
                <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">DB Type</label>
                <select className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]" value={config.db_type} onChange={handleDatabaseTypeChange}>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="neon">Neon DB (Cloud Postgres)</option>
                    <option value="mysql">MySQL</option>
                    <option value="mongodb">MongoDB</option>
                </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                    <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Host</label>
                    <input type="text" className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]" value={config.host} onChange={e => setConfig({ ...config, host: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Port</label>
                    <input type="number" min="1" max="65535" className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]" value={config.port} onChange={e => setConfig({ ...config, port: e.target.value })} />
                </div>
            </div>
            <div>
                <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Database</label>
                <input type="text" className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]" value={config.database} onChange={e => setConfig({ ...config, database: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Username</label>
                    <input type="text" className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]" value={config.username} onChange={e => setConfig({ ...config, username: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Password</label>
                    <input type="password" className="w-full bg-black/30 border border-white/10 rounded p-2 text-white outline-none focus:border-[var(--accent-primary)]" value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })} />
                </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[var(--accent-primary)] text-black font-bold py-3 rounded hover:bg-white transition-colors mt-4 flex items-center justify-center gap-2">
                {loading ? <span className="animate-spin">⌛</span> : <Link size={18} />}
                {loading ? 'Connecting...' : 'Establish Link'}
            </button>
        </form>
    );
};

// ─── Tab: File Upload ─────────────────────────────────────────────────────────

const ACCEPTED_TYPES = '.csv,.xlsx,.xls,.xlsm,.ods';

const FileUploadTab = ({ onClose }) => {
    const { setConnectionId } = useWindowManager();
    const [dragOver, setDragOver] = useState(false);
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const inputRef = useRef(null);

    const validateFile = (f) => {
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['csv', 'xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) return `Unsupported file type ".${ext}". Please upload CSV or Excel.`;
        if (f.size > 100 * 1024 * 1024) return 'File is too large (max 100 MB).';
        return null;
    };

    const handleFile = (f) => {
        setError(null); setResult(null);
        const err = validateFile(f);
        if (err) { setError(err); return; }
        setFile(f);
    };

    const handleDrop = (e) => {
        e.preventDefault(); setDragOver(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFile(dropped);
    };

    const handleClear = () => {
        setFile(null); setResult(null); setError(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true); setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const token = localStorage.getItem('token');
            const baseUrl = import.meta.env.VITE_API_URL ?? '';
            const response = await authFetch(`${baseUrl}/api/files/upload`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.detail || `Upload failed (${response.status})`);
            }
            const data = await response.json();
            setResult(data);
            setConnectionId(data.connection_id);
        } catch (err) {
            setError(err.message || 'Upload failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        return (
            <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-green-400 mb-3">
                        <CheckCircle size={18} />
                        <span className="font-semibold text-sm">File loaded successfully</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-1 truncate">
                        <span className="text-white font-medium">{result.filename}</span>
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                        Connection ID: <span className="text-[var(--accent-primary)] font-mono text-[10px]">{result.connection_id}</span>
                    </p>
                    <div className="space-y-1">
                        {result.tables?.map((tbl) => (
                            <div key={tbl} className="flex items-center justify-between text-xs bg-black/30 rounded px-3 py-1.5">
                                <span className="flex items-center gap-1.5 text-gray-300">
                                    <Table size={12} className="text-[var(--accent-primary)]" />{tbl}
                                </span>
                                <span className="text-gray-500">{result.row_counts?.[tbl]?.toLocaleString() ?? '—'} rows</span>
                            </div>
                        ))}
                    </div>
                </div>
                <button onClick={onClose} className="w-full bg-[var(--accent-primary)] text-black font-bold py-3 rounded hover:bg-white transition-colors flex items-center justify-center gap-2">
                    <CheckCircle size={18} /> Open Dashboard
                </button>
                <button onClick={handleClear} className="w-full text-center text-sm text-gray-500 hover:text-white transition-colors">
                    Upload a different file
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded flex items-center gap-2 text-sm text-red-100">
                    <AlertCircle size={16} className="shrink-0" />{error}
                </div>
            )}

            {/* Drop zone */}
            <div
                onClick={() => !file && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${dragOver ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 scale-[1.01]'
                        : file ? 'border-green-500/40 bg-green-500/5'
                            : 'border-white/10 bg-black/20 hover:border-white/25 hover:bg-black/30'
                    }`}
            >
                <input ref={inputRef} type="file" accept={ACCEPTED_TYPES} onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); }} className="hidden" />

                {file ? (
                    <div className="flex flex-col items-center gap-2">
                        <FileText size={32} className="text-green-400" />
                        <div>
                            <p className="text-white font-medium text-sm">{file.name}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleClear(); }} className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors">
                            <X size={12} /> Remove
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <Upload size={22} className="text-gray-400" />
                        </div>
                        <div>
                            <p className="text-white text-sm font-medium">Drop your file here</p>
                            <p className="text-gray-500 text-xs mt-1">or click to browse</p>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-center mt-1">
                            {['CSV', 'XLSX', 'XLS', 'ODS'].map(fmt => (
                                <span key={fmt} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-500 text-[10px] uppercase tracking-wider">{fmt}</span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {!file && <p className="text-xs text-gray-600 text-center">Excel sheets become separate tables · Max 100 MB · No credentials needed</p>}

            <button
                onClick={handleUpload}
                disabled={!file || loading}
                className={`w-full font-bold py-3 rounded flex items-center justify-center gap-2 transition-all ${file && !loading ? 'bg-[var(--accent-primary)] text-black hover:bg-white cursor-pointer' : 'bg-white/5 text-gray-600 cursor-not-allowed'
                    }`}
            >
                {loading ? <><span className="animate-spin">⌛</span> Processing file…</> : <><Upload size={18} /> Load as Database</>}
            </button>
        </div>
    );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

const TABS = [
    { id: 'db', label: 'Database', icon: Database },
    { id: 'file', label: 'File Upload', icon: Upload },
];

const ConnectionModal = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState('db');

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-panel p-8 w-[420px] relative">

                {/* Header */}
                <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4">
                    <Database className="text-[var(--accent-primary)]" />
                    <h2 className="text-xl font-bold text-white">Connect Data Source</h2>
                </div>

                {/* Tab switcher */}
                <div className="flex gap-1 mb-5 bg-black/30 rounded-lg p-1">
                    {TABS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${activeTab === id ? 'bg-[var(--accent-primary)] text-black' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            <Icon size={14} />{label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                {activeTab === 'db'
                    ? <DatabaseTab onClose={onClose} />
                    : <FileUploadTab onClose={onClose} />
                }

                {/* Cancel */}
                <button onClick={onClose} className="w-full text-center text-sm text-gray-500 hover:text-white mt-4 transition-colors">
                    Cancel (Run in Offline Mode)
                </button>
            </div>
        </div>
    );
};

export default ConnectionModal;