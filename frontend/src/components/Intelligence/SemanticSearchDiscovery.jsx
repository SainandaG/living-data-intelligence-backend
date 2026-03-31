import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Database, Activity, BarChart3, Layers, Zap, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';
import { SectionHeader, Loading } from './HealthDashboard';

const COLOR = '#06b6d4';

const CATEGORIES = [
    { id: 'asset',          label: 'Assets',         color: '#fbbf24', icon: Database },
    { id: 'infrastructure', label: 'Infrastructure', color: '#38bdf8', icon: Layers },
    { id: 'telemetry',      label: 'Telemetry',      color: '#f472b6', icon: Activity },
    { id: 'transaction',    label: 'Transactions',   color: '#34d399', icon: Zap },
    { id: 'financial',      label: 'Financial',      color: '#818cf8', icon: BarChart3 },
];

const PRIORITIES = [
    { id: 'High',   color: '#ef4444' },
    { id: 'Medium', color: '#f59e0b' },
    { id: 'Low',    color: '#64748b' },
];

export default function SemanticSearchDiscovery({ connectionId, accentColor }) {
    const [query, setQuery] = useState('');
    const [cats, setCats] = useState([]);
    const [priority, setPriority] = useState(null);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const color = accentColor || COLOR;

    const doSearch = async (q, c, p) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (q) params.append('query', q);
            if (c.length) params.append('categories', c.join(','));
            if (p) params.append('priority', p);
            const res = await apiClient.get(`/intelligence/semantic-search/${connectionId}?${params}`);
            setResults(res.results || []);
        } catch (e) {
            logger.error('Search failed:', e);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => { doSearch('', [], null); }, [connectionId]);

    // Debounced re-search
    const isFirst = React.useRef(true);
    useEffect(() => {
        if (isFirst.current) { isFirst.current = false; return; }
        const t = setTimeout(() => doSearch(query, cats, priority), 400);
        return () => clearTimeout(t);
    }, [query, cats, priority]);

    const toggleCat = id => setCats(p => p.includes(id) ? p.filter(c => c !== id) : [...p, id]);

    return (
        <div className="p-6 space-y-4 max-w-5xl mx-auto">
            <SectionHeader icon={Search} color={color} title="Discovery Search" subtitle="Semantic intelligence & priority-aware explorer" />

            {/* Search input */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={15} />
                <input
                    type="text"
                    placeholder="Search entities, metrics, domain keywords…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/40 transition-colors"
                />
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Type:</span>
                    <div className="flex gap-1.5">
                        {CATEGORIES.map(cat => {
                            const Icon = cat.icon;
                            const active = cats.includes(cat.id);
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => toggleCat(cat.id)}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border"
                                    style={active
                                        ? { background: `${cat.color}18`, color: cat.color, borderColor: `${cat.color}40` }
                                        : { background: 'transparent', color: '#4b5563', borderColor: 'rgba(255,255,255,0.06)' }}
                                >
                                    <Icon size={11} />
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Priority:</span>
                    <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
                        {PRIORITIES.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setPriority(priority === p.id ? null : p.id)}
                                className="px-3 py-1 rounded-md text-[10px] font-bold transition-all"
                                style={priority === p.id
                                    ? { background: `${p.color}20`, color: p.color }
                                    : { color: '#4b5563' }}
                            >
                                {p.id}
                            </button>
                        ))}
                    </div>
                </div>

                <span className="ml-auto text-[11px] text-gray-600">{results.length} results</span>
            </div>

            {/* Results */}
            <div className="min-h-[200px]">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <Loading label="Running neural scan…" color={color} key="loading" />
                    ) : results.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-16 text-gray-600">
                            <ShieldAlert size={32} className="mb-3 opacity-30" />
                            <p className="text-xs font-bold uppercase tracking-widest">No matches found</p>
                        </motion.div>
                    ) : (
                        <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {results.map((r, i) => <ResultCard key={r.name} data={r} index={i} />)}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function ResultCard({ data, index }) {
    const pConf = PRIORITIES.find(p => p.id === data.priority);
    const cConf = CATEGORIES.find(c => c.id === data.type) || { icon: Cpu, color: '#64748b' };
    const Icon = cConf.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="group bg-white/[0.03] border border-white/[0.07] hover:border-cyan-500/25 rounded-xl p-4 transition-all cursor-pointer"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg" style={{ background: `${cConf.color}18` }}>
                        <Icon size={14} style={{ color: cConf.color }} />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                                style={{ background: `${pConf?.color}18`, color: pConf?.color }}>
                                {data.priority}
                            </span>
                        </div>
                        <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">{data.name}</p>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <p className="text-[9px] text-gray-600 uppercase tracking-wider">Gravity</p>
                    <p className="text-base font-black text-cyan-400 tabular-nums">{data.gravity?.toFixed(1)}x</p>
                </div>
            </div>

            <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-gray-500">
                    <span>Vitality</span>
                    <span className="text-gray-300">{((data.importance ?? 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(data.importance ?? 0) * 100}%` }}
                        transition={{ delay: index * 0.04 + 0.2 }}
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    />
                </div>
                <div className="flex justify-between items-center pt-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
                    <span className="text-cyan-400 font-bold flex items-center gap-1">Explore <ArrowRight size={10} /></span>
                    <span className="text-gray-600 font-mono">{(data.row_count ?? 0).toLocaleString()} rows</span>
                </div>
            </div>
        </motion.div>
    );
}
