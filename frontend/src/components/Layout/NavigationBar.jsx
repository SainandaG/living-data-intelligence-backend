import React from 'react';
import { Home, GitBranch, BarChart3, Database, ChevronRight } from 'lucide-react';

export default function NavigationBar({ currentView, onNavigate, breadcrumbs = [] }) {
    const navItems = [
        { id: 'overview', label: 'Overview', icon: Home },
        { id: 'dataflow', label: 'Data Flow', icon: GitBranch },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'schema', label: 'Schema', icon: Database },
    ];

    return (
        <div className="w-full bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-white/10">
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
                <div className="flex items-center gap-2 px-6 py-3 text-xs text-[var(--text-secondary)]">
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
    );
}
