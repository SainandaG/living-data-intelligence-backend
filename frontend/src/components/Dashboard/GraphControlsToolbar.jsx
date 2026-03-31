import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    ZoomIn, ZoomOut, RotateCcw, Play, Pause,
    Eye, EyeOff, Camera, Cpu, Layers, Mic, Keyboard, Send
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

const MicButton = React.memo(({ isListening, status, onClick }) => (
    <div className="relative group mx-0">
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClick}
            disabled={status === 'processing'}
            className={cn(
                "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg",
                isListening 
                    ? "bg-white text-slate-900" 
                    : status === 'processing' 
                        ? "bg-blue-600/50 cursor-wait text-white" 
                        : "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white"
            )}
        >
            {isListening ? (
                <div className="flex gap-1">
                    {['#4285F4', '#EA4335', '#FBBC05', '#34A853'].map((color, i) => (
                        <motion.div
                            key={i}
                            animate={{ scaleY: [1, 2, 1] }}
                            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                            style={{ backgroundColor: color }}
                            className="w-1 h-4 rounded-full"
                        />
                    ))}
                </div>
            ) : (
                <Mic size={20} strokeWidth={2.5} />
            )}
            
            {!isListening && status === 'idle' && (
                <div className="absolute inset-0 rounded-xl border border-white/20 animate-pulse scale-105" />
            )}
        </motion.button>
        
        <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 px-2.5 py-1.5 bg-[#0a1212]/95 text-white text-[9px] font-bold uppercase tracking-[0.12em] rounded-lg border border-white/10 whitespace-nowrap backdrop-blur-xl shadow-xl">
                {isListening ? 'Stop Listening' : 'Start Voice Engine'}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-[#0a1212]/95" />
            </div>
        </div>
    </div>
));

const ToolbarButton = React.memo(({
    icon: Icon,
    label,
    onClick,
    active = false,
    activeColor = '#0de7f2',
    disabled = false,
    pulse = false,
}) => (
    <div className="relative group">
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                active
                    ? 'text-black shadow-lg scale-105'
                    : 'text-slate-400 hover:text-white hover:bg-white/8',
                disabled && 'opacity-30 cursor-not-allowed pointer-events-none',
            )}
            style={active ? {
                backgroundColor: activeColor,
                boxShadow: `0 0 18px ${activeColor}55, 0 2px 8px rgba(0,0,0,0.4)`,
            } : {}}
        >
            <Icon size={17} strokeWidth={2.2} />
            {pulse && active && (
                <span
                    className="absolute inset-0 rounded-xl animate-ping opacity-25"
                    style={{ backgroundColor: activeColor }}
                />
            )}
        </button>

        {/* Tooltip */}
        <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 px-2.5 py-1.5 bg-[#0a1212]/95 text-white text-[9px] font-bold uppercase tracking-[0.12em] rounded-lg border border-white/10 whitespace-nowrap backdrop-blur-xl shadow-xl">
                {label}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-[#0a1212]/95" />
            </div>
        </div>
    </div>
));

const Divider = () => (
    <div className="w-px h-5 bg-white/[0.07] mx-0.5 self-center" />
);

/* ─── Main Component ─────────────────────────────────────────────────────────── */

const GraphControlsToolbar = ({
    graphRef,
    graphData,
    activeLens = 'ops',
    layoutMode = 'galaxy',
    voiceSystems
}) => {
    const [flowActive, setFlowActive]       = useState(false);
    const [edgesVisible, setEdgesVisible]   = useState(true);
    const [fps, setFps]                     = useState(60);

    const frameCountRef = useRef(0);
    const lastTimeRef   = useRef(performance.now());
    const animIdRef     = useRef(null);

    const { state, voice, toggleListening, dispatch } = voiceSystems || {};

    /* ── FPS counter ──────────────────────────────────────────────── */
    useEffect(() => {
        const tick = () => {
            frameCountRef.current++;
            const now   = performance.now();
            const delta = now - lastTimeRef.current;
            if (delta >= 1000) {
                setFps(Math.round(frameCountRef.current * 1000 / delta));
                frameCountRef.current = 0;
                lastTimeRef.current   = now;
            }
            animIdRef.current = requestAnimationFrame(tick);
        };
        animIdRef.current = requestAnimationFrame(tick);
        return () => { if (animIdRef.current) cancelAnimationFrame(animIdRef.current); };
    }, []);

    /* ── Sync flow state on unmount ───────────────────────────────── */
    useEffect(() => {
        return () => {
            if (flowActive) graphRef?.current?.stopFlow?.();
        };
    }, [flowActive, graphRef]);

    /* ── Handlers ─────────────────────────────────────────────────── */
    const handleZoomIn  = useCallback(() => graphRef?.current?.zoom?.(0.65),  [graphRef]);
    const handleZoomOut = useCallback(() => graphRef?.current?.zoom?.(1.5),   [graphRef]);
    const handleReset   = useCallback(() => graphRef?.current?.resetView?.(), [graphRef]);

    const handleFlowToggle = useCallback(() => {
        setFlowActive(prev => {
            const next = !prev;
            if (next) graphRef?.current?.startFlow?.();
            else      graphRef?.current?.stopFlow?.();
            return next;
        });
    }, [graphRef]);

    const handleEdgesToggle = useCallback(() => {
        const next = !edgesVisible;
        setEdgesVisible(next);
        graphRef?.current?.toggleEdges?.(next);
    }, [edgesVisible, graphRef]);

    const handleScreenshot = useCallback(() => {
        graphRef?.current?.screenshot?.();
    }, [graphRef]);

    /* ── Keyboard shortcuts ───────────────────────────────────────── */
    useEffect(() => {
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === '+' || e.key === '=') handleZoomIn();
            if (e.key === '-')                  handleZoomOut();
            if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) handleReset();
            if (e.key.toLowerCase() === 'f')    handleFlowToggle();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [handleZoomIn, handleZoomOut, handleReset, handleFlowToggle]);

    /* ── Render ───────────────────────────────────────────────────── */
    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-11 left-1/2 -translate-x-1/2 z-[3000] flex items-end gap-2.5 pointer-events-none select-none"
            >
                {/* ── Center: Main Controls ──────────────────────────── */}
                <div className="graph-toolbar-main pointer-events-auto flex items-center gap-0.5 px-1.5 py-1.5 shadow-2xl backdrop-blur-xl border border-white/10 rounded-2xl bg-[#0a1212]/80 transition-all duration-500">
                    <AnimatePresence mode="popLayout" initial={false}>
                        {!state?.isMinimized && (
                            <motion.div 
                                key="left-controls"
                                initial={{ opacity: 0, x: -20, width: 0 }}
                                animate={{ opacity: 1, x: 0, width: 'auto' }}
                                exit={{ opacity: 0, x: -20, width: 0 }}
                                className="flex items-center gap-0.5 overflow-hidden"
                            >
                                <ToolbarButton icon={ZoomIn}    label="Zoom In  [+]"       onClick={handleZoomIn}  />
                                <ToolbarButton icon={ZoomOut}   label="Zoom Out  [−]"      onClick={handleZoomOut} />
                                <ToolbarButton icon={RotateCcw} label="Reset Camera  [R]"  onClick={handleReset}   />
                                <Divider />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Microphone & Keyboard & Chat Form Integration */}
                    <div className="relative flex items-center justify-center mx-0">
                        <AnimatePresence mode="popLayout">
                            {!state?.isMinimized && (
                                <motion.div
                                    key="central-mic"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                >
                                    <MicButton 
                                        isListening={voice?.isListening} 
                                        status={state?.status} 
                                        onClick={toggleListening} 
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                        
                        <div className={cn(
                            "flex flex-col items-center transition-all duration-500",
                            state?.isMinimized ? "relative" : "absolute top-[calc(100%+4px)]"
                        )}>
                            <AnimatePresence>
                                {state?.showChat && (
                                    <motion.form
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            if (state.chatInput.trim()) {
                                                voiceSystems.handleChatSubmit(state.chatInput);
                                                dispatch({ type: 'SET_CHAT_INPUT', payload: '' });
                                                dispatch({ type: 'TOGGLE_CHAT' });
                                            }
                                        }}
                                        className="absolute bottom-full mb-3 bg-[#0a1212]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-1 pl-4 flex items-center shadow-2xl w-64 right-1/2 translate-x-1/2 overflow-hidden"
                                    >
                                        <input
                                            type="text"
                                            value={state.chatInput}
                                            onChange={(e) => dispatch({ type: 'SET_CHAT_INPUT', payload: e.target.value })}
                                            placeholder="Type a command..."
                                            className="bg-transparent border-none outline-none text-white text-[11px] w-full placeholder-slate-500 font-medium"
                                            autoFocus
                                        />
                                        <button type="submit" className="p-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-all duration-300 ml-2 shadow-lg">
                                            <Send size={12} className="text-white" />
                                        </button>
                                    </motion.form>
                                )}
                            </AnimatePresence>

                            <AnimatePresence>
                                {!state?.isMinimized && (
                                    <motion.button
                                        key="keyboard-toggle"
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
                                        className={cn(
                                            "pointer-events-auto p-1.5 rounded-xl transition-all duration-500 hover:scale-110",
                                            state?.showChat ? "bg-white/20 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
                                        )}
                                        title="Toggle Text Input"
                                    >
                                        <Keyboard size={17} strokeWidth={2} />
                                    </motion.button>
                                )}
                            </AnimatePresence>

                            {/* Minimize Toolbar Toggle (Three Dots) - Exactly Below Keyboard OR centered if minimized */}
                            <button
                                onClick={() => dispatch({ type: 'TOGGLE_MINIMIZED' })}
                                className={cn(
                                    "pointer-events-auto flex flex-col items-center gap-0.5 group transition-all duration-500",
                                    state?.isMinimized ? "p-1.5" : "mt-1 opacity-40 hover:opacity-100"
                                )}
                            >
                                <div className={cn("flex justify-center items-center h-4 transition-all duration-500", state?.isMinimized ? "gap-0.5" : "gap-1")}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} className={cn(
                                            "w-1 h-1 rounded-full transition-all duration-500",
                                            state?.isMinimized 
                                                ? "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" 
                                                : "bg-white/30 group-hover:bg-white/60"
                                        )} 
                                        style={{ transitionDelay: `${i * 50}ms` }}
                                        />
                                    ))}
                                </div>
                            </button>
                        </div>
                    </div>

                    <AnimatePresence mode="popLayout" initial={false}>
                        {!state?.isMinimized && (
                            <motion.div 
                                key="right-controls"
                                initial={{ opacity: 0, x: 20, width: 0 }}
                                animate={{ opacity: 1, x: 0, width: 'auto' }}
                                exit={{ opacity: 0, x: 20, width: 0 }}
                                className="flex items-center gap-0.5 overflow-hidden"
                            >
                                <Divider />
                                <ToolbarButton
                                    icon={flowActive ? Pause : Play}
                                    label={flowActive ? 'Stop Data Flow  [F]' : 'Start Data Flow  [F]'}
                                    onClick={handleFlowToggle}
                                    active={flowActive}
                                    activeColor="#0de7f2"
                                    pulse
                                />
                                <ToolbarButton
                                    icon={edgesVisible ? Eye : EyeOff}
                                    label={edgesVisible ? 'Hide Edges' : 'Show Edges'}
                                    onClick={handleEdgesToggle}
                                    active={!edgesVisible}
                                    activeColor="#94a3b8"
                                />
                                <Divider />
                                <ToolbarButton icon={Camera} label="Screenshot" onClick={handleScreenshot} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default React.memo(GraphControlsToolbar);
