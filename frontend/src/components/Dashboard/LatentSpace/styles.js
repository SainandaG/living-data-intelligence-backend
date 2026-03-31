/**
 * LatentSpace/styles.js
 * Shared inline style constants for LatentSpaceUIOverlay and LatentWorld.
 * Extracted from LatentSpaceLogic.jsx lines 1769-1792.
 * TODO: Replace with Tailwind classes (P3C).
 */

const s = {
    c: { cyan: '#00f5ff', orange: '#ff6b00', purple: '#bc13fe', green: '#00ff88', pink: '#ff2d78', gold: '#ffd700', indigo: '#818cf8', bg: '#030508' },
    app: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#030508', color: 'rgba(200,210,240,0.9)', overflow: 'hidden' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '50px', background: 'rgba(5,8,20,0.95)', borderBottom: '1px solid rgba(99,102,241,0.15)', flexShrink: 0, zIndex: 50 },
    footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: '38px', background: 'rgba(5,8,20,0.95)', borderTop: '1px solid rgba(99,102,241,0.12)', flexShrink: 0, zIndex: 50 },
    sidebar: { width: '272px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', overflowY: 'auto', zIndex: 20 },
    panel: { background: 'rgba(10,15,30,0.75)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' },
    panelHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
    panelTitle: { fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', color: '#fff', textTransform: 'uppercase' },
    panelBody: { padding: '12px 14px' },
    closeBtn: { cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: '16px', lineHeight: 1 },
    metric: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
    metricLbl: { fontSize: '8px', color: 'rgba(200,210,240,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' },
    metricVal: { fontSize: '12px', fontWeight: 600, fontFamily: '"Share Tech Mono", monospace' },
    dataRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '10px', borderBottom: '1px solid rgba(255,255,255,0.04)' },
    dataKey: { color: 'rgba(167,186,220,0.45)', letterSpacing: '0.05em' },
    dataVal: { color: 'rgba(200,215,240,0.9)', fontFamily: '"Share Tech Mono", monospace' },
    miniChart: { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', overflow: 'hidden', position: 'relative', cursor: 'pointer' },
    footBtn: { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: '4px', cursor: 'pointer' },
    chartStat: { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '5px', padding: '8px 10px', textAlign: 'center' },
    chartStatVal: { fontSize: '16px', fontWeight: 700, fontFamily: '"Share Tech Mono", monospace', color: '#818cf8' },
    chartStatLbl: { fontSize: '8px', color: 'rgba(167,186,220,0.4)', letterSpacing: '0.1em', marginTop: '2px', fontFamily: '"Rajdhani", sans-serif' }
};


export { s as latentStyles };
export default s;
