import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../../utils/apiClient';
import {
    X, Database, TrendingUp, TrendingDown, Layers, Shield,
    BarChart3, GitBranch, Table2, Minus, Zap, Activity, Clock, LineChart
} from 'lucide-react';

/**
 * Node X-Ray Panel — Deep analytics overlay for a Latent Space node.
 * Replaces the manual work of data analysts / data engineers by showing:
 *   1. Data Quality Radar
 *   2. Transaction Timeline (Area Chart — history + forecast)
 *   3. Daily Activity (Bar Chart)
 *   4. Growth Projection (Line Chart with trend)
 *   5. Column Profiler Cards
 *   6. Value Distribution Charts
 *   7. Correlations
 *   8. Live Sample Records
 */
export default function NodeXRayPanel({ node, connectionId, onClose, onDrillDown }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartView, setChartView] = useState('area'); // 'area' | 'bar' | 'line'

    const tableName = node?.name || node?.id;

    useEffect(() => {
        if (!tableName || !connectionId) return;
        let cancelled = false;

        const fetchXRay = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await apiClient.get(`/node-xray/${connectionId}/${tableName}`);
                if (!cancelled) setData(res);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Analysis failed');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchXRay();
        return () => { cancelled = true; };
    }, [tableName, connectionId]);

    if (!node) return null;

    // Inject spinner keyframe once
    if (typeof document !== 'undefined' && !document.getElementById('xray-spin-css')) {
        const style = document.createElement('style');
        style.id = 'xray-spin-css';
        style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
    }

    const quality = data?.quality_score || 0;
    const columns = data?.column_stats ? Object.entries(data.column_stats) : [];
    const correlations = data?.correlations || [];
    const growth = data?.growth || {};
    const samples = data?.samples || {};
    const timeline = data?.timeline || {};

    return (
        <AnimatePresence>
            <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                style={styles.container}
            >
                {/* === HEADER === */}
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={styles.headerIcon}><Database size={16} /></div>
                        <div>
                            <div style={styles.headerTitle}>{tableName}</div>
                            <div style={styles.headerSub}>
                                {node.entity || node.table_type || 'Table'} • {(data?.row_count || node.row_count || 0).toLocaleString()} rows
                            </div>
                        </div>
                    </div>
                    <button style={styles.closeBtn} onClick={onClose}><X size={16} /></button>
                </div>

                <div style={styles.scrollArea}>
                    {loading ? (
                        <div style={styles.loadingWrap}>
                            <div style={styles.spinner} />
                            <span style={styles.loadingText}>DEEP SCAN IN PROGRESS</span>
                        </div>
                    ) : error ? (
                        <div style={styles.errorWrap}>
                            <Shield size={24} style={{ color: '#f87171' }} />
                            <p style={{ color: '#f87171', fontSize: '12px', marginTop: '8px' }}>{error}</p>
                        </div>
                    ) : node.selectedColumns && node.selectedColumns.length > 0 ? (
                        <ComparisonView
                            node={node}
                            data={data}
                            selectedColumns={node.selectedColumns}
                        />
                    ) : (
                        <>
                            {/* === SECTION 1: DATA QUALITY RADAR === */}
                            <Section title="DATA QUALITY" icon={<Shield size={14} />}>
                                <QualityRadar score={quality} columns={columns} />
                            </Section>

                            {/* === SECTION 2: TRANSACTION TIMELINE + PROJECTION === */}
                            {(timeline.history?.length > 0 || timeline.forecast?.length > 0) && (
                                <Section title="TRANSACTION TIMELINE" icon={<Clock size={14} />}
                                    subtitle={timeline.timestamp_column ? `via ${timeline.timestamp_column}` : undefined}>
                                    {/* Chart Type Switcher */}
                                    <div style={styles.chartSwitcher}>
                                        {[
                                            { id: 'area', label: 'AREA', icon: <Activity size={10} /> },
                                            { id: 'bar', label: 'BARS', icon: <BarChart3 size={10} /> },
                                            { id: 'line', label: 'LINE', icon: <LineChart size={10} /> },
                                        ].map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setChartView(t.id)}
                                                style={{
                                                    ...styles.chartTab,
                                                    ...(chartView === t.id ? styles.chartTabActive : {}),
                                                }}
                                            >
                                                {t.icon} {t.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Weekly Stats Banner */}
                                    <div style={styles.weeklyBanner}>
                                        <div style={styles.weekStat}>
                                            <span style={styles.weekLabel}>LAST 7D</span>
                                            <span style={{ color: '#22d3ee', fontWeight: 800, fontSize: '14px', fontFamily: 'Share Tech Mono, monospace' }}>
                                                {(timeline.total_recent_7d || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.06)' }} />
                                        <div style={styles.weekStat}>
                                            <span style={styles.weekLabel}>PREV 7D</span>
                                            <span style={{ color: 'rgba(167,186,220,0.6)', fontWeight: 700, fontSize: '14px', fontFamily: 'Share Tech Mono, monospace' }}>
                                                {(timeline.total_previous_7d || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.06)' }} />
                                        <div style={styles.weekStat}>
                                            <span style={styles.weekLabel}>CHANGE</span>
                                            <span style={{
                                                color: (timeline.weekly_change_pct || 0) >= 0 ? '#4ade80' : '#f87171',
                                                fontWeight: 800, fontSize: '14px', fontFamily: 'Share Tech Mono, monospace'
                                            }}>
                                                {(timeline.weekly_change_pct || 0) > 0 ? '+' : ''}{(timeline.weekly_change_pct || 0).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* The Chart */}
                                    {chartView === 'area' && <TimelineAreaChart history={timeline.history || []} forecast={timeline.forecast || []} />}
                                    {chartView === 'bar' && <DailyBarChart history={timeline.history || []} />}
                                    {chartView === 'line' && <ForecastLineChart history={timeline.history || []} forecast={timeline.forecast || []} />}
                                </Section>
                            )}

                            {/* === SECTION 3: GROWTH PROJECTION === */}
                            <Section title="GROWTH PROJECTION" icon={<Activity size={14} />}>
                                <GrowthSection growth={growth} rowCount={data?.row_count || 0} />
                            </Section>

                            {/* === SECTION 4: COLUMN PROFILER === */}
                            <Section title="COLUMN PROFILER" icon={<Layers size={14} />} subtitle={`${columns.length} columns detected`}>
                                <div style={styles.columnScroll}>
                                    {columns.map(([name, stats]) => (
                                        <ColumnCard key={name} name={name} stats={stats} totalRows={data?.row_count || 0} />
                                    ))}
                                </div>
                            </Section>

                            {/* === SECTION 5: VALUE DISTRIBUTIONS === */}
                            {columns.filter(([, s]) => s.min !== undefined).length > 0 && (
                                <Section title="VALUE DISTRIBUTIONS" icon={<BarChart3 size={14} />}>
                                    {columns.filter(([, s]) => s.min !== undefined).slice(0, 3).map(([name, stats]) => (
                                        <DistributionBar key={name} name={name} stats={stats} />
                                    ))}
                                </Section>
                            )}

                            {/* === SECTION 6: CORRELATIONS === */}
                            {correlations.length > 0 && (
                                <Section title="CORRELATIONS" icon={<GitBranch size={14} />}>
                                    {correlations.slice(0, 5).map((c, i) => (
                                        <CorrelationBadge key={i} corr={c} />
                                    ))}
                                </Section>
                            )}

                            {/* === SECTION 7: SAMPLE RECORDS === */}
                            {samples.records?.length > 0 && (
                                <Section title="SAMPLE RECORDS" icon={<Table2 size={14} />}>
                                    <SampleTable columns={samples.columns} records={samples.records} />
                                </Section>
                            )}

                            {/* === SUMMARY === */}
                            {data?.summary && (
                                <div style={styles.summaryBox}>
                                    <Zap size={12} style={{ color: '#818cf8', flexShrink: 0 }} />
                                    <p style={styles.summaryText}>{data.summary}</p>
                                </div>
                            )}

                            {/* === QUICK ACTIONS === */}
                            {onDrillDown && (
                                <button style={styles.drillBtn} onClick={() => onDrillDown(tableName)}>
                                    ⬡ EXPLORE TABLE IN DRILL-DOWN
                                </button>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

function ComparisonView({ node, data, selectedColumns }) {
    const columns = data?.column_stats || {};

    // Filter columns based on selection
    const compareItems = selectedColumns.map(key => {
        const [nodeId, colName] = key.includes('-') ? key.split('-') : [node.id, key];
        const stats = columns[colName];
        return { nodeId, colName, stats };
    }).filter(item => item.stats);

    if (compareItems.length === 0) {
        return (
            <div style={styles.errorWrap}>
                <Layers size={24} style={{ color: 'rgba(129,140,248,0.4)' }} />
                <p style={{ color: 'rgba(167,186,220,0.5)', fontSize: '11px', marginTop: '8px' }}>
                    SELECT OR PIN COLUMNS TO COMPARE
                </p>
            </div>
        );
    }

    return (
        <div style={{ padding: '10px 0' }}>
            <Section title="COLUMN COMPARISON MATRIX" icon={<Layers size={14} />}>
                <div style={styles.compareGrid}>
                    {compareItems.map((item, i) => (
                        <ColumnComparisonCard
                            key={i}
                            name={item.colName}
                            nodeName={item.nodeId === node.id ? node.name : item.nodeId}
                            stats={item.stats}
                        />
                    ))}
                </div>
            </Section>

            <Section title="DEEP METRIC DIFF" icon={<BarChart3 size={14} />}>
                <div style={styles.metricTableWrap}>
                    <table style={styles.metricTable}>
                        <thead>
                            <tr>
                                <th style={styles.metricTh}>Metric</th>
                                {compareItems.map((item, i) => (
                                    <th key={i} style={styles.metricTh}>{item.colName}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={styles.metricTd}>Null Rate</td>
                                {compareItems.map((item, i) => (
                                    <td key={i} style={{ ...styles.metricTd, color: item.stats.null_percentage > 10 ? '#f87171' : '#4ade80' }}>
                                        {item.stats.null_percentage}%
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                <td style={styles.metricTd}>Uniqueness</td>
                                {compareItems.map((item, i) => (
                                    <td key={i} style={styles.metricTd}>{item.stats.unique_count.toLocaleString()}</td>
                                ))}
                            </tr>
                            {compareItems.some(i => i.stats.avg !== undefined) && (
                                <>
                                    <tr>
                                        <td style={styles.metricTd}>Mean Value</td>
                                        {compareItems.map((item, i) => (
                                            <td key={i} style={styles.metricTd}>{item.stats.avg?.toFixed(2) || 'N/A'}</td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td style={styles.metricTd}>StDev</td>
                                        {compareItems.map((item, i) => (
                                            <td key={i} style={styles.metricTd}>{item.stats.stddev?.toFixed(2) || 'N/A'}</td>
                                        ))}
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </Section>
        </div>
    );
}

function ColumnComparisonCard({ name, nodeName, stats }) {
    return (
        <div style={{
            ...styles.colCard,
            minWidth: 'auto',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
            border: '1px solid rgba(129,140,248,0.2)'
        }}>
            <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#fff', fontFamily: 'Share Tech Mono' }}>{name}</div>
                <div style={{ fontSize: '8px', color: 'rgba(167,186,220,0.4)', textTransform: 'uppercase' }}>{nodeName}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                    <span style={{ color: 'rgba(167,186,220,0.4)' }}>QUALITY</span>
                    <span style={{ color: '#4ade80', fontWeight: 800 }}>{Math.round(100 - (stats.null_percentage || 0))}%</span>
                </div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#4ade80', width: `${100 - (stats.null_percentage || 0)}%` }} />
                </div>
            </div>
        </div>
    );
}

// ─── CHART COMPONENTS ───────────────────────────────────────────

/**
 * Area Chart — Shows historical daily counts as a filled area + forecast as a dotted projection
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

function Section({ title, icon, subtitle, children }) {
    return (
        <div style={styles.section}>
            <div style={styles.sectionHead}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#818cf8' }}>{icon}</span>
                    <span style={styles.sectionTitle}>{title}</span>
                </div>
                {subtitle && <span style={styles.sectionSub}>{subtitle}</span>}
            </div>
            {children}
        </div>
    );
}

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

function ColumnCard({ name, stats, totalRows }) {
    const typeColors = {
        integer: '#22d3ee', bigint: '#22d3ee', smallint: '#22d3ee',
        numeric: '#a78bfa', real: '#a78bfa', 'double precision': '#a78bfa',
        'character varying': '#fbbf24', text: '#fbbf24', varchar: '#fbbf24',
        boolean: '#4ade80', date: '#f472b6',
        'timestamp with time zone': '#f472b6', 'timestamp without time zone': '#f472b6', timestamp: '#f472b6',
    };
    const tc = typeColors[stats.data_type] || '#94a3b8';
    const nullPct = stats.null_percentage || 0;

    return (
        <div style={styles.colCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', fontFamily: 'Share Tech Mono, monospace' }}>{name}</span>
                <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '3px', background: tc + '20', color: tc, fontWeight: 700, letterSpacing: '0.05em' }}>
                    {(stats.data_type || 'unknown').toUpperCase().replace('CHARACTER VARYING', 'VARCHAR')}
                </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '9px' }}>
                <div><span style={styles.statLabel}>NULLS</span><span style={{ color: nullPct > 20 ? '#f87171' : '#4ade80', fontWeight: 700 }}>{nullPct}%</span></div>
                <div><span style={styles.statLabel}>UNIQUE</span><span style={{ color: '#22d3ee', fontWeight: 700 }}>{(stats.unique_count || 0).toLocaleString()}</span></div>
                {stats.min !== undefined && (
                    <>
                        <div><span style={styles.statLabel}>MIN</span><span style={{ color: '#e2e8f0' }}>{Number(stats.min).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></div>
                        <div><span style={styles.statLabel}>MAX</span><span style={{ color: '#e2e8f0' }}>{Number(stats.max).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></div>
                        <div style={{ gridColumn: 'span 2' }}><span style={styles.statLabel}>AVG</span><span style={{ color: '#a78bfa', fontWeight: 700 }}>{Number(stats.avg).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    </>
                )}
                {stats.most_common && (
                    <div style={{ gridColumn: 'span 2', marginTop: '2px' }}>
                        <span style={styles.statLabel}>TOP VALUES</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '2px' }}>
                            {stats.most_common.slice(0, 3).map((v, i) => (
                                <span key={i} style={{ fontSize: '8px', padding: '1px 4px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', color: '#d1d5db' }}>
                                    {String(v.value).substring(0, 15)} ({v.count})
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function DistributionBar({ name, stats }) {
    const range = (stats.max || 0) - (stats.min || 0);
    const avgPos = range > 0 ? ((stats.avg - stats.min) / range) * 100 : 50;
    const medPos = range > 0 ? (((stats.median || stats.avg) - stats.min) / range) * 100 : 50;

    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px' }}>
                <span style={{ color: '#fff', fontWeight: 600, fontFamily: 'Share Tech Mono, monospace' }}>{name}</span>
                <span style={{ color: 'rgba(167,186,220,0.4)' }}>{Number(stats.min).toFixed(1)} — {Number(stats.max).toFixed(1)}</span>
            </div>
            <div style={{ height: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', position: 'relative', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.6 }} style={{ height: '100%', background: 'linear-gradient(90deg, rgba(99,102,241,0.15), rgba(99,102,241,0.35))', borderRadius: '4px' }} />
                <div style={{ position: 'absolute', left: `${avgPos}%`, top: 0, bottom: 0, width: '2px', background: '#818cf8', boxShadow: '0 0 6px #818cf8' }} />
                <div style={{ position: 'absolute', left: `${medPos}%`, top: 0, bottom: 0, width: '2px', background: '#22d3ee', opacity: 0.6 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', marginTop: '2px', color: 'rgba(167,186,220,0.35)' }}>
                <span>▪ AVG: {Number(stats.avg).toFixed(2)}</span>
                {stats.median !== undefined && <span>▪ MEDIAN: {Number(stats.median).toFixed(2)}</span>}
            </div>
        </div>
    );
}

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
    return (
        <div style={styles.tableWrap}>
            <table style={styles.table}>
                <thead>
                    <tr>
                        {columns?.slice(0, 6).map((col, i) => (
                            <th key={i} style={styles.th}>{col}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {records?.slice(0, 5).map((row, ri) => (
                        <tr key={ri}>
                            {columns?.slice(0, 6).map((col, ci) => (
                                <td key={ci} style={styles.td}>{String(row[col] ?? 'NULL').substring(0, 20)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── STYLES ─────────────────────────────────────────────────────

const styles = {
    container: {
        position: 'absolute', top: 0, right: 0, bottom: 0, width: '500px',
        background: 'rgba(5,8,22,0.92)', backdropFilter: 'blur(24px) saturate(1.4)',
        borderLeft: '1px solid rgba(129,140,248,0.15)',
        display: 'flex', flexDirection: 'column', zIndex: 300,
        fontFamily: '"Rajdhani", sans-serif',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        pointerEvents: 'auto',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    headerIcon: {
        width: '36px', height: '36px', borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
        border: '1px solid rgba(99,102,241,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8',
    },
    headerTitle: { fontSize: '16px', fontWeight: 900, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' },
    headerSub: { fontSize: '10px', color: 'rgba(167,186,220,0.5)', letterSpacing: '0.06em', marginTop: '1px' },
    closeBtn: {
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '6px', padding: '6px', cursor: 'pointer', color: '#f87171',
    },
    scrollArea: { flex: 1, overflowY: 'auto', padding: '0 20px 20px' },
    section: { marginTop: '16px' },
    sectionHead: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.04)',
    },
    sectionTitle: { fontSize: '9px', fontWeight: 900, letterSpacing: '0.2em', color: 'rgba(167,186,220,0.6)' },
    sectionSub: { fontSize: '9px', color: 'rgba(167,186,220,0.3)' },
    chartSwitcher: {
        display: 'flex', gap: '4px', marginBottom: '10px',
    },
    chartTab: {
        display: 'flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)', color: 'rgba(167,186,220,0.4)',
        fontSize: '8px', fontWeight: 700, letterSpacing: '0.1em',
        cursor: 'pointer', fontFamily: '"Rajdhani", sans-serif', transition: 'all 0.15s',
    },
    chartTabActive: {
        background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
        color: '#818cf8',
    },
    weeklyBanner: {
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '8px 0', marginBottom: '8px',
        background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.04)',
    },
    weekStat: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
    weekLabel: { fontSize: '7px', color: 'rgba(167,186,220,0.35)', letterSpacing: '0.12em' },
    columnScroll: { display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px' },
    colCard: {
        minWidth: '160px', maxWidth: '180px', flexShrink: 0,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '10px', padding: '10px 12px',
    },
    statLabel: { display: 'block', fontSize: '7px', color: 'rgba(167,186,220,0.35)', letterSpacing: '0.1em', marginBottom: '1px' },
    summaryBox: {
        marginTop: '16px', padding: '12px', borderRadius: '10px',
        background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)',
        display: 'flex', gap: '10px', alignItems: 'flex-start',
    },
    summaryText: { fontSize: '11px', color: 'rgba(200,210,240,0.7)', lineHeight: 1.5, margin: 0 },
    drillBtn: {
        width: '100%', marginTop: '14px', padding: '12px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
        border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px',
        color: '#c7d2fe', fontSize: '11px', fontWeight: 800, letterSpacing: '0.15em',
        cursor: 'pointer', fontFamily: '"Rajdhani", sans-serif', transition: 'all 0.2s',
    },
    loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '12px' },
    spinner: { width: '32px', height: '32px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#818cf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
    loadingText: { fontSize: '9px', color: 'rgba(129,140,248,0.5)', letterSpacing: '0.2em' },
    errorWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px' },
    tableWrap: { overflowX: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '9px', fontFamily: 'Share Tech Mono, monospace' },
    th: { textAlign: 'left', padding: '6px 8px', color: 'rgba(167,186,220,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap', fontSize: '8px', letterSpacing: '0.08em' },
    td: { padding: '5px 8px', color: '#d1d5db', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' },
    compareGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' },
    metricTableWrap: { marginTop: '12px', border: '1px solid rgba(129,140,248,0.1)', borderRadius: '10px', overflow: 'hidden', background: 'rgba(129,140,248,0.02)' },
    metricTable: { width: '100%', borderCollapse: 'collapse', fontSize: '10px' },
    metricTh: { padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid rgba(129,140,248,0.1)', color: 'rgba(167,186,220,0.6)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
    metricTd: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', color: '#fff', fontFamily: 'Share Tech Mono, monospace' },
};
