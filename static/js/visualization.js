import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export class Visualization {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById('graphView'); // Use the wrapper
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.nodes = [];
        this.connections = [];
        this.particles = [];
        this.animationId = null;
        this.onNodeClick = null;
        this.selectedNode = null;

        this.init();
    }

    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0f2027, 0.0006);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 5000);
        this.camera.position.z = 800;

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x0f2027, 1);

        // Append to container
        const existingCanvas = document.getElementById(this.containerId);
        if (existingCanvas) existingCanvas.remove(); // Remove old canvas

        this.renderer.domElement.id = this.containerId;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const light1 = new THREE.PointLight(0x22d3ee, 2, 1500);
        light1.position.set(400, 400, 400);
        this.scene.add(light1);

        const light2 = new THREE.PointLight(0x667eea, 2, 1500);
        light2.position.set(-400, -400, 400);
        this.scene.add(light2);

        // Starfield
        this.createStarfield();

        // Interaction setup
        this.setupInteractions();

        // Handle resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Start animation loop
        this.animate();
    }

    createStarfield() {
        const geometry = new THREE.BufferGeometry();
        const count = 2000;
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count * 3; i++) {
            positions[i] = (Math.random() - 0.5) * 4000;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x00d4ff,
            size: 2,
            transparent: true,
            opacity: 0.6
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
    }

    addParticle(particleData) {
        // Find source and target nodes
        const sourceNode = this.nodes.find(n => n.data.id === particleData.from);
        const targetNode = this.nodes.find(n => n.data.id === particleData.to);

        if (!sourceNode || !targetNode) return;

        // Create particle
        const geometry = new THREE.SphereGeometry(3, 16, 16);
        const color = particleData.type === 'fraud' ? 0xff4757 : 0x00ff88;
        const material = new THREE.MeshBasicMaterial({ color });

        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(sourceNode.mesh.position);

        this.particles.push({
            mesh: particle,
            source: sourceNode.mesh.position.clone(),
            target: targetNode.mesh.position.clone(),
            progress: 0,
            speed: 0.01
        });

        this.scene.add(particle);
    }

    renderGraph(graphData) {
        this.clearScene();
        if (!graphData || !graphData.nodes) return;

        console.log("Rendering Schema Graph", graphData.nodes.length, "nodes");

        // Layout Parameters
        const radius = 400;
        const centerX = 0, centerY = 0, centerZ = 0;

        graphData.nodes.forEach((node, i) => {
            // Position: Hub at center, others in clusters or radial
            let x, y, z;
            if (node.is_hub) {
                x = 0; y = 0; z = 0;
            } else {
                // Use positions from backend if available, otherwise radial
                x = node.x || (Math.cos((i / graphData.nodes.length) * Math.PI * 2) * radius);
                y = node.y || (Math.sin((i / graphData.nodes.length) * Math.PI * 2) * radius);
                z = node.z || (Math.random() * 200 - 100);
            }

            // Node Geometry: Polyhedral (Icosahedron with 0 detail = flat triangles)
            const geometry = new THREE.IcosahedronGeometry(node.is_hub ? 25 : 15, 0);

            // High-Level Color Coordination (Matching Legend)
            const nodeColor = new THREE.Color(node.color || '#778ca3');

            const material = new THREE.MeshPhongMaterial({
                color: nodeColor,
                emissive: nodeColor,
                emissiveIntensity: 0.3,
                flatShading: true, // Crucial for the Poly look
                shininess: 100
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            mesh.userData = node;

            // Simple Wireframe overlay for premium feel
            const wireGeo = new THREE.IcosahedronGeometry(node.is_hub ? 26 : 16, 0);
            const wireMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                wireframe: true,
                transparent: true,
                opacity: 0.1
            });
            const wireframe = new THREE.Mesh(wireGeo, wireMat);
            mesh.add(wireframe);
            mesh.userData.ring = wireframe; // Link for animation

            this.scene.add(mesh);
            this.nodes.push({ mesh, data: node });
        });

        // Edges: Straight Lines (as requested/shown in image)
        if (graphData.edges) {
            graphData.edges.forEach(edge => {
                const source = this.nodes.find(n => n.data.id === edge.source);
                const target = this.nodes.find(n => n.data.id === edge.target);

                if (source && target) {
                    const geometry = new THREE.BufferGeometry().setFromPoints([
                        source.mesh.position,
                        target.mesh.position
                    ]);

                    let edgeColor = 0xffffff;
                    let opacity = 0.15;

                    if (edge.type === 'ai_predicted') {
                        edgeColor = 0xa855f7; // Purple accent
                        opacity = 0.6;
                        const lineMat = new THREE.LineBasicMaterial({
                            color: edgeColor,
                            transparent: true,
                            opacity: opacity,
                            linewidth: 2 // Note: Linewidth 1 is regular for most GPUs, but we'll try to distinguish via color/opacity
                        });
                        const line = new THREE.Line(geometry, lineMat);
                        this.scene.add(line);
                        this.connections.push(line);
                        return; // Done
                    }

                    const material = new THREE.LineBasicMaterial({
                        color: edgeColor,
                        transparent: true,
                        opacity: opacity
                    });

                    const line = new THREE.Line(geometry, material);
                    this.scene.add(line);
                    this.connections.push(line);
                }
            });
        }
    }

    updateParticles() {
        this.particles.forEach((particle, index) => {
            particle.progress += particle.speed;

            if (particle.progress >= 1) {
                // Remove particle
                this.scene.remove(particle.mesh);
                this.particles.splice(index, 1);
            } else {
                // Move particle along path
                particle.mesh.position.lerpVectors(
                    particle.source,
                    particle.target,
                    particle.progress
                );
            }
        });
    }

    setupInteractions() {
        let isDragging = false;
        let previousMouse = { x: 0, y: 0 };
        let rotation = { x: 0, y: 0 };

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMouse = { x: e.clientX, y: e.clientY };
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMouse.x;
                const deltaY = e.clientY - previousMouse.y;

                // Rotate scene slightly based on drag
                this.scene.rotation.y += deltaX * 0.005;
                this.scene.rotation.x += deltaY * 0.005;

                previousMouse = { x: e.clientX, y: e.clientY };
            }
        });

        this.renderer.domElement.addEventListener('mouseup', () => isDragging = false);
        this.renderer.domElement.addEventListener('mouseleave', () => isDragging = false);

        // Zoom handling
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.camera.position.z += e.deltaY * 0.5;
            // Clamp zoom
            this.camera.position.z = Math.max(200, Math.min(2000, this.camera.position.z));
        }, { passive: false });

        // Click handling for nodes
        this.renderer.domElement.addEventListener('click', (e) => {
            if (isDragging) return; // Don't click if dragging

            // Calculate mouse position
            const rect = this.renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((e.clientX - rect.left) / rect.width) * 2 - 1,
                -((e.clientY - rect.top) / rect.height) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, this.camera);

            // Check intersections including both meshes and their glow children if any
            // We'll intersect against the meshes stored in this.nodes
            const activeMeshes = this.nodes.map(n => n.mesh);
            const intersects = raycaster.intersectObjects(activeMeshes, false);

            if (intersects.length > 0) {
                const object = intersects[0].object;
                const nodeData = object.userData;
                this.showNodeInfo(nodeData);

                // Also trigger external callback if set
                if (this.onNodeClick) {
                    this.onNodeClick(nodeData);
                }
            }
        });
    }

    onCanvasClick(event) {
        // Deprecated, logic moved to setupInteractions
    }

    showNodeInfo(nodeData) {
        // No internal implementation, handled by App.js via onNodeClick
    }

    clearScene() {
        this.nodes.forEach(node => this.scene.remove(node.mesh));
        this.connections.forEach(line => this.scene.remove(line));
        this.nodes = [];
        this.connections = [];
    }

    onWindowResize() {
        this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        // Rotate nodes slightly
        this.nodes.forEach(node => {
            if (node.mesh.userData.ring && node.mesh.userData.ring.rotation) {
                node.mesh.userData.ring.rotation.z += 0.01;
                node.mesh.userData.ring.rotation.y += 0.005;
            }
        });

        // Update particles
        this.updateParticles();

        // Camera look at center
        this.camera.lookAt(0, 0, 0);

        this.renderer.render(this.scene, this.camera);
    }
}
