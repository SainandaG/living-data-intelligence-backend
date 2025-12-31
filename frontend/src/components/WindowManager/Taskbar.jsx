import React from 'react';
import { useWindowManager } from '../../context/WindowManagerContext';

const Taskbar = () => {
    const { windows, activeWindowId, openWindow, minimizeWindow } = useWindowManager();

    const handleTaskbarClick = (window) => {
        if (window.isMinimized) {
            openWindow(window.id); // Triggers restore logic in Context
        } else if (activeWindowId === window.id) {
            minimizeWindow(window.id);
        } else {
            openWindow(window.id); // Focus
        }
    };

    return (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 glass-panel px-4 py-2 flex items-center gap-4 z-[9999]">
            {/* Start Button / System Menu could go here */}
            <div className="h-2 w-2 rounded-full bg-white/20"></div>

            <div className="h-8 w-[1px] bg-white/10 mx-2" />

            {/* Open Windows */}
            {windows.map((w) => (
                <button
                    key={w.id}
                    onClick={() => handleTaskbarClick(w)}
                    className={`
            px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2
            ${w.id === activeWindowId && !w.isMinimized ? 'bg-white/20 shadow-lg scale-105' : 'hover:bg-white/10'}
            ${w.isMinimized ? 'opacity-50' : 'opacity-100'}
          `}
                >
                    <span className={`w-2 h-2 rounded-full ${w.id === activeWindowId && !w.isMinimized ? 'bg-green-400' : 'bg-white/30'}`}></span>
                    {w.title}
                </button>
            ))}
        </div>
    );
};

export default Taskbar;
