import React, { useState, useEffect } from 'react';
import { Bot, Terminal, Activity, History, ChevronRight, Check, X } from 'lucide-react';
import { agentService } from '../../services/agentService';
import soundSystem from '../../utils/SoundSystem';

const AgentStatusPanel = () => {
    const [state, setState] = useState({
        t0_state: 'idle',
        t1_state: 'idle',
        total_commands: 0,
        success_rate: 1.0
    });
    const [logs, setLogs] = useState([]);
    const [isOpen, setIsOpen] = useState(false);

    const fetchData = async () => {
        try {
            const [stateData, logsData] = await Promise.all([
                agentService.getAgentState(),
                agentService.getCommandLogs(5)
            ]);
            setState(stateData);
            setLogs(logsData.commands);
        } catch (error) {
            console.error('Failed to fetch agent status:', error);
        }
    };

    useEffect(() => {
        fetchData();
        // Faster polling for dynamic feel
        const interval = setInterval(fetchData, 2000);
        return () => clearInterval(interval);
    }, []);

    const togglePanel = () => {
        soundSystem.play('nodeClick');
        setIsOpen(!isOpen);
    };

    const getStatusColor = (s) => {
        switch (s) {
            case 'idle': return 'bg-slate-500';
            case 'listening': return 'bg-red-500';
            case 'processing':
            case 'executing': return 'bg-blue-500';
            case 'success':
            case 'dispatching': return 'bg-emerald-500';
            case 'error':
            case 'failed': return 'bg-rose-500';
            default: return 'bg-slate-500';
        }
    };

    return (
        <div className={`fixed left-4 top-24 z-40 transition-all duration-500 ${isOpen ? 'w-80' : 'w-12'}`}>
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                {/* Header/Toggle */}
                <button
                    onClick={togglePanel}
                    className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Bot className={`w-5 h-5 text-indigo-400 ${state.t0_state !== 'idle' ? 'animate-pulse' : ''}`} />
                        {isOpen && <span className="font-semibold text-slate-200">Neural Agent HUB</span>}
                    </div>
                    {isOpen ? <ChevronRight className="w-4 h-4 text-slate-500 rotate-180" /> : null}
                </button>

                {isOpen && (
                    <div className="p-4 flex flex-col gap-6 animate-in fade-in duration-300">
                        {/* State Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">T0 BRAIN</div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(state.t0_state)} shadow-[0_0_8px] ${getStatusColor(state.t0_state)}`} />
                                    <span className="text-sm font-medium text-slate-200 capitalize">{state.t0_state}</span>
                                </div>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">T1 ENGINE</div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(state.t1_state)} shadow-[0_0_8px] ${getStatusColor(state.t1_state)}`} />
                                    <span className="text-sm font-medium text-slate-200 capitalize">{state.t1_state}</span>
                                </div>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="flex justify-between items-center px-2">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Activity className="w-4 h-4" />
                                <span className="text-xs">Success Rate</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-400">{Math.round(state.success_rate * 100)}%</span>
                        </div>

                        {/* Recent History */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <History className="w-4 h-4" />
                                    <span className="text-xs font-semibold uppercase tracking-widest text-[10px]">Recent Intents</span>
                                </div>
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('agent-test-command'))}
                                    className="text-[9px] bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 px-2 py-0.5 rounded transition-colors border border-indigo-500/30"
                                >
                                    Test
                                </button>
                            </div>

                            <div className="flex flex-col gap-2">
                                {logs.length === 0 ? (
                                    <div className="text-center py-4 text-slate-600 text-[10px] italic">No activity logs found</div>
                                ) : logs.map((log) => (
                                    <div key={log.id} className="bg-slate-800/30 p-2 rounded border border-slate-700/50 group">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-mono text-indigo-400/70">{log.id.split('_')[1]}</span>
                                            {log.success ? (
                                                <Check className="w-3 h-3 text-emerald-500" />
                                            ) : (
                                                <X className="w-3 h-3 text-rose-500" />
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-300 truncate font-medium">"{log.text}"</div>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[9px] text-slate-500">{log.intent}</span>
                                            <span className="text-[9px] text-slate-600">{log.execution_time_ms}ms</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-600">
                            <span>Total Ops: {state.total_commands}</span>
                            <span className="flex items-center gap-1">
                                <Terminal className="w-3 h-3" />
                                CLI Active
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentStatusPanel;
