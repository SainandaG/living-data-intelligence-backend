import React from 'react';

/**
 * GrowthProjection
 * Renders growth rate indicators, projected 30-day counts, and risk badges.
 * Extracted from NodeXRayPanel.jsx — Priority 2 split.
 */
function GrowthSection({ growth, rowCount }) {
    const rate = growth.rate_percent || 0;
    const projected = growth.projected_30d || rowCount;
    const current = growth.current_size || rowCount;
    const risk = growth.risk_level || 'Unknown';
    const isUp = rate >= 0;
    const riskColor = risk === 'High' ? '#f87171' : risk === 'Medium' ? '#fbbf24' : '#4ade80';

    return (
        <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                        {isUp ? <TrendingUp size={16} style={{ color: '#4ade80' }} /> : <TrendingDown size={16} style={{ color: '#f87171' }} />}
                        <span style={{ fontSize: '22px', fontWeight: 900, color: isUp ? '#4ade80' : '#f87171', fontFamily: 'Rajdhani' }}>
                            {rate > 0 ? '+' : ''}{rate.toFixed(1)}%
                        </span>
                    </div>
                    <span style={{ fontSize: '8px', color: 'rgba(167,186,220,0.4)', letterSpacing: '0.1em' }}>30-DAY GROWTH</span>
                </div>
                <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.08)' }} />
                <div style={{ flex: 1, fontSize: '9px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(167,186,220,0.5)' }}>CURRENT</span>
                        <span style={{ color: '#fff', fontWeight: 700, fontFamily: 'Share Tech Mono, monospace' }}>{current.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(167,186,220,0.5)' }}>30-DAY EST</span>
                        <span style={{ color: '#818cf8', fontWeight: 700, fontFamily: 'Share Tech Mono, monospace' }}>{projected.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'rgba(167,186,220,0.5)' }}>RISK LEVEL</span>
                        <span style={{ color: riskColor, fontWeight: 800, fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: riskColor + '15', letterSpacing: '0.08em' }}>{risk.toUpperCase()}</span>
                    </div>
                </div>
            </div>
            {growth.summary && (
                <p style={{ fontSize: '10px', color: 'rgba(167,186,220,0.5)', marginTop: '8px', lineHeight: 1.5, fontStyle: 'italic' }}>
                    {growth.summary}
                </p>
            )}
        </div>
    );
}

function CorrelationBadge({ corr }) {
    const val = corr.correlation || corr.coefficient || 0;
    const abs = Math.abs(val);
    const color = abs > 0.7 ? '#f87171' : abs > 0.4 ? '#fbbf24' : '#4ade80';
    const label = abs > 0.7 ? 'STRONG' : abs > 0.4 ? 'MODERATE' : 'WEAK';

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#e2e8f0', fontFamily: 'Share Tech Mono, monospace' }}>{corr.column1 || corr.col1}</span>
                <Minus size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
                <span style={{ color: '#e2e8f0', fontFamily: 'Share Tech Mono, monospace' }}>{corr.column2 || corr.col2}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace' }}>{val.toFixed(2)}</span>
                <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '3px', background: color + '20', color, fontWeight: 700, letterSpacing: '0.08em' }}>{label}</span>
            </div>
        </div>
    );
}

function SampleTable({ columns, records }) {
