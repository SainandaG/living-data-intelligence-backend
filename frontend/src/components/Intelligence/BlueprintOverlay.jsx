import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Zap, Shield, GitBranch, Terminal } from 'lucide-react';
import axios from 'axios';

const BlueprintOverlay = ({ connectionId, tableName }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalysis = async () => {
            try {
                const res = await axios.get(`/api/evolution/analysis/table/${connectionId}/${tableName}`);
                setAnalysis(res.data);
            } catch (err) {
                console.error("Blueprint fetch failed:", err);
            } finally {
                setLoading(false);
            }
        };

        if (connectionId && tableName) fetchAnalysis();
    }, [connectionId, tableName]);

    if (loading) return null;

    const metrics = analysis?.metrics || { gravity: 1.0, entropy: 0.1, vitality: 50 };
    const proofs = analysis?.proofs || {};

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            {/* Mathematical Blueprint */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-6 backdrop-blur-md"
            >
                <div className="flex items-center gap-3 mb-4">
                    <Terminal size={18} className="text-cyan-400" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-cyan-400">Neural Blueprint</h4>
                </div>

                <div className="space-y-4">
                    <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-gray-500 font-mono">NODE_GRAVITY (G)</span>
                            <span className="text-xs font-bold text-white font-mono">{metrics.gravity.toFixed(4)} N</span>
                        </div>
                        <code className="text-[9px] text-cyan-500/70 block px-2 py-1 bg-cyan-500/5 rounded">
                            {proofs.gravity || "G = Σ(in_degree * mass) / r²"}
                        </code>
                    </div>

                    <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] text-gray-500 font-mono">SHANNON_ENTROPY (H)</span>
                            <span className="text-xs font-bold text-white font-mono">{metrics.entropy.toFixed(4)} Bits</span>
                        </div>
                        <code className="text-[9px] text-pink-500/70 block px-2 py-1 bg-pink-500/5 rounded">
                            {proofs.entropy || "H(X) = -Σ p(x) log p(x)"}
                        </code>
                    </div>
                </div>
            </motion.div>

            {/* Logical Connections */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 backdrop-blur-md"
            >
                <div className="flex items-center gap-3 mb-4">
                    <GitBranch size={18} className="text-purple-400" />
                    <h4 className="text-xs font-bold uppercase tracking-widest text-purple-400">Structural Dependencies</h4>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-[10px] text-gray-500 font-mono">IN_DEGREE</span>
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500" style={{ width: `${Math.min(100, metrics.in_degree * 10)}%` }} />
                            </div>
                            <span className="text-xs font-bold text-white font-mono">{metrics.in_degree}</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-[10px] text-gray-500 font-mono">OUT_DEGREE</span>
                        <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, metrics.out_degree * 10)}%` }} />
                            </div>
                            <span className="text-xs font-bold text-white font-mono">{metrics.out_degree}</span>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                        <p className="text-[10px] text-purple-200 font-mono leading-relaxed">
                            Detected Topology: <span className="text-white font-bold">{metrics.in_degree > metrics.out_degree ? 'NUCLEUS' : 'HELIX'}</span>.
                            Logical stability factor at {(1 - metrics.entropy).toFixed(2)}σ.
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default BlueprintOverlay;
