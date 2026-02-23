import React from 'react';
import { Home, GitBranch, BarChart3, Database, ChevronRight, MessageSquare, Activity, Layers, Brain } from 'lucide-react';

export default function NavigationBar({ currentView, onNavigate, breadcrumbs = [], onToggleChat, isChatOpen, activeLens, onToggleLens }) {
    const navItems = [
        { id: 'overview', label: 'Overview', icon: null },
        { id: 'analytics', label: 'Analytics', icon: null },
        { id: 'schema', label: 'Schema', icon: null },
        { id: 'intelligence', label: 'Insights', icon: null },
        { id: 'globalLatent', label: 'Latent Space', icon: null },
    ];

    return (
        <div className="flex items-center gap-6 h-full">
            {/* Primary Nav Tabs */}
            <nav className="flex items-center gap-6">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`
                                text-sm font-medium transition-colors relative py-1
                                ${isActive
                                    ? 'text-[var(--primary)] text-shadow-glow'
                                    : 'text-slate-400 hover:text-white'
                                }
                            `}
                        >
                            {item.label}
                            {isActive && (
                                <span className="absolute -bottom-[19px] left-0 w-full h-[2px] bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]"></span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* Breadcrumbs - Only show if active and meaningful */}
            {breadcrumbs.length > 0 && (
                <div className="hidden 2xl:flex items-center gap-2 pl-4 border-l border-white/10 text-xs text-slate-500">
                    {breadcrumbs.map((crumb, index) => (
                        <div key={index} className="flex items-center gap-2">
                            {index > 0 && <ChevronRight size={10} />}
                            <span className={index === breadcrumbs.length - 1 ? "text-[var(--text-main)]" : ""}>
                                {crumb.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Lens Selector - Compact Pill */}
            {(currentView === 'globalLatent' || currentView === 'overview') && (
                <div className="hidden xl:flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
                    {['ops', 'energy', 'security', 'tier3'].map(lens => (
                        <button
                            key={lens}
                            onClick={() => onToggleLens && onToggleLens(lens)}
                            className={`
                                px-2 py-0.5 rounded text-[9px] uppercase font-bold transition-all
                                ${activeLens === lens
                                    ? 'bg-[var(--primary)] text-black'
                                    : 'text-slate-400 hover:text-white'
                                }
                            `}
                        >
                            {lens}
                        </button>
                    ))}
                </div>
            )}

            {/* AI Analyst Toggle Button - Styled for Header */}
            <button
                onClick={onToggleChat}
                className={`
                    ml-2 p-2 rounded-lg transition-all
                    ${isChatOpen
                        ? 'text-[var(--primary)] bg-[var(--primary)]/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }
                `}
                title="AI Analyst Chat"
            >
                <MessageSquare size={18} />
            </button>
        </div>
    );
}
