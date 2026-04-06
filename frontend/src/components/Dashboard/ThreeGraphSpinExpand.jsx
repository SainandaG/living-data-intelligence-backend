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

// 50 hand-picked perceptually distinct colors for dark backgrounds.
// Each entry is visually unique — no two look the same even at a glance.
const DISTINCT_NODE_COLORS = [
    '#e63946', '#2dc653', '#f4a261', '#c77dff', '#00b4d8',
    '#ff6b6b', '#06d6a0', '#ffd166', '#7b2d8b', '#4cc9f0',
    '#ef233c', '#80b918', '#ff9f1c', '#9d4edd', '#48cae4',
    '#d62828', '#a7c957', '#fb8500', '#6a0572', '#0077b6',
    '#e76f51', '#52b788', '#ffbe0b', '#7209b7', '#4895ef',
    '#f72585', '#43aa8b', '#f3722c', '#560bad', '#4361ee',
    '#b5179e', '#90be6d', '#f8961e', '#3a0ca3', '#277da1',
    '#ff4d6d', '#55a630', '#ff7c43', '#5e548e', '#0096c7',
    '#c9184a', '#6a994e', '#f4845f', '#7b2fff', '#48b2e8',
    '#ff595e', '#25a244', '#ff924c', '#8338ec', '#3a86ff',
];

function getRegularColumnColor(idx) {
    const hex = DISTINCT_NODE_COLORS[idx % DISTINCT_NODE_COLORS.length];
    // Derive glow by lightening each channel
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const glow = `rgb(${Math.min(255, r + 70)},${Math.min(255, g + 70)},${Math.min(255, b + 70)})`;
    return { color: hex, glow };
}

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
            {connections.map(({ key, ...connProps }) => (
                <MemoDirectFKLine key={key} {...connProps} />
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
// SINGLE NODE INSPECTOR
// Shows a table's columns as orbital nodes around a center core.
//
// PK HOVER MODE: hover a PK node →
//   • Small equal-size "PK value" satellite nodes appear around it
//     (customer_id_1, customer_id_2, …) — all same tiny size
//   • Each PK value node connects via arc to FK nodes in referencing tables
//   • FK node SIZE is proportional to distribution %
//     (customer ordered 4/10 = 40% → larger FK node)
//
// FK HOVER MODE: hover a FK node → phantom ref-table nodes spread out (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

// Build column-node + FK-bridge structures
function transformNodeColumns(node, allTables = []) {
    const rawCols = node.columns || [];
    const rawFKs = node.foreign_keys || [];

    const fkMeta = new Map();
    rawFKs.forEach(fk => fkMeta.set(fk.column, { table: fk.referenced_table, col: fk.referenced_column }));

    const rawRefTableIds = [...new Set(rawFKs.map(fk => fk.referenced_table))];
    const refColorMap = new Map();
    rawRefTableIds.forEach((tableId, idx) => {
        const td = allTables.find(t => t.id === tableId || t.label === tableId);
        const paletteEntry = TABLE_COLORS[(idx + 2) % TABLE_COLORS.length];
        refColorMap.set(tableId, {
            color: td?.color || paletteEntry.color,
            glow: td?.glow || paletteEntry.glow,
        });
    });

    const sorted = [...rawCols].sort((a, b) => {
        if (a.is_pk !== b.is_pk) return a.is_pk ? -1 : 1;
        if (a.is_fk !== b.is_fk) return a.is_fk ? -1 : 1;
        return a.name.localeCompare(b.name);
    });

    const n = sorted.length;
    const phi = Math.PI * (3 - Math.sqrt(5));
    const radius = Math.max(8, Math.min(22, 6 + n * 0.55));

    const colNodes = sorted.map((col, i) => {
        let color, glow;
        if (col.is_pk) {
            // PK: always gold — unmistakable, badge + ring confirm type
            color = '#d97706'; glow = '#fbbf24';
        } else if (col.is_fk) {
            // FK: color = the referenced table's unique color (semantic link)
            // The "FK" badge + blue ring on the node still identifies it as FK.
            // This also visually connects each FK node to its matching REF phantom node.
            const ref = fkMeta.get(col.name);
            const refColors = ref ? (refColorMap.get(ref.table) || {}) : {};
            color = refColors.color || '#2563eb';
            glow = refColors.glow || '#60a5fa';
        } else {
            // Regular columns: unique HSL color per column index
            const p = getRegularColumnColor(i);
            color = p.color; glow = p.glow;
        }

        const y = n <= 1 ? 0 : 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = phi * i;
        const scale = col.is_pk ? 1.5 : col.is_fk ? 1.25 : 1.0;
        const badge = col.is_pk ? 'PK' : col.is_fk ? 'FK' : null;

        return {
            id: col.name,
            label: col.name,
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

    // Phantom ref-table nodes (for FK hover)
    const phantomMap = new Map();
    const phantomRadius = radius * 1.9;
    const refCount = rawRefTableIds.length;
    colNodes.forEach((cn) => {
        if (!cn.fkRef) return;
        const pid = `__ref__${cn.fkRef.table}`;
        if (!phantomMap.has(pid)) {
            const seed = cn.fkRef.table.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const pTheta = (seed * 2.399963) % (Math.PI * 2);
            const pPhi = Math.acos(2 * ((seed * 0.3183) % 1) - 1);
            const colors = refColorMap.get(cn.fkRef.table) || { color: '#334155', glow: '#64748b' };
            phantomMap.set(pid, {
                id: pid,
                label: cn.fkRef.table,
                color: colors.color,
                glow: colors.glow,
                freqPct: Math.round(100 / Math.max(1, refCount)),
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

    const bridges = colNodes
        .filter(cn => cn.fkRef)
        .map(cn => {
            const pid = `__ref__${cn.fkRef.table}`;
            const phantom = phantomMap.get(pid);
            return {
                id: `fk-${cn.id}-${pid}`,
                sourceId: cn.id,
                sourcePos: cn.position,
                sourceColor: cn.color,
                targetId: pid,
                targetPos: phantom.position,
                targetColor: phantom.glow,
                label: `${cn.fkRef.table}.${cn.fkRef.col}`,
                fkColumn: cn.fkRef.col,
                hubSize: 0.45,
            };
        });

    const connectivity = {};
    bridges.forEach(b => {
        if (!connectivity[b.sourceId]) connectivity[b.sourceId] = [];
        if (!connectivity[b.targetId]) connectivity[b.targetId] = [];
        connectivity[b.sourceId].push(b.targetId);
        connectivity[b.targetId].push(b.sourceId);
    });

    return { colNodes, phantomNodes, bridges, connectivity };
}

// ── Distinct colors for PK value satellite nodes (one per unique PK value) ─────
const PK_VALUE_COLORS = [
    { color: '#f97316', glow: '#fb923c' },   // orange
    { color: '#a855f7', glow: '#c084fc' },   // violet
    { color: '#06b6d4', glow: '#22d3ee' },   // cyan
    { color: '#84cc16', glow: '#a3e635' },   // lime
    { color: '#f43f5e', glow: '#fb7185' },   // rose
    { color: '#3b82f6', glow: '#60a5fa' },   // blue
    { color: '#10b981', glow: '#34d399' },   // emerald
    { color: '#eab308', glow: '#facc15' },   // yellow
    { color: '#8b5cf6', glow: '#a78bfa' },   // purple
    { color: '#ef4444', glow: '#f87171' },   // red
    { color: '#0ea5e9', glow: '#38bdf8' },   // sky
    { color: '#d946ef', glow: '#e879f9' },   // fuchsia
];

// Mix two hex colors 50/50 — used to tint FK nodes as blend of PK-val color + ref-table color
function mixColors(hexA, hexB) {
    const parse = h => [
        parseInt(h.slice(1, 3), 16),
        parseInt(h.slice(3, 5), 16),
        parseInt(h.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = parse(hexA);
    const [r2, g2, b2] = parse(hexB);
    const r = Math.round((r1 + r2) / 2).toString(16).padStart(2, '0');
    const g = Math.round((g1 + g2) / 2).toString(16).padStart(2, '0');
    const b = Math.round((b1 + b2) / 2).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}

// ── Build PK distribution scene nodes from backend data ──────────────────────
// Layout:
//   • PK column node sits at center (pkColNode.position — already placed by InspectorScene)
//   • Ring 1 (radius PK_RING_R): one node per distinct PK value — all same size, each a unique color
//   • Ring 2 (radius FK_RING_R): one node per (pk_value × ref_table) pair — size ∝ distribution %
//     color = 50% pk-value-color + 50% ref-table-color
//   • Spoke connector: PK col node → each PK value node (thin, pk-value-colored)
//   • Arc connector:   each PK value node → its FK dist node (two-tone, animated)
function buildPKDistributionNodes(pkColNode, pkDistData) {
    if (!pkDistData?.pk_values?.length) return { pkValueNodes: [], refTableNodes: [], fkDistNodes: [], pkFkBridges: [] };

    const { pk_values, pk_distribution } = pkDistData;
    // Deduplicate referencing_tables by (table, fk_column) — backend may return duplicates
    const seen = new Set();
    const referencing_tables = (pkDistData.referencing_tables || []).filter(ref => {
        const key = `${ref.table}::${ref.fk_column}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const [cx, cy, cz] = pkColNode.position;
    const nVals = pk_values.length;
    const nRefs = referencing_tables.length;

    // ── Radii ──────────────────────────────────────────────────────────────
    // Ring 1 (PK values): tight orbit around the PK column node
    const PK_RING_R = Math.max(6, 3.5 + nVals * 0.5);
    // Ring 2 (ref table nodes): clearly outside Ring 1
    const REFTABLE_R = Math.max(20, PK_RING_R + 10 + nRefs * 2);
    // Sub-cluster (FK dist nodes): small orbit around each ref table node
    const FK_SUB_R = Math.max(4.5, 2.5 + nVals * 0.22);

    // ── Ring 1: PK value nodes ─────────────────────────────────────────────
    // Flat circle in XZ plane — all same size, all at same Y, each a distinct color
    const pkValueNodes = pk_values.map((val, i) => {
        const angle = (i / nVals) * Math.PI * 2 - Math.PI / 2;
        const palette = PK_VALUE_COLORS[i % PK_VALUE_COLORS.length];
        return {
            id: `__pkval__${val}`,
            label: val,
            value: val,
            color: palette.color,
            glow: palette.glow,
            colorIdx: i,
            scale: 1.0,
            position: [
                cx + Math.cos(angle) * PK_RING_R,
                cy,
                cz + Math.sin(angle) * PK_RING_R,
            ],
        };
    });

    const pkValMap = new Map(pkValueNodes.map(n => [n.value, n]));

    // ── Ring 2: Ref table nodes ────────────────────────────────────────────
    // One node per referencing table — evenly spaced in an outer ring.
    // This is the "orders" / "payments" table node the user can see clearly.
    const refTableNodes = referencing_tables.map((ref, refIdx) => {
        const angle = (refIdx / nRefs) * Math.PI * 2 - Math.PI / 2;
        const refPalette = TABLE_COLORS[(refIdx + 2) % TABLE_COLORS.length];
        return {
            id: `__reftable__${ref.table}`,
            label: ref.table,
            fkColumn: ref.fk_column || '',
            color: refPalette.color,
            glow: refPalette.glow,
            position: [
                cx + Math.cos(angle) * REFTABLE_R,
                cy,
                cz + Math.sin(angle) * REFTABLE_R,
            ],
        };
    });

    const refTableMap = new Map(refTableNodes.map(n => [n.label, n]));

    // ── Global max pct for scale normalisation ─────────────────────────────
    let globalMaxPct = 0;
    pk_distribution.forEach(e => {
        referencing_tables.forEach(ref => {
            const p = e.ref_pcts?.[ref.table] ?? 0;
            if (p > globalMaxPct) globalMaxPct = p;
        });
    });
    if (globalMaxPct === 0) globalMaxPct = 100;

    // ── Sub-cluster: FK dist nodes around each ref table node ─────────────
    // For each referencing table, its FK dist nodes form a small ring around
    // that table's node — so you can clearly see "these are orders for customer X".
    const fkDistNodes = [];
    const pkFkBridges = [];

    referencing_tables.forEach((ref, refIdx) => {
        const refPalette = TABLE_COLORS[(refIdx + 2) % TABLE_COLORS.length];
        const refNode = refTableMap.get(ref.table);
        if (!refNode) return;

        const [rx, ry, rz] = refNode.position;
        const validEntries = pk_distribution.filter(e => (e.ref_counts?.[ref.table] ?? 0) > 0);
        const nLocal = validEntries.length;
        if (nLocal === 0) return;

        validEntries.forEach((pkEntry, localIdx) => {
            const pct = pkEntry.ref_pcts?.[ref.table] ?? 0;
            const count = pkEntry.ref_counts?.[ref.table] ?? 0;

            // Spread FK nodes in a flat ring around the ref table node
            const angle = (localIdx / nLocal) * Math.PI * 2 - Math.PI / 2;
            const normPct = pct / globalMaxPct;
            // Scale: 0.55 (smallest %) → 1.55 (largest %) — size encodes row share
            const fkScale = 0.55 + normPct * 1.0;
            // Slight Y stagger so nodes at same angle don't sit exactly flat
            const yStagger = (localIdx % 2 === 0 ? 0.7 : -0.7);

            const fkPos = [
                rx + Math.cos(angle) * FK_SUB_R,
                ry + yStagger,
                rz + Math.sin(angle) * FK_SUB_R,
            ];

            // Color = 50% PK value color + 50% ref-table color
            const pkValNode = pkValMap.get(pkEntry.value);
            const blendColor = pkValNode ? mixColors(pkValNode.color, refPalette.color) : refPalette.color;
            const blendGlow  = pkValNode ? mixColors(pkValNode.glow,  refPalette.glow)  : refPalette.glow;

            const fkNodeId = `__fkdist__${ref.table}__${pkEntry.value}`;
            fkDistNodes.push({
                id: fkNodeId,
                pkLabel: pkEntry.value,
                pctLabel: `${pct.toFixed(1)}%`,
                countLabel: `${count} ${ref.table}`,
                pct, count,
                scale: fkScale,
                color: blendColor, glow: blendGlow,
                refColor: refPalette.color, refGlow: refPalette.glow,
                pkColor: pkValNode?.color || '#fbbf24',
                pkGlow:  pkValNode?.glow  || '#fde68a',
                position: fkPos,
                refTable: ref.table,
                pkValue: pkEntry.value,
            });

            // Arc: PK value node → FK dist node (crosses the scene — shows the connection)
            const srcPos = pkValNode?.position || [cx, cy, cz];
            pkFkBridges.push({
                id: `bridge-${fkNodeId}`,
                sourcePos: srcPos,
                targetPos: fkPos,
                sourceColor: pkValNode?.glow || '#fbbf24',
                targetColor: blendGlow,
                pct,
            });
        });
    });

    return { pkValueNodes, refTableNodes, fkDistNodes, pkFkBridges };
}

// ── PK Value satellite node ────────────────────────────────────────────────────
// Each unique PK value → distinct color, all same size, label = value name
function PKValueNode({ node: n }) {
    const groupRef = useRef(null);
    const sphereRef = useRef(null);
    const ringRef = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...n.position));

    useFrame((state, delta) => {
        if (!groupRef.current || !sphereRef.current) return;
        currentPos.current.lerp(new THREE.Vector3(...n.position), delta * 7);
        groupRef.current.position.copy(currentPos.current);
        const t = state.clock.elapsedTime;
        const breath = 1 + Math.sin(t * 1.8 + n.colorIdx * 0.9) * 0.05;
        sphereRef.current.scale.setScalar(breath);
        if (ringRef.current) ringRef.current.rotation.y = t * 0.6 + n.colorIdx * 0.4;
    });

    const BASE = 0.65; // fixed sphere radius — all same size

    return (
        <group ref={groupRef}>
            {/* outer glow corona */}
            <mesh>
                <sphereGeometry args={[BASE * 2.4, 12, 12]} />
                <meshBasicMaterial color={n.glow} transparent opacity={0.07} depthWrite={false} />
            </mesh>
            <mesh>
                <sphereGeometry args={[BASE * 1.55, 12, 12]} />
                <meshBasicMaterial color={n.glow} transparent opacity={0.13} depthWrite={false} />
            </mesh>
            {/* main sphere */}
            <mesh ref={sphereRef}>
                <sphereGeometry args={[BASE, 40, 40]} />
                <meshStandardMaterial
                    color={n.color} emissive={n.glow}
                    emissiveIntensity={0.55}
                    roughness={0.10} metalness={0.0} />
            </mesh>
            {/* specular */}
            <mesh position={[BASE * 0.35, BASE * 0.45, BASE * 0.72]}>
                <sphereGeometry args={[BASE * 0.22, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.60} depthWrite={false} />
            </mesh>
            {/* spinning orbit ring — signals "this is a PK value" */}
            <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
                <torusGeometry args={[BASE * 1.35, BASE * 0.055, 8, 48]} />
                <meshBasicMaterial color={n.glow} transparent opacity={0.50} depthWrite={false} />
            </mesh>

            {/* Label floats above sphere — no background box */}
            <Html position={[0, BASE * 2.2, 0]} center distanceFactor={42} style={{ pointerEvents: 'none' }}>
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    textAlign: 'center', whiteSpace: 'nowrap',
                    fontSize: 9, fontWeight: 700,
                    color: n.glow,
                    textShadow: `0 0 10px ${n.glow}, 0 0 20px ${n.glow}80`,
                }}>{n.label}</div>
            </Html>
        </group>
    );
}

// ── FK Distribution node ───────────────────────────────────────────────────────
// Size ∝ distribution %, color = 50% pk-val-color + 50% ref-table-color
// Label top: pk value name   Label bottom: %  (orders count)
function FKDistNode({ node: n }) {
    const groupRef = useRef(null);
    const sphereRef = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...n.position));
    const [hovered, setHovered] = useState(false);

    useFrame((state, delta) => {
        if (!groupRef.current || !sphereRef.current) return;
        currentPos.current.lerp(new THREE.Vector3(...n.position), delta * 6);
        groupRef.current.position.copy(currentPos.current);
        const t = state.clock.elapsedTime;
        const breath = 1 + Math.sin(t * 1.3 + n.position[0] * 0.4) * 0.04;
        sphereRef.current.scale.setScalar(n.scale * breath * (hovered ? 1.15 : 1.0));
    });

    const BASE = 0.75;
    const ei = hovered ? 1.6 : 0.9;

    return (
        <group ref={groupRef}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
            onPointerOut={() => setHovered(false)}>

            {/* outer glow corona — dual color */}
            <mesh>
                <sphereGeometry args={[BASE * n.scale * 2.8, 14, 14]} />
                <meshBasicMaterial color={n.refGlow} transparent
                    opacity={hovered ? 0.10 : 0.04} depthWrite={false} />
            </mesh>
            <mesh>
                <sphereGeometry args={[BASE * n.scale * 2.0, 14, 14]} />
                <meshBasicMaterial color={n.pkGlow} transparent
                    opacity={hovered ? 0.14 : 0.06} depthWrite={false} />
            </mesh>

            {/* ── Two-tone hemisphere sphere ──────────────────────────────── */}
            {/* Left half = ref-table color (e.g. blue for orders) */}
            <mesh ref={sphereRef} rotation={[0, -Math.PI / 2, 0]}>
                <sphereGeometry args={[BASE, 32, 32, 0, Math.PI]} />
                <meshStandardMaterial
                    color={n.refColor} emissive={n.refGlow}
                    emissiveIntensity={ei} roughness={0.12} metalness={0.4}
                    side={THREE.FrontSide} />
            </mesh>
            {/* Right half = PK value color (orange/violet/cyan — whichever PK value connects) */}
            <mesh rotation={[0, Math.PI / 2, 0]}>
                <sphereGeometry args={[BASE, 32, 32, 0, Math.PI]} />
                <meshStandardMaterial
                    color={n.pkColor} emissive={n.pkGlow}
                    emissiveIntensity={ei} roughness={0.12} metalness={0.4}
                    side={THREE.FrontSide} />
            </mesh>
            {/* Divider ring at the equator — white line between the two colors */}
            <mesh rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[BASE, 0.04, 8, 48]} />
                <meshBasicMaterial color="#ffffff" transparent
                    opacity={hovered ? 0.90 : 0.55} depthWrite={false} />
            </mesh>

            {/* Size ring — ref-table color, thickness = % share */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[BASE * n.scale * 1.12, BASE * 0.05, 6, 32]} />
                <meshBasicMaterial color={n.refGlow} transparent
                    opacity={hovered ? 0.80 : 0.45} depthWrite={false} />
            </mesh>

            {/* specular */}
            <mesh position={[BASE * 0.3, BASE * 0.42, BASE * 0.72]}>
                <sphereGeometry args={[BASE * 0.18, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent
                    opacity={hovered ? 0.80 : 0.45} depthWrite={false} />
            </mesh>

            {/* % floats above — colored half-and-half in the label too */}
            <Html position={[0, BASE * n.scale * 2.4 + 0.4, 0]} center distanceFactor={42} style={{ pointerEvents: 'none' }}>
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{
                        fontSize: 13, fontWeight: 900, lineHeight: 1,
                        background: `linear-gradient(90deg, ${n.refGlow}, ${n.pkGlow})`,
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: `drop-shadow(0 0 6px ${n.refGlow}80)`,
                    }}>{n.pctLabel}</div>
                    {hovered && (
                        <div style={{ marginTop: 3 }}>
                            <div style={{ fontSize: 8, fontWeight: 700, color: n.pkGlow, textShadow: `0 0 8px ${n.pkGlow}` }}>{n.pkLabel}</div>
                            <div style={{ fontSize: 8, fontWeight: 600, color: n.refGlow, textShadow: `0 0 6px ${n.refGlow}` }}>{n.countLabel}</div>
                        </div>
                    )}
                </div>
            </Html>
        </group>
    );
}

// ── Two-tone animated arc: PK value node → FK dist node ───────────────────────
function PKFKBridge({ from, to, fromColor, toColor, pct }) {
    const linesRef = useRef(null);
    const lineObjs = useMemo(() => {
        const vFrom = new THREE.Vector3(...from);
        const vTo = new THREE.Vector3(...to);
        // Bow the arc outward by 20% of distance so arcs don't intersect nodes
        const dist = vFrom.distanceTo(vTo);
        const mid = new THREE.Vector3().addVectors(vFrom, vTo).multiplyScalar(0.5);
        mid.y += dist * 0.20;
        const curve = new THREE.QuadraticBezierCurve3(vFrom, mid, vTo);
        const pts = curve.getPoints(48);
        const half = Math.floor(pts.length / 2);
        const geoA = new THREE.BufferGeometry().setFromPoints(pts.slice(0, half + 1));
        const geoB = new THREE.BufferGeometry().setFromPoints(pts.slice(half));
        // Line width proportional to pct (thicker = bigger FK share)
        const matA = new THREE.LineBasicMaterial({ color: fromColor, transparent: true, opacity: 0.6 });
        const matB = new THREE.LineBasicMaterial({ color: toColor, transparent: true, opacity: 0.6 });
        return [new THREE.Line(geoA, matA), new THREE.Line(geoB, matB)];
    }, [from[0], from[1], from[2], to[0], to[1], to[2], fromColor, toColor]);

    // Pulsing opacity — faster pulse for higher pct (more important connection)
    useFrame((state) => {
        const speed = 1.8 + (pct / 100) * 1.5;
        const base = 0.25 + (pct / 100) * 0.30;
        const pulse = base + Math.sin(state.clock.elapsedTime * speed) * 0.18;
        lineObjs[0].material.opacity = pulse;
        lineObjs[1].material.opacity = pulse;
    });

    return (
        <>
            <primitive object={lineObjs[0]} />
            <primitive object={lineObjs[1]} />
        </>
    );
}

// ── Thin spoke: PK column center → PK value node ─────────────────────────────
function PKValueConnector({ from, to, color }) {
    const lineObj = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...from), new THREE.Vector3(...to),
        ]);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.30 });
        return new THREE.Line(geo, mat);
    }, [from[0], from[1], from[2], to[0], to[1], to[2], color]);

    useFrame((state) => {
        lineObj.material.opacity = 0.20 + Math.sin(state.clock.elapsedTime * 1.2) * 0.10;
    });

    return <primitive object={lineObj} />;
}

// ── Referencing table node (shown in PK distribution mode) ───────────────────
// Represents "orders" / "payments" etc — the table that holds the FK column.
// Larger than FK dist nodes, solid color, clearly labelled with table name + FK col.
function RefTableNode({ node: n }) {
    const groupRef = useRef(null);
    const sphereRef = useRef(null);
    const ring1Ref = useRef(null);
    const ring2Ref = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...n.position));

    useFrame((state, delta) => {
        if (!groupRef.current || !sphereRef.current) return;
        currentPos.current.lerp(new THREE.Vector3(...n.position), delta * 5);
        groupRef.current.position.copy(currentPos.current);
        const t = state.clock.elapsedTime;
        const pulse = 1 + Math.sin(t * 1.4) * 0.06;
        sphereRef.current.scale.setScalar(pulse);
        if (ring1Ref.current) ring1Ref.current.rotation.y = t * 0.4;
        if (ring2Ref.current) ring2Ref.current.rotation.set(t * 0.2, 0, t * 0.3);
    });

    const BASE = 1.4;

    return (
        <group ref={groupRef}>
            {/* outer glow */}
            <mesh>
                <sphereGeometry args={[BASE * 2.6, 16, 16]} />
                <meshBasicMaterial color={n.glow} transparent opacity={0.06} depthWrite={false} />
            </mesh>
            <mesh>
                <sphereGeometry args={[BASE * 1.7, 16, 16]} />
                <meshBasicMaterial color={n.glow} transparent opacity={0.12} depthWrite={false} />
            </mesh>
            {/* main sphere */}
            <mesh ref={sphereRef}>
                <sphereGeometry args={[BASE, 48, 48]} />
                <meshStandardMaterial
                    color={n.color} emissive={n.glow}
                    emissiveIntensity={1.2} roughness={0.15} metalness={0.6}
                    transparent opacity={0.92} />
            </mesh>
            {/* specular */}
            <mesh position={[BASE * 0.35, BASE * 0.45, BASE * 0.68]}>
                <sphereGeometry args={[BASE * 0.2, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
            </mesh>
            {/* orbit rings signal "this is a table node" */}
            <mesh ref={ring1Ref}>
                <torusGeometry args={[BASE * 1.5, BASE * 0.04, 8, 48]} />
                <meshBasicMaterial color={n.glow} transparent opacity={0.55} depthWrite={false} />
            </mesh>
            <mesh ref={ring2Ref}>
                <torusGeometry args={[BASE * 1.9, BASE * 0.025, 8, 48]} />
                <meshBasicMaterial color={n.color} transparent opacity={0.30} depthWrite={false} />
            </mesh>

            {/* Table name floats above sphere — no background box */}
            <Html position={[0, BASE * 2.8, 0]} center distanceFactor={45} style={{ pointerEvents: 'none' }}>
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{
                        fontSize: 12, fontWeight: 900,
                        color: '#ffffff',
                        textShadow: `0 0 16px ${n.glow}, 0 0 32px ${n.glow}50`,
                        letterSpacing: 0.5,
                    }}>{n.label}</div>
                    {n.fkColumn && (
                        <div style={{
                            fontSize: 8, fontWeight: 700, marginTop: 1,
                            color: n.glow,
                            textShadow: `0 0 8px ${n.glow}`,
                        }}>FK · {n.fkColumn}</div>
                    )}
                </div>
            </Html>
        </group>
    );
}

// ── Column ellipsoid node in the single-node inspector ───────────────────────
// Props: col (colNode shape from transformNodeColumns), isHighlighted, onHover
function ColumnEllipsoid({ col, isHighlighted, onHover }) {
    const groupRef = useRef(null);
    const sphereRef = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...col.position));

    useFrame((state, delta) => {
        if (!groupRef.current || !sphereRef.current) return;
        currentPos.current.lerp(new THREE.Vector3(...col.position), delta * 7);
        groupRef.current.position.copy(currentPos.current);

        const t = state.clock.elapsedTime;
        const breath = 1 + Math.sin(t * 1.8 + col.position[0] * 0.7) * 0.04;
        const highlight = isHighlighted ? 1.18 : 1.0;
        const dimFactor = col.isDimmed ? 0.55 : 1.0;
        sphereRef.current.scale.setScalar(col.scale * breath * highlight * dimFactor);
    });

    const baseR = 0.72;
    const isPK = col.badge === 'PK';
    const isFK = col.badge === 'FK';
    // Ring color: PK=gold always, FK=always blue (type identity), regular=node's own glow
    const ringColor = isPK ? '#fbbf24' : isFK ? '#60a5fa' : col.glow;

    return (
        <group ref={groupRef}
            onPointerOver={(e) => { e.stopPropagation(); onHover && onHover(col); }}
            onPointerOut={() => onHover && onHover(null)}>

            {/* outer glow halo */}
            <mesh>
                <sphereGeometry args={[baseR * col.scale * 2.2, 14, 14]} />
                <meshBasicMaterial color={col.glow} transparent
                    opacity={isHighlighted ? 0.13 : col.isDimmed ? 0.02 : 0.06}
                    depthWrite={false} />
            </mesh>

            {/* inner glow */}
            <mesh>
                <sphereGeometry args={[baseR * col.scale * 1.4, 14, 14]} />
                <meshBasicMaterial color={col.glow} transparent
                    opacity={isHighlighted ? 0.20 : col.isDimmed ? 0.03 : 0.09}
                    depthWrite={false} />
            </mesh>

            {/* main sphere */}
            <mesh ref={sphereRef}>
                <sphereGeometry args={[baseR, 40, 40]} />
                <meshStandardMaterial
                    color={col.isDimmed ? '#1e293b' : col.color}
                    emissive={col.isDimmed ? '#0f172a' : col.glow}
                    emissiveIntensity={isHighlighted ? 0.65 : col.isDimmed ? 0.05 : 0.28}
                    roughness={0.12} metalness={0.0} />
            </mesh>

            {/* specular highlight dot */}
            <mesh position={[baseR * 0.28, baseR * 0.38, baseR * 0.7]}>
                <sphereGeometry args={[baseR * 0.18, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent
                    opacity={col.isDimmed ? 0.08 : isHighlighted ? 0.75 : 0.40}
                    depthWrite={false} />
            </mesh>

            {/* badge ring (PK = gold, FK = colored) */}
            {col.badge && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[baseR * col.scale * 1.08, baseR * 0.075, 8, 32]} />
                    <meshBasicMaterial color={ringColor} transparent
                        opacity={isHighlighted ? 0.95 : col.isDimmed ? 0.10 : 0.80}
                        depthWrite={false} />
                </mesh>
            )}

            {/* label */}
            <Html center distanceFactor={40} style={{ pointerEvents: 'none' }}>
                <div style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    textAlign: 'center', whiteSpace: 'nowrap',
                    opacity: col.isDimmed ? 0.3 : 1,
                    transition: 'opacity 0.2s',
                }}>
                    {col.badge && (
                        <div style={{
                            fontSize: 9, fontWeight: 900, letterSpacing: '0.12em',
                            color: '#ffffff',
                            textTransform: 'uppercase',
                            marginBottom: 3,
                            // PK: dark amber bg. FK: always dark navy bg (blue ring = FK identity).
                            background: isPK ? 'rgba(90,45,0,0.90)' : 'rgba(0,10,60,0.90)',
                            border: `1px solid ${ringColor}`,
                            padding: '1px 6px',
                            borderRadius: 4,
                            boxShadow: `0 0 8px ${ringColor}80`,
                            display: 'inline-block',
                        }}>{col.badge}</div>
                    )}
                    <div style={{
                        fontSize: 10, fontWeight: 700,
                        color: '#ffffff',
                        textShadow: `0 0 10px ${col.glow}, 0 1px 4px rgba(0,0,0,0.95)`,
                    }}>{col.label}</div>
                </div>
            </Html>
        </group>
    );
}
const MemoColumnEllipsoid = React.memo(ColumnEllipsoid);

// ── Phantom referenced-table node (shown during FK hover) ─────────────────────
// Props: phantom (phantomNode shape), isHighlighted, targetPosition
function PhantomRefNode({ phantom: ph, isHighlighted, targetPosition }) {
    const groupRef = useRef(null);
    const sphereRef = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...ph.position));

    useFrame((state, delta) => {
        if (!groupRef.current || !sphereRef.current) return;
        const dest = targetPosition
            ? new THREE.Vector3(...targetPosition)
            : new THREE.Vector3(...ph.position);
        currentPos.current.lerp(dest, delta * 6);
        groupRef.current.position.copy(currentPos.current);

        const t = state.clock.elapsedTime;
        const breath = 1 + Math.sin(t * 1.3 + ph.position[2] * 0.5) * 0.04;
        sphereRef.current.scale.setScalar(ph.scale * breath * (isHighlighted ? 1.15 : 1.0));
    });

    const baseR = 0.8;

    return (
        <group ref={groupRef}>
            {/* outer glow — boosted so color is visible even without hover */}
            <mesh>
                <sphereGeometry args={[baseR * ph.scale * 2.5, 14, 14]} />
                <meshBasicMaterial color={ph.glow} transparent
                    opacity={isHighlighted ? 0.25 : 0.12} depthWrite={false} />
            </mesh>
            <mesh>
                <sphereGeometry args={[baseR * ph.scale * 1.5, 14, 14]} />
                <meshBasicMaterial color={ph.glow} transparent
                    opacity={isHighlighted ? 0.35 : 0.18} depthWrite={false} />
            </mesh>

            {/* main sphere — visible color so each REF table is distinguishable */}
            <mesh ref={sphereRef}>
                <sphereGeometry args={[baseR, 40, 40]} />
                <meshStandardMaterial
                    color={ph.color} emissive={ph.glow}
                    emissiveIntensity={isHighlighted ? 1.0 : 0.65}
                    roughness={0.15} metalness={0.3}
                    transparent opacity={isHighlighted ? 0.95 : 0.88} />
            </mesh>

            {/* specular */}
            <mesh position={[baseR * 0.28, baseR * 0.38, baseR * 0.72]}>
                <sphereGeometry args={[baseR * 0.17, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent
                    opacity={isHighlighted ? 0.75 : 0.50} depthWrite={false} />
            </mesh>

            {/* outer glow ring — thicker to distinguish from regular column nodes */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[baseR * ph.scale * 1.12, baseR * 0.07, 8, 32]} />
                <meshBasicMaterial color={ph.glow} transparent
                    opacity={isHighlighted ? 0.90 : 0.60} depthWrite={false} />
            </mesh>

            <Html center distanceFactor={40} style={{ pointerEvents: 'none' }}>
                <div style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    textAlign: 'center', whiteSpace: 'nowrap',
                }}>
                    <div style={{
                        fontSize: 8, fontWeight: 900, letterSpacing: '0.15em',
                        color: ph.glow,
                        textShadow: `0 0 8px ${ph.glow}`,
                        textTransform: 'uppercase', marginBottom: 2,
                        background: 'rgba(0,0,0,0.6)',
                        padding: '1px 6px',
                        borderRadius: 3,
                        border: `1px solid ${ph.glow}60`,
                    }}>REF</div>
                    <div style={{
                        fontSize: 9, fontWeight: 700,
                        color: isHighlighted ? '#ffffff' : ph.glow,
                        textShadow: `0 0 10px ${ph.glow}, 0 1px 4px rgba(0,0,0,0.9)`,
                    }}>{ph.label}</div>
                </div>
            </Html>
        </group>
    );
}
const MemoPhantomRefNode = React.memo(PhantomRefNode);

// ── Full inspector 3D scene ───────────────────────────────────────────────────
function InspectorScene({
    node, tableColor, tableGlow,
    colNodes, phantomNodes, bridges, connectivity,
    showPKs, showFKs,
    pkDistData,
    hoveredPKColId,
    onHoverColNode,
    camParams,
}) {
    const [hoveredId, setHoveredId] = useState(null);
    const hoverClearTimer = useRef(null);
    const controlsRef = useRef(null);

    const visibleColNodes = useMemo(() => colNodes.filter(c => {
        if (c.badge === 'PK' && !showPKs) return false;
        if (c.badge === 'FK' && !showFKs) return false;
        return true;
    }), [colNodes, showPKs, showFKs]);

    const visibleBridges = useMemo(() => showFKs ? bridges : [], [bridges, showFKs]);
    const visiblePhantomNodes = useMemo(() => showFKs ? phantomNodes : [], [phantomNodes, showFKs]);

    const connectedToHovered = useMemo(() => {
        if (!hoveredId || !connectivity) return [];
        return connectivity[hoveredId] || [];
    }, [hoveredId, connectivity]);

    // FK hover spread
    const targetPositions = useMemo(() => {
        if (!hoveredId || connectedToHovered.length === 0) return {};
        const hov = [...visibleColNodes, ...visiblePhantomNodes].find(n => n.id === hoveredId);
        if (!hov) return {};
        const [hx, hy, hz] = hov.position;
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

    // PK distribution nodes (built when a PK col is hovered + data is ready)
    const hoveredPKColNode = useMemo(
        () => hoveredPKColId ? visibleColNodes.find(c => c.id === hoveredPKColId) : null,
        [hoveredPKColId, visibleColNodes]
    );

    const hoveredTargetY = hoveredPKColNode ? hoveredPKColNode.position[1] : 0;

    const { pkValueNodes, refTableNodes, fkDistNodes, pkFkBridges } = useMemo(() => {
        if (!hoveredPKColNode || !pkDistData) return { pkValueNodes: [], refTableNodes: [], fkDistNodes: [], pkFkBridges: [] };
        return buildPKDistributionNodes(hoveredPKColNode, pkDistData);
    }, [hoveredPKColNode, pkDistData]);

    const handleColHover = useCallback((c) => {
        if (c?.id) {
            if (hoverClearTimer.current) { clearTimeout(hoverClearTimer.current); hoverClearTimer.current = null; }
            setHoveredId(c.id);
            if (onHoverColNode) onHoverColNode(c);
        } else {
            if (!hoverClearTimer.current) {
                hoverClearTimer.current = setTimeout(() => {
                    setHoveredId(null);
                    hoverClearTimer.current = null;
                    if (onHoverColNode) onHoverColNode(null);
                }, 500);
            }
        }
    }, [onHoverColNode]);

    return (
        <>
            <InspectorCameraRig
                targetPosition={[0, camParams.y + (hoveredTargetY * 0.5), camParams.camZ]}
                lookAt={[0, hoveredTargetY, 0]}
                fov={camParams.fov}
                controlsRef={controlsRef}
            />
            {/* Spline-style studio lighting */}
            <ambientLight intensity={0.55} color="#e8eeff" />
            <directionalLight position={[8, 14, 10]} intensity={1.8} color="#ffffff" />
            <directionalLight position={[-10, -4, 6]} intensity={0.7} color="#b8d4ff" />
            <pointLight position={[0, -10, -8]} intensity={1.4} color={tableGlow} distance={60} decay={2} />
            <pointLight position={[0, 2, 0]} intensity={0.9} color={tableGlow} distance={22} decay={2} />

            <Stars radius={60} depth={60} count={3000} factor={3} saturation={0.3} fade speed={0.3} />

            <NeuralCoreInspector
                tableColor={tableColor} tableGlow={tableGlow}
                label={node.name || node.id}
                rowCount={node.row_count || 0}
                colCount={visibleColNodes.length}
            />

            {/* FK arcs for FK hover mode */}
            {hoveredId && !hoveredPKColId && visibleBridges
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

            {/* Column ellipsoids — hidden in PK distribution mode so rings have clean space */}
            {!hoveredPKColNode && visibleColNodes.map((col) => (
                <MemoColumnEllipsoid
                    key={col.id}
                    col={{
                        ...col,
                        isDimmed: hoveredId &&
                            hoveredId !== col.id &&
                            !connectedToHovered.includes(col.id),
                    }}
                    isHighlighted={connectedToHovered.includes(col.id)}
                    onHover={handleColHover}
                />
            ))}

            {/* When PK mode active: show only the hovered PK column node — everything else hides */}
            {hoveredPKColNode && (
                <MemoColumnEllipsoid
                    key={hoveredPKColNode.id}
                    col={{ ...hoveredPKColNode, isDimmed: false }}
                    isHighlighted={true}
                    onHover={handleColHover}
                />
            )}

            {/* Phantom ref-table nodes — only in FK hover mode, hidden during PK mode */}
            {!hoveredPKColId && visiblePhantomNodes.map((ph) => (
                <MemoPhantomRefNode
                    key={ph.id}
                    phantom={ph}
                    isHighlighted={connectedToHovered.includes(ph.id) || hoveredId === ph.id}
                    targetPosition={targetPositions[ph.id] || null}
                />
            ))}

            {/* ── PK HOVER MODE: PK value satellites + FK distribution nodes ── */}
            {hoveredPKColNode && pkDistData && (
                <>
                    {/* Extra fill lights so all PK/FK nodes are well-lit at any orbit angle */}
                    <pointLight position={[20, 10, 0]} intensity={1.2} color="#ffffff" distance={80} decay={2} />
                    <pointLight position={[-20, 10, 0]} intensity={1.2} color="#ffffff" distance={80} decay={2} />
                    <pointLight position={[0, 10, 20]} intensity={1.2} color="#ffffff" distance={80} decay={2} />
                    <pointLight position={[0, 10, -20]} intensity={1.2} color="#ffffff" distance={80} decay={2} />

                    {/* Spokes: PK col center → each PK value node */}
                    {pkValueNodes.map(vn => (
                        <PKValueConnector key={`conn-${vn.id}`}
                            from={hoveredPKColNode.position}
                            to={vn.position}
                            color={vn.glow}
                        />
                    ))}

                    {/* PK value satellite nodes — Ring 1 */}
                    {pkValueNodes.map(vn => (
                        <PKValueNode key={vn.id} node={vn} />
                    ))}

                    {/* Ref table nodes — Ring 2 (orders, payments, etc.) */}
                    {refTableNodes.map(rn => (
                        <RefTableNode key={rn.id} node={rn} />
                    ))}

                    {/* Arcs: PK value node → FK distribution node */}
                    {pkFkBridges.map(b => (
                        <PKFKBridge key={b.id}
                            from={b.sourcePos}
                            to={b.targetPos}
                            fromColor={b.sourceColor}
                            toColor={b.targetColor}
                            pct={b.pct}
                        />
                    ))}

                    {/* FK distribution nodes — Ring 2, size ∝ % */}
                    {fkDistNodes.map(fn => (
                        <FKDistNode key={fn.id} node={fn} />
                    ))}
                </>
            )}

            <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.05}
                minDistance={2}
                maxDistance={300}
                onStart={() => {
                    if (controlsRef.current) controlsRef.current._interacting = true;
                }}
                onEnd={() => {
                    if (controlsRef.current) controlsRef.current._interacting = false;
                }}
            />
        </>
    );
}

// Minimal neural-core styled center node — shows the table identity
function NeuralCoreInspector({ tableColor, tableGlow, label, rowCount, colCount }) {
    const coreRef = useRef(null);
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
    const glow = tableData?.glow || '#60a5fa';

    // ── Real-time FK fill-rate fetch ─────────────────────────────────────────
    const [freqData, setFreqData] = useState(null);
    const [freqLoading, setFreqLoading] = useState(false);

    useEffect(() => {
        if (!connectionId || !node.id) return;
        setFreqLoading(true);
        fetch(`/api/graph/${connectionId}/node-frequency/${encodeURIComponent(node.id)}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { setFreqData(d); setFreqLoading(false); })
            .catch(() => setFreqLoading(false));
    }, [connectionId, node.id]);

    // ── PK distribution state — fetched when user hovers a PK column ─────────
    const [hoveredPKColId, setHoveredPKColId] = useState(null);
    const [lockedPKColId, setLockedPKColId] = useState(null);
    const [pkDistData, setPkDistData] = useState(null);
    const [pkDistLoading, setPkDistLoading] = useState(false);
    const pkFetchRef = useRef(null);
    const pkDistLoadingRef = useRef(false);       // ref copy — readable inside timeouts
    const pkDistCache = useRef(new Map());         // cache by colNode.id — avoids re-fetch

    const handleColNodeHover = useCallback((colNode) => {
        if (!colNode || colNode.badge !== 'PK') {
            if (lockedPKColId && !colNode) return;

            if (pkFetchRef.current) clearTimeout(pkFetchRef.current);
            pkFetchRef.current = setTimeout(() => {
                // Don't revert while data is still loading — prevents scene flicker
                if (pkDistLoadingRef.current) return;
                if (!lockedPKColId) {
                    setHoveredPKColId(null);
                    setPkDistData(null);
                } else {
                    setHoveredPKColId(lockedPKColId);
                }
            }, 600);
            return;
        }

        if (pkFetchRef.current) clearTimeout(pkFetchRef.current);

        // Already showing this PK col — do nothing
        if (hoveredPKColId === colNode.id && pkDistData) return;

        // Debounce: wait 350ms before committing to PK scene so fast mouse-overs
        // don't trigger the expensive scene rebuild + fetch.
        pkFetchRef.current = setTimeout(() => {
            pkFetchRef.current = null;
            _triggerPKFetch(colNode);
        }, 350);
        return;
    }, [connectionId, node.id, lockedPKColId, hoveredPKColId, pkDistData]);

    const _triggerPKFetch = useCallback((colNode) => {
        setHoveredPKColId(colNode.id);
        if (!connectionId) return;

        // Cache hit — show instantly, no fetch needed
        if (pkDistCache.current.has(colNode.id)) {
            setPkDistData(pkDistCache.current.get(colNode.id));
            return;
        }

        setPkDistLoading(true);
        pkDistLoadingRef.current = true;
        fetch(`/api/graph/${connectionId}/pk-distribution/${encodeURIComponent(node.id)}/${encodeURIComponent(colNode.id)}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => {
                if (d) pkDistCache.current.set(colNode.id, d);
                setPkDistData(d);
                setPkDistLoading(false);
                pkDistLoadingRef.current = false;
            })
            .catch(() => {
                setPkDistLoading(false);
                pkDistLoadingRef.current = false;
            });
    }, [connectionId, node.id]);

    const { colNodes, phantomNodes, bridges, connectivity } = useMemo(
        () => transformNodeColumns(node, tables), [node, tables]
    );

    // Enrich column nodes with live stats
    const enrichedColNodes = useMemo(() => {
        const fillMap = new Map();
        if (freqData?.fk_stats) freqData.fk_stats.forEach(stat => fillMap.set(stat.column, stat));
        const rowCount = node.row_count || 0;
        const pkDisplay = rowCount >= 1000000 ? `${(rowCount / 1000000).toFixed(1)}M`
            : rowCount >= 1000 ? `${(rowCount / 1000).toFixed(1)}k`
                : rowCount > 0 ? String(rowCount) : null;
        return colNodes.map(col => {
            if (col.badge === 'FK') {
                const stat = fillMap.get(col.id);
                if (stat) return { ...col, statNumber: `${Math.round(stat.fill_rate)}%` };
            }
            if (col.badge === 'PK' && pkDisplay) return { ...col, statNumber: pkDisplay };
            return col;
        });
    }, [colNodes, freqData, node.row_count]);

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
                ...p, freqPct: stat.fill_rate, scale: 0.7 + (stat.fill_rate / 100) * 0.65,
                distinctCount: stat.distinct_count, fillRate: stat.fill_rate
            };
        });
    }, [phantomNodes, freqData]);

    const refFrequencies = useMemo(() =>
        [...enrichedPhantomNodes].sort((a, b) => b.freqPct - a.freqPct)
            .map(p => ({
                id: p.id, label: p.label, color: p.color, glow: p.glow,
                freqPct: Math.round(p.freqPct), distinctCount: p.distinctCount || 0
            })),
        [enrichedPhantomNodes]
    );

    const pkCount = enrichedColNodes.filter(c => c.badge === 'PK').length;
    const fkCount = enrichedColNodes.filter(c => c.badge === 'FK').length;
    const regCount = enrichedColNodes.length - pkCount - fkCount;
    // PK mode: pull back to fit PK ring + ref table ring + FK sub-cluster
    // REFTABLE_R = max(20, PK_RING_R + 10 + nRefs*2), FK_SUB_R ≈ 4–7
    // so total scene radius ≈ REFTABLE_R + FK_SUB_R ≈ 25–35 units → camZ 55–70
    const camZ = hoveredPKColId && pkDistData
        ? Math.max(55, 40 + (pkDistData.pk_values?.length || 0) * 1.5 + (pkDistData.referencing_tables?.length || 0) * 3)
        : colNodes.length > 25 ? 38 : colNodes.length > 12 ? 28 : 20;

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
                {pkDistLoading && (
                    <span style={{ fontSize: 7, color: '#f59e0b', letterSpacing: 1, marginLeft: 4 }}>● PK LOADING…</span>
                )}
            </div>

            {/* PK distribution mode — top banner + ref-table legend */}
            {hoveredPKColId && pkDistData && (() => {
                const refTables = pkDistData.referencing_tables || [];
                return (
                    <>
                        {/* Top banner */}
                        <div style={{
                            position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
                            zIndex: 100, pointerEvents: 'none',
                            background: 'rgba(0,0,0,0.82)', border: '1px solid #fbbf2455',
                            borderRadius: 12, padding: '6px 18px', backdropFilter: 'blur(10px)',
                            display: 'flex', alignItems: 'center', gap: 10,
                            boxShadow: '0 0 24px rgba(251,191,36,0.12)',
                        }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }} />
                            <span style={{ fontSize: 9, color: '#fbbf24', fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                                PK · {hoveredPKColId}
                            </span>
                            <span style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>|</span>
                            
                            {/* NEW: Lock Toggle Button */}
                            <button 
                                onClick={() => {
                                    if (lockedPKColId === hoveredPKColId) setLockedPKColId(null);
                                    else setLockedPKColId(hoveredPKColId);
                                }}
                                style={{
                                    pointerEvents: 'auto',
                                    background: lockedPKColId === hoveredPKColId ? '#d97706' : 'transparent',
                                    border: `1px solid ${lockedPKColId === hoveredPKColId ? '#fbbf24' : '#fbbf2460'}`,
                                    color: lockedPKColId === hoveredPKColId ? '#fff' : '#fbbf24',
                                    fontSize: '8px',
                                    fontWeight: 900,
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <span>{lockedPKColId === hoveredPKColId ? '📌 Locked' : '📍 Lock View'}</span>
                            </button>

                            <span style={{ fontSize: 9, color: '#475569', fontWeight: 600 }}>|</span>
                            <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>
                                {pkDistData.pk_values?.length} values
                            </span>
                            <span style={{ fontSize: 9, color: '#475569' }}>→</span>
                            <span style={{ fontSize: 9, color: '#cbd5e1', fontWeight: 700 }}>
                                FK row frequency distribution
                            </span>
                        </div>

                        {/* Right side: ref-table color legend + how to read */}
                        {refTables.length > 0 && (
                            <div style={{
                                position: 'absolute', top: 90, right: 16, zIndex: 100,
                                pointerEvents: 'auto', minWidth: 220, maxWidth: 280,
                                maxHeight: 'calc(100vh - 160px)',
                                display: 'flex', flexDirection: 'column',
                                background: 'rgba(0,0,0,0.80)', border: '1px solid #1e293b',
                                borderRadius: 10, backdropFilter: 'blur(10px)',
                            }}>
                                {/* sticky header */}
                                <div style={{ padding: '10px 14px 6px', flexShrink: 0 }}>
                                    <div style={{ fontSize: 7, fontWeight: 800, letterSpacing: '0.2em', color: '#475569', textTransform: 'uppercase' }}>
                                        Referencing Tables
                                        <span style={{ marginLeft: 6, color: '#334155' }}>({refTables.length})</span>
                                    </div>
                                </div>
                                {/* scrollable list */}
                                <div style={{ overflowY: 'auto', padding: '0 14px', flex: 1,
                                    scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                                    {refTables.map((ref, i) => {
                                        const palette = TABLE_COLORS[(i + 2) % TABLE_COLORS.length];
                                        return (
                                            <div key={ref.table} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                                                <div style={{ width: 10, height: 10, borderRadius: '50%', background: palette.color, boxShadow: `0 0 6px ${palette.glow}`, flexShrink: 0 }} />
                                                <span style={{ fontSize: 10, color: '#e2e8f0', fontWeight: 700 }}>{ref.table}</span>
                                                <span style={{ fontSize: 8, color: '#475569', marginLeft: 'auto', whiteSpace: 'nowrap' }}>FK → {ref.fk_column || hoveredPKColId}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* sticky footer */}
                                <div style={{ borderTop: '1px solid #1e293b', padding: '6px 14px 10px', flexShrink: 0 }}>
                                    <div style={{ fontSize: 7, color: '#334155', lineHeight: 1.5 }}>
                                        Node size = row share %<br />
                                        Color = ½ PK value + ½ table
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bottom-left: how to read the rings */}
                        <div style={{
                            position: 'absolute', bottom: 88, left: 16, zIndex: 100,
                            pointerEvents: 'none',
                            background: 'rgba(0,0,0,0.75)', border: '1px solid #1e293b',
                            borderRadius: 8, padding: '7px 12px', backdropFilter: 'blur(8px)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #fbbf24', background: '#d97706' }} />
                                <span style={{ fontSize: 8, color: '#fbbf24', fontWeight: 700 }}>Inner ring — PK values (same size)</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#f97316)', opacity: 0.9 }} />
                                <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 700 }}>Outer ring — FK rows (size = %)</span>
                            </div>
                        </div>
                    </>
                );
            })()}

            {/* FK Fill Rate Panel */}
            {refFrequencies.length > 0 && !hoveredPKColId && (
                <div style={{
                    position: 'absolute', bottom: 88, right: 16, zIndex: 100,
                    pointerEvents: 'none', width: 240,
                    background: 'rgba(0,0,0,0.96)', border: '1px solid #1e293b',
                    borderRadius: 10, padding: '8px 12px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 2, color: '#64748b', textTransform: 'uppercase' }}>FK Fill Rate</div>
                        {freqLoading && <div style={{ fontSize: 7, color: '#475569', letterSpacing: 1 }}>LOADING…</div>}
                        {!freqLoading && freqData && <div style={{ fontSize: 7, color: '#22c55e', letterSpacing: 1 }}>● LIVE</div>}
                    </div>
                    <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', height: 7, marginBottom: 8 }}>
                        {refFrequencies.map(ref => (
                            <div key={ref.id} style={{ width: `${ref.freqPct}%`, minWidth: ref.freqPct > 0 ? 3 : 0, background: ref.color, transition: 'width 0.5s' }} />
                        ))}
                    </div>
                    {refFrequencies.map(ref => (
                        <div key={ref.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: ref.color, boxShadow: `0 0 5px ${ref.glow}` }} />
                                <span style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 600 }}>{ref.label}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: ref.glow }}>{ref.freqPct}%</span>
                                {ref.distinctCount > 0 && <span style={{ fontSize: 8, color: '#475569' }}>{ref.distinctCount.toLocaleString()} uniq</span>}
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
                    { label: 'COLS', count: regCount, color: '#94a3b8' },
                ].map(({ label, count, color: c }) => (
                    <div key={label} style={{
                        background: 'rgba(0,0,0,0.96)', border: `1px solid ${c}50`,
                        borderRadius: 8, padding: '5px 14px', textAlign: 'center',
                        minWidth: 52,
                    }}>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: c, textTransform: 'uppercase' }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{count}</div>
                    </div>
                ))}
                <div style={{
                    background: 'rgba(0,0,0,0.96)', border: '1px solid #334155',
                    borderRadius: 8, padding: '5px 12px', textAlign: 'center',
                }}>
                    <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: '#64748b', textTransform: 'uppercase' }}>
                        {pkCount > 0 ? 'hover PK' : 'hover FK'}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: '#94a3b8', marginTop: 2 }}>
                        {pkCount > 0 ? 'to see distribution' : 'to see refs'}
                    </div>
                </div>
            </div>

            <Canvas
                gl={{ antialias: true, alpha: false }}
                style={{ background: hoveredPKColId ? 'hsl(220, 28%, 2%)' : 'hsl(220, 25%, 3%)', transition: 'background 0.8s ease' }}
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
                    pkDistData={pkDistData}
                    hoveredPKColId={hoveredPKColId}
                    onHoverColNode={handleColNodeHover}
                    camParams={{
                        camZ,
                        fov: hoveredPKColId ? 55 : 50,
                        y: hoveredPKColId ? 8 : 4
                    }}
                />
            </Canvas>
        </div>
    );
}


// ─── Camera Rigs ────────────────────────────────────────────────────────────
function InspectorCameraRig({ targetPosition, lookAt, fov, controlsRef }) {
    const { camera } = useThree();
    const tPos = useMemo(() => new THREE.Vector3(...targetPosition), [targetPosition[0], targetPosition[1], targetPosition[2]]);
    const tLook = useMemo(() => new THREE.Vector3(...lookAt), [lookAt[0], lookAt[1], lookAt[2]]);

    const lastRigPos = useRef(new THREE.Vector3());
    const isTransitioning = useRef(false);
    // Once the user manually moves the camera (scroll/drag) the rig backs off
    // permanently for this scene. Only resets when targetPosition/fov truly changes
    // (i.e. switching to a different PK column or leaving PK mode).
    const userOverride = useRef(false);

    useEffect(() => {
        isTransitioning.current = true;
        userOverride.current = false;   // fresh scene — rig may animate once
        if (controlsRef.current) controlsRef.current._interacting = false;
        lastRigPos.current.copy(camera.position);
    }, [targetPosition[0], targetPosition[1], targetPosition[2], lookAt[1], fov]);

    useFrame((state, delta) => {
        // Rig is idle — OrbitControls has full control
        if (!isTransitioning.current || userOverride.current || !controlsRef.current) return;

        // Drag / pan detected → give control to user permanently
        if (controlsRef.current._interacting) {
            userOverride.current = true;
            isTransitioning.current = false;
            return;
        }

        // Scroll-wheel zoom detected (camera drifted from where rig last placed it)
        // Use a generous threshold so tiny floating-point drift doesn't false-fire.
        const drift = camera.position.distanceToSquared(lastRigPos.current);
        if (drift > 0.25) {
            userOverride.current = true;
            isTransitioning.current = false;
            return;
        }

        const camDist = camera.position.distanceTo(tPos);
        const lookDist = controlsRef.current.target.distanceTo(tLook);
        const fovDiff = Math.abs(camera.fov - fov);

        // Animation complete — snap to exact target and hand off to OrbitControls
        if (camDist < 0.1 && lookDist < 0.1 && fovDiff < 0.1) {
            isTransitioning.current = false;
            camera.position.copy(tPos);
            controlsRef.current.target.copy(tLook);
            camera.fov = fov;
            camera.updateProjectionMatrix();
            controlsRef.current.update();
            lastRigPos.current.copy(camera.position);
            return;
        }

        camera.position.lerp(tPos, delta * 3.5);
        controlsRef.current.target.lerp(tLook, delta * 3.5);
        camera.fov = THREE.MathUtils.lerp(camera.fov, fov, delta * 3.5);
        camera.updateProjectionMatrix();
        controlsRef.current.update();
        lastRigPos.current.copy(camera.position);
    });
    return null;
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