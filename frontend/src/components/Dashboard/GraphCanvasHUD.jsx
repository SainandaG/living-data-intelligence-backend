/**
 * GraphCanvasHUD — production-grade canvas decorations for the 3D graph.
 *
 * Renders:
 *  - Corner accent brackets (targeting-reticle style)
 *  - Top-left lens + layout mode badge
 *  - Bottom-right live stats (nodes · edges · fps)
 *  - Subtle scan-line on mount
 *
 * All elements are pointer-events-none so they never steal canvas events.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

/* ── Lens meta ──────────────────────────────────────────────────────────────── */
const LENS = {
    ops:       { color: '#0de7f2', label: 'OPS MODE',    icon: '⬡' },
    security:  { color: '#ef4444', label: 'SECURITY',    icon: '🛡' },
    energy:    { color: '#22c55e', label: 'ENERGY',      icon: '⚡' },
    executive: { color: '#a855f7', label: 'EXECUTIVE',   icon: '◆' },
    tier3:     { color: '#fbbf24', label: '3D TABLES',   icon: '⬛' },
};

const LAYOUT = {
    galaxy:   { label: 'GALAXY',   color: '#818cf8' },
    latent:   { label: 'LATENT',   color: '#0de7f2' },
    analysis: { label: 'ANALYSIS', color: '#fbbf24' },
};

/* ── Corner accent bracket ──────────────────────────────────────────────────── */
const CornerBracket = ({ corner, color }) => {
    const size = 18;
    const thick = 1.5;

    const style = {
        position: 'absolute',
        width:  size,
        height: size,
        borderColor: color,
        borderStyle: 'solid',
        opacity: 0.55,
        ...(corner === 'tl' && { top: 16, left: 16, borderWidth: `${thick}px 0 0 ${thick}px`, borderRadius: '2px 0 0 0' }),
        ...(corner === 'tr' && { top: 16, right: 16, borderWidth: `${thick}px ${thick}px 0 0`, borderRadius: '0 2px 0 0' }),
        ...(corner === 'bl' && { bottom: 16, left: 16, borderWidth: `0 0 ${thick}px ${thick}px`, borderRadius: '0 0 0 2px' }),
        ...(corner === 'br' && { bottom: 16, right: 16, borderWidth: `0 ${thick}px ${thick}px 0`, borderRadius: '0 0 2px 0' }),
    };

    return <div style={style} />;
};

/* ── FPS hook ────────────────────────────────────────────────────────────────── */
function useFPS() {
    const [fps, setFps] = useState(60);
    const frameRef  = useRef(0);
    const lastRef   = useRef(performance.now());
    const animRef   = useRef(null);

    useEffect(() => {
        const tick = () => {
            frameRef.current++;
            const now   = performance.now();
            const delta = now - lastRef.current;
            if (delta >= 1000) {
                setFps(Math.round(frameRef.current * 1000 / delta));
                frameRef.current = 0;
                lastRef.current  = now;
            }
            animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, []);

    return fps;
}

/* ── Main component ──────────────────────────────────────────────────────────── */
const GraphCanvasHUD = ({ graphData, activeLens = 'ops', layoutMode = 'galaxy', visible = true }) => {
    const nodeCount = graphData?.nodes?.length ?? 0;
    const edgeCount = graphData?.edges?.length ?? 0;
    const fps       = useFPS();
    const lens      = LENS[activeLens]   || LENS.ops;
    const layout    = LAYOUT[layoutMode] || LAYOUT.galaxy;

    const fpsColor  = fps >= 50 ? '#34d399' : fps >= 30 ? '#fbbf24' : '#ef4444';

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="graph-canvas-hud"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 pointer-events-none z-[10]"
                >
                    {/* ── Corner brackets ─────────────────────────────── */}
                    <CornerBracket corner="tl" color={lens.color} />
                    <CornerBracket corner="tr" color={lens.color} />
                    <CornerBracket corner="bl" color={lens.color} />
                    <CornerBracket corner="br" color={lens.color} />

                    {/* ── Top-left: Lens + Layout badge ───────────────── */}
                    <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="absolute top-5 left-5 flex items-center gap-2"
                    >
                        {/* Lens chip */}
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                            style={{
                                background: `${lens.color}12`,
                                border: `1px solid ${lens.color}30`,
                                backdropFilter: 'blur(12px)',
                            }}
                        >
                            <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{
                                    backgroundColor: lens.color,
                                    boxShadow: `0 0 8px ${lens.color}`,
                                    animation: 'lens-pulse 2.5s ease-in-out infinite',
                                }}
                            />
                            <span
                                className="text-[9px] font-black tracking-[0.2em] uppercase"
                                style={{ color: lens.color }}
                            >
                                {lens.label}
                            </span>
                        </div>

                        {/* Layout chip */}
                        <div
                            className="flex items-center gap-1 px-2 py-1 rounded-lg"
                            style={{
                                background: 'rgba(10,18,18,0.6)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                backdropFilter: 'blur(12px)',
                            }}
                        >
                            <span
                                className="text-[8px] font-bold tracking-[0.15em] uppercase"
                                style={{ color: layout.color }}
                            >
                                {layout.label}
                            </span>
                        </div>
                    </motion.div>

                    {/* ── Bottom-right: Live stats ─────────────────────── */}
                    <motion.div
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                        className="absolute bottom-5 right-5 flex items-center gap-2"
                    >
                        {/* Stats pill */}
                        <div
                            className="flex items-center gap-3 px-3 py-1.5 rounded-xl"
                            style={{
                                background: 'rgba(10,18,18,0.82)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                backdropFilter: 'blur(20px)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                            }}
                        >
                            {/* Nodes */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[7px] font-bold tracking-[0.18em] text-slate-600 uppercase">NODES</span>
                                <span className="text-[11px] font-bold font-mono tabular-nums text-[#22d3ee]">
                                    {nodeCount.toLocaleString()}
                                </span>
                            </div>
                            <div className="w-px h-3 bg-white/[0.08]" />
                            {/* Edges */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[7px] font-bold tracking-[0.18em] text-slate-600 uppercase">EDGES</span>
                                <span className="text-[11px] font-bold font-mono tabular-nums text-[#818cf8]">
                                    {edgeCount.toLocaleString()}
                                </span>
                            </div>
                            <div className="w-px h-3 bg-white/[0.08]" />
                            {/* FPS */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[7px] font-bold tracking-[0.18em] text-slate-600 uppercase">FPS</span>
                                <span
                                    className="text-[11px] font-bold font-mono tabular-nums"
                                    style={{ color: fpsColor }}
                                >
                                    {fps}
                                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* ── Scan-line on mount ──────────────────────────── */}
                    <motion.div
                        initial={{ top: 0, opacity: 0.12 }}
                        animate={{ top: '100%', opacity: 0 }}
                        transition={{ duration: 1.8, delay: 0.1, ease: 'linear' }}
                        className="absolute left-0 right-0 h-px pointer-events-none"
                        style={{
                            background: `linear-gradient(90deg, transparent, ${lens.color}, transparent)`,
                            boxShadow: `0 0 12px ${lens.color}`,
                        }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default React.memo(GraphCanvasHUD);
