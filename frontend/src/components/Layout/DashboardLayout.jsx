import React, { useState } from 'react';
import { Menu, X, ChevronRight, ChevronLeft, ChevronDown, Activity, Zap, Shield, HelpCircle, Layout, Cpu, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebars } from './Sidebars';

const DashboardLayout = (props) => {
    const { children, sidebarProps } = props;
    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const [isRightOpen, setIsRightOpen] = useState(true);
    const [isHeaderOpen, setIsHeaderOpen] = useState(true);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Mobile/Tablet toggle handlers
    const toggleLeft = () => setIsLeftOpen(!isLeftOpen);
    const toggleRight = () => setIsRightOpen(!isRightOpen);
    const toggleHeader = () => setIsHeaderOpen(!isHeaderOpen);

    // Extract live stats for dynamic display
    const liveStats = sidebarProps?.liveStats || {
        health: { score: 100, status: 'Optimal' },
        activeNodes: 0,
        anomalies: 0
    };

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-transparent text-[var(--text-primary)] font-sans">

            {/* Top Navigation Bar - Floating Overlay */}
            <AnimatePresence>
                {isHeaderOpen && (
                    <motion.nav
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -100, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl z-[100] flex items-center justify-between px-6 mx-auto"
                        style={{ pointerEvents: 'auto' }}
                    >
                        <div className="flex items-center gap-6">
                            <button onClick={toggleLeft} className="lg:hidden p-2 hover:bg-white/10 rounded-full transition-colors">
                                <Menu size={20} className="text-[var(--primary-cyan)]" />
                            </button>

                            {/* Neural Core Branding with Dropdown */}
                            <div className="relative">
                                <div
                                    className="flex items-center gap-3 cursor-pointer group"
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-cyan)]/20 to-[var(--primary-purple)]/20 border border-[var(--primary-cyan)]/30 flex items-center justify-center text-[var(--primary-cyan)] shadow-[0_0_20px_rgba(34,211,238,0.2)] group-hover:border-[var(--primary-cyan)] transition-all">
                                        <Activity size={24} className="drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm tracking-widest text-[#f1f5f9] uppercase flex items-center gap-1 group-hover:text-white transition-colors">
                                            Neural Core
                                            <ChevronDown size={14} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                        </span>
                                        <span className="text-[9px] font-semibold text-cyan-500/80 tracking-[0.2em] uppercase">RL Optimizer v2.4</span>
                                    </div>
                                </div>

                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {isDropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute top-full left-0 mt-4 w-64 bg-[#020617]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl z-[1100] pointer-events-auto"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <div className="space-y-3">
                                                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest border-b border-white/5 pb-2">System Insights</div>
                                                <DropdownItem
                                                    icon={<Activity size={14} />}
                                                    label="Operational Pulse"
                                                    value={liveStats.health.status}
                                                    color={liveStats.health.score > 80 ? "text-emerald-400" : "text-amber-400"}
                                                />
                                                <DropdownItem
                                                    icon={<Zap size={14} />}
                                                    label="Neural Density"
                                                    value={`${liveStats.activeNodes} Nodes`}
                                                    color="text-cyan-400"
                                                />
                                                <DropdownItem
                                                    icon={<Shield size={14} />}
                                                    label="Security Protocol"
                                                    value={liveStats.anomalies > 0 ? "Threat Identified" : "Actively Shielded"}
                                                    color={liveStats.anomalies > 0 ? "text-rose-400" : "text-purple-400"}
                                                />
                                                <div className="pt-2">
                                                    <button className="w-full py-2 bg-[var(--primary-cyan)]/10 hover:bg-[var(--primary-cyan)]/20 text-[var(--primary-cyan)] text-[10px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-2 border border-cyan-500/20">
                                                        <HelpCircle size={12} /> View Full Analytics
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Middle Navigation (Conceptual) */}
                        <div className="hidden md:flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                            <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border border-cyan-500/20">
                                <Layout size={14} /> Overview
                            </div>
                            <div className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-slate-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
                                <Cpu size={14} /> AI Structural
                            </div>
                            <div className="px-3 py-1.5 rounded-lg hover:bg-white/5 text-slate-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-all">
                                <Database size={14} /> Schema Flow
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            {/* Sliding Switch for Header Close */}
                            <div className="flex items-center gap-3 bg-slate-800/30 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Header View</span>
                                <div
                                    className={`sliding-switch ${isHeaderOpen ? 'on' : 'off'}`}
                                    onClick={toggleHeader}
                                    title="Minimize Dashboard Header"
                                >
                                    <div className="switch-handle" />
                                </div>
                            </div>

                            <div className="h-8 w-px bg-white/5" />

                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--primary-green)]/10 border border-[var(--primary-green)]/20 backdrop-blur-md">
                                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-green)] shadow-[0_0_8px_rgba(104,211,145,0.6)] animate-pulse" />
                                <span className="text-[10px] font-bold text-[var(--primary-green)] tracking-wide">SYSTEM LIVE</span>
                            </div>

                            <button onClick={toggleRight} className="lg:hidden p-2 hover:bg-white/10 rounded-full transition-colors">
                                <Menu size={20} className="text-[var(--primary-cyan)]" />
                            </button>
                        </div>
                    </motion.nav>
                )}
            </AnimatePresence>

            {/* Header Re-open Toggle - Floating Pill */}
            <AnimatePresence>
                {!isHeaderOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000]"
                    >
                        <div className="nexus-toggle-container shadow-2xl shadow-cyan-500/20 backdrop-blur-xl border border-cyan-500/30">
                            <span className="nexus-toggle-label !text-cyan-400">Restore Header</span>
                            <div
                                className={`sliding-switch ${isHeaderOpen ? 'on' : 'off'}`}
                                onClick={toggleHeader}
                            >
                                <div className="switch-handle" />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FULL SCREEN CANVAS LAYER (Z-0) */}
            <main className="absolute inset-0 z-0 overflow-hidden bg-[#020617]">
                {children}
            </main>

            {/* UI LAYER (Z-40) - Floating on top of canvas */}
            {/* Left Sidebar - Floating Dock */}
            <aside
                className={`
                    absolute top-32 bottom-6 left-6 z-40 glass-panel border border-[var(--glass-border)]
                    w-[320px] transition-all duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) translate-z-0
                    ${isLeftOpen ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0 pointer-events-none'}
                `}
            >
                <div className="h-full overflow-y-auto custom-scrollbar p-4">
                    <Sidebars.Left {...sidebarProps} />
                </div>
            </aside>

            {/* Left Toggle Button - Floating Pill */}
            <button
                onClick={toggleLeft}
                className={`
                    hidden lg:flex fixed top-1/2 transform -translate-y-1/2 
                    w-8 h-8 bg-[var(--bg-elevated)]/80 backdrop-blur-md
                    border border-[var(--glass-border)] rounded-full 
                    items-center justify-center cursor-pointer 
                    hover:bg-[var(--primary-cyan)] hover:text-black hover:shadow-[0_0_20px_rgba(94,234,212,0.4)]
                    transition-all duration-300 z-[60] text-[var(--text-secondary)]
                    opacity-60 hover:opacity-100
                    ${isLeftOpen ? 'left-[328px]' : 'left-8'}
                `}
                title="Toggle Sidebar"
            >
                {isLeftOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>


            {/* Right Sidebar - Floating Dock */}
            <aside
                className={`
                    absolute top-32 bottom-6 right-6 z-40 glass-panel border border-[var(--glass-border)]
                    w-[360px] transition-all duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) translate-z-0
                    ${isRightOpen ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0 pointer-events-none'}
                `}
            >
                <div className="h-full overflow-y-auto custom-scrollbar p-4">
                    <Sidebars.Right {...sidebarProps} />
                </div>
            </aside>

            {/* Right Toggle Button - Floating Pill */}
            <button
                onClick={toggleRight}
                className={`
                    hidden lg:flex fixed top-1/2 transform -translate-y-1/2 
                    w-8 h-8 bg-[var(--bg-elevated)]/80 backdrop-blur-md
                    border border-[var(--glass-border)] rounded-full 
                    items-center justify-center cursor-pointer 
                    hover:bg-[var(--primary-cyan)] hover:text-black hover:shadow-[0_0_20px_rgba(94,234,212,0.4)]
                    transition-all duration-300 z-[60] text-[var(--text-secondary)]
                    opacity-60 hover:opacity-100
                    ${isRightOpen ? 'right-[368px]' : 'right-8'}
                `}
                title="Toggle Details"
            >
                {isRightOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
        </div>
    );
};

const DropdownItem = ({ icon, label, value, color }) => (
    <div className="flex items-center justify-between group/item cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all">
        <div className="flex items-center gap-3">
            <div className="text-white/40 group-hover/item:text-white transition-colors">{icon}</div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider group-hover/item:text-[var(--text-secondary)]">{label}</span>
        </div>
        <span className={`text-[10px] font-mono font-bold ${color} opacity-80 group-hover/item:opacity-100`}>{value}</span>
    </div>
);

export default DashboardLayout;
