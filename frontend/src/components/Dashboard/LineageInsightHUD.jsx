import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Share2, Info, ArrowRight, Zap, AlertTriangle, Activity, GitBranch, BarChart3, Database, Pin, X } from 'lucide-react';
import './LineageInsightHUD.css';

const LineageInsightHUD = ({ hoveredNode, selectedNode, pinnedNodeId, onPin, onClose, multiSelectedNodes = [], graphData = {}, perspective = 'analyst', onEnterWarRoom, visible = true }) => {
    // Logic: Always show if hovered, otherwise fall back to selected.
    const activeNode = hoveredNode || selectedNode;

    const isPartOfSelection = useMemo(() => {
        if (!activeNode) return false;
        if (selectedNode?.id === activeNode.id) return true;
        return multiSelectedNodes.includes(activeNode.id);
    }, [activeNode, selectedNode, multiSelectedNodes]);

    // --- Business Impact Logic ---
    const impact = useMemo(() => {
        if (!activeNode) return { label: '', class: '', reason: '', risk: '', volume: '0' };

        const in_deg = activeNode.in_degree || 0;
        const out_deg = activeNode.out_degree || 0;
        const down_count = activeNode.affectedDownstreamCount || 0;
        const row_count = activeNode.row_count || 1000;

        // Simulated Transaction Volume (Scaled by row count and connectivity)
        const simVolume = (row_count * (1 + out_deg * 0.2) / 1000).toFixed(1);

        if (down_count > 5 || in_deg > 5) {
            return {
                label: 'Core Asset',
                class: 'core',
                reason: 'Critical business entity. Changes here impact major downstream reporting and operational workflows.',
                risk: 'High - Systemic Ripple',
                volume: simVolume + 'M'
            };
        } else if (in_deg > 0 && out_deg > 0) {
            return {
                label: 'Operational Pivot',
                class: 'pivot',
                reason: 'Key junction point. Acts as a bridge between multiple source systems and reporting layers.',
                risk: 'Medium - Direct Impact',
                volume: simVolume + 'K'
            };
        }
        return {
            label: 'Data Origin',
            class: 'consumer',
            reason: activeNode.isSource ? 'Primary source system. Foundational data for the network.' : 'Downstream terminal node used for reporting.',
            risk: activeNode.isSource ? 'Low - Source Integrity' : 'None - Leaf Node',
            volume: simVolume + 'K'
        };
    }, [activeNode]);


    // --- Lineage Logic ---
    const fks = useMemo(() => {
        if (!activeNode) return [];
        return (activeNode.foreign_keys || []).slice(0, 5);
    }, [activeNode]);

    // --- Bridge Connection Logic (Specific to Multi-Selection) ---
    const bridgeConnections = useMemo(() => {
        if (!activeNode || multiSelectedNodes.length < 2) return [];

        const selectedIds = new Set(multiSelectedNodes);
        return (activeNode.foreign_keys || []).filter(fk => {
            const targetId = typeof fk === 'string' ? fk : fk.referenced_table;
            return selectedIds.has(targetId) && targetId !== activeNode.id;
        });
    }, [activeNode, multiSelectedNodes]);

    if (!activeNode || !visible) return null;

    const isBusiness = perspective === 'business';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className={`lineage-insight-hud shadow-2xl ${isBusiness ? 'perspective-business' : 'perspective-analyst'}`}
                style={{ top: '100px', left: '92px', pointerEvents: 'auto' }}
            >
                {/* Header Controls */}
                <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button 
                        onClick={() => onPin && onPin(activeNode.id)}
                        className={`p-1 rounded-md transition-colors ${pinnedNodeId === activeNode.id ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-white/10 text-white/40'}`}
                        title={pinnedNodeId === activeNode.id ? "Unpin Node" : "Pin Node"}
                    >
                        <Pin size={14} className={pinnedNodeId === activeNode.id ? 'fill-cyan-400' : ''} />
                    </button>
                    <button 
                        onClick={() => onClose && onClose()}
                        className="p-1 hover:bg-white/10 text-white/40 hover:text-white rounded-md transition-colors"
                        title="Close Panel"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Header */}
                <header className="hud-header">
                    <div className="hud-title-area">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="hud-table-name">{activeNode.name}</h3>
                            {isPartOfSelection && <Shield size={10} className="text-cyan-400" />}
                        </div>
                        <div className="hud-table-type">
                            {activeNode.table_type || 'Table'} • {activeNode.row_count?.toLocaleString()} Records
                        </div>
                    </div>
                    <div className={`impact-badge ${impact.class}`}>
                        {impact.label}
                    </div>
                </header>

                <div className="perspective-indicator">
                    {isBusiness ? <Database size={10} /> : <Zap size={10} />}
                    {isBusiness ? 'Business View' : 'Technical Analyst'}
                </div>

                {/* ANALYST VIEW: Technical Lineage */}
                {!isBusiness && (
                    <>
                        {bridgeConnections.length > 0 && (
                            <section className="hud-section">
                                <div className="hud-section-label !text-cyan-400">
                                    <GitBranch size={12} />
                                    Active Schema Join
                                </div>
                                <div className="connection-list !border-l-2 !border-cyan-500/50 !pl-2">
                                    {bridgeConnections.map((fk, i) => (
                                        <div key={i} className="connection-item !bg-cyan-500/5">
                                            <span className="conn-col">{fk.column || "id"}</span>
                                            <ArrowRight size={10} className="conn-arrow" />
                                            <span className="conn-target !text-cyan-400">
                                                {typeof fk === 'string' ? fk : fk.referenced_table}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className="hud-section">
                            <div className="hud-section-label">
                                <Activity size={12} />
                                Integrity Assessment
                            </div>
                            <div className="stats-grid">
                                <div className="stat-item">
                                    <div className="stat-value text-cyan-400">98%</div>
                                    <div className="stat-label">Referential</div>
                                </div>
                                <div className="stat-item">
                                    <div className="stat-value text-indigo-400">{fks.length}</div>
                                    <div className="stat-label">FK Outbound</div>
                                </div>
                            </div>
                        </section>

                        {fks.length > 0 && (
                            <section className="hud-section mb-0">
                                <div className="hud-section-label">System Dependencies</div>
                                <div className="connection-list max-h-24 overflow-y-auto pr-1">
                                    {fks.map((fk, i) => (
                                        <div key={i} className="connection-item opacity-70">
                                            <span className="conn-col text-[9px]">{fk.column || "id"}</span>
                                            <span className="text-[9px] text-white/20">→</span>
                                            <span className="conn-target text-[9px] truncate">
                                                {typeof fk === 'string' ? fk : fk.referenced_table}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}

                {/* BUSINESS VIEW: Operational Impact */}
                {isBusiness && (
                    <>
                        <section className="hud-section">
                            <div className="hud-section-label !text-amber-400">
                                <BarChart3 size={12} />
                                Operational Metrics
                            </div>
                            <div className="stats-grid">
                                <div className="stat-item !border-amber-500/30">
                                    <div className="stat-value text-amber-500">{impact.volume}</div>
                                    <div className="stat-label">Tx Volume</div>
                                </div>
                                <div className="stat-item !border-amber-500/30">
                                    <div className="stat-value text-amber-500">₹{((activeNode.row_count || 0) * 0.01).toFixed(1)}L</div>
                                    <div className="stat-label">Risk Value</div>
                                </div>
                            </div>
                        </section>

                        <section className="hud-section">
                            <div className="hud-section-label">Business Outcome</div>
                            <div className="business-reasoning !border-amber-500/50 text-amber-100/80 bg-amber-500/5">
                                {impact.reason}
                            </div>
                        </section>

                        <section className="hud-section mb-0">
                            <div className="hud-section-label">Downstream ROI Flow</div>
                            <div className="flex flex-wrap gap-1.5">
                                {(activeNode.downstream_node_ids || []).slice(0, 4).map((id, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-amber-500/10 rounded text-[9px] text-amber-400 border border-amber-500/20 uppercase">
                                        {id}
                                    </span>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                {/* WAR ROOM TRIGGER */}
                {(activeNode.health?.score < 50 || activeNode.status === 'error' || activeNode.vitality < 50) && onEnterWarRoom && (
                    <button
                        onClick={() => onEnterWarRoom(activeNode.id)}
                        className="w-full mt-2 py-2 bg-red-900/40 hover:bg-red-800/80 border border-red-500/50 text-red-400 font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-colors rounded shadow-[0_0_15px_rgba(239,68,68,0.2)] pointer-events-auto"
                    >
                        <AlertTriangle size={14} className="animate-pulse" />
                        Enter War-Room
                    </button>
                )}

                <footer className="hud-footer mt-2">
                    <Info size={10} />
                    <span>Click node to lock lineage target</span>
                </footer>
            </motion.div>
        </AnimatePresence>
    );
};

export default React.memo(LineageInsightHUD);
