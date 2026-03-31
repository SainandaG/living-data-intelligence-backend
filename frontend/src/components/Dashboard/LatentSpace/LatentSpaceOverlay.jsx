/**
 * LatentSpace/LatentSpaceOverlay.jsx
 * The UI overlay component (panels, controls, HUD, chart modal).
 * Extracted from LatentSpaceLogic.jsx lines 644-1383.
 */
import React, { useState, useRef, useEffect } from 'react';
import { logger } from '../../../utils/logger';
import NodeXRayPanel from '../NodeXRayPanel';
import DataLensPanel from '../Controls/DataLensPanel';
import NodeSelectorPanel from '../Controls/NodeSelectorPanel';
import EdgeStatsPanel from '../EdgeStatsPanel';
import s from './styles.js';
import {
    enrichNodesWithDependency, getLensCategories, LENS_CATEGORIES,
    computeCentroids, getManifoldHeight,
} from './computations.js';

export const LatentSpaceUIOverlay = ({
    children, // This will be the 3D Canvas
    dataClusters,
    selectedNodeId,
    timeValue = 100,
    onTimeChange,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onClose,
    onToggleLens,
    activeFilters = {},
    onFilterChange,
    standalone = false, // If true, it acts as a transparent overlay for App.jsx
    hudOnly = false, // NEW: If true, hides header/footer to fit perfectly in DashboardLayout
    liveStats = null, // NEW: Receive real stats from App.jsx
    currentLens = 'ops', // NEW: Dynamic Lens categorization
    hoveredEdge, // [NEW] Added for relationship hover detection
    connectionId, // [NEW] For Node X-Ray deep analytics
    onDrillDown, // [NEW] Callback to navigate to DrillDown view
    multiSelectedNodes = [],
    setMultiSelectedNodes,
    showMultiConnections = false,
    setShowMultiConnections,
    showPKs = true,
    showFKs = true,
    setShowPKs,
    setShowFKs
}) => {
    const starCanvasRef = useRef(null);
    const chartRefs = [useRef(null), useRef(null), useRef(null)];
    const modalChartRef = useRef(null);

    // Dynamic Filter Mapping
    const lensCategories = getLensCategories(currentLens);

    // Core Layout States
    const [aiOn, setAiOn] = useState(true);
    const [tier3On, setTier3On] = useState(true);
    const [panels, setPanels] = useState({ intel: true, filter: true, visuals: true, hud: true, relHud: true, nodeSelector: true });
    const [stickyEdge, setStickyEdge] = useState(null); // [NEW] Stores last hovered edge
    const relHudUserClosed = useRef(false); // Track if user manually closed the Relationship HUD
    const [xrayNode, setXrayNode] = useState(null); // [NEW] Node X-Ray deep analytics overlay

    // Data stats
    // Compute total records from all loaded nodes, or default to a realistic baseline
    const calculatedTotalRecords = dataClusters?.reduce((sum, node) => sum + (node.row_count || 0), 0) ?? 0;
    const computedActiveThreads = dataClusters?.length || 125;

    const metrics = {
        snap: (liveStats?.totalTransactions > 0 ? liveStats.totalTransactions : calculatedTotalRecords).toLocaleString(),
        threads: (liveStats?.activeNodes > 0 ? liveStats.activeNodes : computedActiveThreads).toLocaleString(),
        lat: liveStats?.tps > 0 ? (1000 / liveStats.tps).toFixed(1) : '--',
        ghostLines: Math.max(190, 206 + (liveStats?.tps || 0) * 0.1),
        healthScore: liveStats?.health?.score ?? 90,
        avgVitality: dataClusters?.length > 0
            ? Math.round(dataClusters.reduce((s, n) => s + (n.vitality || n.healthScore || 100), 0) / dataClusters.length)
            : 90
    };

    const [chartModal, setChartModal] = useState({ open: false, type: 'throughput', tab: '1m' });

    const togglePanel = (id) => setPanels(p => ({ ...p, [id]: !p[id] }));

    // Extract selected node if needed
    let selectedNode = null;
    if (selectedNodeId && dataClusters) {
        dataClusters.forEach(cluster => {
            if (cluster && cluster.id === selectedNodeId) selectedNode = cluster;
            if (cluster.children) {
                const found = cluster.children.find(n => n.id === selectedNodeId);
                if (found) selectedNode = found;
            }
        });
    }

    // Capture hovered edge into sticky state - persists after hover ends
    useEffect(() => {
        if (hoveredEdge) {
            setStickyEdge(hoveredEdge);
            // Re-open if user hasn't manually closed it
            if (!relHudUserClosed.current) {
                setPanels(p => ({ ...p, relHud: true }));
            }
        }
    }, [hoveredEdge]);

    // Wrap togglePanel to also track user-closed state for relHud
    const handleToggleRelHud = () => {
        setPanels(p => {
            const newVal = !p.relHud;
            relHudUserClosed.current = !newVal; // if closing (newVal=false), mark as user-closed
            return { ...p, relHud: newVal };
        });
    };

    // --- ANIMATIONS ---
    useEffect(() => {
        let frameId;
        const sctx = starCanvasRef.current?.getContext('2d');
        const stars = Array.from({ length: 300 }, () => ({
            x: Math.random(), y: Math.random(),
            r: Math.random() * 1.2 + 0.2,
            a: Math.random() * 0.7 + 0.15,
            ph: Math.random() * Math.PI * 2,
        }));

        const drawStars = (t) => {
            if (!starCanvasRef.current || !sctx) return;
            const W = starCanvasRef.current.width = starCanvasRef.current.offsetWidth;
            const H = starCanvasRef.current.height = starCanvasRef.current.offsetHeight;
            sctx.clearRect(0, 0, W, H);

            /*
            // Nebulas
            [[0.25, 0.35, W * 0.28, 'rgba(30,0,80,0.16)'], [0.72, 0.55, W * 0.22, 'rgba(0,40,100,0.12)']].forEach(([cx, cy, r, c]) => {
                const g = sctx.createRadialGradient(cx * W, cy * H, 0, cx * W, cy * H, r);
                g.addColorStop(0, c); g.addColorStop(1, 'transparent');
                sctx.fillStyle = g; sctx.fillRect(0, 0, W, H);
            });
            */

            /*
            // Stars
            stars.forEach(s => {
                const tw = 0.5 + 0.5 * Math.sin(t * 0.7 + s.ph);
                sctx.globalAlpha = s.a * tw;
                sctx.fillStyle = '#fff';
                sctx.beginPath(); sctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); sctx.fill();
            });
            */
            sctx.globalAlpha = 1;
        };

        const drawSparklines = (t) => {
            const W = 80; const H = 46;
            // Line
            if (chartRefs[0].current) {
                const ctx = chartRefs[0].current.getContext('2d');
                chartRefs[0].current.width = W; chartRefs[0].current.height = H;
                ctx.clearRect(0, 0, W, H);

                const pts = Array.from({ length: 12 }, (_, i) => ({
                    x: (i / 11) * W,
                    y: H - (0.2 + 0.6 * Math.abs(Math.sin(i * 0.8 + t * 0.3))) * H
                }));
                ctx.beginPath();
                pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
                ctx.fillStyle = '#818cf830'; ctx.fill();
            }
            // Bar
            if (chartRefs[1].current) {
                const ctx = chartRefs[1].current.getContext('2d');
                chartRefs[1].current.width = W; chartRefs[1].current.height = H;
                ctx.clearRect(0, 0, W, H);
                const bars = [8, 20, 12, 17, 9, 22];
                const bw = (W - (bars.length - 1) * 2) / bars.length;
                bars.forEach((h, i) => {
                    const bh = (h / 22) * H * 0.85;
                    ctx.fillStyle = i === 1 ? '#a5b4fc' : '#818cf880';
                    ctx.fillRect(i * (bw + 2), H - bh, bw, bh);
                });
            }
            // Health icon
            if (chartRefs[2].current) {
                const ctx = chartRefs[2].current.getContext('2d');
                chartRefs[2].current.width = W; chartRefs[2].current.height = H;
                ctx.clearRect(0, 0, W, H);
                ctx.fillStyle = '#4ade80'; ctx.font = '18px serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('♥', W / 2, H / 2 - 2);
                const r = (14 + 4 * Math.abs(Math.sin(t * 2)));
                ctx.beginPath(); ctx.arc(W / 2, H / 2 - 2, r, 0, Math.PI * 2);
                ctx.strokeStyle = '#4ade8040'; ctx.lineWidth = 1.5; ctx.stroke();
            }
        };

        const loop = (ts) => {
            const t = ts * 0.001;
            drawStars(t);
            drawSparklines(t);
            frameId = requestAnimationFrame(loop);
        };
        frameId = requestAnimationFrame(loop);

        return () => { cancelAnimationFrame(frameId); }
    }, []);

    // Draw Chart Modal
    useEffect(() => {
        if (!chartModal.open || !modalChartRef.current) return;
        let cId;
        const color = chartModal.type === 'clusters' ? '#22d3ee' : chartModal.type === 'health' ? '#4ade80' : '#818cf8';

        const drawModal = () => {
            const canvas = modalChartRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const W = canvas.width = canvas.offsetWidth || 470;
            const H = canvas.height = canvas.offsetHeight || 160;
            ctx.clearRect(0, 0, W, H);

            const t = performance.now() * 0.001;
            ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
            for (let i = 0; i <= 4; i++) {
                const y = H * 0.1 + i * (H * 0.8 / 4);
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            }

            if (chartModal.type === 'throughput') {
                // 1. THROUGHPUT: Digital Activity Matrix (Grid/Heatmap)
                const color = '#818cf8';

                const cols = 35; // Number of columns (time)
                const rows = 12; // Number of rows (channels/threads)
                const paddingX = 20;
                const paddingY = 15;

                const cellW = (W - paddingX * 2) / cols;
                const cellH = (H - paddingY * 2) / rows;
                const margin = 2; // Gap between cells

                for (let c = 0; c < cols; c++) {
                    for (let r = 0; r < rows; r++) {
                        // Math to calculate intensity of each cell based on time and position
                        const xOffset = c * 0.2;
                        const yOffset = r * 0.4;

                        // Create a flowing noise pattern
                        const noise1 = Math.sin(t * 3 - xOffset + Math.sin(yOffset));
                        const noise2 = Math.cos(t * 1.5 + xOffset * 0.5 + yOffset);

                        // Emphasize recent activity (right side of the grid)
                        const ageFactor = (c / cols);

                        // Combine to get an intensity value 0.0 to 1.0
                        let intensity = (noise1 * 0.5 + 0.5) * (noise2 * 0.5 + 0.5) * ageFactor;

                        // Add some random flickering sparks
                        if (Math.random() > 0.98) intensity = 1.0;
                        if (Math.random() > 0.95 && ageFactor > 0.8) intensity = 1.5;

                        if (intensity < 0.1) continue; // Skip very dark cells for cleaner look

                        const x = paddingX + c * cellW + margin / 2;
                        const y = paddingY + r * cellH + margin / 2;
                        const w = cellW - margin;
                        const h = cellH - margin;

                        // Draw inner cell
                        ctx.fillStyle = `rgba(129, 140, 248, ${Math.min(1, intensity)})`;

                        // Add glow if high intensity
                        if (intensity > 0.6) {
                            ctx.shadowColor = color;
                            ctx.shadowBlur = 8 * intensity;
                            ctx.fillStyle = '#fff'; // Bright white core for active cells
                        } else {
                            ctx.shadowBlur = 0;
                        }

                        ctx.beginPath();
                        ctx.roundRect(x, y, w, h, 2);
                        ctx.fill();
                        ctx.shadowBlur = 0; // reset
                    }
                }

                // Overlay a subtle scanning line moving left to right
                const scanLineX = paddingX + ((t * 0.4) % 1) * (W - paddingX * 2);
                const grad = ctx.createLinearGradient(scanLineX - 20, 0, scanLineX, 0);
                grad.addColorStop(0, 'rgba(129, 140, 248, 0)');
                grad.addColorStop(1, 'rgba(255, 255, 255, 0.4)');

                ctx.fillStyle = grad;
                ctx.fillRect(scanLineX - 20, paddingY, 20, H - paddingY * 2);

            } else if (chartModal.type === 'clusters') {
                // 2. CLUSTERS: Distribution Bar Histogram
                const totalNodes = (dataClusters || []).length || 1;
                const lensCategories = getLensCategories(currentLens);
                const items = lensCategories.map(cat => ({
                    cat: cat.id,
                    color: cat.color,
                    pct: (dataClusters || []).filter(n => n.latent_category === cat.id).length / totalNodes
                }));

                const gap = 30;
                const barW = (W - (gap * (items.length + 1))) / items.length;

                for (let i = 0; i < items.length; i++) {
                    const x = gap + i * (barW + gap);
                    // Add subtle floating noise to the stats so it feels alive
                    const noise = Math.sin(t * 2 + i) * 0.03;
                    const hRatio = Math.max(0.05, Math.min(0.9, items[i].pct + noise));
                    const barH = Math.max(H * 0.1, H * hRatio);
                    const y = H - barH;

                    const color = items[i].color;

                    ctx.shadowColor = color; ctx.shadowBlur = 12;
                    const grad = ctx.createLinearGradient(x, y, x, H);
                    grad.addColorStop(0, color); grad.addColorStop(1, color + '20');
                    ctx.fillStyle = grad;

                    ctx.beginPath();
                    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
                    ctx.fill();
                    ctx.shadowBlur = 0;

                    // Data labels on top
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 11px "Rajdhani"';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${Math.floor((items[i].pct + noise) * 100)}%`, x + barW / 2, y - 8);
                }

            } else if (chartModal.type === 'health') {
                // 3. HEALTH: Cybernetic System ECG & Gauge
                const color = '#4ade80';

                // Ring Gauge (Left side)
                const cx = W * 0.15;
                const cy = H / 2;
                const r = H * 0.35;

                // Health ring gauge — real score from liveStats
                const healthVal = metrics.healthScore;
                const healthRing = Math.max(0, Math.min(1, healthVal / 100));

                // Background Track
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 6; ctx.stroke();

                // Health arc
                ctx.beginPath();
                const endAngle = -Math.PI / 2 + (Math.PI * 2 * healthRing);
                ctx.arc(cx, cy, r, -Math.PI / 2, endAngle);
                const ringColor = healthVal >= 80 ? '#4ade80' : healthVal >= 50 ? '#f59e0b' : '#ef4444';
                ctx.strokeStyle = ringColor; ctx.lineWidth = 6;
                ctx.shadowColor = ringColor; ctx.shadowBlur = 12;
                ctx.stroke(); ctx.shadowBlur = 0;

                // Center Text
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 22px "Rajdhani"';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(Math.round(healthVal).toString(), cx, cy - 2);
                ctx.font = '9px "Rajdhani"'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillText('HEALTH', cx, cy + 14);

                // ECG Signal (Right side)
                const ecgX = cx + r + 40;
                const ecgW = W - ecgX - 20;
                ctx.beginPath();

                // Simulating a heartbeat trace
                const loopTime = 1.5;
                const localT = (t % loopTime) / loopTime;

                for (let x = 0; x < ecgW; x += 2) {
                    const xt = x / ecgW;
                    let y = H / 2;

                    const distToBeat = Math.abs(xt - localT);
                    if (distToBeat < 0.08) {
                        // QRS Complex simulation
                        const pulse = Math.sin(distToBeat * Math.PI * 25);
                        const envelope = Math.max(0, 1 - distToBeat * 15);
                        y -= pulse * (H * 0.4) * envelope;
                    }

                    // Add subtle baseline wander 
                    y += Math.sin(x * 0.05 + t * 5) * 2;

                    if (x === 0) ctx.moveTo(ecgX + x, y);
                    else ctx.lineTo(ecgX + x, y);
                }

                ctx.strokeStyle = color; ctx.lineWidth = 2;
                ctx.shadowColor = color; ctx.shadowBlur = 8;
                ctx.stroke(); ctx.shadowBlur = 0;

                // Beam tracker at the current pulse point
                const currentBeatX = ecgX + (localT * ecgW);
                ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.arc(currentBeatX, H / 2, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
            }

            cId = requestAnimationFrame(drawModal);
        };
        cId = requestAnimationFrame(drawModal);
        return () => cancelAnimationFrame(cId);
    }, [chartModal.open, chartModal.type]);


    return (
        <div style={{
            ...s.app,
            ...(standalone ? { background: 'transparent', position: 'absolute', inset: 0, height: '100%', width: '100%', pointerEvents: 'none' } : {})
        }}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600&display=swap');
                .latent-overlay-root * { font-family: 'Rajdhani', sans-serif; box-sizing: border-box; }
                .latent-overlay-root .ls-mono { font-family: 'Share Tech Mono', monospace; }
                @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
                .latent-overlay-root .anim-blink { animation: blink 2s infinite; }
            `}} />

            <div className="latent-overlay-root flex flex-col h-full w-full absolute inset-0 z-[100] pointer-events-none">

                {/* HEADER */}
                {!hudOnly && (
                    <header style={{ ...s.header, pointerEvents: 'auto' }}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-[6px] bg-gradient-to-br from-indigo-500 to-violet-700 flex items-center justify-center">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="white" strokeWidth="1.8" strokeLinecap="round" /></svg>
                            </div>
                            <span className="font-bold text-lg tracking-[0.25em] text-white">Latent<span style={{ color: s.c.indigo }}>Space</span></span>
                            <span className="text-[9px] tracking-[0.15em] px-[7px] py-[2px] border border-indigo-500/35 rounded-[3px] text-indigo-400 bg-indigo-500/10">v4.1.2 ALPHA</span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] tracking-[0.1em]">
                            <span style={{ color: aiOn ? 'rgba(200,210,240,0.4)' : '#fff' }}>HEURISTIC</span>
                            <div onClick={() => setAiOn(!aiOn)} className="w-9 h-[18px] rounded-full relative cursor-pointer bg-indigo-500/15 border border-indigo-500/35 transition-all shrink-0">
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'all 0.2s', left: aiOn ? '18px' : '3px', background: aiOn ? s.c.indigo : 'rgba(255,255,255,0.3)', boxShadow: aiOn ? `0 0 8px ${s.c.indigo}` : 'none' }} />
                            </div>
                            <span style={{ color: aiOn ? '#fff' : 'rgba(200,210,240,0.4)' }}>AI-DRIVEN</span>
                        </div>

                        <div className="flex gap-7">
                            <div style={s.metric}><span style={s.metricLbl}>Nodes Mapped</span><span style={{ ...s.metricVal, color: s.c.indigo }}>{dataClusters?.length || 0} / 125</span></div>
                            <div style={s.metric}><span style={s.metricLbl}>Avg Health</span><span style={{ ...s.metricVal, color: metrics.avgVitality >= 80 ? s.c.green : '#f59e0b' }}>{metrics.avgVitality}%</span></div>
                            <div style={s.metric}><span style={s.metricLbl}>System Score</span><span style={{ ...s.metricVal, color: 'rgba(200,210,240,0.8)' }}>{Math.round(metrics.healthScore)}/100</span></div>
                        </div>

                        <div className="flex items-center gap-3">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.c.indigo} strokeWidth="1.5" strokeLinecap="round" className="cursor-pointer"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#334] to-[#667] border border-slate-400/25" />

                            <button
                                onClick={onClose}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#f87171',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    marginLeft: '10px'
                                }}
                            >
                                CLOSE
                            </button>
                        </div>
                    </header>
                )}

                {/* MAIN CONTENT WORKSPACE */}
                <main className="flex-1 flex overflow-hidden relative pointer-events-none">

                    {/* CENTER (BACKGROUNDS + WRAPPING REACT THREE FIBER CANVAS) */}
                    {!standalone && !hudOnly && (
                        <div className="absolute inset-0 -z-[1]">
                            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center,rgba(15,20,40,0.95) 0%,#030508 100%)' }} />
                            <canvas ref={starCanvasRef} className="absolute inset-0 w-full h-full" />
                        </div>
                    )}

                    {/* The actual 3D canvas injected from the parent (e.g. LatentWorld.jsx holding <Canvas>) must sit here and pointer-events MUST be allowed! */}
                    {!standalone && !hudOnly && (
                        <div className="absolute inset-0 z-0 pointer-events-auto">
                            {children}
                        </div>
                    )}

                    {/* LEFT SIDEBAR */}
                    <aside style={{ ...s.sidebar, pointerEvents: 'auto', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        <div style={s.panel}>
                            <div style={s.panelHead}><span style={s.panelTitle}>Intelligence Report</span><span style={s.closeBtn} onClick={() => togglePanel('intel')}>×</span></div>
                            {panels.intel && (
                                <div style={s.panelBody}>
                                    <div style={s.dataRow}><span style={s.dataKey}>STATUS:</span><span style={{ ...s.dataVal, color: s.c.green, fontWeight: 700 }}>OPERATIONAL</span></div>
                                    <div style={s.dataRow}><span style={s.dataKey}>CLUSTERS MAPPED:</span><span style={{ ...s.dataVal, color: s.c.cyan }}>{new Set(dataClusters?.map(c => c.latent_category)).size || 5}</span></div>
                                    <div style={s.dataRow}><span style={s.dataKey}>TOTAL RECORDS:</span><span style={s.dataVal}>{metrics.snap}</span></div>
                                    <div style={s.dataRow}><span style={s.dataKey}>ACTIVE THREADS:</span><span style={s.dataVal}>{metrics.threads}</span></div>
                                    <div style={{ ...s.dataRow, borderBottom: 'none' }}><span style={s.dataKey}>LATENCY:</span><span style={{ ...s.dataVal, color: parseFloat(metrics.lat) > 4.5 ? '#f59e0b' : s.c.cyan }}>{metrics.lat}ms</span></div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '12px', height: '46px' }}>
                                        <div style={s.miniChart} onClick={() => setChartModal({ open: true, type: 'throughput', tab: '1m' })}><canvas ref={chartRefs[0]} className="w-full h-full" /></div>
                                        <div style={s.miniChart} onClick={() => setChartModal({ open: true, type: 'clusters', tab: '1m' })}><canvas ref={chartRefs[1]} className="w-full h-full" /></div>
                                        <div style={s.miniChart} onClick={() => setChartModal({ open: true, type: 'health', tab: '1m' })}><canvas ref={chartRefs[2]} className="w-full h-full" /></div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '8px', color: 'rgba(129,140,248,0.4)', letterSpacing: '0.08em' }}>
                                        <span className="cursor-pointer" onClick={() => setChartModal({ open: true, type: 'throughput', tab: '1m' })}>THROUGHPUT</span>
                                        <span className="cursor-pointer" onClick={() => setChartModal({ open: true, type: 'clusters', tab: '1m' })}>CLUSTERS</span>
                                        <span className="cursor-pointer" onClick={() => setChartModal({ open: true, type: 'health', tab: '1m' })}>HEALTH</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RELATIONSHIP HUD PANEL - ALWAYS VISIBLE */}
                        <div style={{ ...s.panel, marginTop: '10px' }}>
                            <div style={s.panelHead}>
                                <span style={s.panelTitle}>Relationship HUD</span>
                                <span style={s.closeBtn} onClick={handleToggleRelHud}>×</span>
                            </div>
                            {panels.relHud && (
                                <div style={s.panelBody}>
                                    {stickyEdge ? (
                                        <EdgeStatsPanel
                                            edge={stickyEdge}
                                            visible={true}
                                            variant="sidebar"
                                        />
                                    ) : (
                                        <div style={{ fontSize: '9px', color: 'rgba(167,186,220,0.35)', letterSpacing: '0.08em', textAlign: 'center', padding: '6px 0', lineHeight: 1.6 }}>
                                            HOVER A RELATIONSHIP<br />LINE TO SEE DETAILS
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex-1" />
                    </aside>

                    <div className="flex-1 relative">
                        <div style={{ position: 'absolute', top: '14px', left: '20px', zIndex: 20, pointerEvents: 'none' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.9)', margin: 0 }}>INTELLIGENCE LAYER SEMANTIC MAP</h2>
                            <p style={{ fontSize: '9px', letterSpacing: '0.25em', color: 'rgba(129,140,248,0.55)', marginTop: '2px', margin: 0 }}>3D LATENT SPACE GRAPH • {dataClusters?.length || 0} NODES DETECTED</p>
                        </div>

                        <div style={{ position: 'absolute', top: '14px', right: '20px', zIndex: 20, textAlign: 'right', pointerEvents: 'none' }}>
                            <div style={{ fontSize: '10px', color: 'rgba(0,245,255,0.65)' }} className="ls-mono">LATENT VECTOR RATE<br /><span style={{ color: s.c.cyan, fontWeight: 700 }}>[{selectedNode ? (selectedNode.x / 1000).toFixed(3) : '0.222'}, <b>{selectedNode ? (selectedNode.y / 1000).toFixed(3) : '0.004'}</b>, {selectedNode ? (selectedNode.z / 1000).toFixed(3) : '0.331'}]</span></div>
                        </div>


                    </div>

                    {/* RIGHT SIDEBAR */}
                    <aside style={{ ...s.sidebar, pointerEvents: 'auto' }}>
                        <div style={s.panel}>
                            <div style={s.panelHead}><span style={s.panelTitle}>Visual Settings</span><span style={s.closeBtn} onClick={() => togglePanel('visuals')}>×</span></div>
                            {panels.visuals && (
                                <div style={s.panelBody}>
                                    {/* PK Toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: showPKs ? '#10b981' : 'rgba(100,100,100,0.5)', boxShadow: showPKs ? '0 0 5px #10b981' : 'none' }} />
                                            <span style={{ color: showPKs ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>PRIMARY KEYS (GREEN)</span>
                                        </div>
                                        <div
                                            onClick={() => setShowPKs?.(!showPKs)}
                                            style={{ width: '36px', height: '18px', borderRadius: '9px', position: 'relative', cursor: 'pointer', background: showPKs ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showPKs ? 'rgba(16,185,129,0.45)' : 'rgba(255,255,255,0.1)'}` }}
                                        >
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'all 0.2s', left: showPKs ? '18px' : '3px', background: showPKs ? '#10b981' : 'rgba(255,255,255,0.3)', boxShadow: showPKs ? '0 0 7px #10b981' : 'none' }} />
                                        </div>
                                    </div>

                                    {/* FK Toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                                            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: showFKs ? '#fbbf24' : 'rgba(100,100,100,0.5)', boxShadow: showFKs ? '0 0 5px #fbbf24' : 'none' }} />
                                            <span style={{ color: showFKs ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>FOREIGN KEYS (AMBER)</span>
                                        </div>
                                        <div
                                            onClick={() => setShowFKs?.(!showFKs)}
                                            style={{ width: '36px', height: '18px', borderRadius: '9px', position: 'relative', cursor: 'pointer', background: showFKs ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${showFKs ? 'rgba(251,191,36,0.45)' : 'rgba(255,255,255,0.1)'}` }}
                                        >
                                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', position: 'absolute', top: '2px', transition: 'all 0.2s', left: showFKs ? '18px' : '3px', background: showFKs ? '#fbbf24' : 'rgba(255,255,255,0.3)', boxShadow: showFKs ? '0 0 7px #fbbf24' : 'none' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* DATA LENS (CATEGORICAL FILTERING) */}
                        <DataLensPanel
                            dataClusters={dataClusters}
                            connectionId={connectionId}
                            onFilterChange={onFilterChange}
                            activeFilters={activeFilters}
                        />

                        {/* NODE SELECTOR PANEL */}
                        <NodeSelectorPanel
                            dataClusters={dataClusters}
                            multiSelectedNodes={multiSelectedNodes}
                            setMultiSelectedNodes={setMultiSelectedNodes}
                            showMultiConnections={showMultiConnections}
                            setShowMultiConnections={setShowMultiConnections}
                        />

                        <div style={{ ...s.panel, ...(panels.hud ? { flex: 1, marginTop: '10px' } : { marginTop: '10px' }) }}>
                            <div style={s.panelHead}><span style={s.panelTitle}>Micro-Panel HUD</span><span style={s.closeBtn} onClick={() => togglePanel('hud')}>×</span></div>
                            {panels.hud && (
                                <div style={s.panelBody}>
                                    <div style={{ fontSize: '9px', letterSpacing: '0.15em', color: s.c.indigo, fontWeight: 700, marginBottom: '8px' }}>
                                        {selectedNode ? `NODE: ${selectedNode.name || selectedNode.id}` : 'SELECTED VOXEL'}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', rowGap: '5px', columnGap: '8px', fontSize: '9px' }} className="ls-mono">
                                        <span className="text-slate-300/40">ONTOLOGY CLASS:</span><span style={{ color: 'rgba(200,215,240,0.9)', fontWeight: 700 }}>{selectedNode ? (selectedNode.entity || selectedNode.table_type || 'Unclassified') : 'REFERENCES'}</span>
                                        <span className="text-slate-300/40">NEURAL GRAVITY:</span><span style={{ color: s.c.cyan }}>{selectedNode ? (selectedNode.neural_gravity || selectedNode.importance_score || 1.0).toFixed(2) + 'G' : '0.88G'}</span>
                                        <span className="text-slate-300/40">ID:</span><span style={{ color: 'rgba(200,215,240,0.9)' }}>{selectedNode ? selectedNode.id : 'REF-68294-A'}</span>
                                        <span className="text-slate-300/40">{selectedNode ? 'RECORDS' : 'TX ID'}:</span><span style={{ color: 'rgba(200,215,240,0.9)' }}>{selectedNode ? (selectedNode.row_count || 0).toLocaleString() : 'TAN-8045'}</span>
                                    </div>
                                    <div style={{ marginTop: '14px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px' }} className="ls-mono">
                                            <span className="text-slate-300/40">VITALITY SCORE:</span><span style={{ color: selectedNode ? (selectedNode.vitality < 40 ? '#ef4444' : (selectedNode.vitality < 70 ? '#fbbf24' : '#4ade80')) : '#4ade80' }}>{selectedNode ? Math.round(selectedNode.vitality || 100) : 88}%</span>
                                        </div>
                                        <div style={{ height: '3px', background: 'rgba(30,41,59,0.8)', borderRadius: '2px', overflow: 'hidden', marginTop: '5px' }}>
                                            <div style={{
                                                height: '100%',
                                                borderRadius: '2px',
                                                width: `${selectedNode ? Math.max(0, Math.min(100, selectedNode.vitality || 100)) : 88}%`,
                                                background: selectedNode ? (selectedNode.vitality < 40 ? '#ef4444' : (selectedNode.vitality < 70 ? '#fbbf24' : '#22c55e')) : '#22c55e'
                                            }} />
                                        </div>
                                        <div style={{ fontSize: '9px', color: 'rgba(167,186,220,0.4)', marginTop: '10px' }} className="ls-mono">
                                            CONTRIBUTING COLUMNS:
                                            <div style={{ color: 'rgba(200,215,240,0.85)', marginTop: '4px' }}>{selectedNode ? (selectedNode.columns?.slice(0, 3).map(c => c.name).join(', ') || 'N/A') : 'UserID, Session, Region'}</div>
                                        </div>
                                    </div>
                                    {/* X-RAY DEEP ANALYTICS BUTTON */}
                                    {selectedNode && connectionId && (
                                        <button
                                            onClick={() => setXrayNode(selectedNode)}
                                            style={{
                                                width: '100%', marginTop: '12px', padding: '8px',
                                                background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
                                                border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px',
                                                color: '#c7d2fe', fontSize: '9px', fontWeight: 800,
                                                letterSpacing: '0.2em', cursor: 'pointer',
                                                fontFamily: '"Rajdhani", sans-serif',
                                                transition: 'all 0.2s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                                            }}
                                            onMouseEnter={e => { e.target.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.35))'; }}
                                            onMouseLeave={e => { e.target.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))'; }}
                                        >
                                            ⬡ DEEP X-RAY ANALYSIS
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', letterSpacing: '0.08em' }}><div style={{ width: '14px', height: '2px', borderRadius: '1px', flexShrink: 0, background: s.c.cyan, boxShadow: `0 0 4px ${s.c.cyan}` }} /><span style={{ color: 'rgba(167,186,220,0.7)' }}>X: BUSINESS VALUE</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', letterSpacing: '0.08em' }}><div style={{ width: '14px', height: '2px', borderRadius: '1px', flexShrink: 0, background: s.c.gold, boxShadow: `0 0 4px ${s.c.gold}` }} /><span style={{ color: 'rgba(167,186,220,0.7)' }}>Y: HEALTH RISK</span></div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px', letterSpacing: '0.08em' }}><div style={{ width: '14px', height: '2px', borderRadius: '1px', flexShrink: 0, background: s.c.purple, boxShadow: `0 0 4px ${s.c.purple}` }} /><span style={{ color: 'rgba(167,186,220,0.7)' }}>Z: STABILITY</span></div>
                        </div>
                    </aside>

                </main>

                {/* FOOTER */}
                <footer style={{
                    ...s.footer,
                    pointerEvents: 'auto',
                    ...(hudOnly ? { background: 'transparent', borderTop: 'none', position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 50 } : {})
                }}>
                    <div className="flex-1" />
                    <div className="flex gap-1.5">
                        <div style={s.footBtn} onClick={onZoomIn} title="Zoom In"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></div>
                        <div style={s.footBtn} onClick={onZoomOut} title="Zoom Out"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg></div>
                        <div style={s.footBtn} onClick={onZoomReset} title="Reset View"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg></div>
                    </div>
                </footer>
            </div>

            {/* CHART MODAL OVERLAY */}
            {chartModal.open && (
                <div style={{ position: 'absolute', inset: 0, paddingBottom: '80px', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', pointerEvents: 'auto' }} onClick={(e) => { if (e.target === e.currentTarget) setChartModal({ ...chartModal, open: false }) }}>
                    <div style={{ background: 'rgba(8,14,35,0.97)', border: '1px solid rgba(129,140,248,0.35)', borderRadius: '10px', width: '520px', maxWidth: '90vw', padding: '20px 24px', boxShadow: '0 0 60px rgba(99,102,241,0.25)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.18em', color: '#fff', margin: '0 0 4px 0', fontFamily: 'Rajdhani, sans-serif' }}>
                                    {chartModal.type === 'throughput' ? 'THROUGHPUT ANALYSIS' : chartModal.type === 'clusters' ? 'CLUSTER DISTRIBUTION' : 'SYSTEM HEALTH INDEX'}
                                </h3>
                                <p style={{ fontSize: '9px', color: 'rgba(129,140,248,0.6)', letterSpacing: '0.1em', margin: 0, fontFamily: 'Rajdhani, sans-serif' }}>Real-time dynamic visualization</p>
                            </div>
                            <button onClick={() => setChartModal({ ...chartModal, open: false })} style={{ background: 'none', border: 'none', color: 'rgba(167,186,220,0.4)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                            {['1m', '5m', '1h', '1d'].map(tb => (
                                <div key={tb} onClick={() => setChartModal({ ...chartModal, tab: tb })} style={{ fontFamily: 'Rajdhani, sans-serif', padding: '4px 12px', borderRadius: '4px', border: `1px solid ${chartModal.tab === tb ? s.c.indigo : 'rgba(129,140,248,0.25)'}`, fontSize: '9px', letterSpacing: '0.12em', cursor: 'pointer', color: chartModal.tab === tb ? '#fff' : 'rgba(167,186,220,0.6)', background: chartModal.tab === tb ? 'rgba(129,140,248,0.18)' : 'transparent' }}>
                                    {tb.toUpperCase()}
                                </div>
                            ))}
                        </div>
                        <div style={{ height: '160px', position: 'relative' }}>
                            <canvas ref={modalChartRef} className="w-full h-full" />
                        </div>
                        {/* 4-stat summary grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginTop: '14px' }}>
                            {chartModal.type === 'throughput' ? (
                                <>
                                    <div style={s.chartStat}><div style={s.chartStatVal}>{liveStats?.tps || 1246}</div><div style={s.chartStatLbl}>AVG TPS</div></div>
                                    <div style={s.chartStat}><div style={s.chartStatVal}>{Math.floor((liveStats?.tps || 1246) * 1.5)}</div><div style={s.chartStatLbl}>PEAK TPS</div></div>
                                    <div style={s.chartStat}><div style={s.chartStatVal}>{Math.floor((liveStats?.tps || 1246) * 0.5)}</div><div style={s.chartStatLbl}>MIN TPS</div></div>
                                    <div style={s.chartStat}><div style={s.chartStatVal}>{liveStats?.health?.score || 99.8}%</div><div style={s.chartStatLbl}>UPTIME</div></div>
                                </>
                            ) : chartModal.type === 'clusters' ? (
                                <>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.cyan }}>{new Set(dataClusters?.map(c => c.latent_category)).size || 5}</div><div style={s.chartStatLbl}>CLUSTERS</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.cyan }}>{dataClusters?.filter(n => n.latent_category?.toLowerCase().includes('fact')).length || 0}</div><div style={s.chartStatLbl}>FACT DATA</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.cyan }}>{dataClusters?.filter(n => n.latent_category?.toLowerCase().includes('dimension')).length || 0}</div><div style={s.chartStatLbl}>DIMENSION</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.cyan }}>{dataClusters?.filter(n => n.latent_category?.toLowerCase().includes('transaction') || n?.row_count > 50000).length || 0}</div><div style={s.chartStatLbl}>HIGH TX</div></div>
                                </>
                            ) : (
                                <>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.green }}>{liveStats?.health?.score || 98.4}%</div><div style={s.chartStatLbl}>HEALTH</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.green }}>{metrics.lat}ms</div><div style={s.chartStatLbl}>LATENCY</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.green }}>{metrics.threads}</div><div style={s.chartStatLbl}>THREADS</div></div>
                                    <div style={s.chartStat}><div style={{ ...s.chartStatVal, color: s.c.green }}>{liveStats?.failedTx || 0}</div><div style={s.chartStatLbl}>ERRORS</div></div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* NODE X-RAY DEEP ANALYTICS OVERLAY */}
            {xrayNode && connectionId && (
                <NodeXRayPanel
                    node={xrayNode}
                    connectionId={connectionId}
                    onClose={() => setXrayNode(null)}
                    onDrillDown={onDrillDown}
                />
            )}
        </div>
    );
};

// =========================================================================
// MAIN LATENT WORLD COMPONENT (CONSOLIDATED)
// =========================================================================

