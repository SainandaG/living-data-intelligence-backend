import React, { createContext, useContext, useState, useCallback } from 'react';

const WindowManagerContext = createContext();

export const useWindowManager = () => useContext(WindowManagerContext);

export const WindowManagerProvider = ({ children }) => {
    const [windows, setWindows] = useState([]);
    const [activeWindowId, setActiveWindowId] = useState(null);
    const [highestZIndex, setHighestZIndex] = useState(100);
    const [connectionId, setConnectionId] = useState(null); // Real connection ID

    const openWindow = useCallback((id, title, component, defaultProps = {}) => {
        setWindows((prev) => {
            const existing = prev.find((w) => w.id === id);
            if (existing) {
                if (existing.isMinimized) {
                    return prev.map((w) =>
                        w.id === id ? { ...w, isMinimized: false, zIndex: highestZIndex + 1 } : w
                    );
                }
                return prev.map((w) =>
                    w.id === id ? { ...w, zIndex: highestZIndex + 1 } : w
                );
            }
            return [
                ...prev,
                {
                    id,
                    title,
                    component,
                    isMinimized: false,
                    isMaximized: false,
                    zIndex: highestZIndex + 1,
                    position: { x: 50 + prev.length * 20, y: 50 + prev.length * 20 },
                    // Pass connectionId to apps
                    props: { ...defaultProps, connectionId: connectionId || 'demo-session' },
                },
            ];
        });
        setHighestZIndex((prev) => prev + 1);
        setActiveWindowId(id);
    }, [highestZIndex, connectionId]);

    const closeWindow = useCallback((id) => {
        setWindows((prev) => prev.filter((w) => w.id !== id));
        if (activeWindowId === id) {
            setActiveWindowId(null);
        }
    }, [activeWindowId]);

    const minimizeWindow = useCallback((id) => {
        setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w))
        );
        if (activeWindowId === id) {
            setActiveWindowId(null);
        }
    }, [activeWindowId]);

    const maximizeWindow = useCallback((id) => {
        setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized } : w))
        );
    }, []);

    const focusWindow = useCallback((id) => {
        setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, zIndex: highestZIndex + 1 } : w))
        );
        setHighestZIndex((prev) => prev + 1);
        setActiveWindowId(id);
    }, [highestZIndex]);

    const updateWindowPosition = useCallback((id, position) => {
        setWindows(prev => prev.map(w => w.id === id ? { ...w, position } : w));
    }, []);

    return (
        <WindowManagerContext.Provider
            value={{
                windows,
                activeWindowId,
                openWindow,
                closeWindow,
                minimizeWindow,
                maximizeWindow,
                focusWindow,
                updateWindowPosition,
                connectionId,
                setConnectionId
            }}
        >
            {children}
        </WindowManagerContext.Provider>
    );
};
