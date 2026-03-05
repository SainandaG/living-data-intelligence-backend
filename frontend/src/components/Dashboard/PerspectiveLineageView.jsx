import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, GitBranch, Database, Zap, Activity, BarChart3, ArrowRight, Layers, Clock, AlertTriangle, Pin, PinOff, X } from 'lucide-react';
import './PerspectiveLineageView.css';
import DataLensPanel from './Controls/DataLensPanel';
import NodeSelectorPanel from './Controls/NodeSelectorPanel';
import NodeXRayPanel from './NodeXRayPanel';

const PerspectiveLineageView = ({
    multiSelectedNodes = [],
    setMultiSelectedNodes,
    showMultiConnections,
    setShowMultiConnections,
    graphData = {},
    insightPerspective = 'analyst',
    activeFilters = {},
    onFilterChange,
    setInsightPerspective,
    connectionId,
    pinnedNodes = new Set(),
    setPinnedNodes,
    pinnedCols = new Set(),
    setPinnedCols,
    columnAliases = {},
    setColumnAliases
}) => {
    const containerRef = React.useRef(null);
    const [portPositions, setPortPositions] = React.useState({});
    const [hoveredCol, setHoveredCol] = React.useState(null);
    const [impactPaths, setImpactPaths] = React.useState(new Set());
    const [impactIntensity, setImpactIntensity] = React.useState({}); // { key: intensity 0-1 }
    const [activeInsight, setActiveInsight] = React.useState(null);
    const [simulationSource, setSimulationSource] = React.useState(null); // { id: string, type: 'table'|'column' }
    const [xrayNode, setXrayNode] = React.useState(null);

    const selectedNodes = React.useMemo(() => {
        if (!graphData.nodes) return [];
        const combinedSet = new Set([
            ...(multiSelectedNodes || []).map(n => typeof n === 'string' ? n : n.id),
            ...Array.from(pinnedNodes)
        ]);
        return graphData.nodes.filter(n => combinedSet.has(n.id));
    }, [graphData.nodes, multiSelectedNodes, pinnedNodes]);

    const multiSelectedIds = React.useMemo(() => {
        const ids = (multiSelectedNodes || []).map(n => typeof n === 'string' ? n : n.id);
        pinnedNodes.forEach(id => {
            if (!ids.includes(id)) ids.push(id);
        });
        return ids;
    }, [multiSelectedNodes, pinnedNodes]);

    const updatePositions = React.useCallback(() => {
        const newPositions = {};
        selectedNodes.forEach(node => {
            const tableEl = document.getElementById(`card-${node.id}`);
            if (!tableEl || !containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            const colRows = tableEl.querySelectorAll('.column-row');
            colRows.forEach(row => {
                const colName = row.getAttribute('data-col');
                const leftPort = row.querySelector('.port.left');
                const rightPort = row.querySelector('.port.right');

                if (leftPort && rightPort) {
                    const lRect = leftPort.getBoundingClientRect();
                    const rRect = rightPort.getBoundingClientRect();

                    newPositions[`${node.id}-${colName}`] = {
                        left: { x: lRect.left - containerRect.left + 4, y: lRect.top - containerRect.top + 4 },
                        right: { x: rRect.left - containerRect.left + 4, y: rRect.top - containerRect.top + 4 }
                    };
                }
            });
        });
        setPortPositions(newPositions);
    }, [selectedNodes]);

    React.useEffect(() => {
        const timeoutId = setTimeout(updatePositions, 800);
        window.addEventListener('resize', updatePositions);
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updatePositions);
        };
    }, [updatePositions]);

    const columnEdges = React.useMemo(() => {
        if (!graphData.edges) return [];
        const selectedSet = new Set(multiSelectedIds);

        return graphData.edges
            .filter(e => selectedSet.has(e.source) && selectedSet.has(e.target))
            .map(e => {
                const velocity = Math.random() * 80 + 20;
                const flowSpeed = (1 / (velocity / 50)).toFixed(2) + 's';
                return {
                    ...e,
                    sourceCol: e.column || 'id',
                    targetCol: 'id',
                    timing: `${Math.floor(Math.random() * 59) + 1}m ago`,
                    velocity,
                    flowSpeed,
                    tranche: `TR-${Math.floor(Math.random() * 900) + 100}`,
                    last_tx_time: new Date(Date.now() - Math.random() * 1000000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                };
            });
    }, [graphData.edges, multiSelectedIds]);

    React.useEffect(() => {
        if (!hoveredCol && pinnedCols.size === 0 && !simulationSource) {
            setImpactPaths(new Set());
            setImpactIntensity({});
            return;
        }

        const paths = new Set();
        const intensities = {};
        const startPoints = [];

        if (simulationSource) {
            const key = simulationSource.id;
            startPoints.push({ key, intensity: 1.0 });
        } else {
            if (hoveredCol) startPoints.push({ key: `${hoveredCol.tableId}-${hoveredCol.colName}`, intensity: 0.8 });
            pinnedCols.forEach(p => startPoints.push({ key: p, intensity: 0.8 }));
        }

        const queue = [...startPoints];
        startPoints.forEach(p => {
            paths.add(p.key);
            intensities[p.key] = p.intensity;
        });

        let qIndex = 0;
        while (qIndex < queue.length) {
            const { key: current, intensity } = queue[qIndex++];
            const [tId, cName] = current.split('-');
            if (!tId) continue;

            columnEdges.forEach(edge => {
                if (edge.source === tId && (edge.sourceCol === cName || cName === 'id')) {
                    const targetKey = `${edge.target}-${edge.targetCol}`;
                    const newIntensity = intensity * 0.85; // Decay
                    if (!paths.has(targetKey) || intensities[targetKey] < newIntensity) {
                        paths.add(targetKey);
                        intensities[targetKey] = newIntensity;
                        if (newIntensity > 0.1) {
                            queue.push({ key: targetKey, intensity: newIntensity });
                        }
                    }
                }
            });
        }
        setImpactPaths(paths);
        setImpactIntensity(intensities);
    }, [hoveredCol, pinnedCols, columnEdges, simulationSource]);

    const togglePin = React.useCallback((tableId, colName) => {
        const key = `${tableId}-${colName}`;
        if (setPinnedCols) {
            setPinnedCols(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            });
        }
    }, [setPinnedCols]);

    const toggleNodePin = React.useCallback((tableId) => {
        if (setPinnedNodes) {
            setPinnedNodes(prev => {
                const next = new Set(prev);
                if (next.has(tableId)) next.delete(tableId);
                else next.add(tableId);
                return next;
            });
        }
    }, [setPinnedNodes]);

    const isBusiness = insightPerspective === 'business';

    return (
        <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
            <div className={`perspective-lineage-container flex-1 ${isBusiness ? 'perspective-business' : 'perspective-analyst'}`} ref={containerRef}>
                <svg className="lineage-svg-overlay">
                    <defs>
                        <marker
                            id="arrowhead-col"
                            markerWidth="10"
                            markerHeight="7"
                            refX="9"
                            refY="3.5"
                            orientation="auto"
                            markerUnits="userSpaceOnUse"
                        >
                            <polygon points="0 0, 10 3.5, 0 7" fill={isBusiness ? "#fbbf24" : "#22d3ee"} />
                        </marker>
                    </defs>
                    {columnEdges.map((edge, i) => {
                        const start = portPositions[`${edge.source}-${edge.sourceCol}`]?.right;
                        const end = portPositions[`${edge.target}-${edge.targetCol}`]?.left;
                        if (!start || !end) return null;

                        const isImpactedSource = impactPaths.has(`${edge.source}-${edge.sourceCol}`);
                        const isImpactedTarget = impactPaths.has(`${edge.target}-${edge.targetCol}`);
                        const isHighlightedPath = isImpactedSource && isImpactedTarget;

                        const dx = Math.abs(end.x - start.x);
                        const curvature = Math.min(dx * 0.5, 80); // Dynamic curvature based on distance
                        const midX = (start.x + end.x) / 2;
                        const midY = (start.y + end.y) / 2;

                        return (
                            <g key={`edge-${i}`}>
                                <path
                                    d={`M ${start.x} ${start.y} C ${start.x + curvature} ${start.y}, ${end.x - curvature} ${end.y}, ${end.x} ${end.y}`}
                                    className={`connector-line active ${isHighlightedPath ? 'impact-path' : ''} ${simulationSource ? 'sim-ripple' : ''}`}
                                    style={{
                                        strokeOpacity: isHighlightedPath ? (simulationSource ? 0.9 : 1.0) : 0.4,
                                        strokeWidth: isHighlightedPath ? (2.0 + (impactIntensity[`${edge.source}-${edge.sourceCol}`] || 0) * 4) : 1.5,
                                        stroke: isHighlightedPath ? (simulationSource ? '#ef4444' : (isBusiness ? '#fbbf24' : '#22d3ee')) : 'rgba(255,255,255,0.25)',
                                        '--flow-speed': edge.flowSpeed
                                    }}
                                    markerEnd="url(#arrowhead-col)"
                                />
                                {isHighlightedPath && (
                                    <g className="connector-label-group">
                                        <text x={midX} y={midY - 10} textAnchor="middle" className="connector-timestamp" style={{ fill: simulationSource ? '#f87171' : undefined }}>
                                            {simulationSource ? 'SIMULATED IMPACT' : edge.last_tx_time}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}
                </svg>

                <div className="lineage-grid">
                    {selectedNodes.map((node, idx) => (
                        <LineageCard
                            key={node.id}
                            node={node}
                            idx={idx}
                            perspective={insightPerspective}
                            onHoverCol={setHoveredCol}
                            onTogglePin={togglePin}
                            onToggleNodePin={toggleNodePin}
                            pinnedNodes={pinnedNodes}
                            pinnedCols={pinnedCols}
                            impactPaths={impactPaths}
                            onDeselect={() => setMultiSelectedNodes?.(prev => prev.filter(id => (typeof id === 'string' ? id : id.id) !== node.id))}
                            activeFilters={activeFilters}
                            columnAliases={columnAliases}
                            setColumnAliases={setColumnAliases}
                            onSelectInsight={(item) => setActiveInsight(item)}
                            isActive={activeInsight?.id === node.id}
                            isSimulating={simulationSource?.id === node.id}
                        />
                    ))}
                </div>

                <AnimatePresence>
                    {activeInsight && (
                        <BusinessInsightOverlay
                            insight={activeInsight}
                            onClose={() => setActiveInsight(null)}
                            isBusiness={isBusiness}
                            isSimulating={simulationSource?.id === activeInsight.id}
                            onToggleSim={(source) => setSimulationSource(prev => prev?.id === source.id ? null : source)}
                            multiSelectedNodes={selectedNodes}
                            pinnedCols={pinnedCols}
                            onOpenXRay={(node, columns) => setXrayNode({ ...node, selectedColumns: columns })}
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {xrayNode && connectionId && (
                        <NodeXRayPanel
                            node={xrayNode}
                            connectionId={connectionId}
                            onClose={() => setXrayNode(null)}
                        />
                    )}
                </AnimatePresence>
            </div>

            <aside style={{
                width: '280px',
                background: 'rgba(5, 8, 20, 0.95)',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '20px',
                overflowY: 'auto',
                zIndex: 100,
                pointerEvents: 'auto'
            }}>
                <div style={{ marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', color: '#fff', textTransform: 'uppercase', marginBottom: '15px' }}>Lineage Control Center</h3>

                    <NodeSelectorPanel
                        dataClusters={graphData.nodes || []}
                        multiSelectedNodes={multiSelectedIds}
                        setMultiSelectedNodes={setMultiSelectedNodes}
                        showMultiConnections={showMultiConnections}
                        setShowMultiConnections={setShowMultiConnections}
                    />

                    <DataLensPanel
                        dataClusters={graphData.nodes || []}
                        connectionId={connectionId}
                        onFilterChange={onFilterChange}
                        activeFilters={activeFilters}
                    />
                </div>

                <div style={{ flex: 1 }} />

                <div style={{ padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>PERSPECTIVE</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setInsightPerspective?.('analyst')}
                            className={`flex-1 px-3 py-2 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${!isBusiness ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-white/40 border border-white/5'}`}
                        >
                            Analyst
                        </button>
                        <button
                            onClick={() => setInsightPerspective?.('business')}
                            className={`flex-1 px-3 py-2 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${isBusiness ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-white/5 text-white/40 border border-white/5'}`}
                        >
                            Business
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
};

const LineageCard = ({ node, idx, perspective, onHoverCol, onTogglePin, onToggleNodePin, pinnedNodes, pinnedCols, impactPaths, onDeselect, activeFilters = {}, columnAliases = {}, setColumnAliases, onSelectInsight, isActive, isSimulating }) => {
    const isBusiness = perspective === 'business';
    const [editingCol, setEditingCol] = React.useState(null);
    const [editValue, setEditValue] = React.useState('');

    const getBizTerm = (colName, isFk) => {
        const aliasKey = `${node.id}-${colName}`;
        if (columnAliases[aliasKey]) return columnAliases[aliasKey];

        const overrides = {
            'user_id': 'Customer Profile',
            'station_code': 'Asset Identifier',
            'id': 'Record ID'
        };
        if (overrides[colName]) return overrides[colName];
        if (isFk || colName.toLowerCase().endsWith('_id')) {
            const base = colName.replace(/(_id|id|ID)$/i, '').replace(/_/g, ' ');
            return (base || 'Entity').charAt(0).toUpperCase() + (base || 'Entity').slice(1).trim() + ' Link';
        }
        return colName.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    const vitality = node.vitality || node.healthScore || Math.floor(Math.random() * 20 + 80);
    const impactMagnitude = ((node.affectedDownstreamCount || 0) * 1.5 + (node.importance || 0) * 0.5).toFixed(1);
    const rowCount = node.row_count || 1240;
    const txVolume = (rowCount * 0.15).toFixed(1) + "K";
    const riskLevel = node.affectedDownstreamCount > 5 ? "CRITICAL" : "STANDARD";

    const columns = React.useMemo(() => {
        const baseCols = (node.columns || []).map(c => {
            const colName = typeof c === 'string' ? c : (c.name || 'id');
            const fk = (node.foreign_keys || []).find(f => f.column === colName);
            return {
                name: colName,
                type: fk ? 'FK' : 'DAT',
                bizTerm: getBizTerm(colName, !!fk)
            };
        });

        if (baseCols.length === 0) {
            (node.foreign_keys || []).forEach(fk => {
                baseCols.push({
                    name: fk.column || 'id',
                    type: 'FK',
                    bizTerm: getBizTerm(fk.column || 'id', true)
                });
            });
        }
        if (!baseCols.find(c => c.name === 'id')) baseCols.unshift({ name: 'id', type: 'PK', bizTerm: 'Record ID' });

        return baseCols;
    }, [node]);

    const isFiltered = React.useMemo(() => {
        const nodePrefix = `cat:${node.id.toLowerCase()}:`;
        return Object.keys(activeFilters).some(k => k.startsWith(nodePrefix) && activeFilters[k] === true);
    }, [node.id, activeFilters]);

    return (
        <motion.div
            id={`card-${node.id}`}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                border: isSimulating ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.05)',
                boxShadow: isSimulating ? '0 0 30px rgba(239, 68, 68, 0.4)' : 'none'
            }}
            transition={{ delay: idx * 0.1, type: 'spring', damping: 20 }}
            className={`table-card ${isFiltered ? 'card-filtered' : ''} ${isSimulating ? 'card-simulating' : ''}`}
        >
            <div className={`card-inner ${isBusiness ? 'perspective-business' : 'perspective-analyst'}`}>
                <div
                    className="card-header pb-2 border-b border-white/5 flex items-start justify-between cursor-pointer group"
                    onClick={() => onSelectInsight({ type: 'table', id: node.id, name: node.name, node })}
                >
                    <div>
                        <h3 className={`table-name group-hover:text-indigo-400 transition-colors ${isActive ? 'text-indigo-400' : ''}`}>{node.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="table-type-badge">{node.table_type || 'Table'}</span>
                            <span className="text-[9px] opacity-40 font-mono">#{node.id.slice(0, 6)}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {isFiltered && (
                            <div className="px-2 py-1 rounded-md text-[8px] font-black tracking-tighter bg-indigo-600 text-white flex items-center gap-1 shadow-[0_0_20px_rgba(129,140,248,0.8)] animate-bounce">
                                <span className="material-symbols-outlined text-[10px]">filter_alt</span>
                                DATA LENS ACTIVE
                            </div>
                        )}
                        <div className={`px-2 py-1 rounded-md text-[8px] font-black tracking-tighter ${riskLevel === 'CRITICAL' ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'}`}>
                            {riskLevel}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleNodePin(node.id); }}
                                className={`p-1 rounded bg-white/5 transition-all ${pinnedNodes.has(node.id) ? 'text-indigo-400' : 'text-white/20 hover:text-white/60'}`}
                            >
                                {pinnedNodes.has(node.id) ? <Pin size={10} /> : <PinOff size={10} />}
                            </button>
                            <button onClick={onDeselect} className="text-white/20 hover:text-white/60 transition-colors">
                                <X size={10} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="card-metrics mt-4 grid grid-cols-3 gap-2">
                    <div className="metric-item">
                        <span className="metric-value text-xs">{rowCount > 1000 ? (rowCount / 1000).toFixed(1) + 'K' : rowCount}</span>
                        <span className="metric-label">Records</span>
                    </div>
                    <div className="metric-item">
                        <span className="metric-value text-xs" style={{ color: vitality < 80 ? '#fbbf24' : '#4ade80' }}>{vitality}%</span>
                        <span className="metric-label">Vitality</span>
                    </div>
                    <div className="metric-item">
                        <span className="metric-value text-xs text-indigo-400">{impactMagnitude}</span>
                        <span className="metric-label">Impact Mag</span>
                    </div>
                </div>

                <div className="telemetry-badge">
                    <div className="tranche-pill">
                        <div className="tranche-dot" />
                        TR-{Math.floor(Math.random() * 900) + 100} ACTIVE
                    </div>
                    <div className="text-[7px] opacity-40 font-mono text-white">
                        LAST TX: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>

                <div className="card-body mt-4">
                    <div className="section-title flex items-center gap-2 mb-2">
                        {isBusiness ? <Activity size={10} /> : <GitBranch size={10} />}
                        <span className="uppercase tracking-widest text-[9px] font-bold opacity-60">
                            {isBusiness ? 'Business Context Ports' : 'Technical Lineage'}
                        </span>
                    </div>

                    <div className="column-list space-y-1">
                        {columns.map((col, i) => {
                            const isImpacted = impactPaths.has(`${node.id}-${col.name}`);
                            const isPinned = pinnedCols.has(`${node.id}-${col.name}`);
                            const colPrefix = `cat:${node.id.toLowerCase()}:${col.name.toLowerCase()}:`;
                            const isColFiltered = Object.keys(activeFilters).some(k =>
                                k.startsWith(colPrefix) && activeFilters[k] === true
                            );

                            return (
                                <div
                                    key={`col-${i}`}
                                    className={`column-row relative ${isImpacted ? 'impacted' : ''} ${isPinned ? 'pinned' : ''} ${isColFiltered ? 'filtered-match filtered-pulse' : ''}`}
                                    style={{
                                        background: isPinned ? 'rgba(99,102,241,0.15)' : (isColFiltered ? 'rgba(129,140,248,0.1)' : (isImpacted ? 'rgba(34,211,238,0.05)' : 'transparent')),
                                        borderLeft: isPinned ? '2px solid #818cf8' : (isColFiltered ? '2px solid #818cf8' : 'none'),
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer'
                                    }}
                                    data-col={col.name}
                                    onMouseEnter={() => onHoverCol({ tableId: node.id, colName: col.name })}
                                    onMouseLeave={() => onHoverCol(null)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectInsight({
                                            type: 'column',
                                            id: `${node.id}-${col.name}`,
                                            name: col.bizTerm,
                                            technicalName: col.name,
                                            tableId: node.id,
                                            tableName: node.name,
                                            col
                                        });
                                    }}
                                >
                                    <div className="port left" />
                                    <div className="flex-1 flex flex-col">
                                        {isBusiness ? (
                                            editingCol === col.name ? (
                                                <input
                                                    autoFocus
                                                    className="bg-indigo-500/20 border border-indigo-500/50 text-white text-[10px] font-bold px-1 rounded outline-none w-full"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            setColumnAliases?.(prev => ({ ...prev, [`${node.id}-${col.name}`]: editValue }));
                                                            setEditingCol(null);
                                                        } else if (e.key === 'Escape') {
                                                            setEditingCol(null);
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        setColumnAliases?.(prev => ({ ...prev, [`${node.id}-${col.name}`]: editValue }));
                                                        setEditingCol(null);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span
                                                        className={`font-bold text-[10px] transition-colors ${isSimulating ? 'text-rose-400' : 'hover:text-indigo-300'}`}
                                                        onClick={(e) => {
                                                            if (isBusiness) {
                                                                e.stopPropagation();
                                                                setEditingCol(col.name);
                                                                setEditValue(col.bizTerm);
                                                            }
                                                        }}
                                                        title="Click to rename"
                                                    >
                                                        {col.bizTerm}
                                                    </span>
                                                    {isSimulating && (
                                                        <span className="text-[7px] text-rose-500/80 animate-pulse font-black">SIMULATING CHANGE</span>
                                                    )}
                                                </div>
                                            )
                                        ) : (
                                            <span className="font-bold text-[10px]">{col.name}</span>
                                        )}
                                        {!isBusiness && <span className="text-[8px] opacity-40 uppercase">{col.type} ref</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onTogglePin(node.id, col.name); }}
                                            className={`p-1 rounded transition-all ${isPinned ? 'text-indigo-400' : 'text-white/10 hover:text-white/30'}`}
                                        >
                                            <Pin size={10} style={{ transform: isPinned ? 'none' : 'rotate(-45deg)' }} />
                                        </button>
                                        <div className="port right" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const BusinessInsightOverlay = ({ insight, onClose, isBusiness, isSimulating, onToggleSim, multiSelectedNodes, onOpenXRay, pinnedCols }) => {
    const isTable = insight.type === 'table';
    const isMulti = multiSelectedNodes.length > 1;

    // Multi-Node Logic
    const avgVitality = (multiSelectedNodes.reduce((acc, n) => acc + (n.vitality || 90), 0) / multiSelectedNodes.length).toFixed(1);
    const totalImpact = multiSelectedNodes.reduce((acc, n) => acc + (n.affectedDownstreamCount || 0), 0);

    // Single Insight Logic
    const criticality = insight.node?.affectedDownstreamCount > 5 ? 'P1 - CRITICAL' : (insight.node?.affectedDownstreamCount > 2 ? 'P2 - HIGH' : 'P3 - STANDARD');
    const risk = insight.type === 'table' ? (insight.node?.affectedDownstreamCount > 5 ? 'HIGH' : 'LOW') : 'MEDIUM';
    const popularity = isTable ? "Top 5%" : "Top 12%";
    const health = isTable ? "98.4%" : "99.1%";
    const steward = isTable ? "Data Platform Team" : "Energy Operations";
    const typeLabel = isTable ? "Core Entity" : (insight.col?.type === 'FK' ? 'Relationship Link' : 'Attribute');

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="business-insight-overlay"
        >
            <div className="overlay-header">
                <div className="flex items-center gap-3">
                    <div className={`insight-icon-container ${isMulti ? 'bg-purple-500/20 text-purple-400' : (isTable ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-500')}`}>
                        {isMulti ? <Layers size={16} /> : (isTable ? <Database size={16} /> : <GitBranch size={16} />)}
                    </div>
                    <div>
                        <div className="text-[10px] opacity-40 uppercase font-black tracking-tighter">
                            {isMulti ? 'Comparative Analysis' : 'Perspective Insight'}
                        </div>
                        <div className="text-sm font-bold truncate max-w-[180px]">
                            {isMulti ? `${multiSelectedNodes.length} Entities Selected` : insight.name}
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors">
                    <X size={16} />
                </button>
            </div>

            <div className="overlay-body space-y-4">
                {isMulti ? (
                    <div className="insight-section">
                        <div className="section-label">AGGREGATE ANALYSIS</div>
                        <div className="summary-card bg-purple-500/5 border-purple-500/20">
                            <div className="summary-row">
                                <span className="label">Avg Vitality</span>
                                <span className="value text-emerald-400">{avgVitality}%</span>
                            </div>
                            <div className="summary-row">
                                <span className="label">Total Downstream Impact</span>
                                <span className="value text-rose-500">{totalImpact} Consumers</span>
                            </div>
                            <div className="summary-row">
                                <span className="label">Composite Risk</span>
                                <span className="value text-amber-500">{totalImpact > 10 ? 'CRITICAL' : 'ELEVATED'}</span>
                            </div>
                        </div>
                        <div className="mt-4 space-y-2">
                            <div className="text-[9px] opacity-40 font-bold uppercase">Selection Breakdown</div>
                            {multiSelectedNodes.slice(0, 3).map(n => (
                                <div key={n.id} className="flex justify-between items-center text-[10px] bg-white/5 p-2 rounded">
                                    <span className="opacity-60">{n.name}</span>
                                    <span className="font-bold text-indigo-400">P{n.importance || 2}</span>
                                </div>
                            ))}
                            {pinnedCols && Array.from(pinnedCols).length > 0 && (
                                <div className="mt-2 space-y-1">
                                    <div className="text-[8px] opacity-30 font-bold uppercase mb-1">Pinned Columns</div>
                                    {Array.from(pinnedCols).map(key => {
                                        const [nodeId, colName] = key.split('-');
                                        const node = multiSelectedNodes.find(n => n.id === nodeId);
                                        return (
                                            <div key={key} className="flex justify-between items-center text-[9px] bg-amber-500/10 p-1.5 rounded border border-amber-500/10">
                                                <div className="flex items-center gap-2">
                                                    <Pin size={8} className="text-amber-500" />
                                                    <span className="opacity-80">{colName}</span>
                                                </div>
                                                <span className="text-[8px] opacity-40 uppercase">{node?.name || nodeId}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="insight-section">
                            <div className="section-label">EXECUTIVE SUMMARY</div>
                            <div className="summary-card">
                                <div className="summary-row">
                                    <span className="label">Criticality</span>
                                    <span className={`value ${criticality.includes('P1') ? 'text-rose-500' : 'text-emerald-500'}`}>{criticality}</span>
                                </div>
                                <div className="summary-row">
                                    <span className="label">Blast Radius</span>
                                    <span className={`value ${risk === 'HIGH' ? 'text-rose-500' : 'text-emerald-500'}`}>{risk}</span>
                                </div>
                                <div className="summary-row">
                                    <span className="label">Classification</span>
                                    <span className="value text-indigo-400">{typeLabel}</span>
                                </div>
                            </div>
                        </div>

                        <div className="insight-section">
                            <div className="section-label">OPERATIONAL VITALITY</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="stats-box">
                                    <div className="label">POPULARITY</div>
                                    <div className="value text-emerald-400">{popularity}</div>
                                </div>
                                <div className="stats-box">
                                    <div className="label">HEALTH</div>
                                    <div className="value text-indigo-400">{health}</div>
                                </div>
                            </div>
                        </div>

                        <div className="insight-section">
                            <div className="section-label">WHAT-IF SIMULATION</div>
                            <button
                                onClick={() => onToggleSim(insight)}
                                className={`w-full p-3 rounded-xl flex items-center justify-between transition-all ${isSimulating ? 'bg-rose-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Zap size={14} className={isSimulating ? 'animate-pulse' : ''} />
                                    <span className="text-[10px] font-black tracking-tight">{isSimulating ? 'SIMULATING CHANGE...' : 'SIMULATE CHANGE'}</span>
                                </div>
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </>
                )}

                {!isTable && !isMulti && (
                    <div className="insight-section">
                        <div className="section-label">TECHNICAL CONTEXT</div>
                        <div className="tech-box">
                            <div className="flex justify-between items-center mb-1">
                                <span className="label">SOURCE TABLE</span>
                                <span className="value">{insight.tableName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="label">TECH NAME</span>
                                <span className="value font-mono opacity-60 uppercase">{insight.technicalName}</span>
                            </div>
                        </div>
                    </div>
                )}

                {!isMulti && (
                    <div className="insight-section">
                        <div className="section-label">GOVERNANCE & STEWARDSHIP</div>
                        <div className="steward-box flex items-center gap-2">
                            <Shield size={12} className="text-indigo-400" />
                            <div>
                                <div className="text-[9px] font-bold text-white/80">{steward}</div>
                                <div className="text-[8px] opacity-40">Certified Data Custodian</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="overlay-footer">
                <button
                    className="expand-button"
                    onClick={() => {
                        const pinnedArray = Array.from(pinnedCols || []);
                        if (isMulti) {
                            onOpenXRay(multiSelectedNodes[0], pinnedArray); // Default to first node, pass all pinned columns
                        } else {
                            onOpenXRay(insight.node || { id: insight.id, name: insight.name }, pinnedArray);
                        }
                    }}
                >
                    <span>{isMulti ? 'View Comparative X-Ray' : 'View Deep X-Ray Analysis'}</span>
                    <ArrowRight size={12} />
                </button>
            </div>
        </motion.div>
    );
};

export default PerspectiveLineageView;
