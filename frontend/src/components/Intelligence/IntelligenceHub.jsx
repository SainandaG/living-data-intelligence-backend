import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity,
    BarChart3,
    AlertTriangle,
    TrendingUp,
    GitBranch,
    Lightbulb,
    Zap,
    X
} from 'lucide-react';

import HealthDashboard from './HealthDashboard';
import PatternDashboard from './PatternDashboard';
import AnomalyDashboard from './AnomalyDashboard';
import PredictionDashboard from './PredictionDashboard';
import RootCauseDashboard from './RootCauseDashboard';
import RecommendationDashboard from './RecommendationDashboard';
import DeepStatusDashboard from './DeepStatusDashboard';

const dashboards = [
    { id: 'health', name: 'System Health', icon: Activity, component: HealthDashboard, color: '#00ff88' },
    { id: 'deep-status', name: 'Deep Diagnostics', icon: Zap, component: DeepStatusDashboard, color: '#00D7FF' },
    { id: 'patterns', name: 'Behavior Patterns', icon: BarChart3, component: PatternDashboard, color: '#00ccff' },
    { id: 'anomalies', name: 'Risk Detection', icon: AlertTriangle, component: AnomalyDashboard, color: '#ff4757' },
    { id: 'predictions', name: 'Future Forecast', icon: TrendingUp, component: PredictionDashboard, color: '#ffd60a' },
    { id: 'root-cause', name: 'Impact Analysis', icon: GitBranch, component: RootCauseDashboard, color: '#a29bfe' },
    { id: 'recommendations', name: 'Action Plans', icon: Lightbulb, component: RecommendationDashboard, color: '#ff9f43' },
];

export default function IntelligenceHub({ connectionId, selectedNode, onClose }) {
    const [activeTab, setActiveTab] = useState(() => {
        const savedAction = window.lastIntelligenceTab;
        if (savedAction) {
            window.lastIntelligenceTab = null; // Clear it
            return savedAction === 'anomalies' ? 'anomalies' :
                savedAction === 'patterns' ? 'patterns' :
                    savedAction === 'predictions' ? 'predictions' :
                        savedAction === 'root_cause' ? 'root-cause' :
                            savedAction === 'recommendations' ? 'recommendations' : 'health';
        }
        return localStorage.getItem('intelligence_active_tab') || 'health';
    });

    React.useEffect(() => {
        localStorage.setItem('intelligence_active_tab', activeTab);
    }, [activeTab]);

    const ActiveComponent = dashboards.find(d => d.id === activeTab)?.component || HealthDashboard;
    const activeColor = dashboards.find(d => d.id === activeTab)?.color || '#00ff88';

    // Extract table name from selectedNode or default to 'users'
    const tableName = selectedNode?.id && selectedNode.id !== 'hub' ? selectedNode.id : 'users';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-xl"
        >
            <div className="relative w-full max-w-6xl h-full max-h-[850px] bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col backdrop-blur-2xl">

                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--primary-cyan)] to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <Activity className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white tracking-tight">AI Intelligence Hub</h1>
                            <p className="text-sm text-gray-400">
                                {selectedNode?.id && selectedNode.id !== 'hub'
                                    ? `Analyzing Table: ${selectedNode.name}`
                                    : "Global system insights and predictive monitoring"}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Nav */}
                    <div className="w-64 border-r border-white/5 p-4 flex flex-col gap-2 bg-black/20">
                        {dashboards.map((db) => {
                            const Icon = db.icon;
                            const isActive = activeTab === db.id;

                            return (
                                <button
                                    key={db.id}
                                    onClick={() => setActiveTab(db.id)}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
                                        ${isActive ? 'bg-white/5 text-white shadow-inner' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
                                    `}
                                >
                                    <div
                                        className="p-2 rounded-lg transition-colors"
                                        style={{ backgroundColor: isActive ? `${db.color}20` : 'transparent' }}
                                    >
                                        <Icon
                                            size={18}
                                            className="transition-transform group-hover:scale-110"
                                            style={{ color: isActive ? db.color : 'inherit' }}
                                        />
                                    </div>
                                    <span className="text-sm font-medium">{db.name}</span>
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-pill"
                                            className="ml-auto w-1 h-4 rounded-full"
                                            style={{ backgroundColor: db.color }}
                                        />
                                    )}
                                </button>
                            );
                        })}

                        <div className="mt-auto p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/10">
                            <p className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider mb-2">System Status</p>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-xs text-gray-300">Live Engine Connected</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto bg-black/40 relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                                className="h-full"
                            >
                                <ActiveComponent
                                    connectionId={connectionId}
                                    tableName={tableName}
                                    setActiveTab={setActiveTab}
                                />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
