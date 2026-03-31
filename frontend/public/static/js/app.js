// Main Application Controller
class App {
    constructor() {
        this.connectionId = null;
        this.websocket = null;
        this.visualization = null;
        this.neuralInterval = null;

        window.app = this; // Expose for CSV handler
        this.init();
    }

    init() {
        // DOM elements
        this.modal = document.getElementById('connectionModal');
        this.connectBtn = document.getElementById('connectBtn');
        this.demoBtn = document.getElementById('demoBtn');
        this.connectionForm = document.getElementById('connectionForm');
        this.statusIndicator = document.getElementById('connectionStatus');
        this.loadingOverlay = document.getElementById('loadingOverlay');

        // Event listeners with null checks
        if (this.connectBtn) {
            this.connectBtn.addEventListener('click', () => this.showModal());
        }
        if (this.demoBtn) {
            this.demoBtn.addEventListener('click', () => this.loadDemoMode());
        }
        if (this.connectionForm) {
            this.connectionForm.addEventListener('submit', (e) => this.handleConnect(e));
        }

        // Update port based on database type
        document.getElementById('dbType').addEventListener('change', (e) => {
            const portInput = document.getElementById('port');
            const ports = { postgresql: 5432, mysql: 3306, mongodb: 27017 };
            portInput.value = ports[e.target.value] || 5432;
        });
    }

    showModal() {
        this.modal.classList.remove('hidden');
    }

    hideModal() {
        this.modal.classList.add('hidden');
    }

    async handleConnect(e) {
        e.preventDefault();

        const config = {
            db_type: document.getElementById('dbType').value,
            host: document.getElementById('host').value,
            port: parseInt(document.getElementById('port').value),
            database: document.getElementById('database').value,
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        };

        try {
            this.showLoading('Connecting to database...');

            // Connect to database
            const response = await fetch(`${window.API_BASE}/api/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            const result = await response.json();

            if (result.success) {
                this.connectionId = result.connection_id;
                this.hideModal();
                this.updateStatus(true, 'Connected');

                // Load and visualize graph
                await this.loadGraph();

                // Start WebSocket connection
                this.connectWebSocket();

                // Show Neural Panel and start fetching stats
                document.getElementById('neural-panel').classList.remove('hidden');
                this.startNeuralUpdates();
            } else {
                alert('Connection failed: ' + result.message);
                this.hideLoading();
            }
        } catch (error) {
            console.error('Connection error:', error);
            alert('Connection failed: ' + error.message);
            this.hideLoading();
        }
    }

    async loadDemoMode() {
        // Check if demo mode is enabled
        if (!window.ENABLE_DEMO_MODE) {
            alert('Demo mode is not available. Please use "Connect Database" instead.');
            return;
        }

        try {
            this.showLoading('Loading demo banking system...');
            this.updateStatus(true, 'Demo Mode');

            // Load demo graph
            const response = await fetch(`${window.API_BASE}/api/demo/graph`);
            const graph = await response.json();

            console.log('Demo graph loaded:', graph);

            // Initialize visualization
            if (!this.visualization) {
                const { Visualization } = await import('./visualization.js');
                this.visualization = new Visualization('threejs-canvas');
            }

            // Render graph
            this.visualization.renderGraph(graph);

            // Connect visualization clicks to neural panel
            this.visualization.onNodeClick = (nodeData) => this.handleNodeSelect(nodeData);

            this.hideLoading();

            // Start demo metrics updates
            this.startDemoMetrics();
        } catch (error) {
            console.error('Demo loading error:', error);
            alert('Failed to load demo: ' + error.message);
            this.hideLoading();
        }
    }

    startDemoMetrics() {
        // Show Neural Panel in demo mode too
        document.getElementById('neural-panel').classList.remove('hidden');

        // Set a demo connection ID so Neural Core API works
        this.connectionId = 'demo';

        // Start REAL Neural Core updates
        this.startNeuralUpdates();

        // Simulate real-time metrics updates with intelligence
        setInterval(() => {
            const metrics = {
                transaction_rate: Math.floor(Math.random() * 1000) + 500,
                total_transactions: Math.floor(Math.random() * 1000000) + 50000000,
                fraud_alerts: Math.floor(Math.random() * 10),
                average_amount: (Math.random() * 5000 + 100).toFixed(2),
                failed_transactions: Math.floor(Math.random() * 50)
            };

            // Update metrics display
            this.updateMetrics(metrics);

            // Simulate health status
            const health = this.simulateHealth(metrics);
            this.updateGraphHealth(health);

            // NOTE: Neural UI is now updated by startNeuralUpdates() calling /api/status/demo
            // This provides REAL AI training data instead of fake zeros

            // Simulate anomalies (10% chance)
            if (Math.random() > 0.9) {
                const anomaly = this.simulateAnomaly(metrics);
                this.handleAnomalies([anomaly]);
            }

            // Randomly add particles
            if (Math.random() > 0.7 && this.visualization) {
                const types = ['normal', 'fraud', 'warning'];
                const from = ['accounts', 'customers', 'branches'];
                const to = 'transactions';

                this.visualization.addParticle({
                    from: from[Math.floor(Math.random() * from.length)],
                    to: to,
                    type: types[Math.floor(Math.random() * types.length)]
                });
            }
        }, 2000);
    }

    simulateHealth(metrics) {
        let score = 100;

        // Calculate health based on metrics
        if (metrics.transaction_rate > 1200) score -= 20;
        if (metrics.transaction_rate < 100) score -= 10;
        if (metrics.fraud_alerts > 5) score -= 30;
        if (metrics.fraud_alerts > 0) score -= 10;
        if (metrics.failed_transactions > 30) score -= 25;
        if (metrics.failed_transactions > 10) score -= 10;

        // Determine state
        let state = 'healthy';
        let color = '#00ff88';

        if (score < 50) {
            state = 'anomalous';
            color = '#ff4757';
        } else if (score < 80) {
            state = 'stressed';
            color = '#ffd60a';
        }

        return { state, score, color };
    }

    simulateAnomaly(metrics) {
        const anomalyTypes = [
            {
                metric: 'transaction_rate',
                current_value: metrics.transaction_rate,
                expected_value: 750,
                severity: metrics.transaction_rate > 1200 ? 'critical' : 'warning',
                explanation: `Transaction rate is ${((metrics.transaction_rate - 750) / 750 * 100).toFixed(1)}% ${metrics.transaction_rate > 750 ? 'higher' : 'lower'} than normal. Possible causes: ${metrics.transaction_rate > 750 ? 'marketing campaign, system load test, or DDoS attack' : 'system outage or off-peak hours'}.`
            },
            {
                metric: 'fraud_alerts',
                current_value: metrics.fraud_alerts,
                expected_value: 2,
                severity: metrics.fraud_alerts > 5 ? 'critical' : 'warning',
                explanation: `Fraud alerts increased by ${((metrics.fraud_alerts - 2) / 2 * 100).toFixed(1)}%. Possible coordinated attack or compromised accounts detected.`
            }
        ];

        // Pick random anomaly type
        const anomaly = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
        anomaly.deviation = anomaly.current_value - anomaly.expected_value;
        anomaly.z_score = Math.abs(anomaly.deviation / (anomaly.expected_value * 0.3));

        return anomaly;
    }

    async loadGraph() {
        try {
            this.showLoading('Analyzing database schema...');

            const response = await fetch(`${window.API_BASE}/api/graph/${this.connectionId}`);
            const graph = await response.json();

            console.log('Graph loaded:', graph);

            // Initialize visualization
            if (!this.visualization) {
                const { Visualization } = await import('./visualization.js');
                this.visualization = new Visualization('threejs-canvas');
            }

            // Render graph
            this.visualization.renderGraph(graph);

            // Connect visualization clicks to neural panel
            this.visualization.onNodeClick = (nodeData) => this.handleNodeSelect(nodeData);

            this.hideLoading();
        } catch (error) {
            console.error('Graph loading error:', error);
            alert('Failed to load graph: ' + error.message);
            this.hideLoading();
        }
    }

    connectWebSocket() {
        const apiHost = window.API_BASE.replace(/^https?:\/\//, '');
        const protocol = window.API_BASE.startsWith('https') ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${apiHost}/ws/${this.connectionId}`;

        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
            console.log('WebSocket connected');
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleRealtimeUpdate(data);
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.websocket.onclose = () => {
            console.log('WebSocket disconnected');
            setTimeout(() => this.connectWebSocket(), 5000); // Reconnect after 5s
        };
    }

    handleRealtimeUpdate(data) {
        console.log('Realtime update:', data);

        if (data.type === 'metrics_update') {
            this.updateMetrics(data.data);

            // Update graph health if available
            if (data.health) {
                this.updateGraphHealth(data.health);
            }

            // Handle anomalies if detected
            if (data.anomalies && data.anomalies.length > 0) {
                this.handleAnomalies(data.anomalies);
            }
        }

        if (data.particle) {
            // Add particle to visualization
            if (this.visualization) {
                this.visualization.addParticle(data.particle);
            }
        }
    }

    updateGraphHealth(health) {
        const indicator = document.getElementById('connectionStatus');
        if (!indicator) return;

        const statusText = document.getElementById('statusMessage');
        if (statusText) {
            statusText.textContent = `${health.state.charAt(0).toUpperCase() + health.state.slice(1)} (${health.score}/100)`;
        }

        // Update indicator class safely
        indicator.classList.remove('healthy', 'stressed', 'anomalous');
        indicator.classList.add(health.state);
        indicator.style.display = 'block'; // Ensure it's visible
    }

    handleAnomalies(anomalies) {
        anomalies.forEach(anomaly => {
            console.warn('Anomaly detected:', anomaly);

            // Create notification
            const notification = document.createElement('div');
            notification.className = `anomaly-notification ${anomaly.severity}`;
            notification.innerHTML = `
                <span class="icon">${anomaly.severity === 'critical' ? '🚨' : '⚠️'}</span>
                <span class="text">${anomaly.explanation}</span>
            `;

            document.body.appendChild(notification);

            // Position and style
            notification.style.position = 'fixed';
            notification.style.top = '90px';
            notification.style.left = '50%';
            notification.style.transform = 'translateX(-50%)';
            notification.style.zIndex = '1001';

            // Auto-remove after 10 seconds
            setTimeout(() => notification.remove(), 10000);
        });
    }

    updateMetrics(metrics) {
        if (document.getElementById('tps')) document.getElementById('tps').textContent = metrics.transaction_rate || 0;
        if (document.getElementById('totalTransactions')) document.getElementById('totalTransactions').textContent = (metrics.total_transactions || 0).toLocaleString();
        if (document.getElementById('fraudAlerts')) document.getElementById('fraudAlerts').textContent = metrics.fraud_alerts || 0;
        if (document.getElementById('avgAmount')) document.getElementById('avgAmount').textContent = (metrics.average_amount || 0);
        if (document.getElementById('failedTx')) document.getElementById('failedTx').textContent = metrics.failed_transactions || 0;
    }

    handleNodeSelect(nodeData) {
        console.log('Node selected for neural update:', nodeData);
        // Map node types to readable Hub/Entity format
        const typeMap = {
            'core': 'Hub',
            'fact': 'Entity (Fact)',
            'dimension': 'Entity (Dim)',
            'alert': 'Anomaly',
            'database': 'Hub'
        };

        this.updateNeuralUI({
            core_status: {
                type: typeMap[nodeData.type] || 'Entity',
                name: nodeData.name,
                records: nodeData.row_count ? (nodeData.row_count / 1000000).toFixed(2) + 'M' : '0',
                vitality: nodeData.row_count > 1000000 ? 98 : 75, // Simulated
                data_quality: 100,
                last_update: 'Just now'
            }
        });
    }

    updateStatus(connected, text) {
        const indicator = this.statusIndicator;
        const statusText = indicator.querySelector('.status-text');

        if (connected) {
            indicator.classList.add('connected');
        } else {
            indicator.classList.remove('connected');
        }

        statusText.textContent = text;
    }

    showLoading(message) {
        this.loadingOverlay.querySelector('p').textContent = message;
        this.loadingOverlay.classList.remove('hidden');
    }

    hideLoading() {
        this.loadingOverlay.classList.add('hidden');
    }
    // Neural Core Logic
    startNeuralUpdates() {
        if (this.neuralInterval) clearInterval(this.neuralInterval);

        this.neuralInterval = setInterval(async () => {
            if (!this.connectionId) return;
            try {
                // Fetch both status and training stats
                const [statusResponse, trainingResponse] = await Promise.all([
                    fetch(`${window.API_BASE}/api/ai/status/${this.connectionId}`),
                    fetch(`${window.API_BASE}/api/ai/training-stats/${this.connectionId}`)
                ]);

                if (statusResponse.ok && trainingResponse.ok) {
                    const statusData = await statusResponse.json();
                    const trainingData = await trainingResponse.json();

                    console.log('📊 STATUS API Response:', statusData);
                    console.log('📈 TRAINING API Response:', trainingData);
                    console.log('🔍 STATUS ai_status BEFORE merge:', statusData.ai_status);

                    // Merge training stats into ai_status and rl_status
                    if (!statusData.ai_status) statusData.ai_status = {};
                    if (!statusData.rl_status) statusData.rl_status = {};

                    // Add training stats to ai_status
                    statusData.ai_status.training_episodes = trainingData.training_episodes;
                    statusData.ai_status.decisions_made = trainingData.decisions_made;  // Fixed: use decisions_made
                    statusData.ai_status.using_tensorflow = trainingData.using_tensorflow;

                    console.log('✅ AFTER merge - training_episodes:', statusData.ai_status.training_episodes);
                    console.log('✅ AFTER merge - decisions_made:', statusData.ai_status.decisions_made);

                    // Add RL metrics to rl_status
                    statusData.rl_status.exploration_rate = trainingData.exploration_rate;
                    statusData.rl_status.avg_reward = trainingData.avg_reward;
                    statusData.rl_status.avg_loss = trainingData.avg_loss;

                    this.updateNeuralUI(statusData);
                }
            } catch (e) {
                console.error("Neural update failed", e);
            }
        }, 2000); // Update every 2s
    }

    updateNeuralUI(data) {
        console.log('🔍 Neural UI Update - Received data:', JSON.stringify(data, null, 2));

        if (!data) {
            console.warn('⚠️ No data received for Neural UI update');
            return;
        }

        // Update DOM elements
        if (data.core_status) {
            // Vitality - handle both string "50%" and number formats
            const vitalityStr = data.core_status.vitality;
            const vitality = typeof vitalityStr === 'string' ? parseInt(vitalityStr) : vitalityStr;
            const vEl = document.getElementById('neural-vitality');
            if (vEl) {
                vEl.textContent = typeof vitalityStr === 'string' ? vitalityStr : vitality + '%';
                vEl.className = 'stat-val ' + (vitality > 80 ? 'good' : (vitality > 50 ? 'warn' : 'crit'));
            }

            // Data Quality - handle both string "100%" and number formats
            const qualityStr = data.core_status.data_quality;
            const quality = typeof qualityStr === 'string' ? parseInt(qualityStr) : qualityStr;
            const qEl = document.getElementById('neural-quality');
            if (qEl) {
                qEl.textContent = typeof qualityStr === 'string' ? qualityStr : quality + '%';
                qEl.className = 'stat-val ' + (quality > 90 ? 'good' : 'warn');
            }

            // Records
            if (data.core_status.records) {
                const rEl = document.getElementById('neural-records');
                if (rEl) rEl.textContent = data.core_status.records;
            }

            // Target Type and Name
            const typeEl = document.getElementById('neural-type');
            if (typeEl && data.core_status.type) {
                typeEl.textContent = data.core_status.type;
            }

            const nameEl = document.getElementById('neural-target-name');
            if (nameEl && data.core_status.name) {
                nameEl.textContent = data.core_status.name;
            }

            // Last Update
            if (data.core_status.last_update) {
                const lEl = document.getElementById('neural-last-update');
                if (lEl) lEl.textContent = data.core_status.last_update;
            }
        }

        // AI Insights
        if (data.ai_insights) {
            const anomalyEl = document.getElementById('neural-anomaly');
            if (anomalyEl) {
                const anomalyStr = data.ai_insights.anomaly_score;
                anomalyEl.textContent = typeof anomalyStr === 'string' ? anomalyStr : anomalyStr + '%';
            }

            const gravityEl = document.getElementById('neural-gravity');
            if (gravityEl) {
                gravityEl.textContent = data.ai_insights.gravity_pull;
                gravityEl.className = 'insight-value ' + data.ai_insights.gravity_pull.toLowerCase();
            }

            const optEl = document.getElementById('neural-opt');
            if (optEl) {
                optEl.textContent = data.ai_insights.optimization;
                optEl.className = 'insight-value ' + (data.ai_insights.optimization === 'Active' ? 'active' : 'idle');
            }
        }

        // === NEW: AI STATUS DISPLAY ===
        if (data.ai_status) {
            // AI Mode
            const modeEl = document.getElementById('neural-ai-mode');
            if (modeEl) {
                modeEl.textContent = data.ai_status.mode || 'Monitoring';
            }

            // AI Confidence
            const confEl = document.getElementById('neural-ai-confidence');
            if (confEl) {
                confEl.textContent = data.ai_status.confidence || '85%';
            }

            // TensorFlow Status
            const tfEl = document.getElementById('neural-tensorflow-status');
            if (tfEl) {
                const usingTF = data.ai_status.using_tensorflow;
                tfEl.textContent = usingTF ? '🤖 TensorFlow Active' : '⚡ Q-Learning';
                tfEl.className = 'stat-val ' + (usingTF ? 'good' : 'warn');
            }

            // Training Episodes
            const episodesEl = document.getElementById('neural-training-episodes');
            if (episodesEl) {
                const value = data.ai_status.training_episodes || 0;
                console.log('🎯 Setting training_episodes to:', value, 'Element:', episodesEl);
                episodesEl.textContent = value;
            } else {
                console.error('❌ Element #neural-training-episodes NOT FOUND!');
            }

            // Decisions Made
            const decisionsEl = document.getElementById('neural-decisions');
            if (decisionsEl) {
                const value = data.ai_status.decisions_made || 0;
                console.log('🎯 Setting decisions_made to:', value, 'Element:', decisionsEl);
                decisionsEl.textContent = value;
            } else {
                console.error('❌ Element #neural-decisions NOT FOUND!');
            }
        }

        // === NEW: RL STATUS DISPLAY ===
        if (data.rl_status) {
            // Exploration Rate
            const exploreEl = document.getElementById('neural-exploration');
            if (exploreEl) {
                exploreEl.textContent = data.rl_status.exploration_rate || '20%';
            }

            // Average Reward
            const rewardEl = document.getElementById('neural-avg-reward');
            if (rewardEl) {
                const reward = parseFloat(data.rl_status.avg_reward || 0);
                rewardEl.textContent = reward.toFixed(2);
                rewardEl.className = 'stat-val ' + (reward > 0.5 ? 'good' : reward > 0.2 ? 'warn' : 'crit');
            }

            // Average Loss (TensorFlow only)
            if (data.rl_status.avg_loss && data.rl_status.avg_loss !== 'N/A') {
                const lossEl = document.getElementById('neural-avg-loss');
                if (lossEl) {
                    const loss = parseFloat(data.rl_status.avg_loss);
                    lossEl.textContent = loss.toFixed(4);
                    lossEl.className = 'stat-val ' + (loss < 0.1 ? 'good' : loss < 0.5 ? 'warn' : 'crit');
                }
            }
        }

        // Relational Flows - AI-calculated strengths
        const flowContainer = document.getElementById('relational-flows-container');
        if (flowContainer && data.relational_flows) {
            if (data.relational_flows.length > 0) {
                flowContainer.innerHTML = data.relational_flows.map(flow => `
                    <div class="neural-stat-row">
                        <span class="stat-name">∿ ${flow.source}</span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="stat-val ${flow.status === 'Active' ? 'good' : ''}">${flow.strength}</span>
                            <span class="neural-badge tiny">${flow.status}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                flowContainer.innerHTML = '<div class="section-label">NO ACTIVE FLOWS</div>';
            }
        }

        // Clusters
        const clusterContainer = document.getElementById('clusters-container');
        if (clusterContainer && data.clusters) {
            clusterContainer.innerHTML = data.clusters.map(cluster => `
                <div class="neural-stat-row">
                    <span class="stat-name">${cluster.name}</span>
                    <span class="stat-val ${cluster.status === 'Warning' ? 'warn' : 'good'}">${cluster.count}</span>
                </div>
            `).join('');
        }

        // Recommendations
        const recContainer = document.getElementById('recommendations-container');
        if (recContainer && data.recommendations) {
            recContainer.innerHTML = data.recommendations.map(rec => `
                <div class="recommendation-item">
                    <span class="rec-bullet">•</span>
                    <span class="rec-text">${rec}</span>
                </div>
            `).join('');
        }

        // === NEW: OPTIMIZED PARAMETERS DISPLAY ===
        if (data.optimized_params) {
            const paramsEl = document.getElementById('neural-optimized-params');
            if (paramsEl) {
                const params = data.optimized_params;
                paramsEl.innerHTML = `
                    <div class="neural-stat-row">
                        <span class="stat-name">Optimization Aggression</span>
                        <span class="stat-val good">${(params.optimization_aggression * 100).toFixed(0)}%</span>
                    </div>
                    <div class="neural-stat-row">
                        <span class="stat-name">Anomaly Sensitivity</span>
                        <span class="stat-val">${(params.anomaly_sensitivity * 100).toFixed(0)}%</span>
                    </div>
                    <div class="neural-stat-row">
                        <span class="stat-name">Refresh Rate</span>
                        <span class="stat-val">${params.refresh_rate}s</span>
                    </div>
                `;
            }
        }

        console.log('Neural UI updated successfully');
    }
}

// Global functions for buttons
let appInstance = null;

window.toggleRL = async () => {
    if (!appInstance || !appInstance.connectionId) return;
    const btn = document.getElementById('btn-rl');
    const isEnabled = !btn.classList.contains('disabled'); // Simplified state tracking

    // In a real app we'd fetch current state first, here we toggle visually
    try {
        await fetch(`${window.API_BASE}/api/ai/toggle-rl/${appInstance.connectionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: !isEnabled })
        });

        if (isEnabled) {
            btn.classList.add('disabled');
            btn.innerHTML = '<span class="icon">⚪</span> Enable RL';
            btn.style.opacity = '0.7';
        } else {
            btn.classList.remove('disabled');
            btn.innerHTML = '<span class="icon">⚡</span> Disable RL';
            btn.style.opacity = '1';
        }
    } catch (e) { console.error(e); }
};

window.recalcGravity = async () => {
    if (!appInstance || !appInstance.connectionId) return;
    const btn = event.currentTarget; // Get button element
    const originalText = btn.innerHTML;

    btn.innerHTML = '<span class="icon">⚙️</span> Calculating...';

    try {
        await fetch(`${window.API_BASE}/api/ai/recalculate-gravity/${appInstance.connectionId}`, { method: 'POST' });
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    } catch (e) { console.error(e); }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { appInstance = new App(); });
} else {
    appInstance = new App();
}
