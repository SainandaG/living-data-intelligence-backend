import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sigma, ChevronDown, ChevronUp, BrainCircuit, Activity } from 'lucide-react';

const EvolutionMathOverlay = ({ snapshot }) => {
    const [isFolded, setIsFolded] = useState(false);
    if (!snapshot) return null;

    // Aggregate values for math visualization
    const avgGlow = snapshot.global_metrics?.intelligence_score || 0;
    const avgVitality = snapshot.global_metrics?.avg_vitality || 0;
    const density = snapshot.global_metrics?.data_density || 0;

    return (
        <div className="fixed top-24 left-[300px] w-[350px] z-40 pointer-events-auto">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900/40 backdrop-blur-sm border border-white/5 rounded-2xl p-5 shadow-2xl overflow-hidden"
            >
                <div
                    className="flex items-center justify-between mb-6 text-indigo-400 cursor-pointer select-none"
                    onClick={() => setIsFolded(!isFolded)}
                >
                    <div className="flex items-center gap-2">
                        <Sigma size={18} />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em]">Neural Mathematics (Director Formulation)</h3>
                    </div>
                    {isFolded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </div>

                <AnimatePresence>
                    {!isFolded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-6"
                        >
                            {/* Glow Formula */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Node Glow (G)</span>
                                    <span className="text-xs font-mono text-indigo-300">avg: {avgGlow}</span>
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5 font-mono text-[10px] text-slate-300">
                                    <div className="text-indigo-400 mb-1">Γ(v) = (0.8 · log₁₀(N+1) · λ) + (0.6 · C)</div>
                                    <div className="text-[8px] text-slate-500">
                                        λ=age factor, C=importance weight | N={density.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Vitality Formula */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Neural Vitality (V)</span>
                                    <span className="text-xs font-mono text-emerald-300">{avgVitality}%</span>
                                </div>
                                <div className="p-3 bg-white/5 rounded-lg border border-white/5 font-mono text-[10px] text-slate-300">
                                    <div className="text-emerald-400 mb-1">V(t) = min(100, (20·log₁₀(N+1)) + (5·C))</div>
                                    <div className="text-[8px] text-slate-500">
                                        Φ=log-scale, Ψ=centrality-bias
                                    </div>
                                </div>
                            </div>

                            {/* Simulation Engine Status */}
                            <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    <span className="text-[8px] text-slate-400 uppercase font-bold">Evolution Engine Active</span>
                                </div>
                                <div className="text-[8px] text-indigo-400 font-mono">
                                    STEP_RESOLUTION: 50kf
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default EvolutionMathOverlay;
