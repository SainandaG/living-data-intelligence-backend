import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Share2, Info, ArrowRight, Zap, AlertTriangle, Activity, GitBranch, BarChart3, Database } from 'lucide-react';
import './LineageInsightHUD.css';

const LineageInsightHUD = ({ hoveredNode, selectedNode, multiSelectedNodes = [], graphData = {}, perspective = 'analyst' }) => {
    // Logic: Always show if hovered. 
    const isPartOfSelection = useMemo(() => {
        if (!hoveredNode) return false;
        if (selectedNode?.id === hoveredNode.id) return true;
        return multiSelectedNodes.includes(hoveredNode.id);
    }, [hoveredNode, selectedNode, multiSelectedNodes]);

    // --- Business Impact Logic ---
    const impact = useMemo(() => {
        if (!hoveredNode) return { label: '', class: '', reason: '', risk: '', volume: '0' };

        const in_deg = hoveredNode.in_degree || 0;
        const out_deg = hoveredNode.out_degree || 0;
        const down_count = hoveredNode.affectedDownstreamCount || 0;
        const row_count = hoveredNode.row_count || 1000;

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
            reason: hoveredNode.isSource ? 'Primary source system. Foundational data for the network.' : 'Downstream terminal node used for reporting.',
            risk: hoveredNode.isSource ? 'Low - Source Integrity' : 'None - Leaf Node',
            volume: simVolume + 'K'
        };
    }, [hoveredNode]);

    // --- Lineage Logic ---
    const fks = useMemo(() => {
        if (!hoveredNode) return [];
        return (hoveredNode.foreign_keys || []).slice(0, 5);
    }, [hoveredNode]);

    // --- Bridge Connection Logic (Specific to Multi-Selection) ---
    const bridgeConnections = useMemo(() => {
        if (!hoveredNode || multiSelectedNodes.length < 2) return [];

        const selectedIds = new Set(multiSelectedNodes);
        return (hoveredNode.foreign_keys || []).filter(fk => {
            const targetId = typeof fk === 'string' ? fk : fk.referenced_table;
            return selectedIds.has(targetId) && targetId !== hoveredNode.id;
        });
    }, [hoveredNode, multiSelectedNodes]);

    if (!hoveredNode) return null;

    const isBusiness = perspective === 'business';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className={`lineage-insight-hud shadow-2xl ${isBusiness ? 'perspective-business' : 'perspective-analyst'}`}
                style={{ top: '100px', right: '20px' }}
            >
                {/* Header */}
                <header className="hud-header">
                    <div className="hud-title-area">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="hud-table-name">{hoveredNode.name}</h3>
                            {isPartOfSelection && <Shield size={10} className="text-cyan-400" />}
                        </div>
                        <div className="hud-table-type">
                            {hoveredNode.table_type || 'Table'} • {hoveredNode.row_count?.toLocaleString()} Records
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
                                    <div className="stat-value text-amber-500">₹{((hoveredNode.row_count || 0) * 0.01).toFixed(1)}L</div>
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
                                {(hoveredNode.downstream_node_ids || []).slice(0, 4).map((id, i) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-amber-500/10 rounded text-[9px] text-amber-400 border border-amber-500/20 uppercase">
                                        {id}
                                    </span>
                                ))}
                            </div>
                        </section>
                    </>
                )}

                <footer className="hud-footer">
                    <Info size={10} />
                    <span>Click node to lock lineage target</span>
                </footer>
            </motion.div>
        </AnimatePresence>
    );
};

export default LineageInsightHUD;
