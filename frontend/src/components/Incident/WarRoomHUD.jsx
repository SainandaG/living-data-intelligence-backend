import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Activity, Database, ShieldAlert, ArrowLeftRight, Crosshair, Users } from 'lucide-react';

export default function WarRoomHUD({ targetNode, activePeers = {}, connectionId, anomalyData, onExit }) {
    const [impactData, setImpactData] = useState(null);
    const [loading, setLoading] = useState(false);

    const nodeName = typeof targetNode === 'object' ? (targetNode.name || targetNode.id) : targetNode;

    useEffect(() => {
        if (!connectionId || !nodeName) return;

        const fetchImpact = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/drilldown/${connectionId}/impact-analysis/${nodeName}`);
                if (response.ok) {
                    const data = await response.json();
                    setImpactData(data);
                }
            } catch (err) {
                console.error("Failed to fetch impact analysis:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchImpact();
    }, [connectionId, nodeName]);

    if (!targetNode) return null;

    // Calculate number of people in the war room
    const peerCount = Object.keys(activePeers).length;
    const allUsers = peerCount > 0 ? peerCount + 1 : 1; // +1 for the current user

    return (
        <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-20 right-4 w-96 flex flex-col gap-4 z-[6000] pointer-events-auto"
        >
            {/* Header: Flashing Red Alert */}
            <div className="bg-red-950/80 border border-red-500 rounded-lg p-4 shadow-[0_0_30px_rgba(239,68,68,0.3)] backdrop-blur-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />

                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertTriangle className="animate-pulse" size={24} />
                        <h2 className="text-xl font-bold tracking-wider uppercase font-mono text-shadow-red">Critical Incident</h2>
                    </div>
                    <button
                        onClick={onExit}
                        className="px-3 py-1 bg-red-900/50 hover:bg-red-800 border border-red-500/50 text-red-200 text-xs font-bold rounded transition-colors"
                    >
                        RESOLVE / EXIT
                    </button>
                </div>

                <div className="mt-4 p-3 bg-black/40 rounded border border-red-900/50">
                    <p className="text-xs text-red-300 uppercase font-bold tracking-widest mb-1 opacity-70">Root Cause Node</p>
                    <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-white font-mono break-all">{nodeName}</p>
                        <Crosshair className="text-red-500" size={20} />
                    </div>
                    <div className="mt-2 flex gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${impactData?.risk_score > 60 ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>
                            {impactData?.risk_score > 60 ? 'SEV-1' : 'SEV-2'}
                        </span>
                        {impactData?.affected_tables_count > 0 && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px] font-bold border border-orange-500/30 font-mono tracking-tighter">
                                {impactData?.risk_score > 40 ? 'IMPACT PROPAGATING' : 'ISOLATED RISK'}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Analysis Panel */}
            <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-4 shadow-xl backdrop-blur-md relative overflow-hidden">
                {loading && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/30 overflow-hidden">
                        <motion.div
                            className="w-1/3 h-full bg-cyan-400"
                            animate={{ x: ["-100%", "300%"] }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        />
                    </div>
                )}

                <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={14} className={loading ? "text-cyan-400 animate-spin" : "text-cyan-400"} />
                    Neural Impact Scan {loading && <span className="text-[8px] animate-pulse">(ACTIVE)</span>}
                </h3>

                <div className="space-y-3">
                    <div className={`p-3 border-l-2 rounded-r transition-colors duration-500 ${anomalyData ? 'bg-red-950/30 border-red-500' : 'bg-slate-800/20 border-slate-500'}`}>
                        <p className="text-sm text-slate-300 font-mono">
                            <span className={anomalyData ? "text-red-400 font-bold" : "text-slate-400 font-bold"}>
                                {anomalyData ? '⚠️ ALERT: ' : '📡 ANALYSIS: '}
                            </span>
                            {anomalyData?.explanation || impactData?.summary || `Calculating structural dependencies for ${nodeName}...`}
                        </p>
                    </div>



                    <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="p-2 bg-black/40 rounded border border-slate-800">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Impact Radius</p>
                            <p className="text-xl font-bold text-orange-400">
                                {loading ? "..." : (impactData?.affected_tables_count || 0)} Nodes
                            </p>
                        </div>
                        <div className="p-2 bg-black/40 rounded border border-slate-800">
                            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Risk Score</p>
                            <p className="text-xl font-bold text-red-400">
                                {loading ? "..." : (impactData?.risk_score || 0)}%
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Collaboration Panel */}
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-lg p-3 shadow-xl backdrop-blur-md flex items-center justify-between">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Users size={16} className={peerCount > 0 ? "text-green-400" : "text-slate-500"} />
                        <span className="text-xs font-bold uppercase tracking-wider">War-Room Protocol</span>
                    </div>
                    <span className="text-[8px] text-slate-500 font-mono mt-1 uppercase">
                        Sync: {new Date().toLocaleTimeString()} • {impactData ? 'STABLE' : 'SCANNING'}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400">
                        {allUsers} {allUsers === 1 ? 'ENGINEER' : 'ENGINEERS'} ONLINE
                    </span>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
            </div>


        </motion.div>
    );
}

