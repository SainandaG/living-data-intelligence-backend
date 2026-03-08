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
    Layers,
    Wrench,
    Play,
    StopCircle,
    DatabaseZap,
    Loader2
} from 'lucide-react';
import apiClient from '../../utils/apiClient';

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
    { id: 'utils', name: 'Platform Utils', icon: Wrench, component: PlatformUtils, color: '#94a3b8' },
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

function PlatformUtils({ connectionId }) {
    const [simStatus, setSimStatus] = useState({ running: false, cycle: 0 });
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState(null);

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                const data = await apiClient.get('/simulation/status');
                setSimStatus(data);
            } catch (e) { console.error("Sim status check failed", e); }
        };
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleToggleSim = async () => {
        try {
            const endpoint = simStatus.running ? '/simulation/stop' : '/simulation/start';
            await apiClient.post(endpoint);
            const data = await apiClient.get('/simulation/status');
            setSimStatus(data);
        } catch (e) { alert("Failed to toggle simulation: " + e.message); }
    };

    const handleSeed = async () => {
        if (!window.confirm("This will seed the database with sample data. Continue?")) return;
        setSeeding(true);
        setSeedResult(null);
        try {
            const result = await apiClient.post('/seeder/seed', { connection_id: connectionId });
            setSeedResult(result.message);
        } catch (e) {
            setSeedResult("Error: " + e.message);
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="p-8 space-y-8 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Data Simulator Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                                <Activity size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg">Data Simulator</h3>
                                <p className="text-xs text-gray-400">Live background updates</p>
                            </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${simStatus.running ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                            {simStatus.running ? 'Active' : 'Idle'}
                        </div>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Current Cycle</p>
                            <p className="text-xl font-mono font-bold text-white">#{simStatus.cycle}</p>
                        </div>
                        <button
                            onClick={handleToggleSim}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-xs transition-all ${simStatus.running
                                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                                : 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30'
                                }`}
                        >
                            {simStatus.running ? <><StopCircle size={14} /> STOP SIM</> : <><Play size={14} /> START SIM</>}
                        </button>
                    </div>
                </div>

                {/* Database Seeder Card */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                            <DatabaseZap size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-lg">Database Seeder</h3>
                            <p className="text-xs text-gray-400">Populate with demo data</p>
                        </div>
                    </div>

                    <div className="p-4 bg-black/40 rounded-xl space-y-3">
                        <p className="text-xs text-gray-400 leading-relaxed">
                            Initialize your database with sample Users, Products, Orders, and WEZU Assets for demonstrations.
                        </p>
                        <button
                            onClick={handleSeed}
                            disabled={seeding}
                            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-xs transition-all ${seeding
                                ? 'bg-white/5 text-gray-500 cursor-not-allowed'
                                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30'
                                }`}
                        >
                            {seeding ? <><Loader2 className="animate-spin" size={14} /> SEEDING...</> : <><Zap size={14} /> TRIGGER SEEDER</>}
                        </button>
                    </div>
                </div>
            </div>

            {seedResult && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl border text-sm font-medium ${seedResult.includes('Error') ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'}`}
                >
                    {seedResult}
                </motion.div>
            )}
        </div>
    );
}
