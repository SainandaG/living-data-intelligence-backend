import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import {
    Database,
    Table as TableIcon,
    CheckCircle2,
    ArrowLeft,
    Zap,
    Search,
    Filter,
    Layers,
    Activity,
    Maximize2,
    Box
} from 'lucide-react';
import apiClient from '../../utils/apiClient';
import {
    TABLE_COLORS,
    CombinedInspectionScene
} from './MultiTable/ThreeMultiTableCore';

/**
 * DeepSelectionPage.jsx
 * 
 * Standalone page for picking specific columns/metrics from multiple tables.
 * Features a real-time 3D preview of the satellite distribution.
 */

const CYAN = '#0de7f2';
const EMERALD = '#10b981';
const SLATE = '#64748b';

export default function DeepSelectionPage() {
    const [loading, setLoading] = useState(true);
    const [schema, setSchema] = useState(null);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    // ─── 1. Query Params ──────────────────────────────────────────────────
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const connectionId = params.get('connectionId');
    const sourceTable = params.get('table');
    const linkedTables = useMemo(() => (params.get('links') || '').split(',').filter(Boolean), [params]);
    const pksString = params.get('pks') || '';
    const initialMetricsString = params.get('metrics') || 'records';

    // ─── 2. Selection & Data State ─────────────────────────────────────────
    const [rowDetailData, setRowDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // selectedMetrics is an array of strings: "source > col" or "tableName > col"
    const [selectedMetrics, setSelectedMetrics] = useState(() => {
        if (!initialMetricsString) return ['records'];
        const parts = initialMetricsString.split('|');
        const formatted = [];
        parts.forEach(part => {
            if (!part.includes(':')) {
                formatted.push(part);
                return;
            }
            const [grp, colsRaw] = part.split(':');
            const cols = colsRaw.split(',');
            cols.forEach(col => {
                const prefix = grp === 'source' ? 'source' : grp;
                formatted.push(`${prefix} > ${col}`);
            });
        });
        return formatted.length > 0 ? formatted : ['records'];
    });

    // ─── 3. Life Cycle: Fetch Schema & Detail ────────────────────────────────
    useEffect(() => {
        if (!connectionId) {
            setError("Missing connectionId parameter.");
            setLoading(false);
            return;
        }

        const fetchFullState = async () => {
            try {
                setLoading(true);
                // Fetch Schema
                const schemaRes = await apiClient.get(`/schema/${connectionId}`);
                setSchema(schemaRes);

                // Fetch Row Detail (Statistical Breakdown)
                if (sourceTable && pksString) {
                    setDetailLoading(true);

                    // We need to find the PK column name from schema for the source table
                    const tblDef = schemaRes.tables?.find(t => t.name === sourceTable);
                    const pkCol = tblDef?.columns?.find(c => c.is_pk)?.name || 'id';

                    // Linked tables logic (same as inspector)
                    const allOtherTables = linkedTables.filter(n => n !== sourceTable);
                    // Add any tables that have FKs TO the source table
                    const fkLinked = schemaRes.connections
                        ?.filter(c => c.to_table === sourceTable)
                        .map(c => c.from_table) || [];
                    const linkedTableNames = [...allOtherTables, ...fkLinked];

                    const detailParams = new URLSearchParams({
                        pk_column: pkCol,
                        linked_tables: linkedTableNames.join(','),
                    });

                    const detailRes = await fetch(`/api/multi-table/row-detail/${connectionId}/${encodeURIComponent(sourceTable)}/${encodeURIComponent(pksString)}?${detailParams}`);
                    if (detailRes.ok) {
                        const detailData = await detailRes.json();
                        setRowDetailData(detailData);
                    }
                }

                setLoading(false);
                setDetailLoading(false);
            } catch (err) {
                console.error("Failed to fetch page data:", err);
                setError("Failed to initialize inspection context.");
                setLoading(false);
                setDetailLoading(false);
            }
        };

        fetchFullState();
    }, [connectionId, sourceTable, pksString, linkedTables]);

    // ─── 4. Helper Logic ────────────────────────────────────────────────────
    const filteredTables = useMemo(() => {
        if (!schema) return [];
        return schema.tables.filter(t =>
            t.name === sourceTable || linkedTables.includes(t.name)
        );
    }, [schema, sourceTable, linkedTables]);

    const sourceTableData = useMemo(() =>
        filteredTables.find(t => t.name === sourceTable),
        [filteredTables, sourceTable]);

    const linkedTablesData = useMemo(() =>
        filteredTables.filter(t => linkedTables.includes(t.name)),
        [filteredTables, linkedTables]);

    const toggleColumn = useCallback((tableName, colName) => {
        const metricId = `${tableName} > ${colName}`;
        setSelectedMetrics(prev => {
            if (prev.includes(metricId)) {
                return prev.filter(m => m !== metricId);
            } else {
                return [...prev, metricId];
            }
        });
    }, []);

    const handleApply = () => {
        const backParams = new URLSearchParams();
        // Return back with the selection
        backParams.set('connectionId', connectionId);
        backParams.set('table', sourceTable);
        backParams.set('links', linkedTables.join(','));

        // Compact metric format: source:col1,col2|table1:colA,colB
        const grouped = {};
        selectedMetrics.forEach(m => {
            if (m === 'records') return;
            const [grp, col] = m.split(' > ');
            if (!grouped[grp]) grouped[grp] = [];
            grouped[grp].push(col);
        });

        const metricString = Object.entries(grouped)
            .map(([grp, cols]) => `${grp}:${cols.join(',')}`)
            .join('|');

        if (metricString) backParams.set('metrics', metricString);

        // Go back to the multi-table view
        window.location.href = `/?view=multi&${backParams.toString()}`;
    };

    if (loading) return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 relative">
                <div className="absolute inset-0 border-4 border-emerald-500/10 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-emerald-500 rounded-full animate-spin" />
            </div>
            <div className="flex flex-col items-center">
                <p className="text-emerald-500 font-mono text-xs uppercase tracking-[0.3em] font-black">Syncing Satellites</p>
                <p className="text-slate-600 text-[10px] mt-2 italic">Building multi-table projection...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-8">
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-6">
                <p className="text-rose-400 font-bold">{error}</p>
            </div>
            <button onClick={() => window.history.back()} className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Go Back</button>
        </div>
    );

    return (
        <div className="h-screen bg-[#020617] text-white flex flex-col font-sans selection:bg-emerald-500/30 overflow-hidden">
            {/* ─── Header ────────────────────────────────────────────────────── */}
            <header className="px-8 py-4 border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-[100] flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button
                        onClick={handleApply}
                        className="group flex items-center gap-3 pr-6 border-r border-white/10 hover:text-emerald-400 transition-all font-black text-xs uppercase tracking-widest"
                    >
                        <div className="p-2.5 bg-white/5 group-hover:bg-emerald-500/10 rounded-2xl transition-all border border-transparent group-hover:border-emerald-500/20">
                            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                        </div>
                        <span>Finish & Sync</span>
                    </button>
                    <div>
                        <div className="flex items-center gap-3 mb-0.5">
                            <h1 className="text-xl font-black tracking-tight">Deep Selection</h1>
                            <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                <CheckCircle2 size={10} className="text-emerald-400" />
                                <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">Selections Synced</span>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium italic">Refine metric distributions with live 3D preview</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex flex-col items-end border-white/10">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black mb-1 font-mono tracking-tighter">Live Session Buffering</span>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-xs font-mono text-emerald-300 font-black uppercase">Source: {sourceTable}</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* ─── SIDEBAR: Selection ─────────────────────────────────────── */}
                <aside className="w-[420px] bg-[#020617] border-r border-white/5 flex flex-col z-50">
                    <div className="p-6 space-y-6">
                        {/* Search Bar */}
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-400 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search metrics..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-white/3 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-xs font-semibold focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/5 transition-all placeholder:text-slate-600"
                            />
                        </div>

                        {/* Summary Card */}
                        <div className="p-4 bg-gradient-to-br from-white/5 to-transparent border border-white/10 rounded-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Cluster Summary</span>
                                <Layers size={14} className="text-slate-600" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Selected PKs</p>
                                    <p className="text-lg font-black text-white">{pksString.split(',').length}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] text-slate-500 uppercase font-black tracking-tighter">Active Metrics</p>
                                    <p className="text-lg font-black text-emerald-400">{selectedMetrics.filter(m => m !== 'records').length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8 custom-scrollbar">
                        {/* Source Table Section */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between sticky top-0 bg-[#020617] py-2 z-10">
                                <div className="flex items-center gap-2">
                                    <Box size={14} className="text-cyan-400" />
                                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400/80">Source Table</h2>
                                </div>
                                <span className="text-[9px] font-black text-slate-600 font-mono tracking-tighter">{sourceTable}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {sourceTableData?.columns
                                    .filter(c => !c.is_pk && c.name.toLowerCase().includes(search.toLowerCase()))
                                    .map(col => (
                                        <ColumnToggle
                                            key={col.name}
                                            col={col}
                                            isSelected={selectedMetrics.includes(`source > ${col.name}`)}
                                            onToggle={() => toggleColumn('source', col.name)}
                                            accentColor="cyan"
                                        />
                                    ))
                                }
                            </div>
                        </section>

                        {/* Linked Tables Section */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-2 sticky top-0 bg-[#020617] py-2 z-10">
                                <Activity size={14} className="text-emerald-400" />
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/80">Linked Entities</h2>
                            </div>

                            {linkedTablesData.map(tbl => (
                                <div key={tbl.name} className="space-y-3 p-4 bg-white/2 border border-white/5 rounded-2xl">
                                    <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <TableIcon size={12} className="text-slate-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">{tbl.name}</span>
                                        </div>
                                        <span className="text-[8px] font-bold text-slate-600">TABLE</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1.5">
                                        {tbl.columns
                                            .filter(c => !c.is_pk && c.name.toLowerCase().includes(search.toLowerCase()))
                                            .map(col => (
                                                <ColumnToggle
                                                    key={col.name}
                                                    col={col}
                                                    isSelected={selectedMetrics.includes(`${tbl.name} > ${col.name}`)}
                                                    onToggle={() => toggleColumn(tbl.name, col.name)}
                                                    accentColor="emerald"
                                                />
                                            ))
                                        }
                                    </div>
                                </div>
                            ))}
                        </section>
                    </div>
                </aside>

                {/* ─── MAIN PANE: 3D Visualization ───────────────────────────── */}
                <main className="flex-1 relative bg-black">
                    {detailLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/60 backdrop-blur-sm">
                            <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Calculating Projections...</p>
                        </div>
                    ) : (
                        !rowDetailData && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                                <p className="text-slate-500 text-xs font-medium italic">No rows selected for 3D inspection</p>
                            </div>
                        )
                    )}

                    {/* 3D Canvas Container */}
                    <div className="absolute inset-0">
                        <Canvas
                            camera={{ position: [0, 8, 55], fov: 50 }}
                            gl={{ antialias: true, alpha: false }}
                            onCreated={({ gl }) => {
                                gl.setClearColor('#000002');
                            }}
                        >
                            {rowDetailData && (
                                <CombinedInspectionScene
                                    rowDetailData={rowDetailData}
                                    linkedTables={rowDetailData.linked_tables || []}
                                    selectedMetrics={selectedMetrics}
                                    tableColorIdx={0}
                                />
                            )}
                        </Canvas>
                    </div>

                    {/* Canvas Overlay Controls */}
                    <div className="absolute bottom-6 left-6 flex gap-3 z-30">
                        <div className="px-4 py-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">X-RAY Mode</span>
                                <span className="text-[10px] font-bold text-emerald-400">Aggregated Metrics</span>
                            </div>
                            <div className="h-6 w-[1px] bg-white/10" />
                            <div className="flex flex-col">
                                <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Nodes Found</span>
                                <span className="text-[10px] font-bold text-white">{rowDetailData?.pk_list?.length || 0}</span>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
            `}</style>
        </div>
    );
}

function ColumnToggle({ col, isSelected, onToggle, accentColor }) {
    const isNumeric = col.type?.toLowerCase().includes('int') ||
        col.type?.toLowerCase().includes('float') ||
        col.type?.toLowerCase().includes('double') ||
        col.type?.toLowerCase().includes('numeric') ||
        col.type?.toLowerCase().includes('decimal');

    const themeColor = accentColor === 'emerald' ? '#10b981' : '#0ea5e9';

    return (
        <button
            onClick={onToggle}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all group overflow-hidden relative ${isSelected
                    ? `bg-white/[0.04] border border-${accentColor}-500/20`
                    : 'bg-transparent border border-transparent hover:bg-white/[0.03] hover:border-white/5'
                }`}
        >
            {isSelected && (
                <div
                    className="absolute left-0 top-0 bottom-0 w-[2px]"
                    style={{ backgroundColor: themeColor, boxShadow: `0 0 10px ${themeColor}` }}
                />
            )}

            <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-transparent text-white' : 'bg-white/5 text-slate-600 group-hover:bg-white/10'
                    }`} style={isSelected ? { color: themeColor } : {}}>
                    {isSelected ? <CheckCircle2 size={14} /> : <Filter size={12} />}
                </div>
                <div className="text-left">
                    <p className={`text-xs font-bold transition-colors ${isSelected ? 'text-white' : 'text-slate-400'}`}>{col.name}</p>
                    <div className="flex items-center gap-2">
                        <p className="text-[9px] text-slate-600 font-mono uppercase tracking-tighter">{col.type}</p>
                        {isNumeric && <span className="w-1 h-1 rounded-full bg-emerald-500/30" />}
                    </div>
                </div>
            </div>

            <div className={`text-[8px] font-black uppercase tracking-[0.2em] transition-all transform ${isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`} style={{ color: themeColor }}>
                Projected
            </div>
        </button>
    );
}

