import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, Text, Html, Grid, Billboard, Stars } from '@react-three/drei';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three-stdlib';
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip,
} from 'recharts';
import { authFetch } from '../../utils/apiClient';
import { Loader2 } from 'lucide-react';

// Same bloom pipeline the force-directed graph view uses (ThreeGraph.jsx), ported
// to react-three-fiber's render loop so bars glow instead of looking flat/matte.
function BloomEffect() {
    const { gl, scene, camera, size } = useThree();
    const composer = useMemo(() => {
        const c = new EffectComposer(gl);
        c.addPass(new RenderPass(scene, camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.7, 0.5, 0.2);
        c.addPass(bloom);
        return c;
    }, [gl, scene, camera]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { composer.setSize(size.width, size.height); }, [composer, size]);
    useFrame(() => { composer.render(); }, 1);
    return null;
}

const VIEW_MODES = [
    { id: 'chart', label: 'Chart' },
    { id: '3d', label: '3D' },
    { id: 'table', label: 'Table' },
];

const GRANULARITIES = ['day', 'week', 'month'];
const MAX_BAR_HEIGHT = 40;
// Every bar/row gets at least this much room, on both axes — so table rows
// and time columns never compress into unreadable hairlines no matter how
// many tables or time buckets there are. The plot footprint grows instead.
const MIN_SPACING = 7;
const MIN_EXTENT = 24; // floor so a 1-2 item axis doesn't look tiny/cramped
// A 3D bar has a physical minimum width to stay readable — cap how many time
// buckets get their own bar column; beyond this, buckets are merged (summed)
// into wider groups. The 2D chart/table views stay at full daily granularity.
const MAX_3D_TIME_BUCKETS = 14;
// Even after bucketing, don't try to print a tick label under every bar —
// cap how many are actually drawn so they don't overlap at oblique angles.
const MAX_TICK_LABELS = 6;
// Real schemas can have 50-100+ tables. No chart — 3D, line, or table — stays
// readable with that many series at once, so default to the busiest ones and
// let the user pick more explicitly via the table picker.
const DEFAULT_TABLE_COUNT = 8;
const PALETTE = ['#22d3ee', '#a855f7', '#fbbf24', '#34d399', '#f87171', '#60a5fa', '#f472b6', '#facc15'];

function subsample(list, max) {
    if (list.length <= max) return list;
    const step = Math.ceil(list.length / max);
    return list.filter((_, idx) => idx % step === 0);
}

function colorForTable(tableName, tables) {
    const idx = tables.indexOf(tableName);
    return PALETTE[idx % PALETTE.length];
}

function Bar({ x, z, width, depth, height, color, table, time, count, onHover, isHovered }) {
    return (
        <mesh
            position={[x, height / 2, z]}
            onPointerOver={(e) => { e.stopPropagation(); onHover({ table, time, count, x, z, height }); }}
            onPointerOut={() => onHover(null)}
        >
            <boxGeometry args={[width, Math.max(height, 0.05), depth]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isHovered ? 1.2 : 0.4} />
            {isHovered && (
                <Html position={[0, height / 2 + 1, 0]} center style={{ pointerEvents: 'none' }}>
                    <div className="px-3 py-2 bg-black/90 border border-white/20 rounded-lg text-xs text-white whitespace-nowrap shadow-xl">
                        <div className="font-bold" style={{ color }}>{table}</div>
                        <div className="text-gray-300">{time}</div>
                        <div className="text-gray-300">{count.toLocaleString()} records</div>
                    </div>
                </Html>
            )}
        </mesh>
    );
}

function AxisLabel({ position, text }) {
    return (
        <Text position={position} fontSize={1.2} color="#e2e8f0" anchorX="center">
            {text}
        </Text>
    );
}

// Tick labels always face the camera (Billboard) so they stay readable while orbiting.
function TickLabel({ position, text }) {
    const label = text.length > 14 ? text.slice(0, 13) + '…' : text;
    return (
        <Billboard position={position}>
            <Text fontSize={0.9} color="#94a3b8" anchorX="center" anchorY="middle">
                {label}
            </Text>
        </Billboard>
    );
}

/**
 * 3D bar view of entity (ID) creation counts over time, per table.
 * Default axes: X=table, Y=count, Z=time. Swap toggle exchanges X/Z (which
 * dimension runs left-right vs front-back) — Y always stays count/height,
 * since that's what "bar height" means in a bar chart.
 */
export default function TimeSeries3DView({ connectionId }) {
    const [granularity, setGranularity] = useState('day');
    const [swapAxes, setSwapAxes] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [hovered, setHovered] = useState(null);
    const [viewMode, setViewMode] = useState('chart');
    const [selectedTables, setSelectedTables] = useState(null);
    const [showTablePicker, setShowTablePicker] = useState(false);
    const [showSkipped, setShowSkipped] = useState(false);

    useEffect(() => {
        if (!connectionId) return;
        setLoading(true);
        setError(null);
        authFetch(`/api/analytics/time-series-3d/${connectionId}?granularity=${granularity}`)
            .then(res => {
                if (!res.ok) throw new Error(`Request failed (${res.status})`);
                return res.json();
            })
            .then(json => {
                setData(json);
                // Default the range pickers to the data's full span on first load per granularity
                setRangeStart(json.min_date || '');
                setRangeEnd(json.max_date || '');

                // Default to the busiest tables so the chart stays readable —
                // schemas with dozens of tables would otherwise render as noise.
                const totals = new Map();
                for (const p of json.points || []) {
                    totals.set(p.table_x, (totals.get(p.table_x) || 0) + p.count_y);
                }
                const topTables = [...totals.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, DEFAULT_TABLE_COUNT)
                    .map(([table]) => table);
                setSelectedTables(topTables);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [connectionId, granularity]);

    // All tables with data, ranked by activity — used by the table picker so
    // the user can add more than the default busiest ones.
    const { allTables, tableTotals } = useMemo(() => {
        const totals = new Map();
        for (const p of data?.points || []) {
            totals.set(p.table_x, (totals.get(p.table_x) || 0) + p.count_y);
        }
        const allTables = [...totals.keys()].sort((a, b) => totals.get(b) - totals.get(a));
        return { allTables, tableTotals: totals };
    }, [data]);

    const { bars, tables, times } = useMemo(() => {
        const allPoints = data?.points || [];
        const activeTables = selectedTables ? new Set(selectedTables) : null;
        const points = allPoints.filter(p =>
            (!rangeStart || p.time_z >= rangeStart) && (!rangeEnd || p.time_z <= rangeEnd) &&
            (!activeTables || activeTables.has(p.table_x))
        );
        const tables = [...new Set(points.map(p => p.table_x))].sort();
        const times = [...new Set(points.map(p => p.time_z))].sort();

        const bars = points.map(p => ({
            key: `${p.table_x}-${p.time_z}`,
            color: colorForTable(p.table_x, tables),
            table: p.table_x,
            time: p.time_z,
            count: p.count_y,
        }));

        return { bars, tables, times };
    }, [data, swapAxes, rangeStart, rangeEnd, selectedTables]);

    // Pivoted for Recharts: one row per time bucket, one column per table.
    const chartData = useMemo(() => {
        return times.map(t => {
            const row = { time: t };
            for (const bar of bars) {
                if (bar.time === t) row[bar.table] = bar.count;
            }
            return row;
        });
    }, [bars, times]);

    // 3D-specific layout: merge time buckets down to MAX_3D_TIME_BUCKETS groups
    // (summing counts), then give every table row and time column at least
    // MIN_SPACING — the plot footprint grows to fit rather than compressing
    // rows/columns into hairlines when there are many tables or buckets.
    const { bars3d, xTicks3d, zTicks3d, xExtent, zExtent } = useMemo(() => {
        if (times.length === 0) {
            return { bars3d: [], xTicks3d: [], zTicks3d: [], xExtent: MIN_EXTENT, zExtent: MIN_EXTENT };
        }

        const groupSize = Math.max(1, Math.ceil(times.length / MAX_3D_TIME_BUCKETS));
        const timeGroups = [];
        for (let i = 0; i < times.length; i += groupSize) {
            const slice = times.slice(i, i + groupSize);
            timeGroups.push({
                label: slice[0], // short tick label
                fullLabel: slice.length > 1 ? `${slice[0]} → ${slice[slice.length - 1]}` : slice[0],
                members: new Set(slice),
            });
        }
        const timeToGroupIdx = new Map();
        timeGroups.forEach((g, gi) => g.members.forEach(t => timeToGroupIdx.set(t, gi)));

        const summed = new Map(); // `${table}::${groupIdx}` -> count
        for (const b of bars) {
            const gi = timeToGroupIdx.get(b.time);
            const key = `${b.table}::${gi}`;
            summed.set(key, (summed.get(key) || 0) + b.count);
        }
        const maxCount = Math.max(1, ...summed.values());

        const xCategoryList = swapAxes ? timeGroups : tables.map(t => ({ label: t, fullLabel: t }));
        const zCategoryList = swapAxes ? tables.map(t => ({ label: t, fullLabel: t })) : timeGroups;
        const tableCount = xCategoryList.length;
        const timeCount = zCategoryList.length;
        const xExtent = Math.max(MIN_EXTENT, tableCount * MIN_SPACING);
        const zExtent = Math.max(MIN_EXTENT, timeCount * MIN_SPACING);
        const xSpacing = xExtent / Math.max(tableCount, 1);
        const zSpacing = zExtent / Math.max(timeCount, 1);
        const barWidth = Math.min(xSpacing, zSpacing) * 0.55;

        const bars3d = [];
        tables.forEach((table, tableIdx) => {
            timeGroups.forEach((group, groupIdx) => {
                const count = summed.get(`${table}::${groupIdx}`);
                if (!count) return;
                const xIdx = swapAxes ? groupIdx : tableIdx;
                const zIdx = swapAxes ? tableIdx : groupIdx;
                bars3d.push({
                    key: `${table}-${groupIdx}`,
                    x: (xIdx - tableCount / 2 + 0.5) * xSpacing,
                    z: (zIdx - timeCount / 2 + 0.5) * zSpacing,
                    width: barWidth,
                    depth: barWidth,
                    height: (count / maxCount) * MAX_BAR_HEIGHT,
                    color: colorForTable(table, tables),
                    table,
                    time: group.fullLabel,
                    count,
                });
            });
        });

        const xTicksAll = xCategoryList.map((c, idx) => ({
            label: c.label, pos: (idx - tableCount / 2 + 0.5) * xSpacing,
        }));
        const zTicksAll = zCategoryList.map((c, idx) => ({
            label: c.label, pos: (idx - timeCount / 2 + 0.5) * zSpacing,
        }));

        return {
            bars3d,
            xTicks3d: subsample(xTicksAll, MAX_TICK_LABELS),
            zTicks3d: subsample(zTicksAll, MAX_TICK_LABELS),
            xExtent,
            zExtent,
        };
    }, [bars, tables, times, swapAxes]);

    const planeSize = Math.max(xExtent, zExtent);

    return (
        <div className="w-full h-full flex bg-[#0a0e1a]">
            <div className="w-[340px] flex-shrink-0 h-full overflow-y-auto p-6 flex flex-col gap-3">
                <div className="p-4 bg-black/50 border border-white/10 rounded-xl backdrop-blur-md">
                    <h2 className="text-lg font-bold text-white mb-2">Time Series Analysis</h2>
                    <p className="text-xs text-gray-400 mb-1">
                        How many records were created per {granularity}, per table. Higher = more records.
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                        {data?.min_date && data?.max_date
                            ? `Data from ${data.min_date} to ${data.max_date}`
                            : 'ID creation counts by table over time'}
                    </p>
                    <div className="flex gap-2 mb-2">
                        {GRANULARITIES.map(g => (
                            <button
                                key={g}
                                onClick={() => setGranularity(g)}
                                aria-pressed={granularity === g}
                                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary-cyan)] ${
                                    granularity === g
                                        ? 'bg-[var(--primary-cyan)] text-black'
                                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 mb-2">
                        {VIEW_MODES.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setViewMode(m.id)}
                                aria-pressed={viewMode === m.id}
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary-cyan)] ${
                                    viewMode === m.id
                                        ? 'bg-[var(--primary-cyan)] text-black'
                                        : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    {viewMode === '3d' && (
                        <button
                            onClick={() => setSwapAxes(s => !s)}
                            className="px-3 py-1 rounded-md text-xs font-semibold bg-white/10 text-gray-300 hover:bg-white/20 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary-cyan)] mb-2"
                        >
                            Swap X/Z: {swapAxes ? 'Time / Table' : 'Table / Time'}
                        </button>
                    )}
                    {data?.min_date && data?.max_date && (
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                            <label htmlFor="ts3d-range-start" className="sr-only">Range start date</label>
                            <input
                                id="ts3d-range-start"
                                type="date"
                                value={rangeStart}
                                min={data.min_date}
                                max={rangeEnd || data.max_date}
                                onChange={e => setRangeStart(e.target.value)}
                                className="bg-white/10 border border-white/10 rounded-md px-2 py-1 text-white [color-scheme:dark] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary-cyan)]"
                            />
                            <span className="text-gray-500">→</span>
                            <label htmlFor="ts3d-range-end" className="sr-only">Range end date</label>
                            <input
                                id="ts3d-range-end"
                                type="date"
                                value={rangeEnd}
                                min={rangeStart || data.min_date}
                                max={data.max_date}
                                onChange={e => setRangeEnd(e.target.value)}
                                className="bg-white/10 border border-white/10 rounded-md px-2 py-1 text-white [color-scheme:dark] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary-cyan)]"
                            />
                        </div>
                    )}
                </div>

                {tables.length > 0 && (
                    <div className="p-4 bg-black/50 border border-white/10 rounded-xl backdrop-blur-md">
                        <div className="flex items-center justify-between mb-2 gap-3">
                            <p className="text-xs font-semibold text-white">
                                Tables shown ({tables.length} of {allTables.length})
                            </p>
                            {allTables.length > tables.length || allTables.length > DEFAULT_TABLE_COUNT ? (
                                <button
                                    onClick={() => setShowTablePicker(s => !s)}
                                    aria-pressed={showTablePicker}
                                    className="text-xs text-[var(--primary-cyan)] hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary-cyan)] rounded flex-shrink-0"
                                >
                                    {showTablePicker ? 'Done' : 'Change'}
                                </button>
                            ) : null}
                        </div>

                        {!showTablePicker && (
                            <div className="flex flex-col gap-1.5">
                                {tables.map(t => (
                                    <div key={t} className="flex items-center gap-2 text-xs text-gray-300">
                                        <span
                                            className="w-3 h-3 rounded-sm flex-shrink-0"
                                            style={{ backgroundColor: colorForTable(t, tables) }}
                                        />
                                        <span className="truncate">{t}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {showTablePicker && (
                            <>
                                <p className="text-[11px] text-gray-500 mb-2">
                                    Showing the busiest {DEFAULT_TABLE_COUNT} by default — pick specific tables below.
                                </p>
                                <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
                                    {allTables.map(t => {
                                        const checked = selectedTables?.includes(t);
                                        return (
                                            <label key={t} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white">
                                                <input
                                                    type="checkbox"
                                                    checked={!!checked}
                                                    onChange={() => {
                                                        setSelectedTables(prev => {
                                                            const set = new Set(prev || []);
                                                            if (set.has(t)) set.delete(t); else set.add(t);
                                                            return [...set];
                                                        });
                                                    }}
                                                    className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary-cyan)]"
                                                />
                                                <span className="truncate">{t}</span>
                                                <span className="text-gray-600 ml-auto flex-shrink-0">{(tableTotals.get(t) || 0).toLocaleString()}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {data?.skipped_tables?.length > 0 && (
                    <div className="p-3 bg-black/50 border border-yellow-500/30 rounded-xl backdrop-blur-md text-xs text-yellow-300">
                        <button
                            onClick={() => setShowSkipped(s => !s)}
                            aria-pressed={showSkipped}
                            className="w-full text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded flex items-center justify-between gap-2"
                        >
                            <span>{data.skipped_tables.length} tables have no date column</span>
                            <span className="flex-shrink-0">{showSkipped ? '▲' : '▼'}</span>
                        </button>
                        {showSkipped && (
                            <p className="mt-2 max-h-32 overflow-y-auto text-yellow-300/80">
                                {data.skipped_tables.join(', ')}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 h-full relative overflow-hidden">
            {!loading && !error && viewMode === '3d' && bars3d.length > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-black/50 border border-white/10 rounded-full backdrop-blur-md text-xs text-gray-300 pointer-events-none">
                    Drag to rotate • Scroll to zoom • Hover a bar for details
                </div>
            )}

            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <Loader2 className="animate-spin text-[var(--primary-cyan)]" size={32} />
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10 text-red-400 text-sm">
                    {error}
                </div>
            )}
            {!loading && !error && bars.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center z-10 text-gray-400 text-sm">
                    No date-based data found across tables for this connection.
                </div>
            )}

            {viewMode === 'table' && (
                <div className="w-full h-full overflow-auto p-6">
                    <table className="w-full max-w-3xl mx-auto text-sm text-left border-collapse">
                        <caption className="sr-only">ID creation counts by table and {granularity}</caption>
                        <thead>
                            <tr className="border-b border-white/20 text-gray-400">
                                <th scope="col" className="py-2 pr-4">Table</th>
                                <th scope="col" className="py-2 pr-4">Date</th>
                                <th scope="col" className="py-2 pr-4">Records</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...bars]
                                .sort((a, b) => a.time.localeCompare(b.time) || a.table.localeCompare(b.table))
                                .map(bar => (
                                    <tr key={bar.key} className="border-b border-white/5 text-gray-200">
                                        <td className="py-2 pr-4">
                                            <span className="inline-flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: bar.color }} />
                                                {bar.table}
                                            </span>
                                        </td>
                                        <td className="py-2 pr-4 text-gray-400">{bar.time}</td>
                                        <td className="py-2 pr-4">{bar.count.toLocaleString()}</td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            )}

            {viewMode === 'chart' && !loading && !error && bars.length > 0 && (
                <div className="w-full h-full overflow-y-auto p-6">
                    <p className="text-xs text-gray-500 mb-3 max-w-3xl">
                        Each table gets its own scale — tables with far fewer records would
                        otherwise look flat next to busier ones on a shared axis.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl">
                        {tables.map(t => (
                            <div key={t} className="bg-black/40 border border-white/10 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-gray-200">
                                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colorForTable(t, tables) }} />
                                    <span className="truncate">{t}</span>
                                </div>
                                <div className="h-36">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                            <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 9 }} tickFormatter={v => v?.slice(5)} minTickGap={30} />
                                            <YAxis stroke="#64748b" tick={{ fontSize: 9 }} allowDecimals={false} width={32} />
                                            <Tooltip
                                                contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12 }}
                                                labelStyle={{ color: '#fff' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey={t}
                                                stroke={colorForTable(t, tables)}
                                                strokeWidth={2}
                                                dot={false}
                                                connectNulls
                                                isAnimationActive={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {viewMode === '3d' && (
                <Canvas>
                    {/* Orthographic (not perspective) camera: no distance distortion, so every
                        bar and row reads the same size regardless of depth — the standard
                        approach for GitHub-Skyline-style 3D grid/bar charts. */}
                    <OrthographicCamera
                        makeDefault
                        position={[planeSize * 1.2, planeSize * 1.4, planeSize * 1.2]}
                        zoom={420 / planeSize}
                        near={0.1}
                        far={2000}
                    />
                    <ambientLight intensity={0.7} />
                    <directionalLight position={[20, 40, 20]} intensity={0.9} />
                    <directionalLight position={[-20, 20, -20]} intensity={0.3} />
                    <OrbitControls enableDamping dampingFactor={0.1} target={[0, MAX_BAR_HEIGHT / 4, 0]} maxPolarAngle={Math.PI / 2.05} />
                    <Stars radius={planeSize * 4} depth={planeSize} count={3000} factor={2} fade speed={0.3} />
                    <BloomEffect />

                    {/* Floor grid anchors the bars in a coordinate system instead of floating in space */}
                    <Grid
                        args={[xExtent * 1.3, zExtent * 1.3]}
                        cellColor="#1e293b"
                        sectionColor="#334155"
                        cellSize={planeSize / 14}
                        sectionSize={planeSize / 3.5}
                        fadeDistance={planeSize * 3}
                        followCamera={false}
                    />

                    {bars3d.map(bar => (
                        <Bar
                            key={bar.key}
                            x={bar.x}
                            z={bar.z}
                            width={bar.width}
                            depth={bar.depth}
                            height={bar.height}
                            color={bar.color}
                            table={bar.table}
                            time={bar.time}
                            count={bar.count}
                            onHover={setHovered}
                            isHovered={hovered?.table === bar.table && hovered?.time === bar.time}
                        />
                    ))}

                    {xTicks3d.map(tick => (
                        <TickLabel key={`x-${tick.label}`} position={[tick.pos, 0.2, zExtent / 2 + 3]} text={tick.label} />
                    ))}
                    {zTicks3d.map(tick => (
                        <TickLabel key={`z-${tick.label}`} position={[-(xExtent / 2 + 3), 0.2, tick.pos]} text={tick.label} />
                    ))}

                    <AxisLabel position={[0, -5, zExtent / 2 + 9]} text={swapAxes ? 'Table' : 'Time'} />
                    <AxisLabel position={[-(xExtent / 2 + 9), -5, 0]} text={swapAxes ? 'Time' : 'Table'} />
                    <Billboard position={[-(xExtent / 2 + 3), MAX_BAR_HEIGHT + 3, zExtent / 2 + 3]}>
                        <Text fontSize={1.2} color="#e2e8f0" anchorX="center">Records (bar height)</Text>
                    </Billboard>
                </Canvas>
            )}
            </div>
        </div>
    );
}
