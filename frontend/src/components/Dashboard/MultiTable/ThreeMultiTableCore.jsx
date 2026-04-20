import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Stars, Billboard } from '@react-three/drei';
import * as THREE from 'three';

// ─── Color palette (Shared Constants) ───────────────────────────────────────
export const TABLE_COLORS = [
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

export const METRIC_COLORS = [
    { color: '#16a34a', glow: '#4ade80' },   // green = revenue/money
    { color: '#0891b2', glow: '#22d3ee' },   // cyan = count
    { color: '#9333ea', glow: '#c084fc' },   // purple = qty
    { color: '#d97706', glow: '#fbbf24' },   // amber = avg
    { color: '#dc2626', glow: '#f87171' },   // red = misc
    { color: '#4f46e5', glow: '#818cf8' },
    { color: '#c026d3', glow: '#e879f9' },
    { color: '#059669', glow: '#34d399' },
];

export const PK_VALUE_COLORS = [
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

// ─── Utility Functions ───────────────────────────────────────────────────────
export function fibonacciRing(count, radius) {
    const phi = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: count }, (_, i) => {
        const y = count <= 1 ? 0 : 1 - (i / (count - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = phi * i;
        return [Math.cos(theta) * r * radius, y * radius * 0.6, Math.sin(theta) * r * radius];
    });
}

export function mixColors(hexA, hexB) {
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

// ─── Shared Components ──────────────────────────────────────────────────────

export function PulsingNode({ position, color, glow, scale = 1, label, badge, statLabel, onClick, isDimmed, isHighlighted }) {
    const meshRef = useRef(null);
    const groupRef = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...position));
    const [hovered, setHovered] = useState(false);

    useFrame((state, delta) => {
        if (!meshRef.current || !groupRef.current) return;
        currentPos.current.lerp(new THREE.Vector3(...position), delta * 6);
        groupRef.current.position.copy(currentPos.current);
        const t = state.clock.elapsedTime;
        const pulse = 1 + Math.sin(t * 1.5 + position[0] * 0.4) * 0.05;
        const s = scale * (hovered ? 1.15 : 1) * (isHighlighted ? 1.1 : 1) * pulse;
        meshRef.current.scale.setScalar(s);
    });

    const dimmed = isDimmed && !isHighlighted;

    return (
        <group ref={groupRef}>
            <mesh><sphereGeometry args={[scale * 2.2, 8, 8]} />
                <meshBasicMaterial color={glow} transparent opacity={dimmed ? 0 : isHighlighted ? 0.18 : 0.07} depthWrite={false} /></mesh>
            <mesh><sphereGeometry args={[scale * 1.55, 8, 8]} />
                <meshBasicMaterial color={glow} transparent opacity={dimmed ? 0 : isHighlighted ? 0.28 : 0.11} depthWrite={false} /></mesh>
            <mesh ref={meshRef}
                onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}>
                <sphereGeometry args={[1, 16, 16]} />
                <meshStandardMaterial
                    color={dimmed ? '#111827' : color}
                    emissive={dimmed ? '#000' : color}
                    emissiveIntensity={hovered ? 2 : isHighlighted ? 1.4 : dimmed ? 0 : 0.85}
                    roughness={0.2} metalness={0.6}
                    transparent opacity={dimmed ? 0.3 : hovered ? 1 : 0.88}
                    depthWrite={false}
                />
            </mesh>
            <Billboard position={[0, scale * -3.2, 0]}>
                <Text
                    fontSize={scale * 0.9}
                    color={glow} // Premium upgrade: Use the node's glow color instead of #ffffff
                    anchorX="center"
                    anchorY="middle"
                    maxWidth={30}
                    textAlign="center"
                    outlineWidth={0.08}
                    outlineColor="#000000"
                    fillOpacity={dimmed ? 0.2 : 1}
                >
                    {label}
                </Text>
            </Billboard>
            {statLabel && (
                <Billboard position={[0, scale * -4.4, 0]}>
                    <Text
                        fontSize={scale * 0.7}
                        color={color}
                        anchorX="center"
                        anchorY="middle"
                        fillOpacity={dimmed ? 0.2 : 0.8}
                    >
                        {statLabel}
                    </Text>
                </Billboard>
            )}
        </group>
    );
}

export function GalaxyTableNode({ node: n, onClick }) {
    const groupRef = useRef(null);
    const sphereRef = useRef(null);
    const ring1Ref = useRef(null);
    const ring2Ref = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...n.position));
    const [hovered, setHovered] = useState(false);

    useFrame((state, delta) => {
        if (!groupRef.current || !sphereRef.current) return;
        currentPos.current.lerp(new THREE.Vector3(...n.position), delta * 4);
        groupRef.current.position.copy(currentPos.current);
        const t = state.clock.elapsedTime;
        const pulse = 1 + Math.sin(t * 1.6 + n.colorIdx * 0.5) * 0.05;
        sphereRef.current.scale.setScalar(pulse * (hovered ? 1.2 : 1));
        if (ring1Ref.current) ring1Ref.current.rotation.y = t * 0.5;
        if (ring2Ref.current) ring2Ref.current.rotation.set(t * 0.3, t * 0.2, 0);
    });

    const BASE = 1.35;
    const { color, glow } = n;

    return (
        <group ref={groupRef}>
            <mesh
                onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
            >
                <sphereGeometry args={[BASE * 2.5, 12, 12]} />
                <meshBasicMaterial color={glow} transparent opacity={hovered ? 0.12 : 0.06} depthWrite={false} />
            </mesh>
            <mesh ref={sphereRef}>
                <sphereGeometry args={[BASE, 20, 20]} />
                <meshStandardMaterial color={color} emissive={glow} emissiveIntensity={hovered ? 2.5 : 1.2} roughness={0.1} metalness={0.7} />
            </mesh>
            <mesh ref={ring1Ref}>
                <torusGeometry args={[BASE * 1.6, 0.04, 8, 50]} />
                <meshBasicMaterial color={glow} transparent opacity={0.6} />
            </mesh>
            <mesh ref={ring2Ref}>
                <torusGeometry args={[BASE * 2.0, 0.02, 8, 50]} />
                <meshBasicMaterial color={color} transparent opacity={0.3} />
            </mesh>
            <Billboard position={[0, BASE * 2.8, 0]}>
                <Text
                    fontSize={BASE * 0.65}
                    color={glow} // Premium upgrade: Matches table identity
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.06}
                    outlineColor="#000000"
                >
                    {n.label}
                </Text>
            </Billboard>
            <Billboard position={[0, BASE * 3.6, 0]}>
                <Text
                    fontSize={BASE * 0.45}
                    color={glow}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.06}
                    outlineColor="#000000"
                >
                    {n.statLabel}
                </Text>
            </Billboard>
        </group>
    );
}

export function ArcLine({ from, to, color, opacity = 0.5 }) {
    const lineObj = useMemo(() => {
        const vFrom = new THREE.Vector3(...from);
        const vTo = new THREE.Vector3(...to);
        const mid = new THREE.Vector3().addVectors(vFrom, vTo).multiplyScalar(0.5);
        mid.y += vFrom.distanceTo(vTo) * 0.22;
        const curve = new THREE.QuadraticBezierCurve3(vFrom, mid, vTo);
        const pts = curve.getPoints(32);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
        return new THREE.Line(geo, mat);
    }, [from, to, color, opacity]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        lineObj.material.opacity = opacity * (0.7 + Math.sin(t * 1.8) * 0.3);
    });

    return <primitive object={lineObj} />;
}

export function FKDistNode({ node: n }) {
    const groupRef = useRef(null);
    const sphereRef = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...n.position));
    const [hovered, setHovered] = useState(false);

    useFrame((state, delta) => {
        if (!groupRef.current || !sphereRef.current) return;
        currentPos.current.lerp(new THREE.Vector3(...n.position), delta * 6);
        groupRef.current.position.copy(currentPos.current);
        
        const targetScale = n.scale || 1;
        groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 6);

        const t = state.clock.elapsedTime;
        const breath = 1 + Math.sin(t * 1.3 + n.position[0] * 0.4) * 0.04;
        sphereRef.current.scale.setScalar(breath * (hovered ? 1.15 : 1.0));
    });

    const BASE = 0.75;
    const ei = hovered ? 1.6 : 0.9;

    return (
        <group ref={groupRef}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}>

            <mesh><sphereGeometry args={[BASE * 2.8, 14, 14]} /><meshBasicMaterial color={n.refGlow} transparent opacity={hovered ? 0.10 : 0.04} depthWrite={false} /></mesh>
            <mesh><sphereGeometry args={[BASE * 2.0, 14, 14]} /><meshBasicMaterial color={n.pkGlow} transparent opacity={hovered ? 0.14 : 0.06} depthWrite={false} /></mesh>

            <mesh ref={sphereRef} rotation={[0, -Math.PI / 2, 0]}>
                <sphereGeometry args={[BASE, 32, 32, 0, Math.PI]} />
                <meshStandardMaterial color={n.refColor} emissive={n.refGlow} emissiveIntensity={ei} roughness={0.12} metalness={0.4} side={THREE.FrontSide} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
                <sphereGeometry args={[BASE, 32, 32, 0, Math.PI]} />
                <meshStandardMaterial color={n.pkColor} emissive={n.pkGlow} emissiveIntensity={ei} roughness={0.12} metalness={0.4} side={THREE.FrontSide} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[BASE, 0.04, 6, 24]} /><meshBasicMaterial color="#ffffff" transparent opacity={hovered ? 0.90 : 0.55} depthWrite={false} />
            </mesh>

            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[BASE * 1.12, BASE * 0.05, 6, 32]} /><meshBasicMaterial color={n.refGlow} transparent opacity={hovered ? 0.80 : 0.45} depthWrite={false} />
            </mesh>

            <Billboard position={[0, BASE * 2.4 + 0.4, 0]}>
                <Text
                    fontSize={BASE * 0.9}
                    color={n.refGlow} // Premium upgrade: Matches distribution theme
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.06}
                    outlineColor="#000000"
                >
                    {n.pctLabel}
                </Text>
            </Billboard>
        </group>
    );
}

export function PKFKBridge({ from, to, fromColor, toColor, pct, label }) {
    const lineObjs = useMemo(() => {
        const vFrom = new THREE.Vector3(...from);
        const vTo = new THREE.Vector3(...to);
        const dist = vFrom.distanceTo(vTo);
        const mid = new THREE.Vector3().addVectors(vFrom, vTo).multiplyScalar(0.5);
        mid.y += dist * 0.20;
        const curve = new THREE.QuadraticBezierCurve3(vFrom, mid, vTo);
        const pts = curve.getPoints(48);
        const half = Math.floor(pts.length / 2);
        const geoA = new THREE.BufferGeometry().setFromPoints(pts.slice(0, half + 1));
        const geoB = new THREE.BufferGeometry().setFromPoints(pts.slice(half));
        const matA = new THREE.LineBasicMaterial({ color: fromColor, transparent: true, opacity: 0.6 });
        const matB = new THREE.LineBasicMaterial({ color: toColor, transparent: true, opacity: 0.6 });
        return [new THREE.Line(geoA, matA), new THREE.Line(geoB, matB)];
    }, [from, to, fromColor, toColor]);

    const midpoint = useMemo(() => {
        const vFrom = new THREE.Vector3(...from);
        const vTo = new THREE.Vector3(...to);
        const mid = new THREE.Vector3().addVectors(vFrom, vTo).multiplyScalar(0.5);
        mid.y += vFrom.distanceTo(vTo) * 0.15;
        return mid;
    }, [from, to]);

    useFrame((state) => {
        const speed = 1.8 + (pct / 100) * 1.5;
        const base = 0.25 + (pct / 100) * 0.30;
        const pulse = base + Math.sin(state.clock.elapsedTime * speed) * 0.18;
        lineObjs[0].material.opacity = pulse;
        lineObjs[1].material.opacity = pulse;
    });

    return (
        <group>
            <primitive object={lineObjs[0]} />
            <primitive object={lineObjs[1]} />
            {/* The individual bridge label is now consolidated at the planet centroid in the main scene logic below */}
        </group>
    );
}

export function PKValueConnector({ from, to, color }) {
    const lineObj = useMemo(() => {
        const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 });
        return new THREE.Line(geo, mat);
    }, [from, to, color]);

    useFrame((state) => {
        lineObj.material.opacity = 0.35 + Math.sin(state.clock.elapsedTime * 1.5) * 0.15;
    });
    return <primitive object={lineObj} />;
}

export function PKValueNode({ node: n }) {
    const groupRef = useRef(null);
    const sphereRef = useRef(null);
    const ringRef = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...n.position));

    useFrame((state, delta) => {
        if (!groupRef.current || !sphereRef.current) return;
        currentPos.current.lerp(new THREE.Vector3(...n.position), delta * 7);
        groupRef.current.position.copy(currentPos.current);
        const t = state.clock.elapsedTime;
        const breath = 1 + Math.sin(t * 1.8 + (n.colorIdx || 0) * 0.9) * 0.05;
        sphereRef.current.scale.setScalar(breath);
        if (ringRef.current) ringRef.current.rotation.y = t * 0.6 + (n.colorIdx || 0) * 0.4;
    });

    const BASE = 0.65;
    return (
        <group ref={groupRef}>
            <mesh><sphereGeometry args={[BASE * 2.4, 8, 8]} /><meshBasicMaterial color={n.glow} transparent opacity={0.07} depthWrite={false} /></mesh>
            <mesh><sphereGeometry args={[BASE * 1.55, 8, 8]} /><meshBasicMaterial color={n.glow} transparent opacity={0.13} depthWrite={false} /></mesh>
            <mesh ref={sphereRef}><sphereGeometry args={[BASE, 20, 20]} /><meshStandardMaterial color={n.color} emissive={n.glow} emissiveIntensity={0.55} roughness={0.10} metalness={0.0} /></mesh>
            <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}><torusGeometry args={[BASE * 1.35, BASE * 0.055, 6, 24]} /><meshBasicMaterial color={n.glow} transparent opacity={0.50} depthWrite={false} /></mesh>
            <Billboard position={[0, BASE * 1.8, 0]}>
                <Text
                    fontSize={0.5}
                    color={n.glow}
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.06}
                    outlineColor="#000000"
                >
                    {n.label}
                </Text>
            </Billboard>
        </group>
    );
}

export function RefTableNode({ node: n, onSelect, isActive }) {
    const groupRef = useRef(null);
    const sphereRef = useRef(null);
    const ring1Ref = useRef(null);
    const ring2Ref = useRef(null);
    const currentPos = useRef(new THREE.Vector3(...n.position));

    useFrame((state, delta) => {
        if (!groupRef.current || !sphereRef.current) return;
        currentPos.current.lerp(new THREE.Vector3(...n.position), delta * 5);
        groupRef.current.position.copy(currentPos.current);
        
        const targetScale = n.scale || 1;
        groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 5);

        const t = state.clock.elapsedTime;
        const pulse = 1 + Math.sin(t * 1.4) * 0.06;
        sphereRef.current.scale.setScalar(pulse);
        if (ring1Ref.current) ring1Ref.current.rotation.y = t * 0.4;
        if (ring2Ref.current) ring2Ref.current.rotation.set(t * 0.2, 0, t * 0.3);
    });

    const BASE = 1.4;
    return (
        <group ref={groupRef} onClick={(e) => { e.stopPropagation(); if (onSelect) onSelect(); }}>
            {isActive && <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[BASE * 2.5, 0.08, 12, 48]} /><meshBasicMaterial color={n.glow} transparent opacity={0.4} /></mesh>}
            <mesh><sphereGeometry args={[BASE * 2.6, 12, 12]} /><meshBasicMaterial color={n.glow} transparent opacity={0.06} depthWrite={false} /></mesh>
            <mesh ref={sphereRef}><sphereGeometry args={[BASE, 32, 32]} /><meshStandardMaterial color={n.color} emissive={n.glow} emissiveIntensity={isActive ? 2.5 : 1.2} roughness={0.15} metalness={0.6} transparent opacity={0.92} /></mesh>
            <mesh ref={ring1Ref}><torusGeometry args={[BASE * 1.5, BASE * 0.04, 6, 32]} /><meshBasicMaterial color={n.glow} transparent opacity={0.55} depthWrite={false} /></mesh>
            <mesh ref={ring2Ref}><torusGeometry args={[BASE * 1.9, BASE * 0.025, 6, 32]} /><meshBasicMaterial color={n.color} transparent opacity={0.30} depthWrite={false} /></mesh>
            <Billboard position={[0, BASE * 3.8, 0]}>
                <Text
                    fontSize={BASE * 1.5}
                    color={n.glow} // Premium upgrade: Table theme
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.15}
                    outlineColor="#000000"
                >
                    {n.label}
                </Text>
            </Billboard>
            {n.compactPct && (
                <Billboard position={[0, BASE * -2.2, 0]}>
                    <Text
                        fontSize={BASE * 0.45}
                        color={n.glow}
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.04}
                        outlineColor="#000000"
                    >
                        {n.compactPct}
                    </Text>
                </Billboard>
            )}
            {n.statLabel && (
                <Billboard position={[0, BASE * 2.8, 0]}>
                    <Text
                        fontSize={BASE * 0.9}
                        color={n.glow}
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.12}
                        outlineColor="#000000"
                    >
                        {n.statLabel}
                    </Text>
                </Billboard>
            )}
        </group>
    );
}

export function NeuralCoreInspector({ color, glow, label, sublabel }) {
    const coreRef = useRef(null);
    const r1 = useRef(null);
    const r2 = useRef(null);
    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (coreRef.current) coreRef.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.08);
        if (r1.current) r1.current.rotation.set(t * 0.4, t * 0.3, 0);
        if (r2.current) r2.current.rotation.set(0, t * 0.45, t * 0.25);
    });
    return (
        <group>
            <mesh><sphereGeometry args={[2.5, 32, 32]} /><meshBasicMaterial color={glow} transparent opacity={0.05} /></mesh>
            <mesh ref={coreRef}><sphereGeometry args={[1.5, 48, 48]} /><meshStandardMaterial color={color} emissive={glow} emissiveIntensity={2.5} metalness={0.9} roughness={0.05} /></mesh>
            <mesh ref={r1}><torusGeometry args={[2.5, 0.04, 16, 64]} /><meshBasicMaterial color={glow} transparent opacity={0.6} /></mesh>
            <mesh ref={r2}><torusGeometry args={[3.2, 0.02, 16, 64]} /><meshBasicMaterial color={color} transparent opacity={0.4} /></mesh>
            <Billboard position={[0, 6.5, 0]}>
                <Text
                    fontSize={3.2}
                    color={glow} // Premium upgrade
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.2}
                    outlineColor="#000000"
                    depthTest={false}
                >
                    {label}
                </Text>
                {sublabel && (
                    <Text
                        position={[0, -2.2, 0]}
                        fontSize={1.2}
                        color={glow}
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.08}
                        outlineColor="#000000"
                        depthTest={false}
                    >
                        {sublabel}
                    </Text>
                )}
            </Billboard>
        </group>
    );
}

export function CameraRig({ distance = 65, fov = 50 }) {
    const { camera } = useThree();
    useEffect(() => {
        camera.position.set(0, distance * 0.35, distance);
        camera.lookAt(0, 0, 0);
        camera.fov = fov;
        camera.updateProjectionMatrix();
    }, [distance, fov, camera]);
    return null;
}

export function CombinedInspectionScene({ rowDetailData, linkedTables, selectedMetrics, tableColorIdx, focusedTargetTable, inspectionMode }) {
    const { color: tColor, glow: tGlow } = TABLE_COLORS[tableColorIdx % TABLE_COLORS.length];
    const [focusedTargetId, setFocusedTargetId] = useState(null);
    const isMulti = rowDetailData.is_multi;
    const isManual = inspectionMode === 'manual' || inspectionMode === 'deep';
    const isDeep = inspectionMode === 'deep';
    const isAggregated = isMulti && inspectionMode === 'manual';

    const recordNodes = useMemo(() => {
        const pkList = rowDetailData.pk_list || [];
        const n = pkList.length;
        if (n === 0) return [];

        // Single Combined Core ONLY for manual particular selection
        if (isAggregated) {
            return [{
                id: 'combined-core',
                label: `${n} Records`,
                sublabel: rowDetailData.table_name || 'selection',
                color: PK_VALUE_COLORS[0].color,
                glow: PK_VALUE_COLORS[0].glow,
                colorIdx: 0,
                position: [0, 0, 0]
            }];
        }

        if (n === 1) return [{ id: `pk-${pkList[0]}`, label: pkList[0], color: PK_VALUE_COLORS[0].color, glow: PK_VALUE_COLORS[0].glow, colorIdx: 0, position: [0, 0, 0] }];

        const positions = fibonacciRing(n, Math.max(16, 9 + n * 0.45));
        return pkList.map((val, i) => ({ id: `pk-${val}`, label: val, color: PK_VALUE_COLORS[i % PK_VALUE_COLORS.length].color, glow: PK_VALUE_COLORS[i % PK_VALUE_COLORS.length].glow, colorIdx: i, position: positions[i] }));
    }, [rowDetailData.pk_list, isMulti, isAggregated, rowDetailData.table_name]);

    const uniqueLinked = useMemo(() => {
        if (!linkedTables || linkedTables.length === 0) return [];
        const result = [];
        const seenTables = new Map();

        linkedTables.forEach(lt => {
            if (!seenTables.has(lt.table)) {
                const copy = JSON.parse(JSON.stringify(lt));
                result.push(copy);
                seenTables.set(lt.table, copy);
            } else {
                const existing = seenTables.get(lt.table);
                if (lt.pk_distribution) {
                    if (!existing.pk_distribution) existing.pk_distribution = {};
                    Object.entries(lt.pk_distribution).forEach(([pk, dist]) => {
                        if (!existing.pk_distribution[pk]) existing.pk_distribution[pk] = {};
                        Object.entries(dist).forEach(([col, val]) => {
                            existing.pk_distribution[pk][col] = (existing.pk_distribution[pk][col] || 0) + val;
                        });
                    });
                }
                if (lt.metric_nodes) {
                    lt.metric_nodes.forEach(mn => {
                        if (!existing.metric_nodes.find(e => e.column === mn.column)) {
                            existing.metric_nodes.push(mn);
                        }
                    });
                }
            }
        });
        return result;
    }, [linkedTables]);

    const tableNodes = useMemo(() => {
        const nRecords = recordNodes.length;
        if (nRecords === 0 || uniqueLinked.length === 0) return [];
        const nTables = uniqueLinked.length;

        if (isAggregated) {
            // Manual Mode: Show focused target prominently
            const targetList = focusedTargetTable
                ? uniqueLinked.filter(lt => (lt.uid === focusedTargetTable || lt.table === focusedTargetTable))
                : uniqueLinked;

            return targetList.map((lt, li) => {
                const totalBreakdown = {};
                let tVal = 0;
                let tMax = 0;

                if (lt.pk_distribution) {
                    Object.values(lt.pk_distribution).forEach(breakdown => {
                        Object.entries(breakdown).forEach(([col, val]) => {
                            totalBreakdown[col] = (totalBreakdown[col] || 0) + val;
                            // Aggregation logic for the global planet percentage
                            if (selectedMetrics.some(sm => sm.includes(' > ') && sm.split(' > ')[0] === lt.table && sm.split(' > ')[1] === col)) {
                                tVal += val;
                            }
                        });
                    });
                }
                
                const tableMetrics = selectedMetrics.filter(sm => sm.includes(' > ') && sm.split(' > ')[0] === lt.table);
                if (tableMetrics.length > 0) {
                    tMax = tableMetrics.reduce((sum, sm) => {
                        const col = sm.split(' > ')[1];
                        return sum + (lt.metric_nodes?.find(mn => mn.column === col)?.value || 1);
                    }, 0);
                } else {
                    tVal = lt.row_count || 0;
                    tMax = lt.metric_nodes?.find(mn => mn.column === 'records')?.value || 1;
                }
                const angle = (li / nTables) * Math.PI * 2;
                const ringPos = [Math.cos(angle) * 75, 5, Math.sin(angle) * 75]; // Perfect flat 2D orbit
                
                const pos = (focusedTargetTable === lt.table) ? [0, 0, -65] : ringPos;
                const pct = (tVal / (tMax || 1)) * 100;
                
                return {
                    ...lt,
                    id: `inst-agg-${lt.table}-${li}`,
                    parentId: 'combined-core',
                    targetTable: lt.table,
                    label: lt.table,
                    statLabel: `${pct.toFixed(1)}% Impact`,
                    pct: pct,
                    scale: 0.65 + (pct / 100) * 2.0,
                    color: tColor,
                    glow: tGlow,
                    position: pos,
                    breakdown: totalBreakdown
                };
            });
        }

        // Auto/Standard Mode: individual stars with satellite rings (the "Previous" Look)
        const innerR = nRecords > 1 ? Math.max(10, 5 + nRecords * 1.2) : 0;
        const TABLE_RING_R = innerR + 25;
        return recordNodes.flatMap((rn, ri) => uniqueLinked.map((lt, li) => {
            const breakdown = lt.pk_distribution?.[rn.label];
            if (!breakdown) return null;

            // Calculate Total Impact for this table globally to show on the satellite
            let tVal = 0, tMax = 0;
            if (lt.pk_distribution) {
                Object.values(lt.pk_distribution).forEach(rowDist => {
                    selectedMetrics.forEach(m => {
                        if (m.includes(' > ') && m.split(' > ')[0] === lt.table) {
                            const col = m.split(' > ')[1];
                            tVal += (rowDist[col] || 0);
                        }
                    });
                });
            }
            
            const tableMetricsAgg = selectedMetrics.filter(m => m.includes(' > ') && m.split(' > ')[0] === lt.table);
            if (tableMetricsAgg.length > 0) {
                tMax = tableMetricsAgg.reduce((sum, m) => {
                    const col = m.split(' > ')[1];
                    return sum + (lt.metric_nodes?.find(mn => mn.column === col)?.value || 1);
                }, 0);
            } else {
                tVal = lt.row_count || 0;
                tMax = lt.metric_nodes?.find(mn => mn.column === 'records')?.value || 1;
            }
            const pctLabel = `${((tVal / (tMax || 1)) * 100).toFixed(1)}%`;

            const v = new THREE.Vector3(...rn.position).normalize();
            if (v.length() === 0) v.set(0, 0, 1);

            // Tangential Spreader to cleanly separate multiple targets mapping to the exact same parent node
            const up = new THREE.Vector3(0, 1, 0);
            let right = new THREE.Vector3().crossVectors(up, v).normalize();
            if (right.length() < 0.001) right = new THREE.Vector3(1, 0, 0); // fallback if exactly vertical
            
            const TANGENT_SPACING = 15; 
            const tangentShift = (li - (uniqueLinked.length - 1) / 2) * TANGENT_SPACING;

            // Individual Percentage for this specific Record-Table link
            let rVal = 0, rMax = 0;
            selectedMetrics.forEach(m => {
                if (m.includes(' > ') && m.split(' > ')[0] === lt.table) {
                    const col = m.split(' > ')[1];
                    rVal += (breakdown[col] || 0);
                    rMax += (lt.metric_nodes?.find(mn => mn.column === col)?.value || 1);
                }
            });
            if (rVal === 0) {
                rVal = breakdown['records'] || 0;
                rMax = lt.metric_nodes?.find(mn => mn.column === 'records')?.value || 1;
            }
            const compactPct = `${((rVal / (rMax || 1)) * 100).toFixed(1)}%`;
            const pct = (rVal / (rMax || 1)) * 100;

            return {
                ...lt,
                id: `inst-${rn.id}-${lt.table}-${li}`,
                parentId: rn.id,
                targetTable: lt.table,
                label: '',
                compactPct: compactPct,
                pct: pct,
                scale: 0.65 + (pct / 100) * 2.0,
                color: rn.color,
                glow: rn.glow,
                position: [
                    rn.position[0] + v.x * TABLE_RING_R + right.x * tangentShift,
                    rn.position[1] + v.y * TABLE_RING_R + right.y * tangentShift,
                    rn.position[2] + v.z * TABLE_RING_R + right.z * tangentShift
                ],
                breakdown
            };
        }).filter(Boolean));
    }, [linkedTables, recordNodes, isAggregated, tColor, tGlow, focusedTargetTable]);

    const distNodes = useMemo(() => {
        const nodes = [];
        tableNodes.forEach(tn => {
            if (focusedTargetId && tn.id !== focusedTargetId) return;
            const rn = recordNodes.find(r => r.id === tn.parentId);
            if (!tn.breakdown || !rn) return;
            const relevantMetrics = selectedMetrics.filter(m => m.includes(' > ') && tn.targetTable === m.split(' > ')[0]);
            relevantMetrics.forEach((metric, mi) => {
                const col = metric.split(' > ')[1];
                const val = tn.breakdown[col] || 0;
                const maxVal = tn.metric_nodes?.find(m => m.column === col)?.value || 1;
                const pct = (val / maxVal) * 100;
                if (val <= 0 && pct <= 0) return;
                const orbitAngle = (mi / Math.max(1, relevantMetrics.length)) * Math.PI * 2;
                nodes.push({ id: `dist-link-${tn.id}-${col}-${mi}`, position: [tn.position[0] + Math.cos(orbitAngle) * 5, tn.position[1] + Math.sin(orbitAngle) * 1.5, tn.position[2] + Math.sin(orbitAngle) * 5], scale: 0.75 + (pct / 100) * 2.2, refColor: tn.color, refGlow: tn.glow, pkColor: rn.color, pkGlow: rn.glow, pctLabel: `${col}: ${pct.toFixed(2)}%`, pkLabel: rn.label, countLabel: val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val.toLocaleString(), parentPos: tn.position, pct });
            });
        });

        // 2. Individual Source Satellites ONLY for Deep Selection mode (around each record node)
        if (isDeep && rowDetailData?.source_distribution) {
            const srcDist = rowDetailData.source_distribution;
            const srcTotals = rowDetailData.source_totals || {};
            const sourceTable = rowDetailData.table_name;

            // Correctly identify metrics that belong to the source selection
            const sourceMetrics = selectedMetrics.filter(m => {
                const parts = m.split(' > ');
                const table = parts[0];
                const col = parts[1];
                const isSrc = (!m.includes(' > ') || table === 'source' || table === sourceTable);
                const isIgnored = ['id', 'records', 'pk'].includes((col || table).toLowerCase());
                return isSrc && !isIgnored;
            }).map(m => m.includes(' > ') ? m.split(' > ')[1] : m);

            recordNodes.forEach(rn => {
                // PK keys in JSON are always strings
                const dist = srcDist[String(rn.label)];
                if (!dist) return;

                sourceMetrics.forEach((col, mi) => {
                    const val = dist[col] || 0;
                    const maxVal = srcTotals[col] || 1;
                    const pct = (val / maxVal) * 100;
                    // Lower threshold for individual records as their contribution is naturally smaller
                    if (val <= 0) return;

                    const orbitAngle = (mi / Math.max(1, sourceMetrics.length)) * Math.PI * 2;
                    const radius = 4.2; // Slightly wider for better visibility
                    nodes.push({
                        id: `dist-src-${rn.id}-${col}`,
                        position: [
                            rn.position[0] + Math.cos(orbitAngle) * radius,
                            rn.position[1] + 1.5 + Math.sin(mi * 0.7) * 2.0,
                            rn.position[2] + Math.sin(orbitAngle) * radius
                        ],
                        scale: 0.75 + (pct / 100) * 2.2, // Unified visible scaling
                        refColor: tColor,
                        refGlow: tGlow,
                        pkColor: rn.color,
                        pkGlow: rn.glow,
                        pctLabel: `${col}: ${pct < 0.01 ? pct.toFixed(4) : pct.toFixed(2)}%`,
                        pkLabel: rn.label,
                        countLabel: val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val.toLocaleString(),
                        parentPos: rn.position,
                        pct
                    });
                });
            });
        }

        return nodes;
    }, [tableNodes, selectedMetrics, recordNodes, focusedTargetId, rowDetailData, isDeep, isAggregated]);

    return (
        <>
            <CameraRig distance={Math.max(65, 45 + tableNodes.length * 3)} />
            <ambientLight intensity={0.55} /><directionalLight position={[10, 20, 10]} intensity={2.0} /><pointLight position={[0, 5, 0]} intensity={1.5} color={tGlow} distance={40} /><Stars radius={100} depth={50} count={5000} factor={4} saturation={0.5} fade speed={0.5} />

            {/* Source Rendering */}
            {isAggregated ? (
                <NeuralCoreInspector
                    color={tColor}
                    glow={tGlow}
                    label={`${rowDetailData.selection_count} Records`}
                    sublabel={`Aggregated ${rowDetailData.table_name || 'Selection'}`}
                />
            ) : (
                recordNodes.length <= 1 ? (
                    <NeuralCoreInspector color={recordNodes[0]?.color || tColor} glow={recordNodes[0]?.glow || tGlow} label={rowDetailData.display_val || rowDetailData.pk_val} sublabel={rowDetailData.table_name || 'record'} />
                ) : (
                    <>
                        {recordNodes.map(rn => <PKValueNode key={rn.id} node={rn} />)}
                        {recordNodes.map(rn => <PKValueConnector key={`spoke-${rn.id}`} from={[0, 0, 0]} to={rn.position} color={rn.glow} />)}
                    </>
                )
            )}

            {tableNodes.map(tn => (
                <RefTableNode
                    key={tn.id}
                    node={{
                        ...tn,
                        label: (isManual ? "" : tn.label),
                        compactPct: (isManual ? "" : tn.compactPct),
                        statLabel: (isManual ? "" : tn.statLabel)
                    }}
                    isActive={tn.id === focusedTargetId}
                    onSelect={() => setFocusedTargetId(tn.id === focusedTargetId ? null : tn.id)}
                />
            ))}

            {/* 1. Connectivity Web (Individual lines pointing to actual planet nodes) */}
            {!isAggregated && recordNodes.map(rn => uniqueLinked.map(lt => {
                const breakdown = lt.pk_distribution?.[rn.label];
                if (!breakdown) return null;

                // Find the actual 3D node for this planet
                // In Standard mode, each record has its own satellite planets
                const targetNode = tableNodes.find(tn =>
                    tn.targetTable === lt.table && tn.parentId === rn.id
                );

                if (!targetNode) return null;
                return <PKValueConnector key={`line-${rn.id}-${lt.table}`} from={rn.position} to={targetNode.position} color={rn.glow} />;
            }))}

            {/* 2. Consolidated Impact Labels (One clean percentage per table planet) */}
            {uniqueLinked.map((lt, li) => {
                const breakdown = lt.pk_distribution;
                if (!breakdown) return null;

                let totalVal = 0, totalMax = 0;
                
                Object.values(breakdown).forEach(rowDist => {
                    selectedMetrics.forEach(m => {
                        if (m.includes(' > ') && m.split(' > ')[0] === lt.table) {
                            const col = m.split(' > ')[1];
                            totalVal += (rowDist[col] || 0);
                        }
                    });
                });

                const tableMetricsConsolidated = selectedMetrics.filter(m => m.includes(' > ') && m.split(' > ')[0] === lt.table);
                if (tableMetricsConsolidated.length > 0) {
                    totalMax = tableMetricsConsolidated.reduce((sum, m) => {
                        const col = m.split(' > ')[1];
                        return sum + (lt.metric_nodes?.find(mn => mn.column === col)?.value || 1);
                    }, 0);
                } else {
                    totalVal = lt.row_count || 0;
                    totalMax = lt.metric_nodes?.find(mn => mn.column === 'records')?.value || 1;
                }

                // Show bridge/label if there's impact OR if we are in manual mode (to show existence of link)
                if (totalVal <= 0 && !isManual) return null;
                const pct = (totalVal / (totalMax || 1)) * 100;

                // --- POSITIONING LOGIC FOR STAGE 1 & 2 ---
                let centroid = { x: 0, y: 0, z: 0 };
                
                if (isAggregated) {
                     // In aggregated mode, there's 1 planet per table, which naturally spaces out.
                     const siblingNodes = tableNodes.filter(tn => tn.targetTable === lt.table);
                     if (siblingNodes.length > 0) {
                         centroid.x = siblingNodes[0].position[0];
                         centroid.y = siblingNodes[0].position[1];
                         centroid.z = siblingNodes[0].position[2];
                     } else {
                         return null; // Ghost node suppressed by sidebar focus
                     }
                } else {
                     // In Auto Mode, spreading perfectly over the universe averages out perfectly to [0,0,0]!
                     // This mathematical purity causes overlapping. Create a unique celestial position for this label!
                     const angle = (li / uniqueLinked.length) * Math.PI * 2;
                     const radius = 55;
                     centroid.x = Math.cos(angle) * radius;
                     centroid.y = 20; // Anchor above the galaxy
                     centroid.z = Math.sin(angle) * radius;
                }

                // Consolidated Header at the Cluster Centroid
                return (
                    <group key={`label-group-${lt.table}`}>
                        <PKFKBridge from={[0, 0, 0]} to={[centroid.x, centroid.y, centroid.z]} fromColor={tGlow} toColor={lt.glow} pct={pct} label={lt.table} />
                        <Billboard position={[centroid.x, centroid.y + 13, centroid.z]}>
                            <Text
                                fontSize={3.8} // Reduced from 5.5
                                color={lt.glow}
                                anchorX="center"
                                anchorY="middle"
                                outlineWidth={0.06} // Reduced to prevent crunchy font ghosting
                                outlineColor="#000000"
                                depthTest={false}
                            >
                                {lt.table}
                            </Text>
                        </Billboard>
                        <Billboard position={[centroid.x, centroid.y + 6, centroid.z]}>
                            <Text
                                fontSize={2.4} // Reduced from 3.8
                                color={lt.glow}
                                anchorX="center"
                                anchorY="middle"
                                outlineWidth={0.05} // Reduced for legibility
                                outlineColor="#000000"
                                depthTest={false}
                            >
                                {pct.toFixed(1)}% Impact
                            </Text>
                        </Billboard>
                    </group>
                );
            })}

            {distNodes.map(dn => <FKDistNode key={dn.id} node={dn} />)}

            {/* Show connectors for deep mode selection metrics (now connecting to specific parents) */}
            {isDeep && distNodes.filter(dn => dn.id.startsWith('dist-src-')).map(dn => (
                <PKValueConnector key={`conn-${dn.id}`} from={dn.parentPos} to={dn.position} color={dn.pkGlow} />
            ))}
            <OrbitControls enableDamping dampingFactor={0.06} minDistance={5} maxDistance={300} />
        </>
    );
}

// ─── LEVEL 1 SCENE: Galaxy Cluster View ──────────────────────────────────────
export function Level1Scene({ tables, connections, onSelectTable }) {
    const sceneRef = useRef();

    useFrame((state) => {
        if (!sceneRef.current) return;
        const t = state.clock.elapsedTime;
        sceneRef.current.position.y = Math.sin(t * 0.2) * 2.5;
        sceneRef.current.rotation.y = Math.sin(t * 0.1) * 0.1;
    });

    // Cluster tables based on connectivity
    const clusters = useMemo(() => {
        if (!tables) return [];
        const adj = {};
        tables.forEach(t => adj[t.name] = new Set());
        connections?.forEach(c => {
            if (adj[c.from_table] && adj[c.to_table]) {
                adj[c.from_table].add(c.to_table);
                adj[c.to_table].add(c.from_table);
            }
        });

        const visited = new Set();
        const results = [];
        tables.forEach(t => {
            if (visited.has(t.name)) return;
            const cluster = [];
            const queue = [t.name];
            visited.add(t.name);
            while (queue.length > 0) {
                const curr = queue.shift();
                cluster.push(tables.find(tbl => tbl.name === curr));
                adj[curr]?.forEach(neighbor => {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                });
            }
            results.push(cluster);
        });
        return results;
    }, [tables, connections]);

    const tableNodes = useMemo(() => {
        const nodes = [];
        let clusterOffset = 0;
        clusters.forEach((cluster, ci) => {
            const n = cluster.length;
            const clusterRadius = Math.max(10, Math.sqrt(n) * 8);
            const clusterCenter = [
                Math.cos(ci * 2.4 + clusterOffset) * (ci * 25 + 15),
                (ci % 2 === 0 ? 1 : -1) * 5,
                Math.sin(ci * 2.4 + clusterOffset) * (ci * 25 + 15)
            ];
            const ringPositions = fibonacciRing(n, clusterRadius);
            cluster.forEach((t, i) => {
                const colorIdx = (ci * 7 + i) % TABLE_COLORS.length;
                const { color, glow } = TABLE_COLORS[colorIdx];
                nodes.push({
                    id: t.name, label: t.name, statLabel: `${t.columns?.length || 0} cols`,
                    color, glow, colorIdx,
                    position: [clusterCenter[0] + ringPositions[i][0], clusterCenter[1] + ringPositions[i][1], clusterCenter[2] + ringPositions[i][2]],
                    raw: t
                });
            });
            clusterOffset += 0.5;
        });
        return nodes;
    }, [clusters]);

    const arcLines = useMemo(() => {
        const arcs = [];
        connections?.forEach((c, i) => {
            const fromNode = tableNodes.find(n => n.id === c.from_table);
            const toNode = tableNodes.find(n => n.id === c.to_table);
            if (fromNode && toNode) {
                arcs.push({ id: `arc-${i}`, from: fromNode.position, to: toNode.position, color: fromNode.glow });
            }
        });
        return arcs;
    }, [tableNodes, connections]);

    return (
        <group ref={sceneRef}>
            {tableNodes.map(tn => <GalaxyTableNode key={tn.id} node={tn} onClick={() => onSelectTable(tn.raw, tn.colorIdx)} />)}
            {arcLines.map(arc => <ArcLine key={arc.id} from={arc.from} to={arc.to} color={arc.color} opacity={0.3} />)}
            <OrbitControls enableDamping dampingFactor={0.06} minDistance={10} maxDistance={500} />
        </group>
    );
}
