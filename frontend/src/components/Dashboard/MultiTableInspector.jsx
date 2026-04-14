import React, {
    useState, useEffect, useMemo, useRef, useCallback,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import * as THREE from 'three';

// ─── Color palette (same as ThreeGraphSpinExpand) ───────────────────────────
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

function sr(seed) { const x = Math.sin(seed) * 10000; return x - Math.floor(x); }

function fibonacciRing(count, radius) {
    const phi = Math.PI * (3 - Math.sqrt(5));
    return Array.from({ length: count }, (_, i) => {
        const y = count <= 1 ? 0 : 1 - (i / (count - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = phi * i;
        return [Math.cos(theta) * r * radius, y * radius * 0.6, Math.sin(theta) * r * radius];
    });
}

// ─── SHARED: Pulsing sphere node ─────────────────────────────────────────────
function PulsingNode({ position, color, glow, scale = 1, label, badge, statLabel, onClick, isDimmed, isHighlighted }) {
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
            {/* outer glow corona */}
            <mesh><sphereGeometry args={[scale * 2.2, 12, 12]} />
                <meshBasicMaterial color={glow} transparent opacity={dimmed ? 0 : isHighlighted ? 0.18 : 0.07} depthWrite={false} /></mesh>
            <mesh><sphereGeometry args={[scale * 1.55, 12, 12]} />
                <meshBasicMaterial color={glow} transparent opacity={dimmed ? 0 : isHighlighted ? 0.28 : 0.11} depthWrite={false} /></mesh>
            {/* main sphere */}
            <mesh ref={meshRef}
                onClick={(e) => { e.stopPropagation(); if (onClick) onClick(); }}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}>
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial
                    color={dimmed ? '#111827' : color}
                    emissive={dimmed ? '#000' : color}
                    emissiveIntensity={hovered ? 2 : isHighlighted ? 1.4 : dimmed ? 0 : 0.85}
                    roughness={0.2} metalness={0.6}
                    transparent opacity={dimmed ? 0.3 : hovered ? 1 : 0.88}
                    depthWrite={false}
                />
            </mesh>
            {/* label */}
            <Html center distanceFactor={40} style={{ pointerEvents: 'none' }}>
                <div style={{
                    textAlign: 'center',
                    fontFamily: "'Inter', system-ui, sans-serif",
                    whiteSpace: 'nowrap',
                    opacity: dimmed ? 0.1 : 1,
                    transition: 'opacity 0.2s',
                    pointerEvents: 'none',
                }}>
                    {badge && (
                        <div style={{
                            fontSize: 8, fontWeight: 900, letterSpacing: 1,
                            color: color, background: 'rgba(0,0,0,0.8)',
                            padding: '1px 5px', borderRadius: 4,
                            border: `1px solid ${color}60`, marginBottom: 2,
                            display: 'inline-block',
                        }}>{badge}</div>
                    )}
                    <div style={{
                        fontSize: 12, fontWeight: 700, color: '#fff',
                        textShadow: `0 0 14px ${color}, 0 2px 6px rgba(0,0,0,0.9)`,
                    }}>{label}</div>
                    {statLabel && (
                        <div style={{
                            fontSize: 10, fontWeight: 900, color: color,
                            background: 'rgba(0,0,0,0.7)',
                            padding: '1px 7px', borderRadius: 10,
                            border: `1px solid ${color}50`,
                            marginTop: 2, display: 'inline-block',
                        }}>{statLabel}</div>
                    )}
                </div>
            </Html>
        </group>
    );
}

function GalaxyTableNode({ node: n, onClick, onSelect }) {
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
                onClick={(e) => { e.stopPropagation(); onClick(); }}
                onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
            >
                <sphereGeometry args={[BASE * 2.5, 12, 12]} />
                <meshBasicMaterial color={glow} transparent opacity={hovered ? 0.12 : 0.06} depthWrite={false} />
            </mesh>
            <mesh ref={sphereRef}>
                <sphereGeometry args={[BASE, 40, 40]} />
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
            <Html position={[0, BASE * 2.6, 0]} center distanceFactor={45} style={{ pointerEvents: 'none' }}>
                <div style={{ textAlign: 'center', whiteSpace: 'nowrap', transition: 'all 0.3s', transform: hovered ? 'scale(1.1)' : 'scale(1)' }}>
                    <div style={{
                        fontSize: 13, fontWeight: 900, color: '#fff',
                        textShadow: `0 0 15px ${glow}, 0 2px 5px rgba(0,0,0,0.8)`,
                        letterSpacing: 0.5
                    }}>{n.label}</div>
                    <div style={{
                        fontSize: 9, fontWeight: 800, color: glow,
                        background: 'rgba(0,0,0,0.6)', padding: '1px 6px',
                        borderRadius: 10, border: `1px solid ${glow}40`,
                        marginTop: 3, display: 'inline-block'
                    }}>{n.statLabel}</div>
                </div>
            </Html>
        </group>
    );
}

function ArcLine({ from, to, color, opacity = 0.5 }) {
    const lineObj = useMemo(() => {
        const vFrom = new THREE.Vector3(...from);
        const vTo = new THREE.Vector3(...to);
        const mid = new THREE.Vector3().addVectors(vFrom, vTo).multiplyScalar(0.5);
        // Slightly higher arc for a more elegant orbital look
        mid.y += vFrom.distanceTo(vTo) * 0.22;
        const curve = new THREE.QuadraticBezierCurve3(vFrom, mid, vTo);
        const pts = curve.getPoints(32);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
        return new THREE.Line(geo, mat);
    }, [from[0], from[1], from[2], to[0], to[1], to[2], color, opacity]);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        lineObj.material.opacity = opacity * (0.7 + Math.sin(t * 1.8) * 0.3);
    });

    return <primitive object={lineObj} />;
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

// ─── High-Fidelity Nodes (Ported from SingleNodeInspector) ──────────────────

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
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}>

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

            <mesh ref={sphereRef} rotation={[0, -Math.PI / 2, 0]}>
                <sphereGeometry args={[BASE, 32, 32, 0, Math.PI]} />
                <meshStandardMaterial
                    color={n.refColor} emissive={n.refGlow}
                    emissiveIntensity={ei} roughness={0.12} metalness={0.4}
                    side={THREE.FrontSide} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
                <sphereGeometry args={[BASE, 32, 32, 0, Math.PI]} />
                <meshStandardMaterial
                    color={n.pkColor} emissive={n.pkGlow}
                    emissiveIntensity={ei} roughness={0.12} metalness={0.4}
                    side={THREE.FrontSide} />
            </mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}>
                <torusGeometry args={[BASE, 0.04, 8, 48]} />
                <meshBasicMaterial color="#ffffff" transparent
                    opacity={hovered ? 0.90 : 0.55} depthWrite={false} />
            </mesh>

            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[BASE * n.scale * 1.12, BASE * 0.05, 6, 32]} />
                <meshBasicMaterial color={n.refGlow} transparent
                    opacity={hovered ? 0.80 : 0.45} depthWrite={false} />
            </mesh>

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

function PKFKBridge({ from, to, fromColor, toColor, pct }) {
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
    }, [from[0], from[1], from[2], to[0], to[1], to[2], fromColor, toColor]);

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
        </group>
    );
}

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
        const breath = 1 + Math.sin(t * 1.8 + (n.colorIdx || 0) * 0.9) * 0.05;
        sphereRef.current.scale.setScalar(breath);
        if (ringRef.current) ringRef.current.rotation.y = t * 0.6 + (n.colorIdx || 0) * 0.4;
    });

    const BASE = 0.65;
    return (
        <group ref={groupRef}>
            <mesh>
                <sphereGeometry args={[BASE * 2.4, 12, 12]} />
                <meshBasicMaterial color={n.glow} transparent opacity={0.07} depthWrite={false} />
            </mesh>
            <mesh>
                <sphereGeometry args={[BASE * 1.55, 12, 12]} />
                <meshBasicMaterial color={n.glow} transparent opacity={0.13} depthWrite={false} />
            </mesh>
            <mesh ref={sphereRef}>
                <sphereGeometry args={[BASE, 40, 40]} />
                <meshStandardMaterial color={n.color} emissive={n.glow} emissiveIntensity={0.55} roughness={0.10} metalness={0.0} />
            </mesh>
            <mesh position={[BASE * 0.35, BASE * 0.45, BASE * 0.72]}>
                <sphereGeometry args={[BASE * 0.22, 8, 8]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.60} depthWrite={false} />
            </mesh>
            <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
                <torusGeometry args={[BASE * 1.35, BASE * 0.055, 8, 48]} />
                <meshBasicMaterial color={n.glow} transparent opacity={0.50} depthWrite={false} />
            </mesh>
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
            <mesh><sphereGeometry args={[BASE * 2.6, 16, 16]} /><meshBasicMaterial color={n.glow} transparent opacity={0.06} depthWrite={false} /></mesh>
            <mesh><sphereGeometry args={[BASE * 1.7, 16, 16]} /><meshBasicMaterial color={n.glow} transparent opacity={0.12} depthWrite={false} /></mesh>
            <mesh ref={sphereRef}>
                <sphereGeometry args={[BASE, 48, 48]} />
                <meshStandardMaterial color={n.color} emissive={n.glow} emissiveIntensity={1.2} roughness={0.15} metalness={0.6} transparent opacity={0.92} />
            </mesh>
            <mesh ref={ring1Ref}><torusGeometry args={[BASE * 1.5, BASE * 0.04, 8, 48]} /><meshBasicMaterial color={n.glow} transparent opacity={0.55} depthWrite={false} /></mesh>
            <mesh ref={ring2Ref}><torusGeometry args={[BASE * 1.9, BASE * 0.025, 8, 48]} /><meshBasicMaterial color={n.color} transparent opacity={0.30} depthWrite={false} /></mesh>

            <Html position={[0, BASE * 2.8, 0]} center distanceFactor={45} style={{ pointerEvents: 'none' }}>
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: '#ffffff', textShadow: `0 0 16px ${n.glow}, 0 0 32px ${n.glow}50`, letterSpacing: 0.5 }}>{n.label}</div>
                    {n.fkColumn && <div style={{ fontSize: 8, fontWeight: 700, marginTop: 1, color: n.glow, textShadow: `0 0 8px ${n.glow}` }}>FK · {n.fkColumn}</div>}
                </div>
            </Html>
        </group>
    );
}

function NeuralCoreInspector({ color, glow, label, sublabel }) {
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
            <mesh ref={coreRef}>
                <sphereGeometry args={[1.2, 48, 48]} />
                <meshStandardMaterial color={color} emissive={glow} emissiveIntensity={2} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh ref={r1}><torusGeometry args={[2.0, 0.03, 16, 64]} /><meshBasicMaterial color={glow} transparent opacity={0.6} /></mesh>
            <mesh ref={r2}><torusGeometry args={[2.6, 0.02, 16, 64]} /><meshBasicMaterial color={color} transparent opacity={0.4} /></mesh>
            <Html center distanceFactor={40} style={{ pointerEvents: 'none' }}>
                <div style={{ textAlign: 'center', textShadow: `0 0 20px ${glow}`, color: '#fff', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>{label}</div>
                    {sublabel && <div style={{ fontSize: 10, fontWeight: 800, color: glow, textTransform: 'uppercase', marginTop: 4 }}>{sublabel}</div>}
                </div>
            </Html>
        </group>
    );
}
// (NeuralCoreInspector was already updated above, removing the older CenterCore)

// ─── CameraRig ────────────────────────────────────────────────────────────────
function CameraRig({ distance = 55, fov = 50 }) {
    const { camera } = useThree();
    
    useEffect(() => {
        // High-fidelity starting frame
        camera.position.set(0, distance * 0.45, distance);
        camera.lookAt(0, 0, 0);
        camera.fov = fov;
        camera.updateProjectionMatrix();
    }, [distance, fov, camera]);

    return null;
}

// ─── LEVEL 1 SCENE: Table cluster ────────────────────────────────────────────
function Level1Scene({ tables, connections, onSelectTable }) {
    const n = tables.length;
    const sceneRef = useRef();
    
    useFrame((state) => {
        if (!sceneRef.current) return;
        const t = state.clock.elapsedTime;
        // Move the drift here so it doesn't fight the Camera Zoom
        sceneRef.current.position.y = Math.sin(t * 0.2) * 2.5;
        sceneRef.current.rotation.y = Math.sin(t * 0.1) * 0.1;
    });

    const positions = useMemo(() => {
        // Clustering logic: Use connectivity to group tables into 'islands'
        const islands = [];
        const visited = new Set();
        const adj = new Map();
        
        connections.forEach(c => {
            if (!adj.has(c.from_table)) adj.set(c.from_table, []);
            if (!adj.has(c.to_table)) adj.set(c.to_table, []);
            adj.get(c.from_table).push(c.to_table);
            adj.get(c.to_table).push(c.from_table);
        });

        tables.forEach(t => {
            if (visited.has(t.name)) return;
            const island = [];
            const stack = [t.name];
            while(stack.length) {
                const curr = stack.pop();
                if (visited.has(curr)) continue;
                visited.add(curr);
                island.push(curr);
                (adj.get(curr) || []).forEach(neighbor => stack.push(neighbor));
            }
            islands.push(island);
        });

        const finalPositions = {};
        const GALAXY_RADIUS = Math.max(26, 12 + n * 1.5);
        
        islands.forEach((island, islandIdx) => {
            const islandAngle = (islandIdx / islands.length) * Math.PI * 2;
            const islandCenter = [
                Math.cos(islandAngle) * GALAXY_RADIUS,
                (islandIdx % 2 === 0 ? 6 : -6), // Even more vertical separation
                Math.sin(islandAngle) * GALAXY_RADIUS
            ];

            island.forEach((tableName, tblIdx) => {
                const innerAngle = (tblIdx / island.length) * Math.PI * 2;
                // Significantly more space for labels to prevent overlapping
                const innerR = island.length > 1 ? Math.max(14, island.length * 4.5) : 0;
                
                // VERTICAL STAGGER: This ensures labels sit at different heights
                const verticalStagger = (tblIdx % 3) * 4 - 4; 

                finalPositions[tableName] = [
                    islandCenter[0] + Math.cos(innerAngle) * innerR,
                    islandCenter[1] + verticalStagger,
                    islandCenter[2] + Math.sin(innerAngle) * innerR
                ];
            });
        });

        return tables.map(t => finalPositions[t.name]);
    }, [tables, connections]);

    const connectedMap = useMemo(() => {
        const m = new Map();
        connections.forEach(c => {
            if (!m.has(c.from_table)) m.set(c.from_table, []);
            if (!m.has(c.to_table)) m.set(c.to_table, []);
            m.get(c.from_table).push(c.to_table);
            m.get(c.to_table).push(c.from_table);
        });
        return m;
    }, [connections]);

    return (
        <group ref={sceneRef}>
            <CameraRig distance={Math.max(35, 20 + n * 1.5)} fov={52} />
            <ambientLight intensity={0.5} />
            <pointLight position={[0, 10, 0]} intensity={1.5} color="#fbbf24" distance={100} decay={2} />
            <Stars radius={100} depth={50} count={4000} factor={4} saturation={0.5} fade speed={0.4} />
            
            {connections.map((c, i) => {
                const fromIdx = tables.findIndex(t => t.name === c.from_table);
                const toIdx = tables.findIndex(t => t.name === c.to_table);
                if (fromIdx < 0 || toIdx < 0) return null;
                const fromColor = TABLE_COLORS[fromIdx % TABLE_COLORS.length].color;
                return <ArcLine key={i} from={positions[fromIdx]} to={positions[toIdx]} color={fromColor} opacity={0.6} />;
            })}

            {tables.map((tbl, i) => {
                const { color, glow } = TABLE_COLORS[i % TABLE_COLORS.length];
                const rowLabel = tbl.row_count >= 1000000
                    ? `${(tbl.row_count / 1000000).toFixed(1)}M rows`
                    : tbl.row_count >= 1000 ? `${(tbl.row_count / 1000).toFixed(1)}k rows`
                        : `${tbl.row_count} rows`;
                
                return (
                    <GalaxyTableNode 
                        key={tbl.name}
                        node={{
                            position: positions[i],
                            color,
                            glow,
                            label: tbl.name,
                            statLabel: rowLabel,
                            colorIdx: i
                        }}
                        onClick={() => onSelectTable(tbl, i)}
                    />
                );
            })}
            <OrbitControls 
                enableDamping 
                dampingFactor={0.08} 
                rotateSpeed={1.1} 
                zoomSpeed={1.3} 
                minDistance={5} 
                maxDistance={350} 
            />
        </group>
    );
}

// ─── LEVEL 2 SCENE: Row ring ──────────────────────────────────────────────────
function Level2Scene({ tableInfo, rows, tableColorIdx, onSelectRow, multiSelectedRows }) {
    const { color: tColor, glow: tGlow } = TABLE_COLORS[tableColorIdx % TABLE_COLORS.length];
    const n = rows.length;
    const positions = useMemo(() => fibonacciRing(n, Math.max(16, 9 + n * 0.45)), [n]);

    return (
        <>
            <CameraRig distance={Math.max(45, 30 + n * 0.4)} fov={52} />
            <ambientLight intensity={0.5} color="#e8eeff" />
            <directionalLight position={[8, 14, 10]} intensity={1.6} />
            <pointLight position={[0, 2, 0]} intensity={1} color={tGlow} distance={30} decay={2} />
            <Stars radius={60} depth={60} count={3000} factor={3} saturation={0.3} fade speed={0.3} />
            <NeuralCoreInspector color={tColor} glow={tGlow} label={tableInfo.name} sublabel="table" />
            {rows.map((row, i) => (
                <ArcLine key={`spoke-${i}`} from={[0, 0, 0]} to={positions[i]} color={tColor} opacity={0.15} />
            ))}
            {rows.map((row, i) => {
                const isSelected = multiSelectedRows?.some(sr => sr.pk_val === row.pk_val);
                const pct = row.activity_pct ?? 0;
                const scale = 0.65 + (pct / 100) * 0.85 + (isSelected ? 0.3 : 0);
                const colorIdx = (tableColorIdx + i + 1) % TABLE_COLORS.length;
                const { color, glow } = isSelected 
                    ? { color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.8)' }
                    : TABLE_COLORS[colorIdx];
                const label = row.label || `${row.pk_val} ${row.display_val}`;
                return (
                    <PulsingNode key={row.pk_val}
                        position={positions[i]} color={color} glow={glow}
                        scale={scale}
                        label={label}
                        statLabel={row.activity_count > 0 ? `${row.activity_count} activity` : null}
                        onClick={() => onSelectRow(row, colorIdx)}
                        isHighlighted={isSelected}
                    />
                );
            })}
            <OrbitControls enableDamping dampingFactor={0.05} minDistance={5} maxDistance={200} />
        </>
    );
}

function Level3Scene({ rowData, linkedTables, selectedMetrics, tableColorIdx }) {
    const { color: tColor, glow: tGlow } = TABLE_COLORS[tableColorIdx % TABLE_COLORS.length];
    
    // ── Tier 1: Selected records (Inner Ring) ────────────────────────────────
    const recordNodes = useMemo(() => {
        const pkList = rowData.pk_list || [];
        const n = pkList.length;
        if (n === 0) return [];
        
        // If only one record, place it slightly offset from center or at center
        if (n === 1) {
            return [{
                id: `pk-${pkList[0]}`,
                label: pkList[0],
                color: PK_VALUE_COLORS[0].color,
                glow: PK_VALUE_COLORS[0].glow,
                colorIdx: 0,
                position: [0, 0, 0] // Center
            }];
        }

        const RECORD_RING_R = Math.max(10, 5 + n * 1.2);
        return pkList.map((val, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const palette = PK_VALUE_COLORS[i % PK_VALUE_COLORS.length];
            return {
                id: `pk-${val}`,
                label: val,
                color: palette.color,
                glow: palette.glow,
                colorIdx: i,
                position: [
                    Math.cos(angle) * RECORD_RING_R,
                    0,
                    Math.sin(angle) * RECORD_RING_R
                ]
            };
        });
    }, [rowData.pk_list]);

    // ── Tier 2: Linked Tables (Outer Ring) ───────────────────────────────────
    const tableNodes = useMemo(() => {
        const n = linkedTables.length;
        const nRecords = (rowData.pk_list || []).length;
        const recordR = nRecords > 1 ? Math.max(10, 5 + nRecords * 1.2) : 0;
        const TABLE_RING_R = Math.max(26, recordR + 16 + n * 1.5);

        return linkedTables.map((lt, i) => {
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const palette = TABLE_COLORS[(i + 2) % TABLE_COLORS.length];
            return {
                ...lt,
                id: `tbl-${lt.table}`,
                label: lt.table,
                color: palette.color,
                glow: palette.glow,
                position: [
                    Math.cos(angle) * TABLE_RING_R,
                    0,
                    Math.sin(angle) * TABLE_RING_R
                ]
            };
        });
    }, [linkedTables, rowData.pk_list]);

    // ── Tier 3: Metric Nodes (Satellite nodes per table) ─────────────────────
    const distNodes = useMemo(() => {
        const nodes = [];
        tableNodes.forEach((tn) => {
            // Aggregate metrics from all selected columns
            let totalVal = 0;
            let combinedPct = 0;

            selectedMetrics.forEach(metric => {
                let m = null;
                if (metric.includes(' > ')) {
                    const [tbl, col] = metric.split(' > ');
                    if (tn.table === tbl) {
                        m = tn.metric_nodes?.find(mn => mn.column === col);
                    }
                } else {
                    // Source table metric or generic 'records'
                    m = tn.metric_nodes?.find(mn => mn.column === metric);
                }

                if (m) {
                    totalVal += (m.value || 0);
                    combinedPct += (m.pct || 0);
                }
            });

            // If combined metrics are zero, don't show satellite
            if (totalVal <= 0 && combinedPct <= 0) return;

            // Simple average of pct for visual scale, or cap at 100
            const finalPct = Math.min(100, combinedPct / selectedMetrics.length);

            const [tx, ty, tz] = tn.position;
            const normPct = finalPct / 100;
            const scale = 0.6 + normPct * 1.2;
            
            const valLabel = totalVal >= 1000000
                ? `${(totalVal / 1000000).toFixed(1)}M`
                : totalVal >= 1000 ? `${(totalVal / 1000).toFixed(1)}k`
                    : totalVal.toLocaleString();

            const DIST_SUB_R = 5.5;
            const tableAngle = Math.atan2(tz, tx);
            const distPos = [
                tx + Math.cos(tableAngle) * DIST_SUB_R,
                ty + 1.2,
                tz + Math.sin(tableAngle) * DIST_SUB_R
            ];

            nodes.push({
                id: `dist-${tn.table}-aggregated`,
                position: distPos,
                scale,
                refColor: tn.color,
                refGlow: tn.glow,
                pkColor: recordNodes[0]?.color || '#fbbf24',
                pkGlow: recordNodes[0]?.glow || '#fde68a',
                pctLabel: `${finalPct.toFixed(1)}%`,
                pkLabel: rowData.display_val || rowData.pk_val,
                countLabel: `${valLabel} Impact`,
                parentPos: tn.position,
                pct: finalPct
            });
        });
        return nodes;
    }, [tableNodes, selectedMetrics, recordNodes, rowData]);

    const camDist = Math.max(65, 45 + tableNodes.length * 3);

    return (
        <>
            <CameraRig distance={camDist} fov={55} />
            
            {/* Studio Lighting */}
            <ambientLight intensity={0.55} color="#e8eeff" />
            <directionalLight position={[10, 20, 10]} intensity={2.0} />
            <pointLight position={[0, 5, 0]} intensity={1.5} color={tGlow} distance={40} decay={2} />
            <pointLight position={[20, 10, 20]} intensity={1.2} color="#ffffff" distance={100} />
            <pointLight position={[-20, 10, -20]} intensity={1.2} color="#ffffff" distance={100} />
            
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0.5} fade speed={0.5} />

            {/* If only one record, show NeuralCore at center reflecting that record */}
            {recordNodes.length <= 1 && (
                <NeuralCoreInspector 
                    color={recordNodes[0]?.color || tColor} 
                    glow={recordNodes[0]?.glow || tGlow}
                    label={rowData.display_val || rowData.pk_val}
                    sublabel={rowData.table_name || 'record'}
                />
            )}

            {/* Tier 1: Records in Inner Ring (only if > 1) */}
            {recordNodes.length > 1 && recordNodes.map(rn => (
                <PKValueNode key={rn.id} node={rn} />
            ))}

            {/* Spokes from records to center (if in a ring) */}
            {recordNodes.length > 1 && recordNodes.map(rn => (
                <PKValueConnector key={`spoke-${rn.id}`} from={[0, 0, 0]} to={rn.position} color={rn.glow} />
            ))}

            {/* Tier 2: Linked Tables */}
            {tableNodes.map(tn => (
                <RefTableNode key={tn.id} node={tn} />
            ))}

            {/* Arcs from records to tables (high-fidelity connections) */}
            {recordNodes.map(rn => (
                tableNodes.map(tn => {
                    // Use breakdown to find this specific record's cumulative contribution
                    const breakdown = tn.pk_distribution?.[rn.label];
                    const srcBreakdown = rowData.source_distribution?.[rn.label];
                    if (!breakdown && !srcBreakdown) return null;

                    let cumulativeVal = 0;
                    let cumulativeTotal = 0;

                    selectedMetrics.forEach(metric => {
                        if (metric.includes(' > ')) {
                            // Linked table metric
                            const [tbl, col] = metric.split(' > ');
                            if (tn.table === tbl) {
                                cumulativeVal += (breakdown?.[col] || 0);
                                cumulativeTotal += (tn.metric_nodes?.find(m => m.column === col)?.value || 1);
                            }
                        } else {
                            // Source table metric (e.g. records or quantity_damaged)
                            // This impacts ALL linked tables proportionally to the record's local count
                            const val = srcBreakdown?.[metric] || 0;
                            cumulativeVal += val;
                            // For source metrics, we normalize by the total across all selected records
                            const total = rowData.pk_list?.reduce((acc, pk) => acc + (rowData.source_distribution[pk]?.[metric] || 0), 0) || 1;
                            cumulativeTotal += total;
                        }
                    });

                    if (cumulativeVal <= 0) return null;

                    // Calculate the percentage share this record has in this table for the combined metrics
                    const sharedPct = (cumulativeVal / (cumulativeTotal || 1)) * 100;

                    return (
                        <PKFKBridge 
                            key={`arc-${rn.id}-${tn.id}`}
                            from={rn.position}
                            to={tn.position}
                            fromColor={rn.glow}
                            toColor={tn.glow}
                            pct={sharedPct}
                        />
                    );
                })
            ))}

            {/* Tier 3: Metric satellite nodes */}
            {distNodes.map(dn => (
                <FKDistNode key={dn.id} node={dn} />
            ))}

            <OrbitControls enableDamping dampingFactor={0.06} minDistance={5} maxDistance={300} />
        </>
    );
}

export default function MultiTableInspector({ selectedTableNames, connectionId, allTables, onClose }) {
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
    const ROWS_LIMIT = 100;

    const [searchTerm, setSearchTerm] = useState('');
    const searchTimer = useRef(null);

    const [rowDetailData, setRowDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedMetrics, setSelectedMetrics] = useState(['records']);
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
        fetch(`/api/multi-table/schema/${connectionId}?${params}`)
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

        const incoming = schemaData?.connections?.find(c => c.to_table === tbl.name);
        const pkCol = tbl.columns?.find(c => c.is_pk)?.name || 'id';

        const params = new URLSearchParams({
            limit: ROWS_LIMIT,
            offset: offset,
            ...(search ? { search } : {}),
            ...(incoming ? {
                linked_table: incoming.from_table,
                fk_column: incoming.from_column,
                pk_column: pkCol,
            } : { pk_column: pkCol }),
        });

        fetch(`/api/multi-table/rows/${connectionId}/${encodeURIComponent(tbl.name)}?${params}`)
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
            });
    }, [connectionId, schemaData]);

    const loadMoreRows = useCallback(() => {
        if (!selectedTable || rowsLoading) return;
        const nextOffset = rowsOffset + ROWS_LIMIT;
        fetchRows(selectedTable, searchTerm, nextOffset, true);
    }, [selectedTable, rowsLoading, rowsOffset, searchTerm, fetchRows]);

    const fetchDetail = useCallback((rowOrRows) => {
        if (!selectedTable || !connectionId) return;
        setDetailLoading(true);
        const pkCol = selectedTable.columns?.find(c => c.is_pk)?.name || 'id';

        const allOtherTables = selectedTableNames.filter(n => n !== selectedTable.name);
        const fkLinked = schemaData?.connections
            ?.filter(c => c.to_table === selectedTable.name)
            .map(c => c.from_table) || [];
        const linkedTableNames = [...new Set([...allOtherTables, ...fkLinked])];

        const pkValues = Array.isArray(rowOrRows) 
            ? rowOrRows.map(r => r.pk_val).join(',') 
            : rowOrRows.pk_val;

        const params = new URLSearchParams({
            pk_column: pkCol,
            linked_tables: linkedTableNames.join(','),
        });

        fetch(`/api/multi-table/row-detail/${connectionId}/${encodeURIComponent(selectedTable.name)}/${encodeURIComponent(pkValues)}?${params}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(d => { setRowDetailData(d); setDetailLoading(false); })
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
        fetchRows(tbl, '', 0, false);
    }, [fetchRows]);

    const onSelectRow = useCallback((row, colorIdx) => {
        setSelectedRow(row);
        setSelectedRowColorIdx(colorIdx);
        setLevel(3);
        setBreadcrumb(prev => [...prev, { level: 3, label: row.label }]);
        setMultiSelectedRows([]); // Clear multi-selection for single drilldown
        fetchDetail(row);
    }, [fetchDetail]);

    const goBack = useCallback(() => {
        if (level === 3) {
            setLevel(2);
            setBreadcrumb(prev => prev.filter(b => b.level !== 3));
        } else if (level === 2) {
            setLevel(1);
            setSelectedTable(null);
            setRowsData(null);
            setSearchTerm('');
            setBreadcrumb([]);
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
                                cursor: level > 2 ? 'pointer' : 'default',
                                maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }} onClick={() => { if (level > 2) goBack(); }}>
                                {breadcrumb.find(b => b.level === 2).label}
                            </span>
                        </>
                    )}

                    {level >= 3 && breadcrumb.find(b => b.level === 3) && (
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
            {level === 3 && rowDetailData && (
                <>
                    {/* ANALYSIS CONTROLS (Column Selector) */}
                    <div style={{
                        position: 'absolute', top: 75, left: 16, zIndex: 1000,
                        background: 'rgba(2, 6, 23, 0.94)', border: '1px solid #1e293b',
                        borderRadius: 12, padding: '12px', minWidth: 190,
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    }}>
                        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                            Select Pivot Column
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Source Table Metrics */}
                            <div>
                                <div style={{ fontSize: 7, color: '#444c56', fontWeight: 800, letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>Source Table</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {rowDetailData.available_columns?.filter(c => !c.includes(' > ')).map(col => {
                                        const isActive = selectedMetrics.includes(col);
                                        return (
                                            <button
                                                key={col}
                                                onClick={() => toggleMetric(col)}
                                                style={{
                                                    background: isActive ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255,255,255,0.02)',
                                                    border: `1px solid ${isActive ? '#fbbf24' : 'rgba(255,255,255,0.05)'}`,
                                                    borderRadius: 4, padding: '4px 8px', textAlign: 'left',
                                                    cursor: 'pointer', transition: 'all 0.1s',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                }}
                                            >
                                                <span style={{ fontSize: 9, fontWeight: 600, color: isActive ? '#fbbf24' : '#64748b' }}>{col}</span>
                                                {isActive && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fbbf24' }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Linked Table Metrics */}
                            {rowDetailData.available_columns?.some(c => c.includes(' > ')) && (
                                <div>
                                    <div style={{ fontSize: 7, color: '#444c56', fontWeight: 800, letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' }}>Linked Tables</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {rowDetailData.available_columns?.filter(c => c.includes(' > ')).map(col => {
                                            const isActive = selectedMetrics.includes(col);
                                            return (
                                                <button
                                                    key={col}
                                                    onClick={() => toggleMetric(col)}
                                                    style={{
                                                        background: isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255,255,255,0.02)',
                                                        border: `1px solid ${isActive ? '#22c55e' : 'rgba(255,255,255,0.05)'}`,
                                                        borderRadius: 4, padding: '4px 8px', textAlign: 'left',
                                                        cursor: 'pointer', transition: 'all 0.1s',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    }}
                                                >
                                                    <span style={{ fontSize: 9, fontWeight: 600, color: isActive ? '#22c55e' : '#64748b' }}>{col}</span>
                                                    {isActive && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e' }} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ borderTop: '1px solid #1e293b', marginTop: 12, paddingTop: 10 }}>
                            <div style={{ fontSize: 8, color: '#444c56', fontWeight: 800, letterSpacing: 1 }}>PK DISTRIBUTION MODE</div>
                        </div>
                    </div>

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
                    {level === 2 && rowsData && !rowsLoading && (
                        <Level2Scene
                            tableInfo={selectedTable}
                            rows={rowsData.rows}
                            tableColorIdx={selectedTableColorIdx}
                            onSelectRow={onSelectRow}
                            multiSelectedRows={multiSelectedRows}
                            toggleRowSelection={toggleRowSelection}
                        />
                    )}
                    {level === 3 && rowDetailData && !detailLoading && (
                        <Level3Scene
                            rowData={rowDetailData}
                            linkedTables={rowDetailData.linked_tables}
                            selectedMetrics={selectedMetrics}
                            tableColorIdx={selectedRowColorIdx !== null ? selectedRowColorIdx : selectedTableColorIdx}
                        />
                    )}
                </Canvas>
            )}

            {/* ── RECORD BROWSER SIDEBAR (Level 2) ── */}
            {level === 2 && rowsData && !rowsLoading && (
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
                        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            {multiSelectedRows.length > 0 ? (
                                <button
                                    onClick={() => {
                                        setLevel(3);
                                        setBreadcrumb(prev => [...prev, { level: 3, label: `${multiSelectedRows.length} Selected` }]);
                                        fetchDetail(multiSelectedRows);
                                    }}
                                    style={{
                                        width: '100%', background: '#fbbf24', border: 'none',
                                        borderRadius: 6, padding: '8px', color: '#000',
                                        fontSize: 10, fontWeight: 800, cursor: 'pointer',
                                        letterSpacing: 1, boxShadow: '0 0 15px rgba(251, 191, 36, 0.4)',
                                    }}
                                >
                                    INSPECT {multiSelectedRows.length} SELECTED
                                </button>
                            ) : (
                                <div style={{ fontSize: 8, color: '#334155', letterSpacing: 1 }}>CLICK ITEM FOR SINGLE INSPECT • USE CHECKBOX FOR MULTI</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}