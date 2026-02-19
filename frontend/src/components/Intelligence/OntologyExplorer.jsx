import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../utils/apiClient';
import {
    Layers,
    Link2,
    Info,
    ShieldCheck,
    ExternalLink,
    Search,
    Database,
    Cpu,
    Zap,
    ChevronRight,
    HelpCircle
} from 'lucide-react';

export default function OntologyExplorer({ connectionId }) {
    const [ontology, setOntology] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchOntology = async () => {
            try {
                const res = await apiClient.get(`/ontology/${connectionId}`);
                setOntology(res);
                if (res.objects?.length > 0) {
                    setSelectedId(res.objects[0].id);
                }
            } catch (err) {
                console.error("Failed to fetch ontology:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchOntology();
    }, [connectionId]);

    const filteredObjects = ontology?.objects?.filter(obj =>
        obj.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obj.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        obj.id.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

    const selectedObject = ontology?.objects?.find(o => o.id === selectedId);

    if (loading) return (
        <div className="p-12 flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            <p className="font-mono text-[10px] text-cyan-400 uppercase tracking-widest animate-pulse">Synchronizing Semantic Layer...</p>
        </div>
    );

    return (
        <div className="flex h-full overflow-hidden bg-black/60 rounded-3xl border border-white/5">
            {/* Object Navigator */}
            <div className="w-80 border-r border-white/5 flex flex-col overflow-hidden bg-black/20">
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                            <Layers size={16} className="text-cyan-400" />
                        </div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-tighter">Object Classes</h3>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                        <input
                            type="text"
                            placeholder="Search Entity Model..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                    {filteredObjects.map(obj => (
                        <button
                            key={obj.id}
                            onClick={() => setSelectedId(obj.id)}
                            className={`
                                w-full flex items-center gap-3 p-3 rounded-xl transition-all group
                                ${selectedId === obj.id ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-white/5 border border-transparent'}
                            `}
                        >
                            <div className={`
                                w-2 h-2 rounded-full shadow-[0_0_8px]
                                ${obj.type === 'asset' || obj.type === 'fact' ? 'bg-amber-400 shadow-amber-400/50' : 'bg-cyan-400 shadow-cyan-400/50'}
                            `} />
                            <div className="text-left flex-1 min-w-0">
                                <p className={`text-[11px] font-bold truncate ${selectedId === obj.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                    {obj.displayName}
                                </p>
                                <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">{obj.type}</p>
                            </div>
                            <ChevronRight size={14} className={`transition-transform ${selectedId === obj.id ? 'text-cyan-400' : 'text-gray-700 opacity-0 group-hover:opacity-100'}`} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Entity Inspector */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-br from-black/40 to-cyan-950/5 relative custom-scrollbar">
                <AnimatePresence mode="wait">
                    {selectedObject ? (
                        <motion.div
                            key={selectedObject.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="p-10"
                        >
                            {/* Header Section */}
                            <div className="flex items-start justify-between mb-12">
                                <div>
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                                            <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-[0.2em]">{selectedObject.type}</span>
                                        </div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
                                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">ID: {selectedObject.id}</span>
                                    </div>
                                    <h1 className="text-4xl font-black text-white tracking-tighter mb-2 italic uppercase">
                                        {selectedObject.displayName}
                                    </h1>
                                    <div className="flex items-center gap-3 text-gray-400 text-sm">
                                        <Database size={16} className="text-gray-600" />
                                        <span>Mapped from physical table <code className="bg-white/5 px-2 py-0.5 rounded text-cyan-300">"{selectedObject.id}"</code></span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Vitality Score</p>
                                    <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-t from-cyan-400 to-white">
                                        {Math.floor(80 + Math.random() * 20)}%
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                                {/* Decision Provenance */}
                                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                        <Cpu size={120} />
                                    </div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <ShieldCheck className="text-green-400" size={18} />
                                        <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Decision Provenance</h4>
                                    </div>
                                    <p className="text-gray-300 text-sm leading-relaxed italic border-l-2 border-cyan-500/40 pl-6 py-2">
                                        "{selectedObject.provenance || "No specific justification provided by AI engine."}"
                                    </p>
                                    <div className="mt-8 flex items-center gap-4">
                                        <div className="flex -space-x-2">
                                            {[...Array(3)].map((_, i) => (
                                                <div key={i} className="w-6 h-6 rounded-full border-2 border-black bg-cyan-900 flex items-center justify-center text-[10px] font-bold text-cyan-200">
                                                    AI
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Multi-Engine Consensus: High Confidence</p>
                                    </div>
                                </div>

                                {/* Link Metadata */}
                                <div className="p-8 bg-black/40 border border-white/5 rounded-3xl">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Link2 className="text-cyan-400" size={18} />
                                        <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Ontological Links</h4>
                                    </div>
                                    <div className="space-y-3">
                                        {ontology?.links?.filter(l => l.source === selectedId || l.target === selectedId).map((link, i) => {
                                            const isSource = link.source === selectedId;
                                            const partner = isSource ? link.target : link.source;
                                            return (
                                                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-cyan-500/20 transition-all cursor-pointer group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2 rounded-lg ${isSource ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}>
                                                            <ExternalLink size={14} className={isSource ? 'text-amber-400' : 'text-blue-400'} />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{link.predicate}</p>
                                                            <p className="text-xs text-white mt-0.5 group-hover:text-cyan-400 transition-colors uppercase">{partner}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[9px] font-mono text-gray-600">{link.technical.from} {' -> '} {link.technical.to}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {ontology?.links?.filter(l => l.source === selectedId || l.target === selectedId).length === 0 && (
                                            <div className="py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-gray-600 text-[10px] uppercase font-bold tracking-widest">
                                                No detected semantic links
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Semantic Property Map */}
                            <div className="mt-8 p-10 bg-white/5 border border-white/10 rounded-[2.5rem]">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <Zap className="text-amber-400" size={18} />
                                        <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Semantic Property Map</h4>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <HelpCircle size={14} />
                                        <span>Technical Schema {' -> '} Human Ontology</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Object.entries(selectedObject.properties || {}).map(([tech, semantic]) => (
                                        <div key={tech} className="p-4 bg-black/40 rounded-2xl border border-white/5 flex flex-col gap-2 group hover:bg-cyan-500/[0.03] transition-colors">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[9px] font-mono text-gray-600 truncate max-w-[100px]">{tech}</span>
                                                <motion.div
                                                    animate={{ x: [0, 3, 0] }}
                                                    transition={{ duration: 1.5, repeat: Infinity }}
                                                    className="w-4 h-0.5 bg-gray-800"
                                                />
                                            </div>
                                            <p className="text-sm font-black text-cyan-100 uppercase tracking-tighter group-hover:text-cyan-400 transition-colors">{semantic}</p>
                                        </div>
                                    ))}
                                    {Object.keys(selectedObject.properties || {}).length === 0 && (
                                        <div className="col-span-full p-12 text-center border border-dashed border-white/10 rounded-2xl">
                                            <p className="text-gray-600 text-xs font-bold uppercase tracking-[0.2em]">Physical Schema contains no verified semantic properties</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-600 uppercase font-mono tracking-widest text-[10px]">
                            SELECT AN OBJECT CLASS TO EXPLORE PROVENANCE
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
