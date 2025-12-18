// Three.js 3D Visualization
export class Visualization {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.nodes = [];
        this.edges = [];
        this.particles = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0f1e);
        this.scene.fog = new THREE.Fog(0x0a0f1e, 500, 2000);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            this.canvas.clientWidth / this.canvas.clientHeight,
            0.1,
            3000
        );
        this.camera.position.set(0, 0, 600);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight1 = new THREE.PointLight(0x00d4ff, 1, 1000);
        pointLight1.position.set(200, 200, 200);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x00ff88, 1, 1000);
        pointLight2.position.set(-200, -200, -200);
        this.scene.add(pointLight2);

        // Controls (OrbitControls-like manual implementation)
        this.setupControls();

        // Event listeners
        window.addEventListener('resize', () => this.onWindowResize());
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));

        // Start animation loop
        this.animate();
    }

    setupControls() {
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };

        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;

                this.camera.position.x -= deltaX * 0.5;
                this.camera.position.y += deltaY * 0.5;

                previousMousePosition = { x: e.clientX, y: e.clientY };
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY * 0.5;
            this.camera.position.z += delta;
            this.camera.position.z = Math.max(200, Math.min(1500, this.camera.position.z));
        });
    }

    renderGraph(graph) {
        console.log('Rendering graph:', graph);

        // Clear existing objects
        this.clearScene();

        // Create nodes
        graph.nodes.forEach(nodeData => {
            const node = this.createNode(nodeData);
            this.nodes.push({ data: nodeData, mesh: node });
            this.scene.add(node);
        });

        // Create edges
        graph.edges.forEach(edgeData => {
            const edge = this.createEdge(edgeData, graph.nodes);
            if (edge) {
                this.edges.push(edge);
                this.scene.add(edge);
            }
        });

        // Add ambient particles
        this.createAmbientParticles();
    }

    createNode(nodeData) {
        // Create sphere for node
        const geometry = new THREE.SphereGeometry(nodeData.size || 20, 32, 32);

        // Material with glow effect
        const material = new THREE.MeshPhongMaterial({
            color: new THREE.Color(nodeData.color || '#00d4ff'),
            emissive: new THREE.Color(nodeData.color || '#00d4ff'),
            emissiveIntensity: 0.3,
            shininess: 100,
            transparent: true,
            opacity: 0.9
        });

        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(nodeData.x || 0, nodeData.y || 0, nodeData.z || 0);
        sphere.userData = nodeData;

        // Add glow ring
        const ringGeometry = new THREE.RingGeometry(nodeData.size + 5, nodeData.size + 8, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(nodeData.color || '#00d4ff'),
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        sphere.add(ring);

        // Animate ring
        sphere.userData.ring = ring;

        return sphere;
    }

    createEdge(edgeData, nodes) {
        const sourceNode = nodes.find(n => n.id === edgeData.source);
        const targetNode = nodes.find(n => n.id === edgeData.target);

        if (!sourceNode || !targetNode) return null;

        const points = [
            new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
            new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.2
        });

        return new THREE.Line(geometry, material);
    }

    createAmbientParticles() {
        const particleCount = 200;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 1000;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 1000;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;
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

    onCanvasClick(event) {
        // Calculate mouse position in normalized device coordinates
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Raycast
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(
            this.nodes.map(n => n.mesh)
        );

        if (intersects.length > 0) {
            const selectedNode = intersects[0].object.userData;
            this.showNodeInfo(selectedNode);
        }
    }

    showNodeInfo(nodeData) {
        const infoPanel = document.getElementById('selectedNodeInfo');
        const detailsDiv = document.getElementById('nodeDetails');

        detailsDiv.innerHTML = `
            <p><strong>Name:</strong> ${nodeData.name}</p>
            <p><strong>Type:</strong> ${nodeData.type}</p>
            <p><strong>Entity:</strong> ${nodeData.entity}</p>
            <p><strong>Row Count:</strong> ${nodeData.row_count.toLocaleString()}</p>
            <p><strong>Metrics:</strong> ${nodeData.metrics.join(', ') || 'None'}</p>
        `;

        infoPanel.classList.remove('hidden');
    }

    clearScene() {
        this.nodes.forEach(node => this.scene.remove(node.mesh));
        this.edges.forEach(edge => this.scene.remove(edge));
        this.nodes = [];
        this.edges = [];
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
            if (node.mesh.userData.ring) {
                node.mesh.userData.ring.rotation.z += 0.01;
            }
        });

        // Update particles
        this.updateParticles();

        // Camera look at center
        this.camera.lookAt(0, 0, 0);

        this.renderer.render(this.scene, this.camera);
    }
}
