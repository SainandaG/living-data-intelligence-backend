import { Home, GitBranch, BarChart3, Database, ChevronRight, MessageSquare, Activity, Layers, Brain, Share2, Terminal } from 'lucide-react';
import { useWindowManager } from '../../context/WindowManagerContext';
import { useAuthStore } from '../../stores/authStore';
import FeatureGate from '../FeatureGate';

export default function NavigationBar({
    currentView,
    onNavigate,
    breadcrumbs = [],
    onToggleChat,
    isChatOpen,
    activeLens,
    onToggleLens,
    perspective = 'analyst',
    onTogglePerspective,
    onShareView,
    activePeers = {},
    persona = null
}) {
    const { isGenerationLogVisible, setIsGenerationLogVisible } = useWindowManager();
    const navItems = [
        { id: 'overview', label: 'Overview', icon: null },
        { id: 'lineage', label: 'Lineage', icon: null },
        { id: 'analytics', label: 'Analytics', icon: null },
        { id: 'schema', label: 'Schema', icon: null },
        { id: 'intelligence', label: 'Insights', icon: null },
        { id: 'globalLatent', label: 'Latent Space', icon: null },
    ];

    return (
        <div className="flex items-center gap-4 h-full min-w-0">
            {/* Primary Nav Tabs */}
            <nav className="flex items-center gap-4 min-w-0">
                {navItems.map((item) => {
                    const isActive = currentView === item.id;
                    return (
                        <FeatureGate key={item.id} feature={item.id === 'globalLatent' ? 'latent_projection' : item.id === 'intelligence' ? 'intel_hub' : item.id}>
                            <div className="flex items-center">
                                <button
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

                                {/* Perspective Toggle - Only show for the ACTIVE tab (if Latent Space or Lineage) */}
                                {isActive && (item.id === 'globalLatent' || item.id === 'lineage') && (
                                    <button
                                        onClick={() => onTogglePerspective && onTogglePerspective()}
                                        className={`
                                            ml-4 px-3 py-1 rounded border text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2
                                            ${perspective === 'business'
                                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                                : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)]'
                                            }
                                        `}
                                        title={`Switch to ${perspective === 'analyst' ? 'Business' : 'Analyst'} Perspective`}
                                    >
                                        <span>{perspective === 'analyst' ? '🛠️ Analyst' : '💼 Business'}</span>
                                    </button>
                                )}
                            </div>
                        </FeatureGate>
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

            {/* Multiplayer Avatars */}
            {persona && (
                <div className="flex items-center -space-x-2 ml-4 relative" title={`${Object.keys(activePeers).length} others in workspace`}>
                    {/* Current User */}
                    <div
                        className="w-7 h-7 rounded-full border border-black/30 flex items-center justify-center text-[10px] font-bold text-white shadow-lg relative z-10"
                        style={{ backgroundColor: persona.color, zIndex: 50 }}
                        title={`${persona.name} (You) | Role: ${useAuthStore.getState().userRole?.toUpperCase()}`}
                    >
                        {persona.name.charAt(0)}
                    </div>

                    {/* Role Badge for Viewers */}
                    {useAuthStore.getState().userRole === 'viewer' && (
                        <div className="absolute -top-3 left-0 bg-slate-500/80 text-[8px] px-1 rounded border border-white/10 text-white font-black tracking-tighter">
                            READ_ONLY
                        </div>
                    )}

                    {/* Active Peers */}
                    {Object.entries(activePeers).slice(0, 4).map(([id, peer], idx) => (
                        <div
                            key={id}
                            className="w-7 h-7 rounded-full border border-black/30 flex items-center justify-center text-[10px] font-bold text-white shadow-lg relative transition-transform hover:scale-110 hover:z-50"
                            style={{ backgroundColor: peer.color, zIndex: 40 - idx }}
                            title={`${peer.name} | Looking at: ${peer.selected_node || 'Overview'}`}
                        >
                            {peer.name.charAt(0)}
                        </div>
                    ))}

                    {/* Overflow count */}
                    {Object.keys(activePeers).length > 4 && (
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-black/30 flex items-center justify-center text-[10px] font-bold text-white relative z-0">
                            +{Object.keys(activePeers).length - 4}
                        </div>
                    )}
                </div>
            )}

            {/* Copy Deep Link Button */}
            {onShareView && useAuthStore.getState().canDo('editor') && (
                <button
                    onClick={onShareView}
                    className="ml-2 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/30 hover:bg-[var(--primary)]/20 transition-all shadow-[0_0_10px_rgba(99,102,241,0.15)]"
                    title="Copy Deep-Link to current perspective"
                >
                    <Share2 size={14} />
                    SHARE VIEW
                </button>
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

            {/* Generation Log Toggle */}
            <button
                onClick={() => setIsGenerationLogVisible(!isGenerationLogVisible)}
                className={`
                    ml-1 p-2 rounded-lg transition-all
                    ${isGenerationLogVisible
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }
                `}
                title="Generation Logs"
            >
                <Terminal size={18} />
            </button>
        </div>
    );
}
