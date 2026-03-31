import React from 'react';

/**
 * QualityRadar
 * Renders an SVG radar chart showing data quality dimensions:
 * Quality score, Completeness, and Uniqueness.
 * Extracted from NodeXRayPanel.jsx — Priority 2 split.
 */
function QualityRadar({ score, columns }) {
    const completeness = columns.length > 0
        ? Math.round(100 - columns.reduce((s, [, c]) => s + (c.null_percentage || 0), 0) / columns.length)
        : 0;
    const uniqueness = columns.length > 0
        ? Math.round(columns.reduce((s, [, c]) => s + Math.min(100, (c.unique_count || 0)), 0) / columns.length)
        : 0;

    const axes = [
        { label: 'Quality', value: score, color: '#4ade80' },
        { label: 'Complete', value: completeness, color: '#22d3ee' },
        { label: 'Unique', value: Math.min(100, uniqueness), color: '#a78bfa' },
        { label: 'Columns', value: Math.min(100, columns.length * 10), color: '#fbbf24' },
    ];

    const qColor = score >= 80 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#ef4444';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '8px 0' }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke={qColor} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${score * 2.01} 201`}
                    transform="rotate(-90 40 40)"
                    style={{ filter: `drop-shadow(0 0 6px ${qColor})`, transition: 'stroke-dasharray 1s' }}
                />
                <text x="40" y="38" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="900" fontFamily="Rajdhani">{score}</text>
                <text x="40" y="52" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Rajdhani" letterSpacing="0.1em">QUALITY</text>
            </svg>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {axes.map(a => (
                    <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '9px' }}>
                        <span style={{ width: '52px', color: 'rgba(167,186,220,0.5)', letterSpacing: '0.06em' }}>{a.label.toUpperCase()}</span>
                        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, a.value)}%` }} transition={{ duration: 0.8, delay: 0.1 }} style={{ height: '100%', background: a.color, borderRadius: '2px' }} />
                        </div>
                        <span style={{ width: '28px', textAlign: 'right', color: a.color, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace' }}>{Math.round(a.value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

