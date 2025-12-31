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

            {/* Top Navigation Bar */}
            <nav className="h-16 flex items-center justify-between px-6 border-b border-[var(--border-color)] bg-[var(--bg-dark)]/90 backdrop-blur-xl z-50">
                <div className="flex items-center gap-4">
                    <button onClick={toggleLeft} className="lg:hidden p-2 hover:bg-white/5 rounded-lg">
                        <Menu size={20} className="text-[var(--primary-cyan)]" />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary-cyan)] to-[var(--primary-blue)] flex items-center justify-center text-[var(--bg-deep)] font-bold text-lg shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                            <span className="animate-pulse">◈</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm tracking-widest text-[var(--primary-cyan)] uppercase">
                                Neural Core
                            </span>
                            <span className="text-[10px] font-medium text-[var(--text-secondary)] tracking-wider">
                                LIVING DATA INTELLIGENCE
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex gap-2">
                        {/* Stats / Mode Indicators */}
                        <div className="flex items-center gap-2 px-3 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-color)]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-purple)] animate-pulse" />
                            <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">RL Optimizer Active</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-green)]/10 border border-[var(--primary-green)]/30 backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-[var(--primary-green)] animate-pulse shadow-[0_0_10px_#00ff88]" />
                        <span className="text-xs font-bold text-[var(--primary-green)] tracking-wide">SYSTEM ONLINE</span>
                    </div>
                    <button onClick={toggleRight} className="lg:hidden p-2 hover:bg-white/5 rounded-lg">
                        <Menu size={20} className="text-[var(--primary-cyan)]" />
                    </button>
                </div>
            </nav>

            {/* Main Workspace */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Left Sidebar - Sliding/Folding */}
                <aside
                    className={`
                        absolute lg:relative z-40 bg-[var(--bg-dark)] border-r border-[var(--border-color)]
                        w-[300px] h-full transition-all duration-300 ease-in-out
                        ${isLeftOpen ? 'translate-x-0' : '-translate-x-full lg:w-0 lg:-translate-x-0 lg:border-none lg:overflow-hidden'}
                    `}
                >
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <Sidebars.Left {...sidebarProps} />
                    </div>

                    {/* Toggle Button for Desktop (Folding) */}
                    <button
                        onClick={toggleLeft}
                        className="hidden lg:flex absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-12 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-r-lg items-center justify-center cursor-pointer hover:text-[var(--primary-cyan)] transition-colors z-50"
                        title="Toggle Sidebar"
                    >
                        {isLeftOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>
                </aside>

                {/* Center Content / Visualization Area */}
                <main className="flex-1 relative bg-transparent overflow-hidden">
                    {children}
                </main>

                {/* Right Sidebar - Sliding/Folding */}
                <aside
                    className={`
                        absolute right-0 lg:relative z-40 bg-[var(--bg-dark)] border-l border-[var(--border-color)]
                        w-[340px] h-full transition-all duration-300 ease-in-out
                        ${isRightOpen ? 'translate-x-0' : 'translate-x-full lg:w-0 lg:translate-x-0 lg:border-none lg:overflow-hidden'}
                    `}
                >
                    <div className="h-full overflow-y-auto custom-scrollbar">
                        <Sidebars.Right {...sidebarProps} />
                    </div>

                    {/* Toggle Button for Desktop (Folding) */}
                    <button
                        onClick={toggleRight}
                        className="hidden lg:flex absolute -left-3 top-1/2 transform -translate-y-1/2 w-6 h-12 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-l-lg items-center justify-center cursor-pointer hover:text-[var(--primary-cyan)] transition-colors z-50"
                        title="Toggle Details"
                    >
                        {isRightOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                </aside>

            </div>
        </div>
    );
};

export default DashboardLayout;
