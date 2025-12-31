import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Html, Sphere } from '@react-three/drei';
import * as getUuid from 'uuid'; // Import * as to handle potential default export issues or named exports
import * as THREE from 'three';

const uuid = getUuid.v4;

// --- Statistical Helper Functions ---
const calculateStats = (data, column) => {
    if (!data || data.length === 0) return { type: 'unknown', center: 0, scale: 1 };

    const sampleVal = data[0][column];
    const isNumeric = !isNaN(parseFloat(sampleVal)) && isFinite(sampleVal);

    if (isNumeric) {
        const values = data.map(d => parseFloat(d[column]));
        const sum = values.reduce((a, b) => a + b, 0);
        const mean = sum / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance) || 1; // Avoid divide by zero

        return { type: 'numeric', mean, stdDev, min: Math.min(...values), max: Math.max(...values) };
    } else {
        const counts = {};
        data.forEach(d => {
            const val = d[column];
            counts[val] = (counts[val] || 0) + 1;
        });
        const maxFreq = Math.max(...Object.values(counts));
        return { type: 'categorical', counts, maxFreq };
    }
};

const Node3D = ({ position, color, size, label, details, isCore }) => {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    useFrame((state) => {
        if (!meshRef.current) return;
        // Subtle floating animation
        meshRef.current.position.y += Math.sin(state.clock.elapsedTime + position[0]) * 0.002;
    });

    return (
        <group position={position}>
            {/* Glow Effect */}
            <mesh ref={meshRef} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
                <sphereGeometry args={[size, 32, 32]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={isCore ? 2 : (hovered ? 1.5 : 0.5)}
                    roughness={0.1}
                    metalness={0.8}
                />
            </mesh>

            {/* Label (always visible for Core, on hover for others) */}
            {(hovered || isCore) && (
                <Html distanceFactor={15}>
                    <div className="glass-card" style={{
                        padding: '8px 12px',
                        pointerEvents: 'none',
                        minWidth: '150px',
                        transform: 'translate3d(-50%, -120%, 0)',
                        backdropFilter: 'blur(8px)',
                        background: 'rgba(0, 10, 20, 0.8)',
                        border: `1px solid ${color}`,
                        borderRadius: '8px',
                        color: 'white',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '10px'
                    }}>
                        <div style={{ fontWeight: 'bold', color: color, marginBottom: '4px' }}>
                            {label}
                        </div>
                        {!isCore && details && (
                            <div className="tooltip-grid" style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px' }}>
                                {Object.entries(details).slice(0, 4).map(([k, v]) => (
                                    <React.Fragment key={k}>
                                        <span style={{ opacity: 0.6 }}>{k}:</span>
                                        <span style={{ textAlign: 'right' }}>{String(v).substring(0, 10)}</span>
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                </Html>
            )}
        </group>
    );
};

const Scene = ({ data, column }) => {
    // Calculate 3D Positions based on Statistics
    const { nodes, coreStats } = useMemo(() => {
        if (!data || data.length === 0) return { nodes: [], coreStats: {} };

        const stats = calculateStats(data, column);
        const processedNodes = [];

        // Colors from palette
        const colors = ['#00d4ff', '#00ff88', '#9d4edd', '#ffd60a', '#ff006e'];

        data.forEach((d, i) => {
            const val = d[column];
            let radius, theta, phi, size, color;

            // Spherical Coordinates Logic
            // radius = distance from core (statistical deviation)
            // theta/phi = random distribution for spherical cloud

            if (stats.type === 'numeric') {
                const numVal = parseFloat(val);
                const zScore = Math.abs((numVal - stats.mean) / stats.stdDev); // Distance matches deviation

                // Base radius 5 + deviation. Cap max distance.
                radius = 5 + (zScore * 3);

                // Size based on value relative to max (normalized 0.2 to 0.8)
                const normVal = (numVal - stats.min) / (stats.max - stats.min || 1);
                size = 0.2 + (normVal * 0.6);

                // Color based on deviation severity
                color = zScore > 2 ? colors[4] : (zScore > 1 ? colors[3] : colors[0]);

            } else {
                // Categorical
                const freq = stats.counts[val];
                const rarity = 1 - (freq / stats.maxFreq); // Rarer items are further away? Or Core items are common?
                // Let's make Core items = Common (Gravity center)
                // Rare items = Far away

                radius = 4 + (rarity * 10);
                size = 0.3 + ((freq / stats.maxFreq) * 0.5); // Bigger if more common
                color = colors[i % colors.length];
            }

            // Distribute evenly on sphere surface using Golden Spiral method for cleaner look, 
            // or random for organic cloud. Let's use Random for organic.
            theta = Math.random() * Math.PI * 2;
            phi = Math.acos((Math.random() * 2) - 1);

            const x = radius * Math.sin(phi) * Math.cos(theta);
            const y = radius * Math.sin(phi) * Math.sin(theta);
            const z = radius * Math.cos(phi);

            processedNodes.push({
                id: getUuid ? (typeof getUuid.v4 === 'function' ? getUuid.v4() : i) : i,
                pos: [x, y, z],
                color,
                size,
                data: d,
                val
            });
        });

        return { nodes: processedNodes, coreStats: stats };
    }, [data, column]);

    return (
        <group>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} />
            <pointLight position={[-10, -10, -10]} intensity={0.5} color="#9d4edd" />

            {/* Core Node */}
            <Node3D
                position={[0, 0, 0]}
                size={1.5}
                color="#ffffff"
                label="CORE STATS"
                isCore={true}
                details={null}
            />

            {/* Data Nodes */}
            {nodes.map((node, i) => (
                <React.Fragment key={i}>
                    {/* Connection Line to Core (Opacity based on distance) */}
                    <line>
                        <bufferGeometry attach="geometry" onUpdate={geo => {
                            geo.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(...node.pos)])
                        }} />
                        <lineBasicMaterial attach="material" color={node.color} transparent opacity={0.2} />
                    </line>

                    <Node3D
                        position={node.pos}
                        color={node.color}
                        size={node.size}
                        label={`${column}: ${node.val}`}
                        details={node.data}
                        isCore={false}
                    />
                </React.Fragment>
            ))}

            <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} autoRotate={true} autoRotateSpeed={0.5} />
        </group>
    );
};

const RecordForceGraph = ({ table, column, visible, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);

    useEffect(() => {
        if (!visible || !table || !column) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/data/sample/${table}/${column}`);
                const result = await response.json();
                setData(result.data || []);
            } catch (err) {
                console.error('Failed to fetch records for gravity:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [visible, table, column]);

    if (!visible) return null;

    return (
        <div className="record-constellation-overlay" style={{ background: 'rgba(0, 5, 16, 0.95)' }}>
            <div className="constellation-header">
                <div className="breadcrumb">
                    <span className="breadcrumb-root">3D Statistical View</span>
                    <span className="breadcrumb-sep">›</span>
                    <span className="breadcrumb-table">{table}</span>
                    <span className="breadcrumb-sep">›</span>
                    <span className="breadcrumb-column">{column} Analysis</span>
                </div>
                <button className="close-circle-btn" onClick={onClose}>×</button>
            </div>

            <div className="constellation-canvas-container" style={{ width: '100%', height: 'calc(100vh - 100px)' }}>
                {loading ? (
                    <div className="loader">
                        <div className="dna-spinner">🧬</div>
                    </div>
                ) : (
                    <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
                        <Scene data={data} column={column} />
                    </Canvas>
                )}
            </div>

            <div className="constellation-footer">
                <div className="legend-pills">
                    <div className="pill">Center: Mean/Peak</div>
                    <div className="pill">Distance: Deviation/Rarity</div>
                    <div className="pill">Size: Magnitude/Freq</div>
                </div>
            </div>
        </div>
    );
};

export default RecordForceGraph;
