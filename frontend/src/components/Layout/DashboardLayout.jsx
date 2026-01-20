import React, { useState } from 'react';
import { Menu, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { Sidebars } from './Sidebars';

const DashboardLayout = ({ children, sidebarProps }) => {
    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const [isRightOpen, setIsRightOpen] = useState(true);

    // Mobile/Tablet toggle handlers
    const toggleLeft = () => setIsLeftOpen(!isLeftOpen);
    const toggleRight = () => setIsRightOpen(!isRightOpen);

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-transparent text-[var(--text-primary)] font-sans">

            {/* Top Navigation Bar - Floating Overlay */}
            <nav className="header-container">
                <div className="flex items-center gap-4">
                    <button onClick={toggleLeft} className="lg:hidden p-2 hover:bg-white/10 rounded-full transition-colors">
                        <Menu size={20} className="text-[var(--primary-cyan)]" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-cyan)]/20 to-[var(--primary-purple)]/20 border border-[var(--primary-cyan)]/30 flex items-center justify-center text-[var(--primary-cyan)] shadow-[0_0_20px_rgba(94,234,212,0.2)]">
                            <span className="font-bold text-xl">N</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm tracking-widest text-[#f1f5f9] uppercase">
                                Neural Core
                            </span>
                            <span className="text-[9px] font-semibold text-[var(--text-secondary)] tracking-[0.2em]">
                                INTELLIGENCE
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)]/50 border border-[var(--glass-border)] backdrop-blur-md">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-purple)] shadow-[0_0_8px_rgba(196,181,253,0.6)]" />
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">RL Optimizer</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--primary-green)]/10 border border-[var(--primary-green)]/20 backdrop-blur-md">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-green)] shadow-[0_0_8px_rgba(104,211,145,0.6)] animate-pulse" />
                        <span className="text-[10px] font-bold text-[var(--primary-green)] tracking-wide">ONLINE</span>
                    </div>
                    <button onClick={toggleRight} className="lg:hidden p-2 hover:bg-white/10 rounded-full transition-colors">
                        <Menu size={20} className="text-[var(--primary-cyan)]" />
                    </button>
                </div>
            </nav>

            {/* FULL SCREEN CANVAS LAYER (Z-0) */}
            <main className="absolute inset-0 z-0 overflow-hidden">
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

export default DashboardLayout;
