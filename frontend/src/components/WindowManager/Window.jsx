import React, { useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import { motion } from 'framer-motion';
import { X, Minus, Square, Maximize2 } from 'lucide-react';
import { useWindowManager } from '../../context/WindowManagerContext';

const Window = ({ id, title, component: Component, props, isMinimized, isMaximized, zIndex, position }) => {
    const { closeWindow, minimizeWindow, maximizeWindow, focusWindow, updateWindowPosition } = useWindowManager();
    const nodeRef = useRef(null);

    // Animation variants
    const variants = {
        initial: { opacity: 0, scale: 0.95, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
        exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } },
    };

    if (isMinimized) return null;

    // We need to handle the case where Draggable wraps the Motion component.
    // Draggable needs a ref to the DOM node it moves.
    // Motion uses proper refs too. We can pass the ref to the motion div.

    return (
        <Draggable
            handle=".window-header"
            defaultPosition={position}
            position={isMaximized ? { x: 0, y: 0 } : undefined}
            onStop={(e, data) => !isMaximized && updateWindowPosition(id, { x: data.x, y: data.y })}
            nodeRef={nodeRef}
            disabled={isMaximized}
        >
            <motion.div
                ref={nodeRef}
                initial="initial"
                animate="animate"
                exit="exit"
                variants={variants}
                className={`fixed flex flex-col glass-panel overflow-hidden shadow-2xl backdrop-blur-md`}
                style={{
                    zIndex,
                    width: isMaximized ? '100vw' : '800px',
                    height: isMaximized ? '100vh' : '600px',
                    top: isMaximized ? 0 : undefined,
                    left: isMaximized ? 0 : undefined,
                }}
                onMouseDown={() => focusWindow(id)}
            >
                {/* Window Header */}
                <div
                    className="window-header flex items-center justify-between p-3 border-b border-[rgba(255,255,255,0.1)] select-none cursor-grab active:cursor-grabbing bg-[rgba(255,255,255,0.05)]"
                    onDoubleClick={() => maximizeWindow(id)}
                >
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[var(--glass-text)]">{title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); minimizeWindow(id); }}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <Minus size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); maximizeWindow(id); }}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                        >
                            {isMaximized ? <Square size={12} /> : <Maximize2 size={12} />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); closeWindow(id); }}
                            className="p-1 hover:bg-red-500/80 rounded-full transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Window Content */}
                <div className="flex-1 overflow-auto bg-black/20 relative">
                    <Component {...props} />
                </div>
            </motion.div>
        </Draggable>
    );
};

export default Window;
