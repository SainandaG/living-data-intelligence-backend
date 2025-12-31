import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useWindowManager } from '../../context/WindowManagerContext';

const Record3DGraph = ({ table, column, onClose }) => {
    const containerRef = useRef(null);
    const { connectionId } = useWindowManager();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const sceneRef = useRef(null);
    const nodesRef = useRef([]);
    const animationRef = useRef(null);

    const CLASSIFICATION_COLORS = {
        'fact': 0xff4444,      // Red
        'dimension': 0x22d3ee, // Cyan
        'entity': 0x22c55e,    // Green
        'other': 0x94a3b8      // Slate
    };

    useEffect(() => {
        if (!connectionId || !table || !column) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/drilldown/clustered-records/${connectionId}/${table}/${column}`);
                if (!response.ok) throw new Error('Failed to fetch clustered record data');
                const data = await response.json();

                initThree(data);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (sceneRef.current) {
                // Cleanup
                sceneRef.current.traverse(object => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(m => m.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                });
            }
        };
    }, [connectionId, table, column]);

    const initThree = (graphData) => {
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
        camera.position.z = 600;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(500, 500, 500);
        scene.add(pointLight);

        // Create Starfield
        const starGeo = new THREE.BufferGeometry();
        const starVerts = [];
        for (let i = 0; i < 1000; i++) {
            starVerts.push((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
        const starMat = new THREE.PointsMaterial({ color: 0x888888, size: 1.5 });
        scene.add(new THREE.Points(starGeo, starMat));

        // Create Nodes
        const nodes = [];
        const baseColor = CLASSIFICATION_COLORS[graphData.classification] || CLASSIFICATION_COLORS.other;

        graphData.nodes.forEach((node, i) => {
            const size = 5 + (node.gravity / 20.0);
            const geometry = new THREE.SphereGeometry(size, 16, 16);
            const material = new THREE.MeshPhongMaterial({
                color: baseColor,
                emissive: baseColor,
                emissiveIntensity: 0.3,
                transparent: true,
                opacity: 0.8
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(...node.pos);

            // Add subtle glow
            const glowGeo = new THREE.SphereGeometry(size * 1.5, 8, 8);
            const glowMat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.1 });
            const glowMesh = new THREE.Mesh(glowGeo, glowMat);
            mesh.add(glowMesh);

            scene.add(mesh);

            // Store initial state for animation math
            nodes.push({
                ...node,
                mesh,
                glowMesh,
                initialPos: new THREE.Vector3(...node.pos),
                phase: Math.random() * Math.PI * 2,
                orbitSpeed: (Math.random() * 0.2 + 0.1) * (i % 2 === 0 ? 1 : -1),
                pulseFreq: Math.random() * 2 + 1
            });
        });
        nodesRef.current = nodes;

        // Create Links (Bezier Flows)
        graphData.links.forEach(link => {
            const startNode = nodes.find(n => n.id === link.source);
            const endNode = nodes.find(n => n.id === link.target);

            if (!startNode || !endNode) return;

            const start = startNode.mesh.position;
            const end = endNode.mesh.position;

            const mid = new THREE.Vector3().lerpVectors(start, end, 0.5).add(new THREE.Vector3(0, 50, 0));
            const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
            const points = curve.getPoints(50);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.2 });
            const line = new THREE.Line(geometry, material);
            scene.add(line);
        });

        // Animation Loop
        const animate = () => {
            const time = Date.now() * 0.001;
            animationRef.current = requestAnimationFrame(animate);

            // Scene rotation
            scene.rotation.y += 0.001;

            nodes.forEach((n, i) => {
                // 1. Vertical Float (Sine Wave)
                const floatOffset = Math.sin(time * 0.5 + n.phase) * 10;
                n.mesh.position.y = n.initialPos.y + floatOffset;

                // 2. Orbital Jitter (Circular Motion) using Perlin-like noise simulation
                const orbitRadius = 5;
                n.mesh.position.x = n.initialPos.x + Math.cos(time * n.orbitSpeed + n.phase) * orbitRadius;
                n.mesh.position.z = n.initialPos.z + Math.sin(time * n.orbitSpeed + n.phase) * orbitRadius;

                // 3. Size Pulsing (Scaling)
                const scale = 1 + Math.sin(time * n.pulseFreq) * 0.1; // +/- 10% size
                n.mesh.scale.set(scale, scale, scale);

                // 4. Glow Intensity Pulse
                if (n.glowMesh.material) {
                    n.glowMesh.material.opacity = 0.1 + Math.sin(time * 2 + n.phase) * 0.05;
                }
            });

            renderer.render(scene, camera);
        };
        animate();

        // Resize Listener
        const handleResize = () => {
            if (!containerRef.current) return;
            const w = containerRef.current.clientWidth;
            const h = containerRef.current.clientHeight;
            renderer.setSize(w, h);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', handleResize);
    };

    return (
        <div className="fixed inset-0 z-50 bg-[#000814bb] backdrop-blur-xl flex flex-col">
            <div className="p-6 flex justify-between items-center border-b border-white/10 glass-panel">
                <div className="flex items-center gap-4">
                    <div className="text-2xl">⚡</div>
                    <div>
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">{table}</h2>
                        <p className="text-xs text-cyan-400 font-mono">Deep 3D Record Flow • Clustered by {column}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/20 text-white transition-all text-2xl"
                >
                    ×
                </button>
            </div>

            <div className="flex-1 relative" ref={containerRef}>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="dna-spinner text-4xl mb-4">🧬</div>
                        <p className="text-white/60 font-mono text-sm animate-pulse tracking-[0.2em]">SYNCHRONIZING RECORD EMBEDDINGS...</p>
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center text-red-400">
                        Error: {error}
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-white/10 glass-panel flex justify-between text-[10px] font-mono uppercase tracking-widest text-white/40">
                <div className="flex gap-6">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> Transactions</div>
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-500"></span> Entities</div>
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> Reference</div>
                </div>
                <div className="animate-pulse">Active Gravity Force: G² Clustering Enabled</div>
            </div>
        </div>
    );
};

export default Record3DGraph;
