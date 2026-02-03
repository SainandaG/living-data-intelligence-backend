import React from 'react';
import { Home, GitBranch, BarChart3, Database, ChevronRight, MessageSquare, Sparkles, Globe, Layers, Eye, Box as BoxIcon } from 'lucide-react';

export default function NavigationBar({ currentView, onNavigate, breadcrumbs = [], onToggleChat, isChatOpen, layoutMode = 'galaxy', onChangeLayout, currentLens = 'ops', onChangeLens, isIsolated = false, onToggleIsolation }) {
    const navItems = [
        { id: 'overview', label: 'Overview', icon: Home },
        { id: 'dataflow', label: 'Data Flow', icon: GitBranch },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'schema', label: 'Schema', icon: Database },
        { id: 'intelligence', label: 'AI Insights', icon: Sparkles },
    ];

    return (
        <div className="w-full bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between pr-6 relative z-50">
            <div className="flex flex-col flex-1">
                {/* Navigation Tabs */}
                <div className="flex items-center gap-1 px-6 pt-4">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={`
                    flex items-center gap-2 px-4 py-2 rounded-t-lg font-mono text-xs uppercase tracking-wider transition-all
                    ${isActive
                                        ? 'bg-[var(--primary-cyan)]/20 text-[var(--primary-cyan)] border-t border-x border-[var(--primary-cyan)]'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                                    }
                  `}
                            >
                                <Icon size={14} />
                                {item.label}
                            </button>
                        );
                    })}
                </div>

                {/* Breadcrumb Trail */}
                {breadcrumbs.length > 0 && (
                    <div className="flex items-center gap-2 px-6 py-3 text-xs text-[var(--text-secondary)] border-t border-white/5 w-full">
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <ChevronRight size={12} className="text-[var(--text-tertiary)]" />}
                                <button
                                    onClick={() => crumb.onClick && crumb.onClick()}
                                    className={`
                      hover:text-[var(--primary-cyan)] transition-colors
                      ${index === breadcrumbs.length - 1 ? 'text-[var(--text-primary)] font-semibold' : ''}
                    `}
                                >
                                    {crumb.label}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                )}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-3">
                {/* Layout Toggles (Only in Overview) */}
                {currentView === 'overview' && (
                    <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1">
                        <button
                            onClick={() => onChangeLayout('galaxy')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${layoutMode === 'galaxy' ? 'bg-[var(--primary-cyan)]/20 text-[var(--primary-cyan)]' : 'text-[var(--text-secondary)] hover:text-white'}`}
                            title="Universe View"
                        >
                            <Globe size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Universe</span>
                        </button>
                        <button
                            onClick={() => onChangeLayout('latent')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${(layoutMode === 'latent' || layoutMode === 'analysis') ? 'bg-[var(--primary-cyan)]/20 text-[var(--primary-cyan)]' : 'text-[var(--text-secondary)] hover:text-white'}`}
                            title="Latent Space View"
                        >
                            <Layers size={14} />
                            <span className="text-[10px] font-bold uppercase tracking-tighter">Latent Space</span>
                        </button>
                    </div>
                )}

                {/* Latent Mode Controls (Sub-options when in Latent/Analysis) */}
                {(layoutMode === 'latent' || layoutMode === 'analysis') && (
                    <div className="flex items-center gap-3 ml-4">
                        {/* 3D Tables Switch */}
                        <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1">
                            <button
                                onClick={() => onChangeLayout(layoutMode === 'analysis' ? 'latent' : 'analysis')}
                                className={`flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${layoutMode === 'analysis' ? 'bg-[var(--primary-cyan)] text-black shadow-[0_0_10px_rgba(0,217,255,0.4)]' : 'text-slate-400 hover:text-white'}`}
                            >
                                <BoxIcon size={12} />
                                <span>Switch to 3D Tables</span>
                            </button>

                            {(layoutMode === 'analysis' || layoutMode === 'latent') && (
                                <button
                                    onClick={onToggleIsolation}
                                    className={`ml-2 flex items-center gap-2 px-3 py-1 text-[10px] font-bold uppercase rounded transition-all ${isIsolated ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'text-slate-400 hover:text-white border border-white/5'}`}
                                >
                                    <Eye size={12} />
                                    <span>Isolate View</span>
                                </button>
                            )}
                        </div>

                        {/* Intent Lenses */}
                        <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-1">
                            <button
                                onClick={() => onChangeLens('exec')}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${currentLens === 'exec' ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-white'}`}
                            >
                                Executive
                            </button>
                            <button
                                onClick={() => onChangeLens('ops')}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${currentLens === 'ops' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-white'}`}
                            >
                                Operations
                            </button>
                            <button
                                onClick={() => onChangeLens('security')}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${currentLens === 'security' ? 'bg-rose-500/20 text-rose-400' : 'text-slate-500 hover:text-white'}`}
                            >
                                Security
                            </button>
                        </div>
                    </div>
                )}

                {/* AI Analyst Toggle */}
                <button
                    onClick={onToggleChat}
                    className={`
                        flex items-center gap-2 px-3 py-2 rounded-lg transition-all border
                        ${isChatOpen
                            ? 'bg-[var(--primary-cyan)] text-white border-[var(--primary-cyan)] shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                            : 'bg-white/5 text-[var(--text-secondary)] border-white/10 hover:bg-white/10 hover:text-white'
                        }
                    `}
                >
                    <MessageSquare size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">AI Analyst</span>
                </button>
            </div>
        </div>
    );
}
