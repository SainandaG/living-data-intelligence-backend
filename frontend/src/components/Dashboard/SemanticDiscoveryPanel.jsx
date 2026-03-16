import React, { useEffect, useState } from 'react';
import apiClient from '../../utils/apiClient';
import { BrainCircuit, Sparkles, ArrowRight, Table } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SemanticDiscoveryPanel({ connectionId, tableName, onNodeClick }) {
    const [predictions, setPredictions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!connectionId || !tableName) return;

        const fetchDiscovery = async () => {
            setLoading(true);
            try {
                const data = await apiClient.get(`/drilldown/${connectionId}/semantic-discovery/${tableName}`);
                setPredictions(data.predictions || []);
            } catch (err) {
                console.error('Failed to fetch semantic discovery:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchDiscovery();
    }, [connectionId, tableName]);

    if (loading) {
        return (
            <div className="p-4 bg-white/5 rounded-lg border border-white/10 animate-pulse">
                <div className="h-4 w-32 bg-white/20 rounded mb-4" />
                <div className="space-y-2">
                    <div className="h-12 bg-white/10 rounded" />
                    <div className="h-12 bg-white/10 rounded" />
                </div>
            </div>
        );
    }

    if (!predictions || predictions.length === 0) {
        return (
            <div className="p-4 bg-white/5 rounded-lg border border-white/10 italic text-[10px] text-[var(--text-muted)] text-center">
                Neural Core finds no significant inferred relationships for this entity.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h4 className="text-[10px] font-bold tracking-[2px] uppercase text-[var(--primary-cyan)] font-mono flex items-center gap-2">
                <Sparkles size={12} className="animate-pulse" />
                Inferred Relationships
            </h4>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {predictions.map((pred, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-3 bg-gradient-to-r from-[var(--primary-purple)]/10 to-transparent border border-[var(--primary-purple)]/20 rounded-lg hover:border-[var(--primary-purple)]/50 transition-all group cursor-pointer"
                        onClick={() => onNodeClick && onNodeClick(pred.target_id)}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-white flex items-center gap-2">
                                <Table size={12} className="text-[var(--primary-purple)]" />
                                {pred.target_id}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-[var(--primary-purple)]/20 text-[var(--primary-purple)] rounded-full font-bold">
                                {(pred.confidence * 100).toFixed(0)}% Match
                            </span>
                        </div>
                        <p className="text-[9px] text-[var(--text-secondary)] leading-tight group-hover:text-[var(--text-primary)] transition-colors italic">
                            {pred.reasoning}
                        </p>
                    </motion.div>
                ))}
            </div>

            <div className="text-[9px] text-[var(--text-muted)] flex items-center gap-1.5 px-1">
                <BrainCircuit size={10} />
                <span>Predictions based on Neural name similarity analysis.</span>
            </div>
        </div>
    );
}
