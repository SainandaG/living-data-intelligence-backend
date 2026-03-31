import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Link2, Search, Database, Zap, ChevronRight, ShieldCheck, ExternalLink } from 'lucide-react';
import apiClient from '../../utils/apiClient';
import { logger } from '../../utils/logger';
import { SectionHeader, Loading, ErrorCard } from './HealthDashboard';

const COLOR = '#8b5cf6';

export default function OntologyExplorer({ connectionId, accentColor }) {
    const [ontology, setOntology] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch] = useState('');
    const color = accentColor || COLOR;

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.get(`/ontology/${connectionId}`);
                if (cancelled) return;
                setOntology(res);
                if (res.objects?.length > 0) setSelectedId(res.objects[0].id);
            } catch (e) {
                if (!cancelled) setError(e.message);
                logger.error('Ontology fetch failed:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [connectionId]);

    if (loading) return <Loading label="Synchronizing semantic layer…" color={color} />;
    if (error) return <ErrorCard message={error} />;

    const filtered = (ontology?.objects || []).filter(o =>
        o.displayName.toLowerCase().includes(search.toLowerCase()) ||
        o.type.toLowerCase().includes(search.toLowerCase())
    );
    const selected = ontology?.objects?.find(o => o.id === selectedId);
    const links = (ontology?.links || []).filter(l => l.source === selectedId || l.target === selectedId);
    const summary = ontology?.summary || {};

    return (
        <div className="flex h-full overflow-hidden">

            {/* Left panel — entity list */}
            <div className="w-64 shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/[0.06] space-y-3">
                    <SectionHeader icon={Layers} color={color} title="Entities" subtitle={`${summary.objectCount ?? 0} objects · ${summary.linkCount ?? 0} links`} />
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={13} />
                        <input
                            type="text"
                            placeholder="Search…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-2 pl-8 pr-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/40 transition-colors"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                    {filtered.map(obj => {
                        const isActive = selectedId === obj.id;
                        const dot = (obj.type === 'asset' || obj.type === 'fact') ? '#fbbf24' : color;
                        return (
                            <button
                                key={obj.id}
                                onClick={() => setSelectedId(obj.id)}
                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left group"
                                style={isActive ? { background: `${color}12`, border: `1px solid ${color}25` } : {}}
                            >
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot, boxShadow: isActive ? `0 0 6px ${dot}80` : 'none' }} />
                                <div className="min-w-0 flex-1">
                                    <p className={`text-[12px] font-semibold truncate ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                        {obj.displayName}
                                    </p>
                                    <p className="text-[9px] text-gray-600 uppercase tracking-widest">{obj.type}</p>
                                </div>
                                <ChevronRight size={12} className={`shrink-0 transition-colors ${isActive ? 'text-violet-400' : 'text-gray-700'}`} />
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Right panel — entity detail */}
            <div className="flex-1 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {selected ? (
                        <motion.div
                            key={selected.id}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="p-6 space-y-5 max-w-2xl"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider"
                                            style={{ background: `${color}18`, color }}>
                                            {selected.type}
                                        </span>
                                        <span className="text-[10px] text-gray-600 font-mono">/{selected.id}</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">{selected.displayName}</h2>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                        <Database size={12} />
                                        <span>Physical table: <code className="text-gray-300">{selected.id}</code></span>
                                    </div>
                                </div>
                                {selected.vitality != null && (
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Vitality</p>
                                        <p className="text-3xl font-black" style={{ color }}>{selected.vitality}%</p>
                                    </div>
                                )}
                            </div>

                            {/* Technical stats */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Row Count</p>
                                    <p className="text-xl font-black text-white">{(selected.technical?.rowCount ?? 0).toLocaleString()}</p>
                                </div>
                                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Columns</p>
                                    <p className="text-xl font-black text-white">{(selected.technical?.columns ?? []).length}</p>
                                </div>
                            </div>

                            {/* Provenance */}
                            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <ShieldCheck size={14} style={{ color }} />
                                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Decision Provenance</p>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed italic border-l-2 pl-4" style={{ borderColor: `${color}50` }}>
                                    "{selected.provenance || 'No provenance data from AI engine.'}"
                                </p>
                            </div>

                            {/* Ontological links */}
                            {links.length > 0 && (
                                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Link2 size={14} style={{ color }} />
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ontological Links · {links.length}</p>
                                    </div>
                                    <div className="space-y-2">
                                        {links.map((link, i) => {
                                            const isSrc = link.source === selectedId;
                                            const partner = isSrc ? link.target : link.source;
                                            return (
                                                <div key={i} className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-white/[0.05] hover:border-violet-500/20 transition-all cursor-pointer">
                                                    <div className="flex items-center gap-3">
                                                        <ExternalLink size={13} className={isSrc ? 'text-amber-400' : 'text-blue-400'} />
                                                        <div>
                                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{link.predicate}</p>
                                                            <p className="text-xs font-semibold text-white">{partner}</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-[9px] font-mono text-gray-700">{link.technical?.from} → {link.technical?.to}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Semantic properties */}
                            {Object.keys(selected.properties || {}).length > 0 && (
                                <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Zap size={14} className="text-amber-400" />
                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Semantic Properties</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {Object.entries(selected.properties).map(([tech, semantic]) => (
                                            <div key={tech} className="bg-black/30 rounded-lg p-3 border border-white/[0.05]">
                                                <p className="text-[9px] font-mono text-gray-600 mb-1 truncate">{tech}</p>
                                                <p className="text-xs font-bold text-white">{semantic}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-700">
                            <p className="text-xs font-bold uppercase tracking-widest">Select an entity to explore</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
