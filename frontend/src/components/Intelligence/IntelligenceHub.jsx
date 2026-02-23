import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity,
    BarChart3,
    AlertTriangle,
    TrendingUp,
    GitBranch,
    Lightbulb,
    Zap,
    X,
    Layers
} from 'lucide-react';

import HealthDashboard from './HealthDashboard';
import PatternDashboard from './PatternDashboard';
import AnomalyDashboard from './AnomalyDashboard';
import PredictionDashboard from './PredictionDashboard';
import RootCauseDashboard from './RootCauseDashboard';
import RecommendationDashboard from './RecommendationDashboard';
import DeepStatusDashboard from './DeepStatusDashboard';
import OntologyExplorer from './OntologyExplorer';

const dashboards = [
    { id: 'health', name: 'System Health', icon: Activity, component: HealthDashboard, color: '#00ff88' },
    { id: 'ontology', name: 'Ontology & Entities', icon: Layers, component: OntologyExplorer, color: '#00D7FF' },
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

    // Track which tabs have been visited to lazy-load them
    const [visitedTabs, setVisitedTabs] = useState(new Set([activeTab]));

    React.useEffect(() => {
        localStorage.setItem('intelligence_active_tab', activeTab);
        setVisitedTabs(prev => {
            const newSet = new Set(prev);
            newSet.add(activeTab);
            return newSet;
        });
    }, [activeTab]);

    // Extract table name from selectedNode or default to 'users'
    const tableName = selectedNode?.id && selectedNode.id !== 'hub' ? selectedNode.id : 'users';

    if (!connectionId) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--bg-dark)] text-white p-8">
                <div className="max-w-md text-center space-y-6">
                    <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="text-amber-500" size={40} />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">No Active Connection</h2>
                    <p className="text-gray-400">
                        The Intelligence Hub requires an active database connection to analyze real-time signals and generate predictions.
                    </p>
                    <button
                        onClick={() => window.dispatchEvent(new CustomEvent('open-connection-modal'))}
                        className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                    >
                        Connect Database
                    </button>
                    {onClose && (
                        <button onClick={onClose} className="block w-full text-xs text-gray-500 hover:text-gray-300 transition-colors uppercase tracking-widest mt-4">
                            Back to Graph
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full flex flex-col bg-[var(--bg-dark)] pointer-events-auto"
        >
            <div className="w-full h-full flex flex-col overflow-hidden">

                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between shrink-0">
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
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Nav */}
                    <div className="w-64 border-r border-white/5 p-4 flex flex-col gap-2 bg-black/20 shrink-0">
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

                    {/* Main Content Area - Cached / Keep-Alive Implementation */}
                    <div className="flex-1 overflow-y-auto bg-black/40 relative">
                        {dashboards.map((db) => {
                            // Only render if it's the active tab OR has been visited (lazy load)
                            if (!visitedTabs.has(db.id)) return null;

                            const Component = db.component;
                            const isActive = activeTab === db.id;

                            return (
                                <div
                                    key={db.id}
                                    className="h-full w-full"
                                    style={{
                                        display: isActive ? 'block' : 'none',
                                        // Use visibility: hidden for better accessibility/focus handling if needed, 
                                        // but display: none is better for performance here to stop layout recalc
                                    }}
                                >
                                    <Component
                                        connectionId={connectionId}
                                        tableName={tableName}
                                        setActiveTab={setActiveTab}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
