import React, {
    useState, useEffect, useMemo, useRef, useCallback,
} from 'react';
import { logger } from '../../utils/logger';
import { authFetch } from '../../utils/apiClient';
import { Canvas } from '@react-three/fiber';
import { 
    TABLE_COLORS,
    PK_VALUE_COLORS,
    CombinedInspectionScene,
    Level1Scene,
    fibonacciRing,
    PulsingNode
} from './MultiTable/ThreeMultiTableCore';
import SaveSelectionModal from './MultiTable/SaveSelectionModal';
import * as THREE from 'three';
import { withRBAC } from '../../hoc/withRBAC';

const METRIC_COLORS = [
    { color: '#16a34a', glow: '#4ade80' },   // green = revenue/money
    { color: '#0891b2', glow: '#22d3ee' },   // cyan = count
    { color: '#9333ea', glow: '#c084fc' },   // purple = qty
    { color: '#d97706', glow: '#fbbf24' },   // amber = avg
    { color: '#dc2626', glow: '#f87171' },   // red = misc
    { color: '#4f46e5', glow: '#818cf8' },
    { color: '#c026d3', glow: '#e879f9' },
    { color: '#059669', glow: '#34d399' },
];

function MultiTableInspector({ selectedTableNames, connectionId, allTables, onClose }) {
    const [level, setLevel] = useState(1);
    const [breadcrumb, setBreadcrumb] = useState([]);

    const [schemaData, setSchemaData] = useState(null);
    const [schemaLoading, setSchemaLoading] = useState(true);
    const [schemaError, setSchemaError] = useState(null);

    const [selectedTable, setSelectedTable] = useState(null);
    const [selectedTableColorIdx, setSelectedTableColorIdx] = useState(0);
    const [selectedRow, setSelectedRow] = useState(null);
    const [selectedRowColorIdx, setSelectedRowColorIdx] = useState(null);
    const [rowsData, setRowsData] = useState(null);
    const [rowsLoading, setRowsLoading] = useState(false);
    const [rowsOffset, setRowsOffset] = useState(0);
    const ROWS_LIMIT = 40;

    const [searchTerm, setSearchTerm] = useState('');

    const [savedSelections, setSavedSelections] = useState([]);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const searchTimer = useRef(null);

    const [rowDetailData, setRowDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Deep Selection Integration: Parse metrics from URL if present
    const [selectedMetrics, setSelectedMetrics] = useState(() => {
        const p = new URLSearchParams(window.location.search);
        const raw = p.get('metrics');
        if (!raw) return ['records'];
        
        // Parse "source:col1,col2|table1:colA,colB"
        const parts = raw.split('|');
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

    const [showRecordBrowser, setShowRecordBrowser] = useState(true);
    const [hoveredRow, setHoveredRow] = useState(null);
    const [multiSelectedRows, setMultiSelectedRows] = useState([]);

    const toggleRowSelection = useCallback((row) => {
        setMultiSelectedRows(prev => {
            const isSelected = prev.find(r => r.pk_val === row.pk_val);
            if (isSelected) {
                return prev.filter(r => r.pk_val !== row.pk_val);
            } else {
                return [...prev, row];
            }
        });
    }, []);

    const toggleMetric = useCallback((metric) => {
        setSelectedMetrics(prev => {
            if (prev.includes(metric)) {
                // Keep at least one metric if possible, or allow empty
                if (prev.length <= 1) return prev; 
                return prev.filter(m => m !== metric);
            } else {
                return [...prev, metric];
            }
        });
    }, []);

    useEffect(() => {
        if (!selectedTableNames?.length) {
            setSchemaError("No tables selected for inspection.");
            setSchemaLoading(false);
            return;
        }
        if (!connectionId) {
            setSchemaError("No active database connection identified.");
            setSchemaLoading(false);
            return;
        }

        setSchemaLoading(true);
        setSchemaError(null);
        const params = new URLSearchParams({ tables: selectedTableNames.join(',') });
        authFetch(`/api/multi-table/schema/${connectionId}?${params}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(d => {
                if (!d.tables || d.tables.length === 0) {
                    setSchemaError("No matching table schema found in the database. Verify that the selected tables still exist.");
                } else {
                    setSchemaData(d);
                }
                setSchemaLoading(false);
            })
            .catch(e => {
                console.error("MultiTable Schema Fetch Error:", e);
                setSchemaError(`Failed to fetch schema: ${String(e)}`);
                setSchemaLoading(false);
            });
    }, [selectedTableNames, connectionId]);

    const fetchRows = useCallback((tbl, search = '', offset = 0, append = false) => {
        if (!tbl || !connectionId) return;
        setRowsLoading(true);
        setRowsOffset(offset);

        const pkCol = tbl.columns?.find(c => c.is_pk)?.name || 'id';
        const incomingConnections = schemaData?.connections?.filter(c => c.to_table === tbl.name) || [];
        
        const params = new URLSearchParams({
            limit: ROWS_LIMIT,
            offset: offset,
            ...(search ? { search } : {}),
            pk_column: pkCol,
            linked_table: incomingConnections.map(c => c.from_table).join(','),
            fk_column: incomingConnections.map(c => c.from_column).join(','),
        });

        authFetch(`/api/multi-table/rows/${connectionId}/${encodeURIComponent(tbl.name)}?${params}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(d => { 
                if (append) {
                    setRowsData(prev => ({
                        ...d,
                        rows: [...(prev?.rows || []), ...(d.rows || [])],
                        total_shown: (prev?.total_shown || 0) + (d.total_shown || 0)
                    }));
                } else {
                    setRowsData(d);
                }
                setRowsLoading(false); 
            })
            .catch(e => {
                console.error("MultiTable Rows Fetch Error:", e);
                setRowsLoading(false);
                setDetailLoading(false); // Clear if this was part of an initial load
            });
    }, [connectionId, schemaData]);

    const loadSelections = useCallback(() => {
        if (!selectedTable || !connectionId) return;
        authFetch(`/api/selections/${connectionId}/${encodeURIComponent(selectedTable.name)}`)
            .then(r => r.ok ? r.json() : [])
            .then(setSavedSelections)
            .catch(err => console.error("Load selections failed:", err));
    }, [selectedTable, connectionId]);

    useEffect(() => {
        if (level === 2 && selectedTable) {
            loadSelections();
        }
    }, [level, selectedTable, loadSelections]);

    const handleSaveSelection = async (title) => {
        if (!selectedTable || !connectionId) return;
        const res = await authFetch(`/api/selections/${connectionId}/${encodeURIComponent(selectedTable.name)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                pks: multiSelectedRows.map(r => r.pk_val),
                pk_labels: multiSelectedRows.map(r => r.display_val || r.pk_val.toString()),
                metrics: selectedMetrics
            })
        });
        if (res.ok) {
            loadSelections();
        } else {
            throw new Error("Save failed");
        }
    };

    const handleLoadSelection = (sel) => {
        // Reconstruct records from saved state
        const restoredRecords = sel.pks.map((pk, idx) => ({
            pk_val: pk,
            display_val: sel.pk_labels?.[idx] || pk.toString()
        }));
        setMultiSelectedRows(restoredRecords);
        setSelectedMetrics(sel.metrics || ['records']);
        fetchDetail(restoredRecords, 'manual');
    };

    const handleDeleteSelection = async (selId) => {
        if (!selectedTable || !connectionId) return;
        const res = await authFetch(`/api/selections/${connectionId}/${encodeURIComponent(selectedTable.name)}/${selId}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            loadSelections();
        }
    };

    const loadMoreRows = useCallback(() => {
        if (!selectedTable || rowsLoading) return;
        const nextOffset = rowsOffset + ROWS_LIMIT;
        fetchRows(selectedTable, searchTerm, nextOffset, true);
    }, [selectedTable, rowsLoading, rowsOffset, searchTerm, fetchRows]);

    const [activeTargetTableName, setActiveTargetTableName] = useState(null);
    const [inspectionMode, setInspectionMode] = useState('auto'); // 'auto' | 'manual'

    const fetchDetail = useCallback((rowOrRows, mode = 'auto') => {
        if (!selectedTable || !connectionId) return;
        setDetailLoading(true);
        setInspectionMode(mode);
        const pkCol = selectedTable.columns?.find(c => c.is_pk)?.name || 'id';

        const allOtherTables = selectedTableNames.filter(n => n !== selectedTable.name);
        const fkLinked = schemaData?.connections
            ?.filter(c => c.to_table === selectedTable.name)
            .map(c => c.from_table) || [];
        const linkedTableNames = [...allOtherTables, ...fkLinked];

        const pkValues = Array.isArray(rowOrRows) 
            ? rowOrRows.map(r => r.pk_val).join(',') 
            : rowOrRows.pk_val;

        const params = new URLSearchParams({
            pk_column: pkCol,
            linked_tables: linkedTableNames.join(','),
        });

        authFetch(`/api/multi-table/row-detail/${connectionId}/${encodeURIComponent(selectedTable.name)}/${encodeURIComponent(pkValues)}?${params}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
                        .then(d => { 
                setRowDetailData(d); 
                setDetailLoading(false); 
                // Auto-select all columns for Total Impact View
                if (d.available_columns) {
                    setSelectedMetrics(d.available_columns);
                }
                // Initialize active target table for multi-focus ONLY if manual selection
                if (d.is_multi && mode === 'manual' && d.linked_tables?.length > 0) {
                    setActiveTargetTableName(d.linked_tables[0].uid || d.linked_tables[0].table);
                } else {
                    setActiveTargetTableName(null);
                }
            })
            .catch(e => {
                console.error("MultiTable Detail Fetch Error:", e);
                setDetailLoading(false);
            });
    }, [selectedTable, connectionId, schemaData, selectedTableNames]);

    const goToLevel2 = useCallback((tbl, colorIdx) => {
        setSelectedTable(tbl);
        setSelectedTableColorIdx(colorIdx);
        setLevel(2);
        setBreadcrumb(prev => [...prev, { level: 2, label: tbl.name }]);
        setMultiSelectedRows([]); // Reset selection
        setRowsOffset(0);
        
        // Auto-fetch rows and then detail for Total Impact view
        setDetailLoading(true);
        fetchRows(tbl, '', 0, false);
    }, [fetchRows]);

    // Effect to trigger fetchDetail when initial rows load from goToLevel2
    useEffect(() => {
        if (level === 2 && rowsData?.rows?.length > 0 && !rowDetailData && detailLoading && multiSelectedRows.length === 0) {
            fetchDetail(rowsData.rows);
        } else if (level === 2 && rowsData?.rows?.length === 0 && detailLoading) {
            // No rows to fetch detail for
            setDetailLoading(false);
        }
    }, [level, rowsData, rowDetailData, detailLoading, multiSelectedRows, fetchDetail]);

    const onSelectRow = useCallback((row, colorIdx) => {
        setSelectedRow(row);
        setSelectedRowColorIdx(colorIdx);
        setLevel(2);
        setBreadcrumb(prev => [...prev, { level: 3, label: row.label }]);
        setMultiSelectedRows([]); // Clear multi-selection for single drilldown
        fetchDetail(row, 'auto');
    }, [fetchDetail]);

    const goBack = useCallback(() => {
        if (level === 2) {
            // Going back from Table View to Galaxy Overview
            setLevel(1);
            setSelectedTable(null);
            setRowsData(null);
            setRowDetailData(null);
            setSearchTerm('');
            setBreadcrumb([]);
            setMultiSelectedRows([]);
            setDetailLoading(false);
            setRowsOffset(0);
        }
    }, [level]);

    // ── Search handler (debounced) ───────────────────────────────────────────
    const handleSearch = useCallback((val) => {
        setSearchTerm(val);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => {
            if (selectedTable) {
                setRowsOffset(0);
                fetchRows(selectedTable, val, 0, false);
            }
        }, 400);
    }, [selectedTable, fetchRows]);

    // ── Derived data ─────────────────────────────────────────────────────────
    const { color: headerColor, glow: headerGlow } = TABLE_COLORS[selectedTableColorIdx % TABLE_COLORS.length];

    const canvasBackground = 'hsl(220, 25%, 3%)';

    return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 4000 }}>

            {/* ── TOP NAV ── */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000,
                display: 'flex', alignItems: 'center', gap: 12,
                background: 'rgba(2, 6, 23, 0.98)', backdropFilter: 'blur(20px)',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                padding: '12px 16px',
            }}>
                {/* Back button */}
                {level > 1 && (
                    <button onClick={goBack} style={{
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#e2e8f0', borderRadius: 6, padding: '4px 10px',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
                        marginRight: 4,
                    }}>← Back</button>
                )}

                {/* Breadcrumb */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, overflow: 'hidden' }}>
                    <span style={{ fontSize: 9, color: '#444c56', fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', cursor: 'pointer', flexShrink: 0, transition: 'color 0.2s' }}
                        onMouseEnter={e => e.target.style.color = '#fbbf24'}
                        onMouseLeave={e => e.target.style.color = '#444c56'}
                        onClick={() => { setLevel(1); setBreadcrumb([]); setSelectedTable(null); setRowsData(null); onClose(); }}>
                        Galaxy
                    </span>
                    
                    <span style={{ color: '#334155', fontSize: 10, fontWeight: 900 }}>/</span>
                    <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
                        color: level === 1 ? '#fbbf24' : '#64748b',
                        cursor: level > 1 ? 'pointer' : 'default',
                        maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }} onClick={() => { if (level > 1) goBack(); }}>
                        {selectedTableNames.join(' + ')}
                    </span>

                    {level >= 2 && breadcrumb.find(b => b.level === 2) && (
                        <>
                            <span style={{ color: '#334155', fontSize: 10, fontWeight: 900 }}>/</span>
                            <span style={{
                                fontSize: 9, fontWeight: 800, letterSpacing: 1,
                                color: level === 2 ? headerGlow : '#64748b',
                                cursor: level > 1 ? 'pointer' : 'default',
                                maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }} onClick={() => { if (level > 1) goBack(); }}>
                                {breadcrumb.find(b => b.level === 2).label}
                            </span>
                        </>
                    )}

                    {level >= 3 && breadcrumb.find(b => b.level === 2) && (
                        <>
                            <span style={{ color: '#334155', fontSize: 10, fontWeight: 900 }}>/</span>
                            <span style={{
                                fontSize: 9, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase',
                                color: '#fbbf24',
                            }}>
                                Metrics
                            </span>
                        </>
                    )}
                </div>

                {/* Level indicator */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {[1, 2, 3].map(l => (
                        <div key={l} style={{
                            width: 20, height: 6, borderRadius: 3,
                            background: l === level ? '#fbbf24' : l < level ? '#334155' : 'rgba(255,255,255,0.05)',
                            transition: 'background 0.3s',
                        }} />
                    ))}
                </div>

                {/* Close */}
                <button onClick={onClose} style={{
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#94a3b8', borderRadius: 6, padding: '4px 10px',
                    fontSize: 10, fontWeight: 700, cursor: 'pointer', marginLeft: 4,
                }}>✕ Exit</button>
            </div>

            {/* ── SEARCH BAR (Level 2 only) ── */}
            {level === 2 && (
                <div style={{
                    position: 'absolute', top: 48, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 100, display: 'flex', gap: 6, alignItems: 'center',
                }}>
                    <input
                        type="text"
                        placeholder={`Search ${selectedTable?.name || 'rows'}…`}
                        value={searchTerm}
                        onChange={e => handleSearch(e.target.value)}
                        style={{
                            background: 'rgba(0,0,0,0.85)', border: `1px solid ${headerColor}50`,
                            color: '#e2e8f0', borderRadius: 8, padding: '5px 12px',
                            fontSize: 11, fontWeight: 600, width: 220,
                            outline: 'none', backdropFilter: 'blur(8px)',
                        }}
                    />
                    {rowsLoading && <div style={{ fontSize: 9, color: '#fbbf24', letterSpacing: 1 }}>● Loading…</div>}
                    {rowsData && <div style={{ fontSize: 9, color: '#22c55e', letterSpacing: 1 }}>● {rowsData.rows?.length} rows</div>}
                </div>
            )}

            {/* ── LEVEL 2: Legend ── */}
            {level === 2 && !rowsLoading && rowsData && (
                <div style={{
                    position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 100, display: 'flex', gap: 8, pointerEvents: 'none',
                }}>
                    <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid #1e293b', borderRadius: 8, padding: '5px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: '#64748b', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Table</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: headerColor }}>{selectedTable?.name}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid #1e293b', borderRadius: 8, padding: '5px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: '#64748b', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Showing</div>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{rowsData.rows?.length}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid #1e293b', borderRadius: 8, padding: '5px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: '#64748b', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Node Size</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>= activity %</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.9)', border: '#1e293b 1px solid', borderRadius: 8, padding: '5px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 8, color: '#64748b', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>Click row</div>
                        <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8' }}>to see metrics</div>
                    </div>
                </div>
            )}

            {/* ── LEVEL 3: Legend & Analysis Controls ── */}
            {level === 2 && rowDetailData && (
                <>
                    

                    <div style={{
                        position: 'absolute', bottom: 16, right: 16, zIndex: 100,
                        background: 'rgba(0,0,0,0.92)', border: '1px solid #1e293b',
                        borderRadius: 10, padding: '12px 16px', minWidth: 220,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}>
                        <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: '#fbbf24', textTransform: 'uppercase', marginBottom: 4 }}>
                            {rowDetailData.is_multi ? 'Aggregated Analysis' : 'Single Row Detail'}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>
                            {rowDetailData.is_multi ? `${rowDetailData.selection_count} Selected Records` : rowDetailData.row_data[rowDetailData.pk_column]}
                        </div>

                        {rowDetailData.is_multi && inspectionMode === 'manual' && rowDetailData.linked_tables?.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                                    Focus Target Table
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {rowDetailData.linked_tables.map(lt => {
                                        const uid = lt.uid || lt.table;
                                        return (
                                            <button
                                                key={uid}
                                                onClick={() => setActiveTargetTableName(uid)}
                                                style={{
                                                    background: lt.compliance_violation ? 'rgba(239,68,68,0.10)' : activeTargetTableName === uid ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                                                    border: `1px solid ${lt.compliance_violation ? '#ef444450' : activeTargetTableName === uid ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
                                                    borderRadius: 4, padding: '6px 8px', textAlign: 'left',
                                                    cursor: 'pointer', transition: 'all 0.2s',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                }}
                                            >
                                                <span style={{ fontSize: 10, fontWeight: 700, color: lt.compliance_violation ? '#fca5a5' : activeTargetTableName === uid ? '#fff' : '#94a3b8' }}>
                                                    {lt.compliance_violation ? '⚠ ' : ''}{lt.table} {lt.fk_column ? `(${lt.fk_column})` : ''}
                                                </span>
                                                {lt.compliance_violation && <span style={{ fontSize: 7, color: '#ef4444', fontWeight: 800 }}>PII</span>}
                                                {!lt.compliance_violation && activeTargetTableName === uid && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px #3b82f6' }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                            Distribution Metrics
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {METRIC_COLORS.slice(0, 3).map((mc, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, width: '100%' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: mc.color, boxShadow: `0 0 5px ${mc.glow}` }} />
                                    <span style={{ fontSize: 9, color: '#94a3b8' }}>
                                        {i === 0 ? 'High concentration' : i === 1 ? 'Moderate frequency' : 'Low activity'}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div style={{ borderTop: '1px solid #1e293b', marginTop: 6, paddingTop: 6, fontSize: 7, color: '#334155' }}>
                            Node scale = % share across tables
                        </div>
                    </div>
                </>
            )}

            {/* ── XAI Join Explanation + ESG Cost + RAI Violation Panel (Level 1) ── */}
            {level === 1 && schemaData?.connections?.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: 16, left: 16, zIndex: 100,
                    background: 'rgba(0,0,0,0.90)', border: '1px solid #1e293b',
                    borderRadius: 10, padding: '12px 16px', minWidth: 280, maxWidth: 360,
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}>
                    {/* XAI Join Explanation */}
                    <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.18em', color: '#60a5fa', textTransform: 'uppercase', marginBottom: 8 }}>
                        XAI · Join Conditions
                    </div>
                    <div style={{ maxHeight: 120, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                        {schemaData.connections.map((conn, i) => (
                            <div key={i} style={{
                                marginBottom: 6, padding: '4px 8px',
                                background: conn.compliance_violation ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)',
                                border: conn.compliance_violation ? '1px solid #ef444450' : '1px solid transparent',
                                borderRadius: 5, fontFamily: "'JetBrains Mono', monospace",
                            }}>
                                <div style={{ fontSize: 9, color: '#e2e8f0', fontWeight: 600 }}>
                                    <span style={{ color: '#60a5fa' }}>{conn.from_table}</span>
                                    <span style={{ color: '#475569' }}>.{conn.from_column}</span>
                                    <span style={{ color: '#fbbf24', margin: '0 4px' }}>→</span>
                                    <span style={{ color: '#22d3ee' }}>{conn.to_table}</span>
                                    <span style={{ color: '#475569' }}>.{conn.to_column}</span>
                                </div>
                                <div style={{ fontSize: 8, color: '#64748b', marginTop: 2 }}>
                                    INNER JOIN {conn.from_table} ON {conn.from_table}.{conn.from_column} = {conn.to_table}.{conn.to_column}
                                </div>
                                {conn.compliance_violation && (
                                    <div style={{ fontSize: 7, color: '#fca5a5', fontWeight: 800, marginTop: 2, letterSpacing: '0.1em' }}>
                                        RAI VIOLATION — Public ↔ PII data path
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* ESG Join Cost Estimator */}
                    <div style={{ borderTop: '1px solid #1e293b', marginTop: 8, paddingTop: 8 }}>
                        <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.18em', color: '#34d399', textTransform: 'uppercase', marginBottom: 4 }}>
                            ESG · Estimated Join Cost
                        </div>
                        {(() => {
                            const totalRows = schemaData.tables.reduce((s, t) => s + (t.row_count || 0), 0);
                            const joins = schemaData.connections.length;
                            const cpuMs = totalRows * joins * 0.005;
                            const energyWh = cpuMs / 3600000 * 250;
                            const co2 = energyWh * 0.4;
                            return (
                                <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.6 }}>
                                    <div>Tables: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{schemaData.tables.length}</span>
                                        <span style={{ color: '#475569', margin: '0 4px' }}>·</span>
                                        Joins: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{joins}</span>
                                        <span style={{ color: '#475569', margin: '0 4px' }}>·</span>
                                        Total rows: <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{totalRows.toLocaleString()}</span>
                                    </div>
                                    <div>Est. energy: <span style={{ color: '#4ade80', fontWeight: 700 }}>{energyWh.toFixed(4)} Wh</span>
                                        <span style={{ color: '#475569', margin: '0 4px' }}>·</span>
                                        Carbon: <span style={{ color: '#34d399', fontWeight: 700 }}>{co2.toFixed(4)} gCO₂e</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* RAI: Global compliance status */}
                    {schemaData.connections.some(c => c.compliance_violation) && (
                        <div style={{
                            marginTop: 8, background: 'rgba(239,68,68,0.12)',
                            border: '1px solid #ef444450', borderRadius: 6, padding: '6px 10px',
                        }}>
                            <div style={{ fontSize: 8, fontWeight: 800, color: '#fca5a5', letterSpacing: '0.12em' }}>
                                RAI COMPLIANCE WARNING
                            </div>
                            <div style={{ fontSize: 8, color: '#fca5a5', lineHeight: 1.5, marginTop: 2 }}>
                                One or more join paths connect public/external tables to PII datasets. Query execution may violate data governance policies.
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── LOADING / ERROR states ── */}
            {schemaLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, background: canvasBackground }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, color: '#fbbf24', fontWeight: 700, letterSpacing: 2 }}>ANALYZING TABLES…</div>
                        <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Detecting FK relationships</div>
                    </div>
                </div>
            )}
            {schemaError && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, background: canvasBackground }}>
                    <div style={{ textAlign: 'center', color: '#f87171', fontSize: 12 }}>Failed to load schema: {schemaError}</div>
                </div>
            )}
            {detailLoading && (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    zIndex: 101, background: 'rgba(0,0,0,0.85)', borderRadius: 10,
                    padding: '12px 24px', border: '1px solid #fbbf2440',
                }}>
                    <div style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, letterSpacing: 2 }}>LOADING METRICS…</div>
                </div>
            )}

            {/* ── 3D CANVAS ── */}
            {!schemaLoading && !schemaError && (
                <Canvas
                    camera={{ position: [0, 8, 55], fov: 50 }}
                    gl={{ antialias: true, alpha: false }}
                    style={{ background: canvasBackground, position: 'absolute', inset: 0, marginTop: 44 }}
                >
                    {level === 1 && schemaData && (
                        <Level1Scene
                            tables={schemaData.tables}
                            connections={schemaData.connections}
                            onSelectTable={goToLevel2}
                        />
                    )}

                    {level === 2 && rowDetailData && !detailLoading && (
                        <CombinedInspectionScene
                            rowDetailData={rowDetailData}
                            linkedTables={rowDetailData.linked_tables}
                            selectedMetrics={selectedMetrics}
                            tableColorIdx={selectedRowColorIdx !== null ? selectedRowColorIdx : selectedTableColorIdx}
                            focusedTargetTable={inspectionMode === 'manual' ? activeTargetTableName : null}
                            inspectionMode={inspectionMode}
                        />
                    )}
                </Canvas>
            )}

            {/* ── RECORD BROWSER SIDEBAR (Level 2) ── */}
            {level === 2 && rowDetailData && !detailLoading && (
                <>
                    {/* Re-open Trigger (Only visible when browser is closed) */}
                    {!showRecordBrowser && (
                        <button
                            onClick={() => setShowRecordBrowser(true)}
                            title="Open Record Browser"
                            style={{
                                position: 'absolute', right: 16, top: '50%',
                                transform: 'translateY(-50%)', zIndex: 1001,
                                width: 44, height: 44, borderRadius: '50%',
                                background: 'rgba(2, 6, 23, 0.8)', border: '1px solid #1e293b',
                                color: '#fbbf24', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                boxHover: '0 0 15px rgba(251, 191, 36, 0.3)',
                                backdropFilter: 'blur(10px)',
                            }}
                        >
                            <span style={{ fontSize: 20 }}>≣</span>
                        </button>
                    )}

                    {/* Sidebar Panel */}
                    <div style={{
                        position: 'absolute', right: showRecordBrowser ? 0 : -300, top: 44, bottom: 0,
                        width: 280, zIndex: 1000, background: 'rgba(2, 6, 23, 0.85)',
                        backdropFilter: 'blur(16px)', borderLeft: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', flexDirection: 'column', transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
                    }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: 2 }}>RECORD BROWSER</div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <div style={{ fontSize: 9, color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                                        {rowsData.rows?.length}
                                    </div>
                                    <button 
                                        onClick={() => setShowRecordBrowser(false)}
                                        style={{ 
                                            background: 'transparent', border: 'none', color: '#475569', 
                                            fontSize: 14, cursor: 'pointer', padding: '0 4px',
                                            transition: 'color 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.color = '#fff'}
                                        onMouseLeave={(e) => e.target.style.color = '#475569'}
                                    >✕</button>
                                </div>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 20 }}>
                                Inside {selectedTable?.name}
                            </div>
                        </div>

                        {/* SAVED GROUPS LIST */}
                        {savedSelections.length > 0 && (
                            <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ fontSize: 8, fontWeight: 800, color: '#475569', letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
                                    Saved Groups ({savedSelections.length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto', paddingRight: 4 }}>
                                    {savedSelections.map(sel => (
                                        <div key={sel.id} style={{ display: 'flex', gap: 4 }}>
                                            <button
                                                onClick={() => handleLoadSelection(sel)}
                                                style={{
                                                    flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: 4, padding: '4px 8px', textAlign: 'left',
                                                    cursor: 'pointer', transition: 'all 0.2s',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                }}
                                                onMouseEnter={e => e.target.style.background = 'rgba(251, 191, 36, 0.1)'}
                                                onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.03)'}
                                            >
                                                <span style={{ fontSize: 10, fontWeight: 600, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {sel.title}
                                                </span>
                                                <span style={{ fontSize: 8, color: '#64748b' }}>{sel.pks.length}</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteSelection(sel.id)}
                                                style={{ background: 'transparent', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 10, padding: '0 4px' }}
                                                onMouseEnter={e => e.target.style.color = '#ef4444'}
                                                onMouseLeave={e => e.target.style.color = '#334155'}
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Search in sidebar also */}
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)' }}>
                            <input
                                type="text"
                                placeholder="Filter list..."
                                value={searchTerm}
                                onChange={e => handleSearch(e.target.value)}
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 6, padding: '7px 10px', fontSize: 11, color: '#fff', outline: 'none',
                                }}
                            />
                        </div>

                        {/* SCROLLABLE LIST */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                            {rowsData.rows && rowsData.rows.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 11 }}>No matching records.</div>
                            ) : (
                                rowsData.rows?.map((row, i) => {
                                    const isSelected = multiSelectedRows.some(sr => sr.pk_val === row.pk_val);
                                    return (
                                        <div
                                            key={row.pk_val || i}
                                            onClick={() => onSelectRow(row, i)}
                                            style={{
                                                padding: '10px 16px', borderLeft: '3px solid transparent',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                background: hoveredRow === i ? 'rgba(255,255,255,0.05)' : isSelected ? 'rgba(251, 191, 36, 0.05)' : 'transparent',
                                                borderColor: hoveredRow === i ? TABLE_COLORS[selectedTableColorIdx % TABLE_COLORS.length].color : isSelected ? '#fbbf24' : 'transparent',
                                            }}
                                            onMouseEnter={() => setHoveredRow(i)}
                                            onMouseLeave={() => setHoveredRow(null)}
                                        >
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                {/* Checkbox */}
                                                <div 
                                                    onClick={(e) => { e.stopPropagation(); toggleRowSelection(row); }}
                                                    style={{
                                                        width: 14, height: 14, borderRadius: 3,
                                                        border: `1px solid ${isSelected ? '#fbbf24' : 'rgba(255,255,255,0.2)'}`,
                                                        background: isSelected ? '#fbbf24' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', flexShrink: 0,
                                                        boxShadow: isSelected ? '0 0 8px rgba(251, 191, 36, 0.4)' : 'none',
                                                    }}
                                                >
                                                    {isSelected && <span style={{ color: '#000', fontSize: 10, fontWeight: 900 }}>✓</span>}
                                                </div>

                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#fbbf24' : '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {row.display_val || `ID: ${row.pk_val}`}
                                                        </div>
                                                        <div style={{ fontSize: 9, color: '#64748b', fontFamily: 'monospace' }}>#{i + 1}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                                        <span style={{ fontSize: 8, color: '#475569', fontWeight: 700 }}>PK: {row.pk_val}</span>
                                                        {row.activity_pct !== undefined && (
                                                            <span style={{ fontSize: 8, color: '#94a3b8' }}>ACTIVITY: {row.activity_pct}%</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}

                            {/* Load More Button */}
                            {rowsData && rowsData.rows && rowsData.rows.length < (rowsData.total_count || 0) && (
                                <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                                    <button
                                        onClick={loadMoreRows}
                                        disabled={rowsLoading}
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${TABLE_COLORS[selectedTableColorIdx % TABLE_COLORS.length].color}40`,
                                            color: '#94a3b8',
                                            borderRadius: 6,
                                            padding: '6px 12px',
                                            fontSize: 10,
                                            fontWeight: 700,
                                            cursor: rowsLoading ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            width: '100%',
                                        }}
                                        onMouseEnter={e => { if(!rowsLoading) { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.color = '#fff'; } }}
                                        onMouseLeave={e => { if(!rowsLoading) { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#94a3b8'; } }}
                                    >
                                        {rowsLoading ? 'LOADING...' : `LOAD MORE (${(rowsData.total_count || 0) - rowsData.rows.length} REMAINING)`}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Footer info & Multi-action */}
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={() => window.open(`/column-refinement?tables=${selectedTableNames.join(',')}`, '_blank')}
                                    style={{
                                        flex: 1, background: 'transparent', border: '1px solid #3b82f6',
                                        borderRadius: 6, padding: '8px', color: '#60a5fa',
                                        fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                        letterSpacing: 0.5, transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => { e.target.style.background = 'rgba(59, 130, 246, 0.1)'; e.target.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#60a5fa'; }}
                                >
                                    DEEP ANALYSIS ↗
                                </button>
                                <button
                                    onClick={() => {
                                        if (!selectedTable) return;
                                        const metricsString = selectedMetrics.join('|');
                                        const pksString = rowDetailData?.pk_list?.join(',') || '';
                                        
                                        const params = new URLSearchParams({
                                            connectionId,
                                            table: selectedTable.name,
                                            links: selectedTableNames.join(','),
                                            pks: pksString,
                                            metrics: metricsString
                                        });
                                        window.open(`/deep-selection?${params.toString()}`, '_blank');
                                    }}
                                    style={{
                                        flex: 1, background: 'transparent', border: '1px solid #10b981',
                                        borderRadius: 6, padding: '8px', color: '#34d399',
                                        fontSize: 9, fontWeight: 800, cursor: 'pointer',
                                        letterSpacing: 0.5, transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => { e.target.style.background = 'rgba(16, 185, 129, 0.1)'; e.target.style.color = '#fff'; }}
                                    onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#34d399'; }}
                                >
                                    DEEP SELECTION ⚡
                                </button>
                            </div>
                            {/* RAI: Compliance violation banner */}
                            {schemaData?.connections?.some(c => c.compliance_violation) && (
                                <div style={{
                                    background: 'rgba(239,68,68,0.12)', border: '1px solid #ef444450',
                                    borderRadius: 6, padding: '5px 8px', marginBottom: 8,
                                }}>
                                    <div style={{ fontSize: 7, fontWeight: 800, color: '#fca5a5', letterSpacing: '0.1em' }}>
                                        RAI · QUERY BLOCKED
                                    </div>
                                    <div style={{ fontSize: 8, color: '#fca5a5', lineHeight: 1.4, marginTop: 2 }}>
                                        Join path crosses public → PII boundary. Resolve compliance violation before executing.
                                    </div>
                                </div>
                            )}
                            {multiSelectedRows.length > 0 ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={() => {
                                            if (schemaData?.connections?.some(c => c.compliance_violation)) return;
                                            fetchDetail(multiSelectedRows, 'manual');
                                        }}
                                        disabled={schemaData?.connections?.some(c => c.compliance_violation)}
                                        style={{
                                            flex: 1,
                                            background: schemaData?.connections?.some(c => c.compliance_violation) ? '#374151' : '#fbbf24',
                                            border: 'none',
                                            borderRadius: 6, padding: '8px',
                                            color: schemaData?.connections?.some(c => c.compliance_violation) ? '#6b7280' : '#000',
                                            fontSize: 10, fontWeight: 800,
                                            cursor: schemaData?.connections?.some(c => c.compliance_violation) ? 'not-allowed' : 'pointer',
                                            letterSpacing: 1,
                                            boxShadow: schemaData?.connections?.some(c => c.compliance_violation) ? 'none' : '0 0 15px rgba(251, 191, 36, 0.4)',
                                        }}
                                    >
                                        {schemaData?.connections?.some(c => c.compliance_violation) ? 'BLOCKED — COMPLIANCE' : `INSPECT ${multiSelectedRows.length} SELECTED`}
                                    </button>
                                    <button
                                        onClick={() => setIsSaveModalOpen(true)}
                                        title="Save current selection as bookmark"
                                        style={{
                                            width: 44, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(251, 191, 36, 0.3)',
                                            borderRadius: 6, padding: '8px', color: '#fbbf24', cursor: 'pointer',
                                            fontSize: 14, transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={e => { e.target.style.background = 'rgba(251, 191, 36, 0.1)'; e.target.style.borderColor = '#fbbf24'; }}
                                        onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.borderColor = 'rgba(251, 191, 36, 0.3)'; }}
                                    >
                                        💾
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        fetchDetail(rowsData?.rows || [], 'auto');
                                    }}
                                    style={{
                                        width: '100%', background: '#fbbf24', border: 'none',
                                        borderRadius: 6, padding: '8px', color: '#000',
                                        fontSize: 10, fontWeight: 800, cursor: 'pointer',
                                        letterSpacing: 1, boxShadow: '0 0 15px rgba(251, 191, 36, 0.4)',
                                    }}
                                >
                                    INSPECT ALL ROWS
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}

            <SaveSelectionModal
                isOpen={isSaveModalOpen}
                onClose={() => setIsSaveModalOpen(false)}
                onSave={handleSaveSelection}
                recordCount={multiSelectedRows.length}
                metricCount={selectedMetrics.length}
            />
        </div>
    );
}

export default withRBAC(MultiTableInspector, 'multi_schema', 'analyst');