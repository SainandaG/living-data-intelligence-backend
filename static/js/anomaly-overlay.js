// Anomaly Overlay System for Visual Explanations
export class AnomalyOverlay {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.activeOverlays = [];
        this.explanationPanels = [];
    }

    showAnomaly(anomaly, affectedNodes) {
        console.log('Showing anomaly:', anomaly);

        // Highlight affected nodes
        affectedNodes.forEach(nodeId => {
            const nodeObj = this.scene.children.find(child =>
                child.userData && child.userData.id === nodeId
            );

            if (nodeObj) {
                this.highlightNode(nodeObj, anomaly.severity);
            }
        });

        // Create explanation panel
        this.createExplanationPanel(anomaly);

        // Store overlay
        this.activeOverlays.push({
            anomaly,
            affectedNodes,
            timestamp: Date.now()
        });

        // Auto-remove after 30 seconds
        setTimeout(() => this.removeAnomaly(anomaly), 30000);
    }

    highlightNode(node, severity) {
        const color = severity === 'critical' ? 0xff4757 : 0xffd60a;

        // Create pulsing glow
        const glowGeometry = new THREE.SphereGeometry(node.geometry.parameters.radius * 1.5, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3
        });

        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.userData.isAnomalyGlow = true;
        glow.userData.pulsePhase = 0;
        glow.userData.severity = severity;

        node.add(glow);

        // Change node color temporarily
        node.material.emissive.setHex(color);
        node.material.emissiveIntensity = 0.8;
    }

    createExplanationPanel(anomaly) {
        // Create DOM element for explanation
        const panel = document.createElement('div');
        panel.className = 'anomaly-explanation-panel';
        panel.innerHTML = `
            <div class="anomaly-header ${anomaly.severity}">
                <span class="anomaly-icon">${anomaly.severity === 'critical' ? '🚨' : '⚠️'}</span>
                <span class="anomaly-title">${anomaly.severity.toUpperCase()} ANOMALY DETECTED</span>
                <button class="close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="anomaly-body">
                <p class="anomaly-metric"><strong>Metric:</strong> ${anomaly.metric}</p>
                <p class="anomaly-value">
                    <strong>Current:</strong> ${anomaly.current_value.toFixed(2)} 
                    <span class="deviation">(${anomaly.deviation > 0 ? '+' : ''}${anomaly.deviation.toFixed(2)})</span>
                </p>
                <p class="anomaly-expected"><strong>Expected:</strong> ${anomaly.expected_value.toFixed(2)}</p>
                <p class="anomaly-explanation">${anomaly.explanation}</p>
            </div>
        `;

        document.body.appendChild(panel);
        this.explanationPanels.push(panel);

        // Position panel
        panel.style.position = 'fixed';
        panel.style.top = `${100 + this.explanationPanels.length * 20}px`;
        panel.style.right = '400px';

        // Auto-remove
        setTimeout(() => {
            panel.remove();
            const index = this.explanationPanels.indexOf(panel);
            if (index > -1) this.explanationPanels.splice(index, 1);
        }, 30000);
    }

    removeAnomaly(anomaly) {
        // Remove from active overlays
        const index = this.activeOverlays.findIndex(o => o.anomaly === anomaly);
        if (index > -1) {
            this.activeOverlays.splice(index, 1);
        }

        // Remove glows from nodes
        this.scene.children.forEach(node => {
            if (node.children) {
                const glows = node.children.filter(child => child.userData.isAnomalyGlow);
                glows.forEach(glow => node.remove(glow));
            }
        });
    }

    update() {
        // Animate anomaly glows
        this.scene.traverse(obj => {
            if (obj.userData.isAnomalyGlow) {
                obj.userData.pulsePhase += 0.05;
                const pulse = Math.sin(obj.userData.pulsePhase) * 0.5 + 0.5;
                obj.material.opacity = 0.2 + pulse * 0.4;
                obj.scale.setScalar(1 + pulse * 0.2);
            }
        });
    }
}
