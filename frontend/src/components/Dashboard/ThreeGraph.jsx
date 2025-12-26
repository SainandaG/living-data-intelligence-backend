import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const ThreeGraph = ({ onNodeClick, data, className }) => {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const animationRef = useRef(null);

    // Data Refs
    const nodesRef = useRef([]);
    const edgesRef = useRef([]);
    const particlesRef = useRef([]);

    // Simulation State
    const simulationRef = useRef({
        alpha: 1.0,  // Simulation heat
        running: true
    });

    useEffect(() => {
        if (!containerRef.current) return;

        // Cleanup
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Init Scene
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x0f2027, 0.0006); // Darker Blue-Green fog from check.html
        sceneRef.current = scene;

        // Init Camera
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 15000);
        camera.position.set(0, 400, 1200);
        cameraRef.current = camera;

        // Init Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, logarithmicDepthBuffer: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x0f2027, 1); // Background color from check.html

        const canvasContainer = document.createElement('div');
        canvasContainer.className = "absolute inset-0 z-0";
        containerRef.current.appendChild(canvasContainer);
        canvasContainer.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lights - From check.html
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const light1 = new THREE.PointLight(0x22d3ee, 2, 1500); // Cyan
        light1.position.set(400, 400, 400);
        scene.add(light1);

        const light2 = new THREE.PointLight(0x667eea, 2, 1500); // Purple
        light2.position.set(-400, -400, 400);
        scene.add(light2);

        // Starfield
        createStarfield(scene);

        // --- Data Processing & Simulation Init ---
        let nodes = [];
        let edges = [];
        let particles = [];

        if (data && data.nodes && data.nodes.length > 0) {

            // 1. Create Mesh Objects
            const net = createNetwork(scene, data.nodes, data.edges);
            nodes = net.nodes;
            edges = net.edges;
            particles = net.particles;

            nodesRef.current = nodes;
            edgesRef.current = edges;
            particlesRef.current = particles;

            // 2. Restart Simulation
            simulationRef.current.alpha = 1.0;
            simulationRef.current.running = true;

            // 3. Initial Camera
            camera.lookAt(new THREE.Vector3(0, 0, 0));
        }

        // --- Interaction Logic (Drag & Click) ---
        let isDragging = false;
        let draggedNode = null;
        let hoverNode = null;
        const dragPlane = new THREE.Plane();
        const raycaster = new THREE.Raycaster();
        let previousMouse = { x: 0, y: 0 };
        window.isRotating = false;

        const onMouseDown = (e) => {
            if (e.target.tagName !== 'CANVAS') return;
            const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(nodesRef.current.map(n => n.mesh));
            if (intersects.length > 0) {
                draggedNode = nodesRef.current.find(n => n.mesh === intersects[0].object);
                if (draggedNode && !draggedNode.fixed) {
                    isDragging = true;
                    // Wake up simulation on interaction
                    simulationRef.current.alpha = 0.5;
                    const planeNormal = new THREE.Vector3().copy(camera.position).normalize();
                    dragPlane.setFromNormalAndCoplanarPoint(planeNormal, draggedNode.mesh.position);
                }
            } else {
                isDragging = false;
                previousMouse = { x: e.clientX, y: e.clientY };
                window.isRotating = true;
            }
        };

        const onMouseMove = (e) => {
            const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(nodesRef.current.map(n => n.mesh));

            // Hover Logic
            if (intersects.length > 0) {
                const node = nodesRef.current.find(n => n.mesh === intersects[0].object);
                if (node !== hoverNode) {
                    hoverNode = node;
                    updateHoverStyles(hoverNode, nodesRef.current, edgesRef.current);
                    document.body.style.cursor = 'pointer';
                }
            } else if (hoverNode) {
                hoverNode = null;
                updateHoverStyles(null, nodesRef.current, edgesRef.current);
                document.body.style.cursor = 'default';
            }

            // Drag Logic
            if (isDragging && draggedNode) {
                const intersection = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
                    draggedNode.x = intersection.x;
                    draggedNode.y = intersection.y;
                    draggedNode.z = intersection.z;
                    draggedNode.mesh.position.copy(intersection);
                    draggedNode.velocity = { x: 0, y: 0, z: 0 }; // Zero velocity while holding
                }
            }
            // Camera Rotate Logic
            else if (window.isRotating) {
                const deltaX = e.clientX - previousMouse.x;
                const deltaY = e.clientY - previousMouse.y;

                // Simple orbit around the center
                const currentCameraPos = camera.position.clone();
                const center = new THREE.Vector3(0, 0, 0);

                const spherical = new THREE.Spherical().setFromVector3(currentCameraPos.sub(center));

                spherical.theta -= deltaX * 0.005;
                spherical.phi -= deltaY * 0.005;

                // Clamp phi to prevent camera flipping
                spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

                camera.position.setFromSpherical(spherical).add(center);
                camera.lookAt(center);

                previousMouse = { x: e.clientX, y: e.clientY };
            }
        };

        const onMouseUp = () => { isDragging = false; draggedNode = null; window.isRotating = false; };

        const onWheel = (e) => {
            const zoomSpeed = 0.5;
            camera.position.addScaledVector(camera.position.clone().normalize(), e.deltaY * zoomSpeed);
            // Clamp zoom
            const minZoom = 200;
            const maxZoom = 4000;
            const currentDistance = camera.position.length();
            if (currentDistance < minZoom) {
                camera.position.normalize().multiplyScalar(minZoom);
            } else if (currentDistance > maxZoom) {
                camera.position.normalize().multiplyScalar(maxZoom);
            }
            e.preventDefault();
        };

        const onClick = (e) => {
            if (isDragging || window.isRotating) return;
            const mouse = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(nodesRef.current.map(n => n.mesh));
            if (intersects.length > 0) {
                const node = nodesRef.current.find(n => n.mesh === intersects[0].object);
                if (node && onNodeClick) onNodeClick(node);
            }
        };

        const canvas = renderer.domElement;
        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('click', onClick);

        // --- Animation Loop ---
        const animate = () => {
            // 1. Run Force Simulation Step
            if (simulationRef.current.alpha > 0.01) {
                runForceStep(nodesRef.current, edgesRef.current, simulationRef.current.alpha);
                simulationRef.current.alpha *= 0.99; // Decay
            }

            // 2. Update Visuals
            const time = Date.now() * 0.001;

            // Node Behavior
            // Node Behavior
            nodesRef.current.forEach((n, i) => {
                // Update Mesh from Simulation Data
                n.mesh.position.set(n.x, n.y, n.z);

                // Neural Core Driven Animation
                const pulseSpeed = n.pulse_rate || 1.0;
                const glowBase = n.glow_intensity || 0.5;

                // Gentle Bobbing - Speed modulated by pulse_rate
                n.mesh.position.y += Math.sin((time * pulseSpeed) + i * 0.5) * 0.5;

                // Rotate slightly - Speed modulated by vitality (higher vitality = faster spin)
                const rotSpeed = 0.004 + ((n.vitality || 0) / 10000);
                n.mesh.rotation.y += rotSpeed;

                // Dynamic Glow - Pulse opacity based on heartbeat
                if (n.glow) {
                    const pulse = (Math.sin(time * pulseSpeed * 2) + 1) * 0.5; // 0 to 1
                    n.glow.material.opacity = (glowBase * 0.3) + (pulse * 0.1);
                }

                if (n.labelSprite) {
                    n.labelSprite.position.set(n.x, n.y + n.size + 15, n.z);
                    n.labelSprite.lookAt(camera.position);
                }
            });

            // Edge Behavior - Update Bezier Curves
            edgesRef.current.forEach(e => {
                if (e.sourceNode && e.targetNode) {
                    const idx = e.sourceNode.index + e.targetNode.index; // Stable random seed
                    const start = e.sourceNode.mesh.position;
                    const end = e.targetNode.mesh.position;

                    // Update main line (Bezier)
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2;
                    const midZ = (start.z + end.z) / 2;

                    // Simple deterministic offset for control point to create curve
                    // Uses sin/cos of indices to be consistent yet varied
                    const offset = 80;
                    const cX = midX + Math.sin(idx) * offset;
                    const cY = midY + Math.cos(idx) * offset;
                    const cZ = midZ + Math.sin(idx * 0.5) * offset;

                    const curve = new THREE.QuadraticBezierCurve3(
                        start.clone(),
                        new THREE.Vector3(cX, cY, cZ),
                        end.clone()
                    );
                    e.curve = curve; // Save for particles

                    const points = curve.getPoints(20); // Low resolution for performance
                    e.line.geometry.setFromPoints(points);
                }
            });

            // Particle Behavior
            particlesRef.current.forEach(p => {
                if (p.edge && p.edge.curve) {
                    p.progress += p.speed;
                    if (p.progress >= 1) p.progress = 0;
                    const pos = p.edge.curve.getPoint(p.progress);
                    p.mesh.position.copy(pos);
                }
            });

            // 3. Render
            renderer.render(scene, camera);
            animationRef.current = requestAnimationFrame(animate);
        };
        animate();

        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (canvas) {
                canvas.removeEventListener('mousedown', onMouseDown);
                canvas.removeEventListener('wheel', onWheel);
                canvas.removeEventListener('click', onClick);
            }
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            if (containerRef.current && canvasContainer) containerRef.current.removeChild(canvasContainer);
            renderer.dispose();
        };
    }, [onNodeClick, data]);

    return <div ref={containerRef} className={className || "fixed inset-0 z-0"} />;
};

// --- PHYSICS ENGINE ---
function runForceStep(nodes, edges, alpha) {
    const REPULSION = 40000;  // Push away
    const HOME_GRAVITY = 0.08; // Strong pull to statistical origin
    const CENTER_GRAVITY = 0.01; // Weak pull to center (backup)
    const MAX_VELOCITY = 12;

    // 0. Reset Forces
    nodes.forEach(n => {
        n.fx = 0; n.fy = 0; n.fz = 0;
    });

    // 1. Repulsion (N^2 Loop optimized)
    for (let i = 0; i < nodes.length; i++) {
        const u = nodes[i];
        if (u.fixed) continue;

        for (let j = i + 1; j < nodes.length; j++) {
            const v = nodes[j];
            const dx = u.x - v.x;
            const dy = u.y - v.y;
            const dz = u.z - v.z;
            const distSq = dx * dx + dy * dy + dz * dz || 1;
            // Prevent division by zero / extreme forces
            if (distSq < 100) continue;

            // Force = k / dist^2
            const f = (REPULSION / distSq) * alpha;

            const dist = Math.sqrt(distSq);
            const fx = (dx / dist) * f;
            const fy = (dy / dist) * f;
            const fz = (dz / dist) * f;

            u.fx += fx; u.fy += fy; u.fz += fz;
            v.fx -= fx; v.fy -= fy; v.fz -= fz;
        }

        // STATISTICAL HOMING (The "Neural Alignment" Force)
        if (typeof u.target_x === 'number') {
            // Pull towards calculated statistical position
            const tx = u.target_x - u.x;
            const ty = u.target_y - u.y;
            const tz = u.target_z - u.z;

            u.fx += tx * HOME_GRAVITY * alpha;
            u.fy += ty * HOME_GRAVITY * alpha;
            u.fz += tz * HOME_GRAVITY * alpha;
        } else {
            // Fallback for nodes without stats
            const distToCenter = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z) || 1;
            u.fx -= (u.x / distToCenter) * CENTER_GRAVITY * distToCenter * alpha;
            u.fy -= (u.y / distToCenter) * CENTER_GRAVITY * distToCenter * alpha;
            u.fz -= (u.z / distToCenter) * CENTER_GRAVITY * distToCenter * alpha;
        }
    }

    // 2. Attraction (Edges)
    edges.forEach(e => {
        const u = e.sourceNode;
        const v = e.targetNode;
        if (!u || !v) return;

        const dx = v.x - u.x;
        const dy = v.y - u.y;
        const dz = v.z - u.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;

        // Semantic Length
        const strength = e.data.link_strength || 0.1;
        // Stronger links = shorter target distance
        const targetDist = 400 * (1.2 - strength);

        // Hooke's Law
        const displacement = dist - targetDist;
        const k = 0.04 * alpha; // Spring constant

        const force = displacement * k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;

        if (!u.fixed) { u.fx += fx; u.fy += fy; u.fz += fz; }
        if (!v.fixed) { v.fx -= fx; v.fy -= fy; v.fz -= fz; }
    });

    // 3. Apply Velocity & Position
    nodes.forEach(n => {
        if (n.fixed) return;

        // Damping
        n.velocity = n.velocity || { x: 0, y: 0, z: 0 };
        n.velocity.x = (n.velocity.x + n.fx) * 0.6;
        n.velocity.y = (n.velocity.y + n.fy) * 0.6;
        n.velocity.z = (n.velocity.z + n.fz) * 0.6;

        // Cap Velocity
        const speed = Math.sqrt(n.velocity.x * n.velocity.x + n.velocity.y * n.velocity.y + n.velocity.z * n.velocity.z);
        if (speed > MAX_VELOCITY) {
            n.velocity.x = (n.velocity.x / speed) * MAX_VELOCITY;
            n.velocity.y = (n.velocity.y / speed) * MAX_VELOCITY;
            n.velocity.z = (n.velocity.z / speed) * MAX_VELOCITY;
        }

        n.x += n.velocity.x;
        n.y += n.velocity.y;
        n.z += n.velocity.z;
    });
}

function createTextSprite(message, fontsize, color) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = "bold " + fontsize + "px Arial";
    const metrics = ctx.measureText(message);
    const textWidth = metrics.width;

    canvas.width = textWidth + 20;
    canvas.height = fontsize + 20;

    ctx.font = "bold " + fontsize + "px Arial";
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 6;
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(canvas.width / 10 * 2, canvas.height / 10 * 2, 1);
    return sprite;
}

function createStarfield(scene) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const colors = [];
    for (let i = 0; i < 3000; i++) {
        vertices.push((Math.random() - 0.5) * 6000, (Math.random() - 0.5) * 6000, (Math.random() - 0.5) * 6000);
        const color = new THREE.Color().setHSL(Math.random(), 0.8, 0.8);
        colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({ size: 3, vertexColors: true, transparent: true, opacity: 0.6 });
    scene.add(new THREE.Points(geometry, material));
}

function createNetwork(scene, nodeData, edgeData) {
    const nodes = [];
    const edges = [];
    const particles = [];
    const nodeMap = new Map();

    // 1. Nodes
    nodeData.forEach((data, i) => {
        // Size based on row count
        const rowCount = typeof data.row_count === 'number' ? data.row_count : 0;
        const size = Math.max(25, Math.min(80, 20 + Math.log10(rowCount + 1) * 10));

        let color = data.color || 0x22d3ee;

        // Use Phong Material mostly like check.html to react to light
        const isCore = data.id === 'hub' || data.entity === 'core';
        const finalSize = isCore ? 120 : size; // Force Core size

        const geometry = new THREE.SphereGeometry(finalSize, 64, 64);

        // Special material for Core
        const material = new THREE.MeshPhongMaterial({
            color: isCore ? 0xffffff : color, // Core is white-hot center
            emissive: isCore ? 0x22d3ee : color,
            emissiveIntensity: isCore ? 2.0 : 0.5, // Super bright
            shininess: isCore ? 100 : 80,
            transparent: true,
            opacity: 0.9
        });
        const mesh = new THREE.Mesh(geometry, material);

        const x = data.x !== undefined ? data.x : (Math.random() - 0.5) * 1000;
        const y = data.y !== undefined ? data.y : (Math.random() - 0.5) * 1000;
        const z = data.z !== undefined ? data.z : (Math.random() - 0.5) * 1000;
        mesh.position.set(x, y, z);
        scene.add(mesh);

        // Glow
        const glowGeo = new THREE.SphereGeometry(size * 1.5, 32, 32);
        const glowMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        mesh.add(glow);

        // Label
        const label = createTextSprite(data.name || data.id, 20, '#ffffff');
        label.position.set(x, y + size + 20, z);
        scene.add(label);

        const nodeObj = {
            ...data,
            mesh,
            glow,
            labelSprite: label,
            x, y, z,
            size,
            index: i,
            fx: 0, fy: 0, fz: 0 // Force Accumulators
        };
        nodes.push(nodeObj);
        nodeMap.set(data.id, nodeObj);
    });

    // 2. Edges
    if (edgeData) {
        edgeData.forEach(edge => {
            const n1 = nodeMap.get(edge.source);
            const n2 = nodeMap.get(edge.target);
            if (!n1 || !n2) return;

            // Determine Style based on Edge Type
            let color = 0x22d3ee;
            let opacity = 0.35;

            if (edge.type === 'foreign_key') { color = 0x22d3ee; opacity = 0.5; } // Cyan
            else if (edge.type === 'matching_col') { color = 0xc084fc; opacity = 0.25; } // Purple
            else if (edge.type === 'ai_predicted') { color = 0xfbbf24; opacity = 0.2; } // Amber
            else if (edge.type === 'core_link') { color = 0x5eead4; opacity = 0.15; } // Teal, faint

            // Start with empty buffer, will be updated in animate()
            const geometry = new THREE.BufferGeometry();
            // We need to set initial positions to avoid errors
            geometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)]);

            const material = new THREE.LineBasicMaterial({
                color: color,
                transparent: true,
                opacity: opacity
            });

            const line = new THREE.Line(geometry, material);
            scene.add(line);

            const edgeObj = {
                line,
                sourceNode: n1,
                targetNode: n2,
                data: edge,
                curve: null // Will be calculated in animate
            };
            edges.push(edgeObj);

            // Particles (Randomly add to some edges)
            if (Math.random() > 0.3) {
                const particleGeo = new THREE.SphereGeometry(3, 12, 12);
                const particleMat = new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.8
                });
                const particle = new THREE.Mesh(particleGeo, particleMat);
                scene.add(particle);

                particles.push({
                    mesh: particle,
                    edge: edgeObj,
                    progress: Math.random(),
                    speed: 0.005 + Math.random() * 0.01
                });
            }
        });
    }

    return { nodes, edges, particles };
}

function updateHoverStyles(hoverNode, allNodes, allEdges) {
    allNodes.forEach(n => {
        const isActive = !hoverNode || n === hoverNode ||
            allEdges.some(e => (e.sourceNode === hoverNode && e.targetNode === n) || (e.targetNode === hoverNode && e.sourceNode === n));

        n.mesh.material.opacity = isActive ? 0.9 : 0.2;
        n.mesh.material.emissiveIntensity = isActive ? 0.6 : 0.1;
        n.labelSprite.visible = isActive;
    });

    allEdges.forEach(e => {
        const isRelated = hoverNode && (e.sourceNode === hoverNode || e.targetNode === hoverNode);
        e.line.material.opacity = (!hoverNode || isRelated) ? (isRelated ? 1.0 : 0.1) : 0.02;
    });
}

export default React.memo(ThreeGraph);
