import React from 'react';
import { TrendingUp, Database, Brain, CheckCircle, Pin, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function EdgeStatsPanel({ edge, position, visible, variant = 'floating', isPinned, onPin, onClose }) {
    if (!visible || !edge) return null;

    const edgeData = edge.data || {};
    const factors = edgeData.strength_factors || {};
    const factorEntries = Object.entries(factors);
    const isFloating = variant === 'floating';

    // ── SIDEBAR VARIANT: compact data-rows matching Intelligence Report style ──
    if (!isFloating) {
        const rowStyle = {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
            fontSize: '9px', gap: '6px'
        };
        const keyStyle = { color: 'rgba(167,186,220,0.45)', letterSpacing: '0.08em', flexShrink: 0 };
        const valStyle = { color: 'rgba(200,215,240,0.9)', fontWeight: 600, fontFamily: 'Share Tech Mono, monospace', textAlign: 'right', wordBreak: 'break-all' };

        return (
            <div style={{ width: '100%' }}>
                <div style={rowStyle}>
                    <span style={keyStyle}>FROM:</span>
                    <span style={valStyle}>{edge.sourceNode?.name || 'Unknown'}</span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>TO:</span>
                    <span style={valStyle}>{edge.targetNode?.name || 'Unknown'}</span>
                </div>
                <div style={rowStyle}>
                    <span style={keyStyle}>CONFIDENCE:</span>
                    <span style={{ ...valStyle, color: '#22d3ee' }}>{edgeData.confidence_score || 0}%</span>
                </div>
                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                    <span style={keyStyle}>CATEGORY:</span>
                    <span style={{ ...valStyle, color: '#818cf8', textTransform: 'capitalize' }}>
                        {edgeData.relationship_category || 'Unknown'}
                    </span>
                </div>
            </div>
        );
    }

    // ── FLOATING VARIANT: full card (unchanged) ──
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="fixed z-[5000] pointer-events-auto"
                style={{ top: '100px', left: '92px' }}
            >
                <div className="bg-[var(--bg-elevated)]/95 backdrop-blur-xl border border-white/30 rounded-xl p-4 shadow-2xl min-w-[320px] max-w-[400px] relative">
                    {/* Header Controls */}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                        <button 
                            onClick={() => onPin && onPin()}
                            className={`p-1 rounded-md transition-colors ${isPinned ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-white/10 text-white/40'}`}
                            title={isPinned ? "Unpin Relationship" : "Pin Relationship"}
                        >
                            <Pin size={14} className={isPinned ? 'fill-cyan-400' : ''} />
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
                    <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gradient-to-br from-[var(--primary-cyan)] to-[var(--primary-purple)] rounded-lg">
                                <TrendingUp size={14} />
                            </div>
                            <h4 className="font-bold text-[var(--text-primary)] text-sm">Relationship Analysis</h4>
                        </div>
                        <span className="text-2xl font-bold text-[var(--primary-cyan)]">
                            {edgeData.confidence_score || 0}%
                        </span>
                    </div>

                    {/* Connection Info */}
                    <div className="mb-3 p-2 bg-white/5 rounded-lg">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-secondary)]">From:</span>
                            <span className="font-mono font-semibold text-[var(--text-primary)]">{edge.sourceNode?.name || 'Unknown'}</span>
                        </div>
                        <div className="my-1 flex justify-center">
                            <div className="w-6 h-0.5 bg-gradient-to-r from-[var(--primary-cyan)] to-[var(--primary-purple)]" />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-[var(--text-secondary)]">To:</span>
                            <span className="font-mono font-semibold text-[var(--text-primary)]">{edge.targetNode?.name || 'Unknown'}</span>
                        </div>
                    </div>

                    {/* Statistical Proof */}
                    <div className="mb-3">
                        <div className="flex items-center gap-1.5 mb-2">
                            <Database size={12} className="text-[var(--primary-cyan)]" />
                            <span className="text-xs font-semibold text-[var(--text-primary)]">Statistical Proof</span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-white/5 p-2 rounded border border-white/10">
                            {edgeData.statistical_proof || edgeData.reasoning || 'No detailed reasoning available'}
                        </p>
                    </div>

                    {/* Strength Factors */}
                    {factorEntries.length > 0 && (
                        <div className="mb-3">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Brain size={12} className="text-[var(--primary-purple)]" />
                                <span className="text-xs font-semibold text-[var(--text-primary)]">Contributing Factors</span>
                            </div>
                            <div className="space-y-2">
                                {factorEntries.map(([key, value]) => (
                                    <div key={key} className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-[var(--text-secondary)] capitalize">{key.replace(/_/g, ' ')}</span>
                                            <span className="font-semibold text-[var(--text-primary)]">{value}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${value}%` }}
                                                transition={{ duration: 0.5, delay: 0.2 }}
                                                className="h-full bg-gradient-to-r from-[var(--primary-cyan)] to-[var(--primary-purple)] rounded-full"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Category Badge */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div className="flex items-center gap-1.5">
                            <CheckCircle size={12} className="text-green-400" />
                            <span className="text-xs text-[var(--text-secondary)]">Category:</span>
                        </div>
                        <span className="text-xs px-2 py-1 rounded bg-gradient-to-r from-[var(--primary-cyan)]/20 to-[var(--primary-purple)]/20 border border-[var(--primary-cyan)]/30 text-[var(--primary-cyan)] font-semibold capitalize">
                            {edgeData.relationship_category || 'Unknown'}
                        </span>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

