import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, 
    Filter, 
    Zap, 
    Database, 
    Activity, 
    BarChart3, 
    ArrowRight,
    ChevronDown,
    Layers,
    ShieldAlert,
    Cpu,
    ExternalLink
} from 'lucide-react';
import apiClient from '../../utils/apiClient';

const CATEGORIES = [
    { id: 'asset', label: 'Assets', color: '#fbbf24', icon: Database },
    { id: 'infrastructure', label: 'Infrastructure', color: '#38bdf8', icon: Layers },
    { id: 'telemetry', label: 'Telemetry', color: '#f472b6', icon: Activity },
    { id: 'transaction', label: 'Transactions', color: '#34d399', icon: Zap },
    { id: 'financial', label: 'Financial', color: '#818cf8', icon: BarChart3 }
];

const PRIORITIES = [
    { id: 'High', label: 'High Priority', color: '#ef4444' },
    { id: 'Medium', label: 'Medium', color: '#f59e0b' },
    { id: 'Low', label: 'Low', color: '#94a3b8' }
];

export default function SemanticSearchDiscovery({ connectionId }) {
    const [query, setQuery] = useState('');
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedPriority, setSelectedPriority] = useState(null);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const toggleCategory = (id) => {
        setSelectedCategories(prev => 
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleSearch = async () => {
        setLoading(true);
        setHasSearched(true);
        try {
            const params = new URLSearchParams();
            if (query) params.append('query', query);
            if (selectedCategories.length > 0) params.append('categories', selectedCategories.join(','));
            if (selectedPriority) params.append('priority', selectedPriority);

            const res = await apiClient.get(`/intelligence/semantic-search/${connectionId}?${params.toString()}`);
            setResults(res.results || []);
        } catch (err) {
            console.error("Semantic search failed:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query || selectedCategories.length > 0 || selectedPriority) {
                handleSearch();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [query, selectedCategories, selectedPriority]);

    return (
        <div className="p-8 h-full flex flex-col gap-8 bg-gradient-to-br from-transparent to-cyan-500/5 overflow-hidden">
            {/* Header section */}
            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                        <Search className="text-cyan-400" size={20} />
                    </div>
                    Neural Discovery
                </h2>
                <p className="text-xs text-gray-500 font-mono uppercase tracking-[0.2em]">Semantic Intelligence & Priority-Aware Explorer</p>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col gap-6 bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-xl">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 group-focus-within:scale-110 transition-transform" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search for entities, metrics, or domain keywords..."
                        className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/40 transition-all outline-none"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mr-2">Categories:</span>
                        <div className="flex gap-2">
                            {CATEGORIES.map(cat => {
                                const Icon = cat.icon;
                                const isActive = selectedCategories.includes(cat.id);
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all
                                            ${isActive 
                                                ? 'bg-white/10 border border-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]' 
                                                : 'bg-transparent border border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-400'}
                                        `}
                                    >
                                        <Icon size={12} style={{ color: isActive ? cat.color : 'inherit' }} />
                                        {cat.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mr-2">Priority:</span>
                        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                            {PRIORITIES.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => setSelectedPriority(selectedPriority === p.id ? null : p.id)}
                                    className={`
                                        px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all
                                        ${selectedPriority === p.id 
                                            ? 'bg-white/10 text-white border border-white/10' 
                                            : 'text-gray-600 hover:text-gray-400'}
                                    `}
                                    style={{ color: selectedPriority === p.id ? p.color : '' }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center h-full gap-4"
                        >
                            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                            <p className="text-[10px] uppercase font-bold text-cyan-400 tracking-widest animate-pulse">Running Neural Scan...</p>
                        </motion.div>
                    ) : results.length > 0 ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            {results.map((res, i) => (
                                <DiscoveryCard key={res.name} data={res} index={i} />
                            ))}
                        </motion.div>
                    ) : hasSearched ? (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center h-full text-gray-600"
                        >
                            <ShieldAlert size={48} className="opacity-20 mb-4" />
                            <p className="text-xs font-bold uppercase tracking-widest">No semantic matches found for current filters</p>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-700 opacity-40">
                            <Cpu size={64} className="mb-4" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Neural Core Ready for Discovery</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function DiscoveryCard({ data, index }) {
    const pConfig = PRIORITIES.find(p => p.id === data.priority);
    const cConfig = CATEGORIES.find(c => c.id === data.type) || { icon: Database, color: '#94a3b8' };
    const Icon = cConfig.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="group relative bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/[0.08] hover:border-cyan-500/30 transition-all cursor-pointer"
        >
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-black/40 rounded-xl border border-white/5 group-hover:border-cyan-500/20 transition-colors">
                        <Icon size={18} style={{ color: cConfig.color }} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span 
                                className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                                style={{ backgroundColor: `${pConfig?.color}20`, color: pConfig?.color }}
                            >
                                {data.priority}
                            </span>
                            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{data.type}</span>
                        </div>
                        <h4 className="text-md font-bold text-white mt-1 group-hover:text-cyan-400 transition-colors">{data.name}</h4>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-1">Gravity</p>
                    <p className="text-lg font-black font-mono text-cyan-500">{data.gravity.toFixed(1)}x</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-500 uppercase tracking-widest">Structural Vitality</span>
                    <span className="text-gray-300 font-mono">{(data.importance * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${data.importance * 100}%` }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                    />
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-widest flex items-center gap-1">
                        Connect to Node <ArrowRight size={10} />
                    </span>
                    <div className="flex items-center gap-2 text-[9px] text-gray-600 font-mono">
                         {data.row_count.toLocaleString()} rows
                    </div>
                </div>
            </div>
            
            {/* Visual Flare */}
            <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-cyan-500 blur-sm opacity-0 group-hover:opacity-100 animate-pulse" />
        </motion.div>
    );
}
