import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronRight, ChevronLeft, Search, Database, Bell, Settings, HelpCircle, LayoutGrid, Terminal } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { LeftSidebar, RightSidebar } from './Sidebars';

const DashboardLayout = ({ children, sidebarProps, navbar, timeValue, onTimeChange }) => {
    // ...
    // In strict reference mode, sidebars are fixed, but we allow collapsing for smaller screens
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false); // Default visible (64px)
    const [isRightOpen, setIsRightOpen] = useState(true);
    const [sysVitals, setSysVitals] = useState(null);
    const [sysStatus, setSysStatus] = useState('INIT');

    // Poll for System Vitals
    useEffect(() => {
        const fetchVitals = async () => {
            try {
                const response = await fetch('/api/vitals/');
                if (response.ok) {
                    const data = await response.json();
                    setSysVitals(data.vitals);
                    setSysStatus(data.status);
                }
            } catch (error) {
                console.error("Vitals Sync Failed", error);
                setSysStatus('OFFLINE');
            }
        };

        fetchVitals();
        const interval = setInterval(fetchVitals, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-dark)] text-[var(--text-main)] font-display">

            {/* 3D Latent Background Simulation (Fixed) */}
            <div className="three-graph-bg">
                <div className="latent-grid"></div>
            </div>

            {/* Top Navigation Bar */}
            <header className="flex items-center justify-between border-b border-white/10 bg-[var(--bg-dark)]/80 px-6 py-3 backdrop-blur-md z-50 h-16 shrink-0">
                <div className="flex items-center gap-6 h-full">
                    {/* Branding */}
                    <div className="flex items-center gap-3">
                        <div className="text-[var(--primary)]">
                            <span className="material-symbols-outlined text-3xl">hub</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold leading-none tracking-tight text-white">WEZU Master Spec v2.1</h2>
                            <p className="text-[10px] uppercase tracking-widest text-[var(--primary)]/70">Data Engineering Suite</p>
                        </div>
                    </div>

                    {/* Navbar Injection (Tabs) */}
                    <div className="ml-8 h-full">
                        {navbar}
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    <div className="relative hidden xl:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            className="bg-white/5 border-white/10 rounded-lg pl-10 pr-4 py-1.5 text-sm w-64 focus:ring-1 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all outline-none text-white placeholder-slate-600"
                            placeholder="Search schema..."
                            type="text"
                        />
                    </div>

                    <div className="flex gap-2">
                        <button className="bg-[var(--primary)] hover:shadow-[0_0_15px_rgba(13,231,242,0.4)] text-[var(--bg-dark)] px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">sync</span>
                            SYNC
                        </button>
                    </div>

                    <div className="h-8 w-8 rounded-full border border-[var(--primary)]/30 p-0.5 relative">
                        <div className="w-full h-full rounded-full bg-slate-700 overflow-hidden flex items-center justify-center text-xs text-white box-border">
                            U
                        </div>
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full"></div>
                    </div>
                </div>
            </header>

            {/* Workspace Layout */}
            <div className="flex flex-1 overflow-hidden p-4 gap-4 relative z-10 box-border">

                {/* Left Sidebar Controls (Icon Rail) */}
                <aside className="w-16 flex flex-col items-center py-4 gap-6 glass-panel rounded-xl z-40 shrink-0">
                    <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30 hover:scale-110 transition-transform" title="Dashboard">
                        <span className="material-symbols-outlined">dashboard</span>
                    </button>

                    {/* Render Left Sidebar Actions loosely mapped to icons */}
                    <div className="flex flex-col gap-4 w-full items-center">
                        <LeftSidebar {...sidebarProps} collapsed={true} />
                    </div>

                    <div className="mt-auto flex flex-col gap-4">
                        <button className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">help</span>
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-white/5 hover:text-white transition-colors">
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col gap-4 relative min-w-0">



                    {/* Content Container (Graph + Overlays) */}
                    <div className="flex-1 relative rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-black/20 backdrop-blur-sm group">
                        {/* Pass children (Graph) here. */}
                        {children}
                    </div>

                </main>

                {/* Right Info Panel */}
                <AnimatePresence>
                    {isRightOpen && (
                        <motion.aside
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="flex flex-col gap-4 shrink-0 overflow-hidden"
                        >
                            <RightSidebar {...sidebarProps} />
                        </motion.aside>
                    )}
                </AnimatePresence>

                {/* Sidebar Toggle Handle */}
                <button
                    onClick={() => setIsRightOpen(!isRightOpen)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-50 p-2 rounded-l-xl bg-[var(--bg-dark)] border-y border-l border-white/10 text-slate-400 hover:text-[var(--primary)] hover:border-[var(--primary)]/50 transition-all shadow-lg backdrop-blur-md"
                    style={{ right: isRightOpen ? '20.5rem' : '0' }}
                    title={isRightOpen ? "Close Sidebar" : "Open Sidebar"}
                >
                    {isRightOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {/* Footer Overlay */}
            <footer className="h-8 bg-[var(--bg-dark)]/90 border-t border-white/5 px-6 flex items-center justify-between text-[10px] font-medium text-slate-500 z-50 shrink-0 backdrop-blur-md">
                <div className="flex items-center gap-6">
                    <span className="flex items-center gap-2 text-slate-400">
                        <span className={`w-1.5 h-1.5 rounded-full ${sysStatus === 'HEALTHY' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 animate-pulse'}`}></span>
                        WEZU_NODE_01_WEST
                    </span>

                    <div className="h-3 w-[1px] bg-white/10 mx-2"></div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2" title="Process Load">
                            <span className="text-[var(--primary)]/70 uppercase tracking-wider">CPU Compute</span>
                            <span className="text-slate-200 font-mono">{sysVitals?.cpu_usage || 0}%</span>
                        </div>

                        <div className="flex items-center gap-2" title="RAM Allocation">
                            <span className="text-[var(--primary)]/70 uppercase tracking-wider">Neural Mem</span>
                            <span className="text-slate-200 font-mono">{sysVitals?.memory_usage_mb || 0}MB</span>
                        </div>

                        <div className="flex items-center gap-2" title="Sync Speed">
                            <span className="text-[var(--primary)]/70 uppercase tracking-wider">API Latency</span>
                            <span className="text-slate-200 font-mono">{sysVitals?.avg_api_latency_ms || 0}ms</span>
                        </div>

                        {onTimeChange && (
                            <>
                                <div className="h-3 w-[1px] bg-white/10 mx-2"></div>
                                <div className="flex items-center gap-4 px-2" style={{ minWidth: '240px' }}>
                                    <span className="text-[var(--primary)]/70 uppercase tracking-widest text-[9px] whitespace-nowrap">Distortion</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={timeValue}
                                        onChange={e => onTimeChange?.(parseFloat(e.target.value))}
                                        className="flex-1 accent-[var(--primary)] h-1 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
                                    />
                                    <span className="text-slate-300 font-mono text-[10px] w-8 text-right">{timeValue}%</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-[var(--primary)]/50">LATENT_MODE: ENABLED</span>
                    <span className="text-slate-500 font-mono">{new Date().toLocaleTimeString()}</span>
                </div>
            </footer>
        </div>
    );
};

export default DashboardLayout;
