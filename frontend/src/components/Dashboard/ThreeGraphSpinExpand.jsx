import React, {
    useRef, useMemo, useState, useEffect,
    forwardRef, useImperativeHandle, useCallback,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useRegisterCommand } from '../../context/CommandRegistryContext';
import { logger } from '../../utils/logger';

// ─── Color Palette ──────────────────────────────────────────────────────────
const TABLE_COLORS = [
    { color: '#2563eb', glow: '#60a5fa' },
    { color: '#16a34a', glow: '#4ade80' },
    { color: '#d97706', glow: '#fbbf24' },
    { color: '#9333ea', glow: '#c084fc' },
    { color: '#dc2626', glow: '#f87171' },
    { color: '#0891b2', glow: '#22d3ee' },
    { color: '#c026d3', glow: '#e879f9' },
    { color: '#ea580c', glow: '#fb923c' },
    { color: '#059669', glow: '#34d399' },
    { color: '#4f46e5', glow: '#818cf8' },
];

function getTableColor(index) {
    return TABLE_COLORS[index % TABLE_COLORS.length];
}

// ─── Pseudo-random helper ───────────────────────────────────────────────────
function sr(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// ─── Transform living-data graph data into spin-expand table structures ─────
function transformGraphData(data, showPKs = true, showFKs = true) {
    if (!data || !data.nodes || data.nodes.length === 0) {
        return { tables: [], bridges: [] };
    }

    const nodes = data.nodes.filter(n =>
        n.id !== 'DATABASE_CORE' && n.id !== 'hub' &&
        n.type !== 'core' && n.entity !== 'core' &&
        n.name !== 'Neural Core'
    );

    // Corrected spacing for better visibility and zoom
    const phi = Math.PI * (3 - Math.sqrt(5));
    const radius = Math.max(12, Math.min(45, 8 + nodes.length * 0.6));

    // Calculate degrees
    const nodeDegree = new Map();
    if (data.edges) {
        data.edges.forEach(edge => {
            const srcId = typeof edge.source === 'object' ? edge.source.id : edge.source;
            const tgtId = typeof edge.target === 'object' ? edge.target.id : edge.target;
            nodeDegree.set(srcId, (nodeDegree.get(srcId) || 0) + 1);
            nodeDegree.set(tgtId, (nodeDegree.get(tgtId) || 0) + 1);
        });
    }

    // Step 1: Find Row Frequency Range
    const rowCounts = nodes.map(n => Math.max(0, n.metadata?.rows || n.row_count || 0));
    const maxRows = Math.max(...rowCounts, 100);

    const tables = nodes.map((node, i) => {
        const { color: uniqueColor, glow: uniqueGlow } = getTableColor(i);

        const degree = nodeDegree.get(node.id) || 0;
        const isIsolated = degree === 0;

        // Logarithmic Scale calculation (0.8 to 2.5)
        const count = Math.max(0, node.metadata?.rows || node.row_count || 0);
        const logMax = Math.log10(maxRows);
        const logVal = Math.log10(Math.max(1, count));
        const normalizedScale = 0.8 + (logVal / Math.max(1, logMax)) * 1.7;

        // Format count (e.g. 1.2k)
        const formatCount = (num) => {
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 10000) return (num / 1000).toFixed(0) + 'k';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
            return num.toString();
        };

        // Resolve backend color (for lens status)
        const nodeColor = node.color ? (typeof node.color === 'string' ? node.color : '#' + node.color.toString(16).padStart(6, '0')) : null;

        const color = uniqueColor; // Always different
        const glow = nodeColor || uniqueGlow; // Reflects lens/status if available

        // Fibonacci sphere distribution
        const y = nodes.length <= 1 ? 0 : 1 - (i / (nodes.length - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = phi * i;

        const position = [
            Math.cos(theta) * r * radius,
            y * radius,
            Math.sin(theta) * r * radius,
        ];

        return {
            id: node.id,
            label: node.name || node.id,
            count: count,
            displayCount: formatCount(count),
            scale: normalizedScale,
            color,
            glow,
            position,
            fields: [],
            nodeData: node,
            isIsolated,
        };
    });

    // Build Unified FK Hubs (Star Topology)
    const hubMap = new Map();
    if (showFKs && data.edges) {
        data.edges.forEach((edge) => {
            const srcId = typeof edge.source === 'object' ? edge.source.id : edge.source;
            const tgtId = typeof edge.target === 'object' ? edge.target.id : edge.target;

            // Skip PK-only edges when showPKs is false
            const isPK = edge.type === 'pk' || edge.metadata?.type === 'pk' || edge.label === 'PK';
            if (isPK && !showPKs) return;

            if (srcId === 'DATABASE_CORE' || srcId === 'hub' || tgtId === 'DATABASE_CORE' || tgtId === 'hub') return;

            const srcTable = tables.find(t => t.id === srcId);
            const tgtTable = tables.find(t => t.id === tgtId);
            if (!srcTable || !tgtTable) return;

            // Group by source and target column identity (Expand all FK nodes as requested)
            const targetColumn = edge.metadata?.column || edge.label || 'RELATION';
            const hubKey = `${srcId}:::${tgtId}:::${targetColumn}`;

            if (!hubMap.has(hubKey)) {
                hubMap.set(hubKey, {
                    id: `hub-${hubKey}`,
                    targetId: tgtId,
                    targetTable: tgtTable,
                    targetPos: tgtTable.position,
                    targetColor: tgtTable.color,
                    sources: [],
                    column: targetColumn,
                });
            }
            const hub = hubMap.get(hubKey);
            // Add source if not already present
            if (!hub.sources.find(s => s.id === srcId)) {
                hub.sources.push({
                    id: srcId,
                    name: srcTable.label || srcId,
                    column: edge.metadata?.sourceColumn || edge.metadata?.column || edge.label || 'FK', // Track specific source col
                    pos: srcTable.position,
                    color: srcTable.color,
                });
            }
        });
    }

    const bridges = Array.from(hubMap.values()).map((hub, hi) => {
        // Weighted placement: 30% from target towards the source average
        // This keeps hubs "beside" the target table
        const srcCount = hub.sources.length || 1;
        const sourceAvg = [
            hub.sources.reduce((sum, s) => sum + s.pos[0], 0) / srcCount,
            hub.sources.reduce((sum, s) => sum + s.pos[1], 0) / srcCount,
            hub.sources.reduce((sum, s) => sum + s.pos[2], 0) / srcCount,
        ];

        const centroid = [
            hub.targetPos[0] + (sourceAvg[0] - hub.targetPos[0]) * 0.3,
            hub.targetPos[1] + (sourceAvg[1] - hub.targetPos[1]) * 0.3,
            hub.targetPos[2] + (sourceAvg[2] - hub.targetPos[2]) * 0.3,
        ];

        // Slight jitter to prevent overlapping at [0,0,0]
        const jitter = 0.5;
        centroid[0] += (Math.random() - 0.5) * jitter;
        centroid[1] += (Math.random() - 0.5) * jitter;
        centroid[2] += (Math.random() - 0.5) * jitter;

        const targetName = hub.targetTable?.label || hub.targetId || 'Target';
        const targetColumn = hub.column || 'Relationship';

        return {
            id: hub.id,
            midpoint: centroid,
            targetId: hub.targetId,
            targetName: targetName,
            targetPos: hub.targetPos,
            targetColor: hub.targetColor,
            sources: hub.sources,
            label: targetColumn === 'RELATION' ? `${targetName}` : `${targetName}.${targetColumn}`,
            fromColor: hub.sources[0]?.color || hub.targetColor,
            toColor: hub.targetColor,
            toPos: hub.targetPos,
        };
    });

    // Build connectivity map for highlighting
    const connectivity = new Map();
    bridges.forEach(b => {
        const related = [b.targetId, ...b.sources.map(s => s.id)];
        related.forEach(id => {
            if (!connectivity.has(id)) connectivity.set(id, new Set());
            related.forEach(otherId => {
                if (id !== otherId) connectivity.get(id).add(otherId);
            });
        });
    });

    return { tables, bridges, connectivity: Object.fromEntries(Array.from(connectivity.entries()).map(([k, v]) => [k, Array.from(v)])) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function FieldSphere({ field, tableColor, tableGlow }) {
    const ref = useRef(null);
    const [hovered, setHovered] = useState(false);

    useFrame((state) => {
        if (!ref.current) return;
        const t = state.clock.elapsedTime;
        const bob = Math.sin(t * 2 + field.offset[0] * 3 + field.offset[1] * 2) * 0.03;
        ref.current.position.set(field.offset[0], field.offset[1] + bob, field.offset[2]);
        ref.current.scale.setScalar(field.size * (hovered ? 1.4 : 1));
    });

    const isFk = field.type === 'fk';

    return (
        <group>
            <mesh position={field.offset}>
                <sphereGeometry args={[field.size * 2, 12, 12]} />
                <meshBasicMaterial color={tableGlow} transparent opacity={isFk ? 0.12 : 0.06} />
            </mesh>
            <mesh
                ref={ref}
                position={field.offset}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
                onPointerOut={() => setHovered(false)}
            >
                <sphereGeometry args={[1, 24, 24]} />
                <meshStandardMaterial
                    color={isFk ? '#ffffff' : tableColor}
                    emissive={isFk ? tableGlow : tableColor}
                    emissiveIntensity={hovered ? 1 : isFk ? 0.8 : 0.5}
                    roughness={0.3}
                    metalness={0.7}
                />
            </mesh>
            {hovered && field.label && (
                <Html position={field.offset} center distanceFactor={18} style={{ pointerEvents: 'none' }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.9)',
                        color: '#fff',
                        padding: '5px 12px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "'JetBrains Mono', monospace",
                        whiteSpace: 'nowrap',
                        border: `1px solid ${tableColor}`,
                        boxShadow: `0 4px 20px ${tableColor}60`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span style={{
                            color: field.type === 'pk' ? '#fbbf24' : '#60a5fa',
                            fontSize: '10px',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            background: 'rgba(255,255,255,0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                        }}>
                            {field.type}
                        </span>
                        {field.label}
                    </div>
                </Html>
            )}
        </group>
    );
}

function LocalEdge({ to, color }) {
    const lineObj = useMemo(() => {
        const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...to)];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.25 });
        return new THREE.Line(geo, mat);
    }, [to, color]);
    return <primitive object={lineObj} />;
}
const MemoLocalEdge = React.memo(LocalEdge);

function TableEllipsoid({ table, isSelected, isHighlighted, onClick, onHover, targetPosition }) {
    const meshRef = useRef(null);
    const groupRef = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...table.position));
    const [hovered, setHovered] = useState(false);

    useFrame((state, delta) => {
        if (!meshRef.current || !groupRef.current) return;
        const t = state.clock.elapsedTime;

        // Smoothly move towards targetPosition (connected-node pull-in) or back to origin
        const dest = targetPosition
            ? new THREE.Vector3(...targetPosition)
            : new THREE.Vector3(...table.position);
        currentPos.current.lerp(dest, delta * 5);
        groupRef.current.position.copy(currentPos.current);

        // Frequency-based scaling (normalized log)
        const freqScale = table.scale || 1.0;
        const pulse = 1 + Math.sin(t * 1.2 + table.position[0] * 0.5) * 0.04;
        const s = freqScale * (hovered ? 1.08 : 1) * (isSelected ? 1.12 : 1) * pulse;
        meshRef.current.scale.set(s * 1.6, s, s * 0.7);
    });

    const isDimmed = table.isDimmed;

    return (
        <group ref={groupRef}>
            {/* Highlighted solid fill — only for connected nodes */}
            {isHighlighted && (
                <mesh scale={[1.65, 1.02, 0.72]}>
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshBasicMaterial color={table.glow} transparent opacity={0.55} depthWrite={false} />
                </mesh>
            )}
            {/* Outer glow */}
            <mesh scale={[2.8, 1.7, 1.2]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color={table.glow} transparent opacity={isSelected ? 0.15 : isHighlighted ? 0.35 : isDimmed ? 0.0 : 0.07} depthWrite={false} />
            </mesh>
            {/* Mid glow */}
            <mesh scale={[2.2, 1.35, 0.95]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color={table.glow} transparent opacity={isSelected ? 0.2 : isHighlighted ? 0.45 : isDimmed ? 0.0 : 0.1} depthWrite={false} />
            </mesh>
            {/* Main ellipsoid */}
            <mesh
                ref={meshRef}
                onClick={(e) => { e.stopPropagation(); onClick(e); }}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(table.nodeData); }}
                onPointerOut={() => { setHovered(false); onHover(null); }}
            >
                <sphereGeometry args={[1, 48, 48]} />
                <meshStandardMaterial
                    color={isDimmed ? '#111111' : table.color}
                    emissive={isDimmed ? '#000000' : table.color}
                    emissiveIntensity={hovered ? 2.0 : isHighlighted ? 1.2 : isDimmed ? 0.0 : 0.85}
                    roughness={0.2}
                    metalness={0.5}
                    transparent
                    opacity={hovered ? 1.0 : isHighlighted ? 1.0 : isDimmed ? 0.06 : 0.82}
                    depthWrite={false}
                />
            </mesh>
            {/* Label */}
            <Html center distanceFactor={40} style={{ pointerEvents: 'none' }}>
                <div style={{
                    color: 'white',
                    textAlign: 'center',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    textShadow: `0 0 20px ${table.color}, 0 0 40px ${table.color}, 0 2px 8px rgba(0,0,0,0.8)`,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    opacity: isDimmed ? 0.15 : 1.0,
                    transition: 'opacity 0.2s'
                }}>
                    <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>{table.label}</div>
                    <div style={{
                        fontSize: 13,
                        fontWeight: 900,
                        marginTop: 4,
                        color: table.color,
                        background: 'rgba(0,0,0,0.6)',
                        padding: '2px 10px',
                        borderRadius: '20px',
                        display: 'inline-block',
                        border: `1px solid ${table.color}60`
                    }}>
                        {table.displayCount}
                    </div>
                </div>
            </Html>

        </group>
    );
}
const MemoTableEllipsoid = React.memo(TableEllipsoid);

// ─── FK Connection Lines ────────────────────────────────────────────────────
function FKConnections({ tables, connections }) {
    const fieldPositions = useMemo(() => {
        const map = new Map();
        tables.forEach((t) => {
            t.fields.forEach((f) => {
                map.set(f.id, new THREE.Vector3(
                    t.position[0] + f.offset[0],
                    t.position[1] + f.offset[1],
                    t.position[2] + f.offset[2],
                ));
            });
        });
        return map;
    }, [tables, connections]);

    return (
        <group>
            {connections.map((conn, i) => {
                const from = fieldPositions.get(conn.from);
                const to = fieldPositions.get(conn.to);
                if (!from || !to) return null;
                return <FKLine key={i} from={from} to={to} />;
            })}
        </group>
    );
}

function FKLine({ from, to }) {
    const lineObj = useMemo(() => {
        const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
        mid.y += 1.5;
        mid.z += 1;
        const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
        const points = curve.getPoints(32);
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.2 });
        return new THREE.Line(geo, mat);
    }, [from, to]);

    useFrame((state) => {
        const mat = lineObj.material;
        mat.opacity = 0.15 + Math.sin(state.clock.elapsedTime * 2) * 0.08;
    });

    return <primitive object={lineObj} />;
}

// ─── Flow Particles ─────────────────────────────────────────────────────────
function FlowParticles({ tables, bridges }) {
    const count = Math.min(60, Math.max(10, bridges.length * 10));
    const ref = useRef(null);
    const geomRef = useRef(null);

    const { paths, initialT } = useMemo(() => {
        const fieldPositions = new Map();
        tables.forEach((t) => {
            t.fields.forEach((f) => {
                fieldPositions.set(f.id, new THREE.Vector3(
                    t.position[0] + f.offset[0],
                    t.position[1] + f.offset[1],
                    t.position[2] + f.offset[2],
                ));
            });
        });

        const curves = [];
        bridges.forEach((bridge) => {
            const from = new THREE.Vector3(...bridge.fromPos);
            const to = new THREE.Vector3(...bridge.toPos);
            const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
            mid.y += 1.5; mid.z += 1;
            curves.push(new THREE.QuadraticBezierCurve3(from, mid, to));
        });

        if (curves.length === 0) return { paths: [], initialT: [] };

        const p = [];
        const t = [];
        for (let i = 0; i < count; i++) {
            p.push(curves[i % curves.length]);
            t.push(sr(i * 7));
        }
        return { paths: p, initialT: t };
    }, [tables, bridges, count]);

    const positions = useMemo(() => new Float32Array(count * 3), [count]);

    useEffect(() => {
        if (geomRef.current && paths.length > 0) {
            geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        }
    }, [positions, paths.length]);

    useFrame((state) => {
        if (!ref.current || paths.length === 0) return;
        const t = state.clock.elapsedTime;
        for (let i = 0; i < count; i++) {
            const prog = (initialT[i] + t * (0.15 + sr(i * 11) * 0.1)) % 1;
            const pt = paths[i].getPoint(prog);
            positions[i * 3] = pt.x;
            positions[i * 3 + 1] = pt.y;
            positions[i * 3 + 2] = pt.z;
        }
        if (ref.current.geometry.attributes.position) {
            ref.current.geometry.attributes.position.needsUpdate = true;
        }
    });

    if (paths.length === 0) return null;

    return (
        <points ref={ref}>
            <bufferGeometry ref={geomRef} />
            <pointsMaterial size={0.12} color="#fde68a" transparent opacity={0.8} sizeAttenuation />
        </points>
    );
}

// ─── Grid Plane ─────────────────────────────────────────────────────────────
// ─── Direct FK Arc Line (hover only) ────────────────────────────────────────
// hubSize: normalized 0.3–1.2 based on connected table row-count scale
function DirectFKLine({ from, to, fromColor, toColor, label, fkColumn, hubSize = 0.5, rowCount = 0 }) {
    const hubRef = useRef(null);
    const hitRef = useRef(null);
    const [hubHovered, setHubHovered] = useState(false);

    const displayCount = rowCount >= 1000
        ? `${(rowCount / 1000).toFixed(1)}k`
        : rowCount > 0 ? String(rowCount) : null;

    const { segA, segB, midPos, labelPos } = useMemo(() => {
        const vFrom = new THREE.Vector3(...from);
        const vTo = new THREE.Vector3(...to);
        const dist = vFrom.distanceTo(vTo);
        const mid = new THREE.Vector3().addVectors(vFrom, vTo).multiplyScalar(0.5);
        mid.y += dist * 0.18;
        const curve = new THREE.QuadraticBezierCurve3(vFrom, mid, vTo);
        const allPts = curve.getPoints(40);
        const half = Math.floor(allPts.length / 2);
        return {
            segA: allPts.slice(0, half + 1),
            segB: allPts.slice(half),
            midPos: mid.toArray(),
            labelPos: [mid.x, mid.y + hubSize * 1.4 + 0.5, mid.z],
        };
    }, [from[0], from[1], from[2], to[0], to[1], to[2], hubSize]);

    useFrame((state) => {
        if (!hubRef.current) return;
        const boost = hubHovered ? 1.35 : 1.0;
        const s = hubSize * boost * (1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.06);
        hubRef.current.scale.setScalar(s);
    });

    const displayName = fkColumn && fkColumn !== 'RELATION' && fkColumn !== 'FK' ? fkColumn : label;

    return (
        <group>
            {/* Gradient arc */}
            <line>
                <bufferGeometry onUpdate={(self) => self.setFromPoints(segA)} />
                <lineBasicMaterial color={fromColor} transparent opacity={hubHovered ? 1.0 : 0.65} />
            </line>
            <line>
                <bufferGeometry onUpdate={(self) => self.setFromPoints(segB)} />
                <lineBasicMaterial color={toColor} transparent opacity={hubHovered ? 1.0 : 0.65} />
            </line>

            {/* FK Hub Node */}
            <group position={midPos} ref={hubRef}>
                {/* Left hemisphere — fromColor */}
                <mesh rotation={[0, -Math.PI / 2, 0]}>
                    <sphereGeometry args={[1, 20, 20, 0, Math.PI]} />
                    <meshStandardMaterial color={fromColor} emissive={fromColor}
                        emissiveIntensity={hubHovered ? 1.8 : 1.0} metalness={0.7} roughness={0.2}
                        transparent opacity={1.0} depthWrite={false} />
                </mesh>
                {/* Right hemisphere — toColor */}
                <mesh rotation={[0, Math.PI / 2, 0]}>
                    <sphereGeometry args={[1, 20, 20, 0, Math.PI]} />
                    <meshStandardMaterial color={toColor} emissive={toColor}
                        emissiveIntensity={hubHovered ? 1.8 : 1.0} metalness={0.7} roughness={0.2}
                        transparent opacity={1.0} depthWrite={false} />
                </mesh>
                {/* Divider ring */}
                <mesh rotation={[0, Math.PI / 2, 0]}>
                    <torusGeometry args={[1, 0.05, 8, 32]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={hubHovered ? 1.0 : 0.5} depthWrite={false} />
                </mesh>
                {/* Invisible hit area for hover */}
                <mesh ref={hitRef}
                    onPointerOver={(e) => { e.stopPropagation(); setHubHovered(true); }}
                    onPointerOut={() => setHubHovered(false)}
                    visible={false}>
                    <sphereGeometry args={[1.8, 8, 8]} />
                </mesh>
                {/* Row count badge always visible on hub */}
                {displayCount && (
                    <Html center distanceFactor={40} style={{ pointerEvents: 'none' }}>
                        <div style={{
                            background: 'rgba(0,0,0,0.85)',
                            color: '#ffffff',
                            fontSize: `${Math.max(9, Math.min(13, 9 + hubSize * 3))}px`,
                            fontWeight: 900,
                            fontFamily: "'JetBrains Mono', monospace",
                            padding: '1px 5px',
                            borderRadius: '8px',
                            border: `1px solid ${fromColor}80`,
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            lineHeight: 1.2,
                        }}>
                            {displayCount}
                        </div>
                    </Html>
                )}
            </group>

            {/* Label — only on hub hover */}
            {hubHovered && (
                <Html position={labelPos} center distanceFactor={40} style={{ pointerEvents: 'none' }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.92)',
                        padding: '4px 10px',
                        borderRadius: '5px',
                        fontSize: '11px',
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        whiteSpace: 'nowrap',
                        border: `1px solid ${toColor}90`,
                        boxShadow: `0 0 12px ${fromColor}60, 0 0 12px ${toColor}60`,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: fromColor, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: '#fbbf24' }}>{displayName}</span>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: toColor, display: 'inline-block', flexShrink: 0 }} />
                    </div>
                </Html>
            )}
        </group>
    );
}
const MemoDirectFKLine = React.memo(DirectFKLine);

// ─── Hover FK Connections ────────────────────────────────────────────────────
function HoverFKConnections({ bridges, hoveredTableId, tables, targetPositions = {} }) {
    const tableInfoMap = useMemo(() => {
        const m = new Map();
        (tables || []).forEach(t => m.set(t.id, { scale: t.scale || 1.0, count: t.rowCount ?? t.count ?? 0 }));
        return m;
    }, [tables]);

    const connections = useMemo(() => {
        if (!hoveredTableId) return [];
        const seen = new Set();
        const result = [];

        bridges.forEach((bridge) => {
            const isTarget = bridge.targetId === hoveredTableId;
            const isSource = bridge.sources.some(s => s.id === hoveredTableId);
            if (!isTarget && !isSource) return;

            if (isTarget) {
                bridge.sources.forEach((src) => {
                    const key = `${src.id}→${bridge.targetId}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    const info = tableInfoMap.get(src.id) || { scale: 1.0, count: 0 };
                    const hubSize = 0.3 + ((info.scale - 0.8) / 1.7) * 0.9;
                    result.push({
                        key, hubSize, rowCount: info.count,
                        from: targetPositions[src.id] || src.pos,
                        to: bridge.targetPos,
                        fromColor: src.color, toColor: bridge.targetColor,
                        label: src.name, fkColumn: src.column,
                    });
                });
            } else {
                const src = bridge.sources.find(s => s.id === hoveredTableId);
                if (!src) return;
                const key = `${hoveredTableId}→${bridge.targetId}`;
                if (seen.has(key)) return;
                seen.add(key);
                const info = tableInfoMap.get(bridge.targetId) || { scale: 1.0, count: 0 };
                const hubSize = 0.3 + ((info.scale - 0.8) / 1.7) * 0.9;
                result.push({
                    key, hubSize, rowCount: info.count,
                    from: src.pos,
                    to: targetPositions[bridge.targetId] || bridge.targetPos,
                    fromColor: src.color, toColor: bridge.targetColor,
                    label: bridge.targetName, fkColumn: src.column,
                });
            }
        });

        return result;
    }, [bridges, hoveredTableId, tableInfoMap, targetPositions]);

    if (!hoveredTableId || connections.length === 0) return null;

    return (
        <group>
            {connections.map((conn) => (
                <MemoDirectFKLine key={conn.key} {...conn} />
            ))}
        </group>
    );
}
const MemoHoverFKConnections = React.memo(HoverFKConnections);




// ─── Neural Core ────────────────────────────────────────────────────────────
function NeuralCore({ tables }) {
    const coreRef = useRef(null);
    const ringRef1 = useRef(null);
    const ringRef2 = useRef(null);
    const ringRef3 = useRef(null);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (coreRef.current) {
            const pulse = 1 + Math.sin(t * 2) * 0.08;
            coreRef.current.scale.setScalar(pulse);
        }
        if (ringRef1.current) ringRef1.current.rotation.set(t * 0.5, t * 0.3, 0);
        if (ringRef2.current) ringRef2.current.rotation.set(0, t * 0.4, t * 0.6);
        if (ringRef3.current) ringRef3.current.rotation.set(t * 0.2, 0, t * 0.5);
    });

    const coreLines = useMemo(() => {
        return tables.map((t) => {
            const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 1, 0),
                new THREE.Vector3(...t.position),
            ]);
            const mat = new THREE.LineBasicMaterial({
                color: t.color,
                transparent: true,
                opacity: 0.35,
            });
            return new THREE.Line(geo, mat);
        });
    }, [tables]);

    return (
        <group position={[0, 1, 0]}>
            <mesh>
                <sphereGeometry args={[3, 32, 32]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.03} />
            </mesh>
            <mesh>
                <sphereGeometry args={[2, 32, 32]} />
                <meshBasicMaterial color="#fde68a" transparent opacity={0.06} />
            </mesh>
            <mesh ref={coreRef}>
                <sphereGeometry args={[1, 48, 48]} />
                <meshStandardMaterial
                    color="#fef3c7"
                    emissive="#f59e0b"
                    emissiveIntensity={1.5}
                    roughness={0.1}
                    metalness={0.8}
                    transparent
                    opacity={0.9}
                />
            </mesh>
            <mesh>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
            </mesh>
            <mesh ref={ringRef1}>
                <torusGeometry args={[1.6, 0.02, 16, 64]} />
                <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} />
            </mesh>
            <mesh ref={ringRef2}>
                <torusGeometry args={[2.0, 0.015, 16, 64]} />
                <meshBasicMaterial color="#60a5fa" transparent opacity={0.35} />
            </mesh>
            <mesh ref={ringRef3}>
                <torusGeometry args={[2.4, 0.012, 16, 64]} />
                <meshBasicMaterial color="#c084fc" transparent opacity={0.3} />
            </mesh>
            <Html center distanceFactor={45} style={{ pointerEvents: 'none' }}>
                <div style={{
                    color: '#fef3c7',
                    textAlign: 'center',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    textShadow: '0 0 20px #f59e0b, 0 0 40px #f59e0b',
                    whiteSpace: 'nowrap',
                    opacity: 0.8
                }}>
                    <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase' }}>Neural</div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>Core</div>
                </div>
            </Html>
            {coreLines.map((line, i) => (
                <primitive object={line} key={i} position={[0, -1, 0]} />
            ))}
        </group>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE NODE INSPECTOR — exact Spin & Expand clone for a table's columns
// Each column = its own ellipsoid node, identical look to TableEllipsoid.
// Hover dims non-connected, FK columns pull their referenced-table phantom
// node toward them — exactly like the main scene hover-spread behaviour.
// ─────────────────────────────────────────────────────────────────────────────

// Build column-node + FK-bridge structures that mirror transformGraphData output
function transformNodeColumns(node, allTables = []) {
    const rawCols = node.columns || [];
    const rawFKs  = node.foreign_keys || [];

    // FK lookup: colName → {table, col}
    const fkMeta = new Map();
    rawFKs.forEach(fk => fkMeta.set(fk.column, { table: fk.referenced_table, col: fk.referenced_column }));

    // Assign a unique color to every referenced table.
    // FK column nodes will share this color with their phantom — making the visual bond obvious.
    const rawRefTableIds = [...new Set(rawFKs.map(fk => fk.referenced_table))];
    const refColorMap = new Map();
    rawRefTableIds.forEach((tableId, idx) => {
        const td = allTables.find(t => t.id === tableId || t.label === tableId);
        const paletteEntry = TABLE_COLORS[(idx + 2) % TABLE_COLORS.length]; // +2 offset avoids clash with center node
        refColorMap.set(tableId, {
            color: td?.color || paletteEntry.color,
            glow:  td?.glow  || paletteEntry.glow,
        });
    });

    // Sort: PKs → FKs → regular (alpha)
    const sorted = [...rawCols].sort((a, b) => {
        if (a.is_pk !== b.is_pk) return a.is_pk ? -1 : 1;
        if (a.is_fk !== b.is_fk) return a.is_fk ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    const n = sorted.length;
    const phi = Math.PI * (3 - Math.sqrt(5));
    const radius = Math.max(8, Math.min(22, 6 + n * 0.55));

    // PK → gold   FK → unique color per referenced table   COL → palette
    const colNodes = sorted.map((col, i) => {
        let color, glow;
        if (col.is_pk) {
            color = '#d97706'; glow = '#fbbf24';
        } else if (col.is_fk) {
            const ref = fkMeta.get(col.name);
            const refColors = ref ? (refColorMap.get(ref.table) || {}) : {};
            color = refColors.color || '#1d4ed8';
            glow  = refColors.glow  || '#60a5fa';
        } else {
            const p = TABLE_COLORS[i % TABLE_COLORS.length];
            color = p.color; glow = p.glow;
        }

        const y = n <= 1 ? 0 : 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = phi * i;

        const scale = col.is_pk ? 1.5 : col.is_fk ? 1.25 : 1.0;
        const badge = col.is_pk ? 'PK' : col.is_fk ? 'FK' : null;

        return {
            id:           col.name,
            label:        col.name,
            displayCount: (col.type || 'col').toLowerCase(),
            badge,
            color, glow, scale,
            position: [
                Math.cos(theta) * r * radius,
                y * radius * 0.75,
                Math.sin(theta) * r * radius,
            ],
            nodeData: col,
            fkRef: fkMeta.get(col.name) || null,
        };
    });

    // Phantom referenced-table nodes at ~1.9× radius — one per unique ref table.
    // freqPct defaults to equal split; SingleNodeInspector replaces it with
    // real-time fill_rate data fetched live from the backend.
    const phantomMap = new Map();
    const phantomRadius = radius * 1.9;
    const refCount = rawRefTableIds.length;
    colNodes.forEach((cn) => {
        if (!cn.fkRef) return;
        const pid = `__ref__${cn.fkRef.table}`;
        if (!phantomMap.has(pid)) {
            const seed = cn.fkRef.table.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const pTheta = (seed * 2.399963) % (Math.PI * 2);
            const pPhi   = Math.acos(2 * ((seed * 0.3183) % 1) - 1);
            const colors = refColorMap.get(cn.fkRef.table) || { color: '#334155', glow: '#64748b' };
            phantomMap.set(pid, {
                id: pid,
                label: cn.fkRef.table,
                displayCount: `→ ${cn.fkRef.col}`,
                color: colors.color,
                glow:  colors.glow,
                freqPct: Math.round(100 / Math.max(1, refCount)), // equal-split placeholder
                scale: 0.8,
                position: [
                    Math.sin(pPhi) * Math.cos(pTheta) * phantomRadius,
                    Math.cos(pPhi) * phantomRadius * 0.55,
                    Math.sin(pPhi) * Math.sin(pTheta) * phantomRadius,
                ],
                nodeData: { name: cn.fkRef.table },
                isPhantom: true,
            });
        }
    });
    const phantomNodes = Array.from(phantomMap.values());

    // FK bridges: FK column → phantom ref node
    const bridges = colNodes
        .filter(cn => cn.fkRef)
        .map(cn => {
            const pid = `__ref__${cn.fkRef.table}`;
            const phantom = phantomMap.get(pid);
            return {
                id:          `fk-${cn.id}-${pid}`,
                sourceId:    cn.id,
                sourcePos:   cn.position,
                sourceColor: cn.color,
                targetId:    pid,
                targetPos:   phantom.position,
                targetColor: phantom.glow,
                label:       `${cn.fkRef.table}.${cn.fkRef.col}`,
                fkColumn:    cn.fkRef.col,
                hubSize:     0.45,
            };
        });

    // Connectivity: colId / phantomId → [connected ids]
    const connectivity = {};
    bridges.forEach(b => {
        if (!connectivity[b.sourceId]) connectivity[b.sourceId] = [];
        if (!connectivity[b.targetId]) connectivity[b.targetId] = [];
        connectivity[b.sourceId].push(b.targetId);
        connectivity[b.targetId].push(b.sourceId);
    });

    return { colNodes, phantomNodes, bridges, connectivity };
}

// Column ellipsoid — pixel-perfect copy of TableEllipsoid adapted for columns
function ColumnEllipsoid({ col, isHighlighted, onHover }) {
    const meshRef  = useRef(null);
    const groupRef = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...col.position));
    const [hovered, setHovered] = useState(false);

    useFrame((state, delta) => {
        if (!meshRef.current || !groupRef.current) return;
        const t = state.clock.elapsedTime;
        currentPos.current.lerp(new THREE.Vector3(...col.position), delta * 5);
        groupRef.current.position.copy(currentPos.current);
        const freqScale = col.scale || 1.0;
        const pulse = 1 + Math.sin(t * 1.2 + col.position[0] * 0.5) * 0.04;
        const s = freqScale * (hovered ? 1.08 : 1) * pulse;
        meshRef.current.scale.set(s * 1.6, s, s * 0.7);
    });

    const isDimmed = col.isDimmed;

    return (
        <group ref={groupRef}>
            {isHighlighted && (
                <mesh scale={[1.65, 1.02, 0.72]}>
                    <sphereGeometry args={[1, 32, 32]} />
                    <meshBasicMaterial color={col.glow} transparent opacity={0.55} depthWrite={false} />
                </mesh>
            )}
            <mesh scale={[2.8, 1.7, 1.2]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color={col.glow} transparent
                    opacity={isHighlighted ? 0.35 : isDimmed ? 0.0 : 0.07} depthWrite={false} />
            </mesh>
            <mesh scale={[2.2, 1.35, 0.95]}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshBasicMaterial color={col.glow} transparent
                    opacity={isHighlighted ? 0.45 : isDimmed ? 0.0 : 0.10} depthWrite={false} />
            </mesh>
            <mesh
                ref={meshRef}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); onHover(col); }}
                onPointerOut={() => { setHovered(false); onHover(null); }}
            >
                <sphereGeometry args={[1, 48, 48]} />
                <meshStandardMaterial
                    color={isDimmed ? '#111111' : col.color}
                    emissive={isDimmed ? '#000000' : col.color}
                    emissiveIntensity={hovered ? 2.0 : isHighlighted ? 1.2 : isDimmed ? 0.0 : 0.85}
                    roughness={0.2} metalness={0.5}
                    transparent opacity={hovered ? 1.0 : isHighlighted ? 1.0 : isDimmed ? 0.06 : 0.82}
                    depthWrite={false}
                />
            </mesh>
            <Html center distanceFactor={40} style={{ pointerEvents: 'none' }}>
                <div style={{
                    color: 'white', textAlign: 'center',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    textShadow: `0 0 20px ${col.color}, 0 0 40px ${col.color}, 0 2px 8px rgba(0,0,0,0.8)`,
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                    opacity: isDimmed ? 0.15 : 1.0, transition: 'opacity 0.2s',
                }}>
                    {col.badge && (
                        <div style={{
                            fontSize: 8, fontWeight: 900, letterSpacing: 2,
                            color: col.badge === 'PK' ? '#fbbf24' : '#60a5fa',
                            background: col.badge === 'PK' ? 'rgba(251,191,36,0.12)' : 'rgba(96,165,250,0.12)',
                            border: `1px solid ${col.badge === 'PK' ? '#fbbf24' : '#60a5fa'}50`,
                            borderRadius: 10, padding: '1px 6px',
                            display: 'inline-block', marginBottom: 3,
                        }}>{col.badge}</div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>{col.label}</div>
                    <div style={{
                        fontSize: 11, fontWeight: 800, marginTop: 3,
                        color: col.color, background: 'rgba(0,0,0,0.6)',
                        padding: '2px 8px', borderRadius: 20, display: 'inline-block',
                        border: `1px solid ${col.color}60`,
                    }}>{col.displayCount}</div>
                    {col.statNumber && (
                        <div style={{
                            fontSize: 11, fontWeight: 900, marginTop: 2,
                            color: col.badge === 'PK' ? '#fbbf24' : '#22c55e',
                            background: 'rgba(0,0,0,0.55)',
                            padding: '1px 7px', borderRadius: 20, display: 'inline-block',
                            border: `1px solid ${col.badge === 'PK' ? '#fbbf2440' : '#22c55e40'}`,
                        }}>{col.statNumber}</div>
                    )}
                </div>
            </Html>
        </group>
    );
}
const MemoColumnEllipsoid = React.memo(ColumnEllipsoid);

// Phantom referenced-table node — dimmer, ghostly version of ColumnEllipsoid
function PhantomRefNode({ phantom, isHighlighted, targetPosition }) {
    const groupRef   = useRef(null);
    const meshRef    = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...phantom.position));

    useFrame((state, delta) => {
        if (!groupRef.current || !meshRef.current) return;
        const dest = targetPosition
            ? new THREE.Vector3(...targetPosition)
            : new THREE.Vector3(...phantom.position);
        currentPos.current.lerp(dest, delta * 5);
        groupRef.current.position.copy(currentPos.current);
        const freqScale = phantom.scale || 0.8;
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.0 + phantom.position[0]) * 0.04;
        meshRef.current.scale.set(1.4 * freqScale * pulse, 0.88 * freqScale * pulse, 0.62 * freqScale * pulse);
    });

    const displayRows = phantom.distinctCount >= 1000000 ? `${(phantom.distinctCount / 1000000).toFixed(1)}M`
        : phantom.distinctCount >= 1000 ? `${(phantom.distinctCount / 1000).toFixed(1)}k`
        : phantom.distinctCount > 0 ? String(phantom.distinctCount) : null;

    return (
        <group ref={groupRef}>
            {isHighlighted && (
                <mesh scale={[1.65, 1.02, 0.72]}>
                    <sphereGeometry args={[1, 24, 24]} />
                    <meshBasicMaterial color={phantom.glow} transparent opacity={0.45} depthWrite={false} />
                </mesh>
            )}
            <mesh scale={[2.5, 1.5, 1.1]}>
                <sphereGeometry args={[1, 24, 24]} />
                <meshBasicMaterial color={phantom.glow} transparent
                    opacity={isHighlighted ? 0.25 : 0.10} depthWrite={false} />
            </mesh>
            <mesh ref={meshRef}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial
                    color={phantom.color}
                    emissive={phantom.glow}
                    emissiveIntensity={isHighlighted ? 1.4 : 0.55}
                    roughness={0.3} metalness={0.4}
                    transparent opacity={isHighlighted ? 0.92 : 0.58}
                    depthWrite={false}
                />
            </mesh>
            <Html center distanceFactor={40} style={{ pointerEvents: 'none' }}>
                <div style={{
                    textAlign: 'center', fontFamily: "'Inter', system-ui, sans-serif",
                    whiteSpace: 'nowrap', pointerEvents: 'none',
                    textShadow: `0 0 14px ${phantom.glow}`,
                    transition: 'all 0.3s',
                }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase',
                        color: phantom.glow, marginBottom: 2,
                    }}>ref table</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{phantom.label}</div>
                    {phantom.freqPct > 0 && (
                        <div style={{
                            fontSize: 11, fontWeight: 900, marginTop: 3,
                            color: phantom.glow,
                            background: `${phantom.color}28`,
                            padding: '2px 9px', borderRadius: 20, display: 'inline-block',
                            border: `1px solid ${phantom.glow}70`,
                        }}>{phantom.freqPct}%</div>
                    )}
                    {displayRows && (
                        <div style={{
                            fontSize: 10, fontWeight: 600, marginTop: 2,
                            color: '#94a3b8', background: 'rgba(0,0,0,0.55)',
                            padding: '1px 7px', borderRadius: 20, display: 'inline-block',
                            border: '1px solid #33415550',
                        }}>{displayRows} uniq</div>
                    )}
                </div>
            </Html>
        </group>
    );
}
const MemoPhantomRefNode = React.memo(PhantomRefNode);

// Full inspector 3D scene — mirrors Scene exactly
function InspectorScene({ node, tableColor, tableGlow, colNodes, phantomNodes, bridges, connectivity, showPKs, showFKs }) {
    const [hoveredId, setHoveredId] = useState(null);
    const hoverClearTimer = useRef(null);

    // Apply Key Visibility filtering
    const visibleColNodes = useMemo(() => colNodes.filter(c => {
        if (c.badge === 'PK' && !showPKs) return false;
        if (c.badge === 'FK' && !showFKs) return false;
        return true;
    }), [colNodes, showPKs, showFKs]);

    const visibleBridges = useMemo(() =>
        showFKs ? bridges : [], [bridges, showFKs]);

    const visiblePhantomNodes = useMemo(() =>
        showFKs ? phantomNodes : [], [phantomNodes, showFKs]);

    const connectedToHovered = useMemo(() => {
        if (!hoveredId || !connectivity) return [];
        return connectivity[hoveredId] || [];
    }, [hoveredId, connectivity]);

    // When hovering a FK column, spread its phantom ref node out around it
    const targetPositions = useMemo(() => {
        if (!hoveredId || connectedToHovered.length === 0) return {};
        const hovered = [...visibleColNodes, ...visiblePhantomNodes].find(n => n.id === hoveredId);
        if (!hovered) return {};
        const [hx, hy, hz] = hovered.position;
        const count = connectedToHovered.length;
        const phi = Math.PI * (3 - Math.sqrt(5));
        const spreadR = 10;
        const result = {};
        connectedToHovered.forEach((id, i) => {
            if (count === 1) { result[id] = [hx + spreadR, hy, hz]; return; }
            const y = 1 - (i / (count - 1)) * 2;
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = phi * i;
            result[id] = [hx + Math.cos(theta) * r * spreadR, hy + y * spreadR * 0.55, hz + Math.sin(theta) * r * spreadR];
        });
        return result;
    }, [hoveredId, connectedToHovered, visibleColNodes, visiblePhantomNodes]);

    return (
        <>
            <ambientLight intensity={0.15} />
            <pointLight position={[10, 12, 10]} intensity={0.8} color="#ffffff" />
            <pointLight position={[-8, -4, -8]} intensity={0.5} color={tableColor} />
            <pointLight position={[8, -6, 5]} intensity={0.4} color="#22c55e" />
            <pointLight position={[0, 8, -5]} intensity={0.3} color="#f59e0b" />
            <pointLight position={[0, -8, 3]} intensity={0.3} color="#60a5fa" />
            <pointLight position={[0, 1, 0]} intensity={1.2} color={tableGlow} distance={20} decay={2} />

            <Stars radius={60} depth={60} count={3000} factor={3} saturation={0.3} fade speed={0.3} />

            {/* Table core — same NeuralCore style */}
            <NeuralCoreInspector tableColor={tableColor} tableGlow={tableGlow}
                label={node.name || node.id}
                rowCount={node.row_count || 0}
                colCount={visibleColNodes.length}
            />

            {/* FK arcs — only while something is hovered */}
            {hoveredId && visibleBridges
                .filter(b => b.sourceId === hoveredId || b.targetId === hoveredId)
                .map(b => (
                    <MemoDirectFKLine key={b.id}
                        from={targetPositions[b.sourceId] || b.sourcePos}
                        to={targetPositions[b.targetId] || b.targetPos}
                        fromColor={b.sourceColor} toColor={b.targetColor}
                        label={b.label} fkColumn={b.fkColumn}
                        hubSize={b.hubSize} rowCount={b.rowCount}
                    />
                ))
            }

            {/* Column ellipsoids */}
            {visibleColNodes.map((col) => (
                <MemoColumnEllipsoid
                    key={col.id}
                    col={{
                        ...col,
                        isDimmed: hoveredId && hoveredId !== col.id && !connectedToHovered.includes(col.id),
                    }}
                    isHighlighted={connectedToHovered.includes(col.id)}
                    onHover={(c) => {
                        if (c?.id) {
                            if (hoverClearTimer.current) { clearTimeout(hoverClearTimer.current); hoverClearTimer.current = null; }
                            setHoveredId(c.id);
                        } else {
                            if (!hoverClearTimer.current) {
                                hoverClearTimer.current = setTimeout(() => {
                                    setHoveredId(null);
                                    hoverClearTimer.current = null;
                                }, 500);
                            }
                        }
                    }}
                />
            ))}

            {/* Phantom ref-table nodes — only visible when a FK column is hovered */}
            {visiblePhantomNodes.map((ph) => (
                <MemoPhantomRefNode
                    key={ph.id}
                    phantom={ph}
                    isHighlighted={connectedToHovered.includes(ph.id) || hoveredId === ph.id}
                    targetPosition={targetPositions[ph.id] || null}
                />
            ))}

            <OrbitControls enableDamping dampingFactor={0.05} minDistance={5} maxDistance={120} />
        </>
    );
}

// Minimal neural-core styled center node — shows the table identity
function NeuralCoreInspector({ tableColor, tableGlow, label, rowCount, colCount }) {
    const coreRef  = useRef(null);
    const ring1Ref = useRef(null);
    const ring2Ref = useRef(null);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (coreRef.current) coreRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.07);
        if (ring1Ref.current) ring1Ref.current.rotation.set(t * 0.45, t * 0.28, 0);
        if (ring2Ref.current) ring2Ref.current.rotation.set(0, t * 0.38, t * 0.55);
    });

    const displayRows = rowCount >= 1000000 ? `${(rowCount / 1000000).toFixed(1)}M`
        : rowCount >= 1000 ? `${(rowCount / 1000).toFixed(1)}k`
        : rowCount > 0 ? String(rowCount) : '—';

    return (
        <group position={[0, 0, 0]}>
            <mesh><sphereGeometry args={[2.8, 32, 32]} />
                <meshBasicMaterial color={tableGlow} transparent opacity={0.04} /></mesh>
            <mesh><sphereGeometry args={[2.0, 32, 32]} />
                <meshBasicMaterial color={tableGlow} transparent opacity={0.08} /></mesh>
            <mesh ref={coreRef}>
                <sphereGeometry args={[1.1, 48, 48]} />
                <meshStandardMaterial color={tableColor} emissive={tableGlow}
                    emissiveIntensity={1.8} roughness={0.1} metalness={0.8}
                    transparent opacity={0.95} />
            </mesh>
            <mesh><sphereGeometry args={[0.5, 24, 24]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.6} /></mesh>
            <mesh ref={ring1Ref}>
                <torusGeometry args={[1.8, 0.022, 16, 64]} />
                <meshBasicMaterial color={tableGlow} transparent opacity={0.5} />
            </mesh>
            <mesh ref={ring2Ref}>
                <torusGeometry args={[2.3, 0.015, 16, 64]} />
                <meshBasicMaterial color={tableColor} transparent opacity={0.35} />
            </mesh>
            <Html center distanceFactor={45} style={{ pointerEvents: 'none' }}>
                <div style={{
                    textAlign: 'center', fontFamily: "'Inter', system-ui, sans-serif",
                    textShadow: `0 0 20px ${tableGlow}, 0 0 40px ${tableGlow}`,
                    whiteSpace: 'nowrap', pointerEvents: 'none', color: '#fff',
                }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', color: tableGlow, marginBottom: 2 }}>table</div>
                    <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>{label}</div>
                    <div style={{
                        fontSize: 11, fontWeight: 800, marginTop: 4, color: tableColor,
                        background: 'rgba(0,0,0,0.6)', padding: '2px 10px',
                        borderRadius: 20, display: 'inline-block', border: `1px solid ${tableColor}60`,
                    }}>{displayRows} rows · {colCount} cols</div>
                </div>
            </Html>
        </group>
    );
}

function SingleNodeInspector({ node, tables, connectionId, onClose, showPKs = true, showFKs = true }) {
    const tableData = tables.find(t => t.id === node.id);
    const color = tableData?.color || '#2563eb';
    const glow  = tableData?.glow  || '#60a5fa';

    // ── Real-time FK fill-rate fetch ────────────────────────────────────────
    const [freqData, setFreqData]       = useState(null);
    const [freqLoading, setFreqLoading] = useState(false);

    useEffect(() => {
        if (!connectionId || !node.id) return;
        setFreqLoading(true);
        fetch(`/api/graph/${connectionId}/node-frequency/${encodeURIComponent(node.id)}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { setFreqData(d); setFreqLoading(false); })
            .catch(() => setFreqLoading(false));
    }, [connectionId, node.id]);

    const { colNodes, phantomNodes, bridges, connectivity } = useMemo(
        () => transformNodeColumns(node, tables), [node, tables]
    );

    // Inject stat numbers into column nodes:
    //   FK  → fill_rate% (how populated is this FK column)
    //   PK  → row count of the table
    const enrichedColNodes = useMemo(() => {
        const fillMap = new Map();
        if (freqData?.fk_stats) {
            freqData.fk_stats.forEach(stat => fillMap.set(stat.column, stat));
        }
        const rowCount = node.row_count || 0;
        const pkDisplay = rowCount >= 1000000 ? `${(rowCount / 1000000).toFixed(1)}M`
            : rowCount >= 1000 ? `${(rowCount / 1000).toFixed(1)}k`
            : rowCount > 0 ? String(rowCount) : null;
        return colNodes.map(col => {
            if (col.badge === 'FK') {
                const stat = fillMap.get(col.id);
                if (stat) return { ...col, statNumber: `${Math.round(stat.fill_rate)}%` };
            }
            if (col.badge === 'PK' && pkDisplay) {
                return { ...col, statNumber: pkDisplay };
            }
            return col;
        });
    }, [colNodes, freqData, node.row_count]);

    // Override phantom nodes with live fill_rate + distinct_count from backend
    const enrichedPhantomNodes = useMemo(() => {
        if (!freqData?.fk_stats?.length) return phantomNodes;
        const fillMap = new Map();
        freqData.fk_stats.forEach(stat => {
            const prev = fillMap.get(stat.referenced_table);
            if (!prev || stat.fill_rate > prev.fill_rate) fillMap.set(stat.referenced_table, stat);
        });
        return phantomNodes.map(p => {
            const stat = fillMap.get(p.label);
            if (!stat) return p;
            return {
                ...p,
                freqPct:      stat.fill_rate,
                scale:        0.7 + (stat.fill_rate / 100) * 0.65,
                distinctCount: stat.distinct_count,
                fillRate:     stat.fill_rate,
            };
        });
    }, [phantomNodes, freqData]);

    // Summary legend — sorted descending by fill rate
    const refFrequencies = useMemo(() =>
        [...enrichedPhantomNodes]
            .sort((a, b) => b.freqPct - a.freqPct)
            .map(p => ({
                id:            p.id,
                label:         p.label,
                color:         p.color,
                glow:          p.glow,
                freqPct:       Math.round(p.freqPct),
                distinctCount: p.distinctCount || 0,
            })),
        [enrichedPhantomNodes]
    );

    const pkCount  = enrichedColNodes.filter(c => c.badge === 'PK').length;
    const fkCount  = enrichedColNodes.filter(c => c.badge === 'FK').length;
    const regCount = enrichedColNodes.length - pkCount - fkCount;
    const camZ     = colNodes.length > 25 ? 38 : colNodes.length > 12 ? 28 : 20;

    return (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
            {/* Exit */}
            <button onClick={onClose} style={{
                position: 'absolute', top: 16, right: 16, zIndex: 100,
                background: 'rgba(0,0,0,0.75)', border: `1px solid ${glow}50`,
                color: glow, borderRadius: 8, padding: '6px 14px',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.15em',
                textTransform: 'uppercase', cursor: 'pointer', backdropFilter: 'blur(8px)',
            }}>✕ Exit Inspector</button>

            {/* Header */}
            <div style={{
                position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                zIndex: 100, display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(0,0,0,0.65)', border: `1px solid ${glow}35`,
                borderRadius: 20, padding: '5px 18px', backdropFilter: 'blur(10px)',
                pointerEvents: 'none',
            }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: glow, boxShadow: `0 0 8px ${glow}` }} />
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.25em', color: glow, textTransform: 'uppercase' }}>
                    Node Inspector · {node.name || node.id}
                </span>
            </div>

            {/* FK Fill Rate Panel */}
            {refFrequencies.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: 88, right: 16, zIndex: 100,
                    pointerEvents: 'none', width: 240,
                    background: 'rgba(0,0,0,0.72)', border: '1px solid #1e293b',
                    borderRadius: 10, padding: '8px 12px', backdropFilter: 'blur(10px)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: '#64748b', textTransform: 'uppercase' }}>
                            FK Fill Rate
                        </div>
                        {freqLoading && (
                            <div style={{ fontSize: 7, color: '#475569', letterSpacing: 1 }}>LOADING…</div>
                        )}
                        {!freqLoading && freqData && (
                            <div style={{ fontSize: 7, color: '#22c55e', letterSpacing: 1 }}>● LIVE</div>
                        )}
                    </div>
                    {/* Stacked fill-rate bar */}
                    <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', height: 7, marginBottom: 8 }}>
                        {refFrequencies.map(ref => (
                            <div key={ref.id} style={{
                                width: `${ref.freqPct}%`, minWidth: ref.freqPct > 0 ? 3 : 0,
                                background: ref.color, transition: 'width 0.5s',
                            }} />
                        ))}
                    </div>
                    {/* Legend rows */}
                    {refFrequencies.map(ref => (
                        <div key={ref.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: ref.color, boxShadow: `0 0 5px ${ref.glow}` }} />
                                <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 600 }}>{ref.label}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: ref.glow }}>{ref.freqPct}%</span>
                                {ref.distinctCount > 0 && (
                                    <span style={{ fontSize: 8, color: '#475569' }}>{ref.distinctCount.toLocaleString()} uniq</span>
                                )}
                            </div>
                        </div>
                    ))}
                    <div style={{ marginTop: 4, borderTop: '1px solid #1e293b', paddingTop: 4, fontSize: 7, color: '#334155' }}>
                        fill rate = rows with FK populated / total rows
                    </div>
                </div>
            )}

            {/* Legend */}
            <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                zIndex: 100, display: 'flex', gap: 8, pointerEvents: 'none',
            }}>
                {[
                    { label: 'PK', count: pkCount, color: '#fbbf24' },
                    { label: 'FK', count: fkCount, color: '#60a5fa' },
                    { label: 'COL', count: regCount, color },
                ].map(({ label, count, color: c }) => (
                    <div key={label} style={{
                        background: 'rgba(0,0,0,0.75)', border: `1px solid ${c}40`,
                        borderRadius: 8, padding: '5px 12px', textAlign: 'center',
                        backdropFilter: 'blur(8px)',
                    }}>
                        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: c, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{count}</div>
                    </div>
                ))}
                <div style={{
                    background: 'rgba(0,0,0,0.75)', border: '1px solid #334155',
                    borderRadius: 8, padding: '5px 12px', textAlign: 'center',
                    backdropFilter: 'blur(8px)',
                }}>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: '#64748b', textTransform: 'uppercase' }}>hover</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', marginTop: 2 }}>FK node to see refs</div>
                </div>
            </div>

            <Canvas
                camera={{ position: [0, 4, camZ], fov: 50 }}
                gl={{ antialias: true, alpha: false }}
                style={{ background: 'hsl(220, 25%, 3%)' }}
            >
                <InspectorScene
                    node={node}
                    tableColor={color} tableGlow={glow}
                    colNodes={enrichedColNodes}
                    phantomNodes={enrichedPhantomNodes}
                    bridges={bridges}
                    connectivity={connectivity}
                    showPKs={showPKs}
                    showFKs={showFKs}
                />
            </Canvas>
        </div>
    );
}

// ─── Camera Controller ──────────────────────────────────────────────────────
function CameraController({ cameraRef }) {
    const { camera } = useThree();
    useEffect(() => {
        cameraRef.current = camera;
    }, [camera, cameraRef]);
    return null;
}

// ─── Scene ──────────────────────────────────────────────────────────────────
function Scene({ tables, bridges, connectivity, onNodeClick, onNodeHover, selectedId, setSelectedId, controlsRef, cameraRef, edgesVisible, multiSelectedNodes, singleNodeViewEnabled, onInspectNode, activeLens }) {
    const [hoveredTableId, setHoveredTableId] = useState(null);
    const hoverClearTimer = useRef(null);
    const hoverShowTimer = useRef(null);

    const connectedToHovered = useMemo(() => {
        if (!hoveredTableId || !connectivity) return [];
        return connectivity[hoveredTableId] || [];
    }, [hoveredTableId, connectivity]);

    // Hovered node stays fixed; connected nodes spread in Fibonacci sphere around it
    const targetPositions = useMemo(() => {
        if (!hoveredTableId || connectedToHovered.length === 0) return {};
        const hovered = tables.find(t => t.id === hoveredTableId);
        if (!hovered) return {};
        const [hx, hy, hz] = hovered.position;
        const count = connectedToHovered.length;
        const radius = Math.max(12, Math.min(38, 10 + count * 1.8));
        const phi = Math.PI * (3 - Math.sqrt(5));
        const result = {};

        connectedToHovered.forEach((id, i) => {
            if (count === 1) {
                result[id] = [hx + radius, hy, hz];
                return;
            }
            const y = 1 - (i / (count - 1)) * 2;
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = phi * i;
            result[id] = [
                hx + Math.cos(theta) * r * radius,
                hy + y * radius * 0.55,
                hz + Math.sin(theta) * r * radius,
            ];
        });
        return result;
    }, [hoveredTableId, connectedToHovered, tables]);

    return (
        <>
            <ambientLight intensity={0.15} />
            <pointLight position={[10, 12, 10]} intensity={0.8} color="#ffffff" />
            <pointLight position={[-8, -4, -8]} intensity={0.5} color="#3b82f6" />
            <pointLight position={[8, -6, 5]} intensity={0.4} color="#22c55e" />
            <pointLight position={[0, 8, -5]} intensity={0.3} color="#f59e0b" />
            <pointLight position={[0, -8, 3]} intensity={0.3} color="#9333ea" />
            <pointLight position={[0, 1, 0]} intensity={1} color="#fbbf24" distance={20} decay={2} />

            {activeLens !== 'latent' && (
                <Stars radius={60} depth={60} count={3000} factor={3} saturation={0.3} fade speed={0.3} />
            )}

            <NeuralCore tables={tables} />
            {edgesVisible && <MemoHoverFKConnections bridges={bridges} hoveredTableId={hoveredTableId} tables={tables} targetPositions={targetPositions} />}

            {tables.map((table) => (
                <MemoTableEllipsoid
                    key={table.id}
                    table={{
                        ...table,
                        isDimmed: hoveredTableId && hoveredTableId !== table.id && !connectedToHovered.includes(table.id)
                    }}
                    isSelected={selectedId === table.id || (multiSelectedNodes || []).includes(table.id)}
                    isHighlighted={connectedToHovered.includes(table.id)}
                    targetPosition={targetPositions[table.id] || null}
                    onClick={(e) => {
                        const shiftKey = e?.nativeEvent?.shiftKey || e?.shiftKey || false;
                        const newSelected = selectedId === table.id ? null : table.id;
                        setSelectedId(newSelected);
                        if (onNodeClick && table.nodeData) {
                            onNodeClick(table.nodeData, shiftKey);
                        }
                    }}
                    onHover={(nodeData) => {
                        if (nodeData?.id) {
                            // Single Node Inspector: instant jump on hover, no delay
                            if (singleNodeViewEnabled && onInspectNode) {
                                onInspectNode(nodeData);
                                return;
                            }
                            // Cancel any pending clear
                            if (hoverClearTimer.current) { clearTimeout(hoverClearTimer.current); hoverClearTimer.current = null; }
                            // Only show after 300ms dwell — prevents flash on quick mouse-overs
                            if (!hoverShowTimer.current) {
                                hoverShowTimer.current = setTimeout(() => {
                                    setHoveredTableId(nodeData.id);
                                    if (onNodeHover) onNodeHover(nodeData);
                                    hoverShowTimer.current = null;
                                }, 300);
                            }
                        } else {
                            // Cancel any pending show
                            if (hoverShowTimer.current) { clearTimeout(hoverShowTimer.current); hoverShowTimer.current = null; }
                            // Delay clear so mouse can reach FK hub
                            if (!hoverClearTimer.current) {
                                hoverClearTimer.current = setTimeout(() => {
                                    setHoveredTableId(null);
                                    if (onNodeHover) onNodeHover(null);
                                    hoverClearTimer.current = null;
                                }, 700);
                            }
                        }
                    }}
                />
            ))}

            <CameraController cameraRef={cameraRef} />

            <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.05}

                minDistance={5}
                maxDistance={150}
            />
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const ThreeGraphSpinExpand = forwardRef(({
    data,
    tps = 0,
    liveTableCounts = {},
    onNodeClick,
    onNodeHover,
    onEdgeHover,
    activeLens = 'ops',
    clusteringMethod = 'heuristic',
    paused = false,
    className = '',
    activeFilters = {},
    timeValue = 100,
    onNodesEnriched,
    multiSelectedNodes,
    showMultiConnections,
    snapshotData = null,
    isSnapshotMode = false,
    layoutMode: layoutModeProp = 'galaxy',
    showPKs = true,
    showFKs = true,
    singleNodeViewEnabled = false,
    connectionId = null,
}, ref) => {

    const [selectedId, setSelectedId] = useState(null);
    const [edgesVisible, setEdgesVisible] = useState(true);
    const [inspectedNode, setInspectedNode] = useState(null);
    const controlsRef = useRef(null);
    const cameraRef = useRef(null);

    // Transform data
    const { tables, bridges, connectivity } = useMemo(
        () => transformGraphData(data, showPKs, showFKs),
        [data, showPKs, showFKs]
    );

    // ─── Voice Command Stubs ────────────────────────────────────────────────
    const noopHandler = useCallback(() => ({ success: true }), []);
    useRegisterCommand('graph_zoom', noopHandler);
    useRegisterCommand('graph_highlight', noopHandler);
    useRegisterCommand('graph_camera', noopHandler);
    useRegisterCommand('graph_flow', noopHandler);
    useRegisterCommand('graph_trace_lineage', noopHandler);
    useRegisterCommand('graph_lens', noopHandler);
    useRegisterCommand('graph_edges', noopHandler);

    // ─── Imperative Handle (same API as original ThreeGraph) ────────────────
    useImperativeHandle(ref, () => ({
        zoomToCluster: (target) => {
            logger.debug(`[SpinExpand] Zoom to cluster: ${target}`);
            const normalizedTarget = target.toLowerCase().trim();
            const matchTable = tables.find(t =>
                t.id.toLowerCase() === normalizedTarget ||
                t.label.toLowerCase() === normalizedTarget ||
                t.label.toLowerCase().includes(normalizedTarget)
            );
            if (matchTable) {
                setSelectedId(matchTable.id);
                return true;
            }
            return false;
        },
        setEvolutionSnapshot: (snapshot) => {
            logger.debug('[SpinExpand] Evolution snapshot received');
        },
        applySnapshot: (snapshot) => {
            logger.debug('[SpinExpand] Apply snapshot');
        },
        setLens: (lens) => {
            logger.debug(`[SpinExpand] Set lens: ${lens}`);
        },
        startFlow: () => {
            logger.debug('[SpinExpand] Start flow');
        },
        stopFlow: () => {
            logger.debug('[SpinExpand] Stop flow');
        },
        toggleEdges: (visible) => {
            logger.debug(`[SpinExpand] Toggle edges: ${visible}`);
            setEdgesVisible(visible);
        },
        highlightNode: (nodeName) => {
            logger.debug(`[SpinExpand] Highlight node: ${nodeName}`);
            const cleanName = nodeName.toString().toLowerCase().replace(/[.,!?;:]$/, '').trim();
            const target = tables.find(t =>
                t.label.toLowerCase() === cleanName ||
                t.id.toLowerCase() === cleanName ||
                t.label.toLowerCase().includes(cleanName)
            );
            if (target) setSelectedId(target.id);
        },
        resetView: () => {
            logger.debug('[SpinExpand] Reset view');
            setSelectedId(null);
            if (controlsRef.current) controlsRef.current.reset();
        },
        zoom: (factor) => {
            if (cameraRef.current && controlsRef.current) {
                const dir = new THREE.Vector3().subVectors(
                    controlsRef.current.target, cameraRef.current.position
                ).normalize();
                const dist = cameraRef.current.position.distanceTo(controlsRef.current.target);
                const newDist = Math.max(5, Math.min(150, dist * factor));
                cameraRef.current.position.copy(controlsRef.current.target).sub(dir.multiplyScalar(newDist));
                controlsRef.current.update();
            }
        },
        setLatentMode: (mode) => {
            logger.debug(`[SpinExpand] Set latent mode: ${mode}`);
        },
        setLayoutMode: (mode) => {
            logger.debug(`[SpinExpand] Set layout mode: ${mode}`);
        },
        toggleLatentMode: () => {
            logger.debug('[SpinExpand] Toggle latent mode');
        },
        screenshot: () => {
            logger.debug('[SpinExpand] Screenshot requested');
        },
    }), [tables]);

    return (
        <div className={className || 'absolute inset-0 z-0'}>
            {isSnapshotMode && (
                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 px-6 py-3 bg-amber-500/20 backdrop-blur-md border border-amber-500/40 rounded-full flex items-center gap-3 animate-pulse pointer-events-none">
                    <div className="w-2 h-2 bg-amber-500 rounded-full" />
                    <span className="text-amber-300 text-xs font-bold uppercase tracking-[0.2em]">
                        Viewing Snapshot Analysis — Live Data Paused
                    </span>
                </div>
            )}

            <div
                className={`absolute inset-0 z-0 transition-opacity duration-700 ${isSnapshotMode ? 'opacity-80' : 'opacity-100'}`}
                style={{ willChange: 'transform' }}
            >
                <Canvas
                    camera={{ position: [0, 5, 80], fov: 45 }}
                    gl={{ antialias: true, alpha: false }}
                    style={{ background: 'hsl(220, 25%, 3%)' }}
                >
                    <Scene
                        tables={tables}
                        bridges={bridges}
                        connectivity={connectivity}
                        onNodeClick={onNodeClick}
                        onNodeHover={onNodeHover}
                        selectedId={selectedId}
                        setSelectedId={setSelectedId}
                        controlsRef={controlsRef}
                        cameraRef={cameraRef}
                        edgesVisible={edgesVisible}
                        multiSelectedNodes={multiSelectedNodes}
                        singleNodeViewEnabled={singleNodeViewEnabled}
                        onInspectNode={setInspectedNode}
                        activeLens={activeLens}
                    />
                </Canvas>
            </div>

            {/* Single Node Inspector — full-screen overlay, completely isolated scene */}
            {inspectedNode && (
                <SingleNodeInspector
                    node={inspectedNode}
                    tables={tables}
                    connectionId={connectionId}
                    onClose={() => setInspectedNode(null)}
                    showPKs={showPKs}
                    showFKs={showFKs}
                />
            )}
        </div>
    );
});

export default React.memo(ThreeGraphSpinExpand);
