import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Shield, Search, Filter, Download, Trash2, ChevronLeft, ChevronRight,
    AlertTriangle, Activity, Database, Users, Fingerprint, Calendar
} from 'lucide-react';
import { authFetch } from '../../utils/apiClient';
import { useAuthStore } from '../../stores/authStore';
import { logger } from '../../utils/logger';

// --- Helper Functions ---
const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
        month: 'short', day: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
};

const getActionColor = (action) => {
    switch(action) {
        case 'DELETE': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
        case 'UPDATE': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'INSERT': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        case 'READ': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
};

const AuditLogPage = () => {
    const navigate = useNavigate();
    const { userRole } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();

    // Stats State
    const [stats, setStats] = useState({
        total_logs: 0,
        expiring_in_7_days: 0,
        logs_this_week: 0,
        logs_by_module: {}
    });

    // Data State
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);

    // Expandable Rows
    const [expandedRow, setExpandedRow] = useState(null);

    // Purge Modal
    const [showPurgeModal, setShowPurgeModal] = useState(false);
    const [purgeInput, setPurgeInput] = useState('');
    const [purging, setPurging] = useState(false);
    const [toast, setToast] = useState(null);

    // Filters derived from URL or defaults
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = 25;
    const actionFilter = searchParams.get('action') || 'ALL';
    const moduleFilter = searchParams.get('module') || 'ALL';
    const searchFilter = searchParams.get('user_id') || '';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';

    useEffect(() => {
        if (userRole !== 'admin' && userRole !== 'super_admin') {
            navigate('/forbidden');
        }
    }, [userRole, navigate]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const updateFilters = (key, value) => {
        const newParams = new URLSearchParams(searchParams);
        if (value && value !== 'ALL') {
            newParams.set(key, value);
        } else {
            newParams.delete(key);
        }
        // Reset page to 1 on filter change
        if (key !== 'page') newParams.set('page', '1');
        setSearchParams(newParams);
    };

    const fetchStats = async () => {
        try {
            const res = await authFetch('/api/audit-logs/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            logger.error('Failed to fetch audit stats:', err);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', page);
            params.set('limit', limit);
            if (actionFilter !== 'ALL') params.set('action', actionFilter);
            if (moduleFilter !== 'ALL') params.set('module', moduleFilter);
            if (searchFilter) params.set('user_id', searchFilter);
            if (dateFrom) params.set('date_from', new Date(dateFrom).toISOString());
            if (dateTo) params.set('date_to', new Date(dateTo).toISOString());

            const res = await authFetch(`/api/audit-logs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.items || []);
                setTotal(data.total || 0);
                setPages(data.pages || 1);
            }
        } catch (err) {
            logger.error('Failed to fetch audit logs:', err);
        } finally {
            setLoading(false);
        }
    }, [page, limit, actionFilter, moduleFilter, searchFilter, dateFrom, dateTo]);

    useEffect(() => {
        if (userRole === 'admin' || userRole === 'super_admin') {
            fetchStats();
            fetchLogs();
        }
    }, [fetchLogs, userRole]);

    const handlePurge = async () => {
        if (purgeInput !== 'PURGE') return;
        setPurging(true);
        try {
            const res = await authFetch('/api/audit-logs/purge', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setToast(`Deleted ${data.deleted_count} records older than 90 days.`);
                setShowPurgeModal(false);
                setPurgeInput('');
                fetchStats();
                fetchLogs();
            } else {
                setToast('Failed to purge records.');
            }
        } catch (err) {
            logger.error('Purge error:', err);
            setToast('Error occurred during purge.');
        } finally {
            setPurging(false);
        }
    };

    const handleExportCSV = () => {
        if (logs.length === 0) return;
        
        const headers = ['Timestamp', 'User', 'Action', 'Module', 'Record ID', 'Metadata'];
        const csvRows = [headers.join(',')];

        logs.forEach(log => {
            const metaStr = JSON.stringify(log.details || {}).replace(/"/g, '""');
            const row = [
                log.timestamp,
                log.user,
                log.action,
                log.module,
                log.record_id || '',
                `"${metaStr}"`
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const mostActiveModule = useMemo(() => {
        if (!stats.logs_by_module) return 'N/A';
        const entries = Object.entries(stats.logs_by_module);
        if (entries.length === 0) return 'N/A';
        const top = entries.reduce((a, b) => a[1] > b[1] ? a : b);
        return top[0].charAt(0).toUpperCase() + top[0].slice(1);
    }, [stats.logs_by_module]);

    if (userRole !== 'admin' && userRole !== 'super_admin') return null;

    return (
        <div className="flex flex-col h-full bg-[#020617] text-white p-6 overflow-hidden relative">
            <div className="mb-6 flex justify-between items-end shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Fingerprint className="text-blue-400" /> Security Audit Log
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">Immutable record of system activity</p>
                </div>
                {userRole === 'super_admin' && (
                    <button 
                        onClick={() => setShowPurgeModal(true)}
                        className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-lg text-sm font-bold uppercase hover:bg-rose-500/20 transition-colors flex items-center gap-2"
                    >
                        <Trash2 size={16} /> Purge Old Logs
                    </button>
                )}
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Logs</div>
                    <div className="text-2xl font-bold text-blue-400">
                        {statsLoading ? <div className="h-8 w-20 bg-slate-800 animate-pulse rounded" /> : stats.total_logs.toLocaleString()}
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Expiring in 7 Days</div>
                    <div className="text-2xl font-bold text-amber-400">
                        {statsLoading ? <div className="h-8 w-20 bg-slate-800 animate-pulse rounded" /> : stats.expiring_in_7_days.toLocaleString()}
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Logs This Week</div>
                    <div className="text-2xl font-bold text-emerald-400">
                        {statsLoading ? <div className="h-8 w-20 bg-slate-800 animate-pulse rounded" /> : stats.logs_this_week.toLocaleString()}
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
                    <div className="text-slate-400 text-xs font-bold uppercase mb-1">Most Active Module</div>
                    <div className="text-2xl font-bold text-purple-400">
                        {statsLoading ? <div className="h-8 w-20 bg-slate-800 animate-pulse rounded" /> : mostActiveModule}
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 w-64">
                        <Search size={16} className="text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Search user email..."
                            value={searchFilter}
                            onChange={(e) => updateFilters('user_id', e.target.value)}
                            className="bg-transparent border-none text-sm text-white focus:outline-none w-full placeholder:text-slate-600"
                        />
                    </div>
                    
                    <select 
                        value={actionFilter}
                        onChange={(e) => updateFilters('action', e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-sm text-white rounded-lg px-3 py-2 focus:outline-none"
                    >
                        <option value="ALL">All Actions</option>
                        <option value="INSERT">Insert</option>
                        <option value="UPDATE">Update</option>
                        <option value="DELETE">Delete</option>
                        <option value="READ">Read</option>
                    </select>

                    <select 
                        value={moduleFilter}
                        onChange={(e) => updateFilters('module', e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-sm text-white rounded-lg px-3 py-2 focus:outline-none"
                    >
                        <option value="ALL">All Modules</option>
                        <option value="data">Data</option>
                        <option value="ml">ML</option>
                        <option value="agent">Agent</option>
                        <option value="decisions">Decisions</option>
                    </select>

                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-500" />
                        <input 
                            type="date"
                            value={dateFrom}
                            onChange={(e) => updateFilters('date_from', e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-sm text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none"
                        />
                        <span className="text-slate-600">-</span>
                        <input 
                            type="date"
                            value={dateTo}
                            onChange={(e) => updateFilters('date_to', e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-sm text-slate-300 rounded-lg px-2 py-1.5 focus:outline-none"
                        />
                    </div>
                </div>

                {userRole === 'super_admin' && (
                    <button 
                        onClick={handleExportCSV}
                        disabled={loading || logs.length === 0}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                    >
                        <Download size={16} /> Export CSV
                    </button>
                )}
            </div>

            {/* Results Table */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col min-h-0">
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10 border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3 font-medium uppercase tracking-wider text-[10px]">Timestamp</th>
                                <th className="px-4 py-3 font-medium uppercase tracking-wider text-[10px]">User</th>
                                <th className="px-4 py-3 font-medium uppercase tracking-wider text-[10px]">Action</th>
                                <th className="px-4 py-3 font-medium uppercase tracking-wider text-[10px]">Module</th>
                                <th className="px-4 py-3 font-medium uppercase tracking-wider text-[10px]">Record ID</th>
                                <th className="px-4 py-3 font-medium uppercase tracking-wider text-[10px] w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {loading ? (
                                Array.from({ length: 10 }).map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan="6" className="px-4 py-3">
                                            <div className="h-4 bg-slate-800 rounded animate-pulse w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                                        <Activity size={32} className="mx-auto mb-2 opacity-50" />
                                        No audit records found matching your filters.
                                    </td>
                                </tr>
                            ) : logs.map(log => (
                                <React.Fragment key={log.id}>
                                    <tr 
                                        className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${expandedRow === log.id ? 'bg-slate-800/30' : ''}`}
                                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                    >
                                        <td className="px-4 py-3 text-slate-300 font-mono text-xs">{formatDate(log.timestamp)}</td>
                                        <td className="px-4 py-3 text-white">{log.user}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border uppercase ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">{log.module}</td>
                                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{log.record_id || '--'}</td>
                                        <td className="px-4 py-3 text-right">
                                            <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${expandedRow === log.id ? 'rotate-90' : ''}`} />
                                        </td>
                                    </tr>
                                    <AnimatePresence>
                                        {expandedRow === log.id && (
                                            <motion.tr
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                            >
                                                <td colSpan="6" className="px-4 py-4 bg-slate-950 border-b border-slate-800/50">
                                                    <div className="font-mono text-xs text-emerald-400 whitespace-pre-wrap">
                                                        {JSON.stringify(log.details, null, 2)}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )}
                                    </AnimatePresence>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                <div className="bg-slate-950 p-4 border-t border-slate-800 flex items-center justify-between shrink-0">
                    <div className="text-xs text-slate-400">
                        Showing <span className="text-white font-medium">{logs.length > 0 ? ((page - 1) * limit) + 1 : 0}</span> to <span className="text-white font-medium">{Math.min(page * limit, total)}</span> of <span className="text-white font-medium">{total}</span> records
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            disabled={page <= 1}
                            onClick={() => updateFilters('page', page - 1)}
                            className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs text-slate-400 font-medium px-2">Page {page} of {pages}</span>
                        <button 
                            disabled={page >= pages}
                            onClick={() => updateFilters('page', page + 1)}
                            className="p-1 rounded bg-slate-800 text-slate-300 disabled:opacity-50 hover:bg-slate-700 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Purge Modal */}
            <AnimatePresence>
                {showPurgeModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[#0f172a] border border-rose-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                        >
                            <div className="flex items-center gap-3 text-rose-500 mb-4">
                                <AlertTriangle size={24} />
                                <h3 className="text-lg font-bold text-white">Purge Old Records</h3>
                            </div>
                            <p className="text-slate-300 text-sm mb-6">
                                This will permanently delete all audit log records older than 90 days. This action cannot be undone.
                            </p>
                            <div className="mb-6">
                                <label className="block text-xs text-slate-400 uppercase font-bold mb-2">Type "PURGE" to confirm</label>
                                <input 
                                    type="text" 
                                    value={purgeInput}
                                    onChange={(e) => setPurgeInput(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-rose-500"
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button 
                                    onClick={() => { setShowPurgeModal(false); setPurgeInput(''); }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    disabled={purgeInput !== 'PURGE' || purging}
                                    onClick={handlePurge}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg text-sm font-bold transition-colors"
                                >
                                    {purging ? 'Purging...' : 'Execute Purge'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-8 right-8 px-6 py-3 rounded-xl border shadow-2xl z-50 bg-emerald-950/90 border-emerald-500/30 text-emerald-400 flex items-center gap-3"
                    >
                        <Shield size={18} />
                        <span className="text-sm font-bold tracking-tight">{toast}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AuditLogPage;
