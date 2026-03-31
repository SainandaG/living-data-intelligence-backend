import React from 'react';

/**
 * TransactionTimeline
 * Renders timeline charts: area (history+forecast), daily bar, forecast line.
 * Extracted from NodeXRayPanel.jsx — Priority 2 split.
 */
function TimelineAreaChart({ history, forecast }) {
    const W = 440, H = 140, PAD = { t: 10, r: 10, b: 24, l: 36 };
    const chartW = W - PAD.l - PAD.r;
    const chartH = H - PAD.t - PAD.b;

    const allPoints = [
        ...history.map(d => ({ date: d.date, count: d.count, type: 'history' })),
        ...forecast.map(d => ({ date: d.date, count: d.predicted_count, type: 'forecast' })),
    ];

    if (allPoints.length === 0) return <div style={{ color: 'rgba(167,186,220,0.3)', fontSize: '10px', textAlign: 'center', padding: '20px' }}>No timeline data available</div>;

    const maxVal = Math.max(...allPoints.map(p => p.count), 1);
    const xScale = (i) => PAD.l + (i / Math.max(allPoints.length - 1, 1)) * chartW;
    const yScale = (v) => PAD.t + chartH - (v / maxVal) * chartH;

    const histLen = history.length;

    // Build SVG path for history area
    let histPath = `M ${xScale(0)} ${yScale(allPoints[0].count)}`;
    for (let i = 1; i < histLen; i++) histPath += ` L ${xScale(i)} ${yScale(allPoints[i].count)}`;
    const histArea = `${histPath} L ${xScale(histLen - 1)} ${yScale(0)} L ${xScale(0)} ${yScale(0)} Z`;

    // Build forecast line (dashed)
    let forecastPath = '';
    if (forecast.length > 0 && histLen > 0) {
        forecastPath = `M ${xScale(histLen - 1)} ${yScale(history[histLen - 1]?.count || 0)}`;
        for (let i = 0; i < forecast.length; i++) {
            forecastPath += ` L ${xScale(histLen + i)} ${yScale(forecast[i].predicted_count)}`;
        }
    }
    const forecastArea = forecast.length > 0 && histLen > 0
        ? `${forecastPath} L ${xScale(allPoints.length - 1)} ${yScale(0)} L ${xScale(histLen - 1)} ${yScale(0)} Z`
        : '';

    // Y-axis labels
    const yTicks = [0, Math.round(maxVal / 2), maxVal];

    return (
        <svg width={W} height={H} style={{ display: 'block', width: '100%', height: 'auto' }}>
            <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="foreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
                </linearGradient>
            </defs>

            {/* Grid lines */}
            {yTicks.map((t, i) => (
                <g key={i}>
                    <line x1={PAD.l} y1={yScale(t)} x2={W - PAD.r} y2={yScale(t)} stroke="rgba(255,255,255,0.04)" />
                    <text x={PAD.l - 4} y={yScale(t) + 3} textAnchor="end" fill="rgba(167,186,220,0.3)" fontSize="7" fontFamily="Share Tech Mono, monospace">{t}</text>
                </g>
            ))}

            {/* History area */}
            <path d={histArea} fill="url(#histGrad)" />
            <path d={histPath} fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinejoin="round" />

            {/* Forecast area */}
            {forecastArea && <path d={forecastArea} fill="url(#foreGrad)" />}
            {forecastPath && <path d={forecastPath} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />}

            {/* Divider between history and forecast */}
            {forecast.length > 0 && histLen > 0 && (
                <line x1={xScale(histLen - 1)} y1={PAD.t} x2={xScale(histLen - 1)} y2={PAD.t + chartH} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 2" />
            )}

            {/* Date labels (first, midpoint, last) */}
            {[0, Math.floor(allPoints.length / 2), allPoints.length - 1].map(i => (
                <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle" fill="rgba(167,186,220,0.3)" fontSize="7" fontFamily="Share Tech Mono, monospace">
                    {allPoints[i]?.date?.slice(5) || ''}
                </text>
            ))}

            {/* Legend */}
            <circle cx={PAD.l + 4} cy={H - 5} r="3" fill="#818cf8" />
            <text x={PAD.l + 10} y={H - 2} fill="rgba(167,186,220,0.4)" fontSize="6">HISTORY</text>
            {forecast.length > 0 && (
                <>
                    <circle cx={PAD.l + 56} cy={H - 5} r="3" fill="#22d3ee" />
                    <text x={PAD.l + 62} y={H - 2} fill="rgba(167,186,220,0.4)" fontSize="6">FORECAST</text>
                </>
            )}
        </svg>
    );
}

/**
 * Bar Chart — Daily transaction counts as vertical bars
 */
function DailyBarChart({ history }) {
    const W = 440, H = 140, PAD = { t: 10, r: 10, b: 24, l: 36 };
    const chartW = W - PAD.l - PAD.r;
    const chartH = H - PAD.t - PAD.b;

    if (!history.length) return <div style={{ color: 'rgba(167,186,220,0.3)', fontSize: '10px', textAlign: 'center', padding: '20px' }}>No daily data</div>;

    const maxVal = Math.max(...history.map(d => d.count), 1);
    const barW = Math.max(2, (chartW / history.length) - 2);

    // Y ticks
    const yTicks = [0, Math.round(maxVal / 2), maxVal];
    const yScale = (v) => PAD.t + chartH - (v / maxVal) * chartH;

    return (
        <svg width={W} height={H} style={{ display: 'block', width: '100%', height: 'auto' }}>
            <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
            </defs>

            {/* Grid */}
            {yTicks.map((t, i) => (
                <g key={i}>
                    <line x1={PAD.l} y1={yScale(t)} x2={W - PAD.r} y2={yScale(t)} stroke="rgba(255,255,255,0.04)" />
                    <text x={PAD.l - 4} y={yScale(t) + 3} textAnchor="end" fill="rgba(167,186,220,0.3)" fontSize="7" fontFamily="Share Tech Mono, monospace">{t}</text>
                </g>
            ))}

            {/* Bars */}
            {history.map((d, i) => {
                const barH = (d.count / maxVal) * chartH;
                const x = PAD.l + (i / history.length) * chartW + 1;
                const isLast7 = i >= history.length - 7;
                return (
                    <g key={i}>
                        <rect
                            x={x} y={PAD.t + chartH - barH}
                            width={barW} height={barH}
                            rx="1.5"
                            fill={isLast7 ? 'url(#barGrad)' : 'rgba(99,102,241,0.25)'}
                            opacity={0.9}
                        />
                        {/* Hover tooltip via title */}
                        <title>{d.date}: {d.count} records</title>
                    </g>
                );
            })}

            {/* Date labels */}
            {[0, Math.floor(history.length / 2), history.length - 1].map(i => (
                <text key={i} x={PAD.l + (i / history.length) * chartW + barW / 2} y={H - 4} textAnchor="middle" fill="rgba(167,186,220,0.3)" fontSize="7" fontFamily="Share Tech Mono, monospace">
                    {history[i]?.date?.slice(5) || ''}
                </text>
            ))}

            {/* Last 7d highlight label */}
            <text x={W - PAD.r - 2} y={PAD.t + 8} textAnchor="end" fill="#818cf8" fontSize="6" fontWeight="700">LAST 7D ▸</text>
        </svg>
    );
}

/**
 * Line Chart — Combined history (solid) + forecast (dashed) as a line with data points
 */
function ForecastLineChart({ history, forecast }) {
    const W = 440, H = 140, PAD = { t: 10, r: 10, b: 24, l: 36 };
    const chartW = W - PAD.l - PAD.r;
    const chartH = H - PAD.t - PAD.b;

    const allPoints = [
        ...history.map(d => ({ date: d.date, count: d.count, type: 'history' })),
        ...forecast.map(d => ({ date: d.date, count: d.predicted_count, type: 'forecast' })),
    ];

    if (allPoints.length === 0) return <div style={{ color: 'rgba(167,186,220,0.3)', fontSize: '10px', textAlign: 'center', padding: '20px' }}>No data</div>;

    const maxVal = Math.max(...allPoints.map(p => p.count), 1);
    const xScale = (i) => PAD.l + (i / Math.max(allPoints.length - 1, 1)) * chartW;
    const yScale = (v) => PAD.t + chartH - (v / maxVal) * chartH;
    const histLen = history.length;

    // Y ticks
    const yTicks = [0, Math.round(maxVal / 2), maxVal];

    // Build history line
    let histLine = history.length > 0 ? `M ${xScale(0)} ${yScale(history[0].count)}` : '';
    for (let i = 1; i < histLen; i++) histLine += ` L ${xScale(i)} ${yScale(history[i].count)}`;

    // Build forecast line
    let foreLine = '';
    if (forecast.length > 0 && histLen > 0) {
        foreLine = `M ${xScale(histLen - 1)} ${yScale(history[histLen - 1]?.count || 0)}`;
        for (let i = 0; i < forecast.length; i++) {
            foreLine += ` L ${xScale(histLen + i)} ${yScale(forecast[i].predicted_count)}`;
        }
    }

    return (
        <svg width={W} height={H} style={{ display: 'block', width: '100%', height: 'auto' }}>
            {/* Grid */}
            {yTicks.map((t, i) => (
                <g key={i}>
                    <line x1={PAD.l} y1={yScale(t)} x2={W - PAD.r} y2={yScale(t)} stroke="rgba(255,255,255,0.04)" />
                    <text x={PAD.l - 4} y={yScale(t) + 3} textAnchor="end" fill="rgba(167,186,220,0.3)" fontSize="7" fontFamily="Share Tech Mono, monospace">{t}</text>
                </g>
            ))}

            {/* History line */}
            {histLine && <path d={histLine} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" />}

            {/* History data points */}
            {history.map((d, i) => (
                <g key={`h-${i}`}>
                    <circle cx={xScale(i)} cy={yScale(d.count)} r="3" fill="#818cf8" stroke="rgba(5,8,22,0.8)" strokeWidth="1.5">
                        <title>{d.date}: {d.count}</title>
                    </circle>
                </g>
            ))}

            {/* Divider */}
            {forecast.length > 0 && histLen > 0 && (
                <line x1={xScale(histLen - 1)} y1={PAD.t} x2={xScale(histLen - 1)} y2={PAD.t + chartH} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 2" />
            )}

            {/* Forecast line */}
            {foreLine && <path d={foreLine} fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="6 3" strokeLinejoin="round" />}

            {/* Forecast data points */}
            {forecast.map((d, i) => (
                <g key={`f-${i}`}>
                    <circle cx={xScale(histLen + i)} cy={yScale(d.predicted_count)} r="2.5" fill="none" stroke="#22d3ee" strokeWidth="1.5">
                        <title>{d.date}: ~{d.predicted_count} (projected)</title>
                    </circle>
                </g>
            ))}

            {/* Date labels */}
            {[0, Math.floor(allPoints.length / 2), allPoints.length - 1].map(i => (
                <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle" fill="rgba(167,186,220,0.3)" fontSize="7" fontFamily="Share Tech Mono, monospace">
                    {allPoints[i]?.date?.slice(5) || ''}
                </text>
            ))}

            {/* Labels */}
            <text x={PAD.l + 4} y={PAD.t + 8} fill="#818cf8" fontSize="6" fontWeight="700">● ACTUAL</text>
            {forecast.length > 0 && <text x={PAD.l + 54} y={PAD.t + 8} fill="#22d3ee" fontSize="6" fontWeight="700">○ PROJECTED</text>}
        </svg>
    );
}

// ─── OTHER SUB-COMPONENTS ───────────────────────────────────────

