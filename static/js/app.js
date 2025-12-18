// Main Application Controller
class App {
    constructor() {
        this.connectionId = null;
        this.websocket = null;
        this.visualization = null;

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

        // Event listeners
        this.connectBtn.addEventListener('click', () => this.showModal());
        this.demoBtn.addEventListener('click', () => this.loadDemoMode());
        this.connectionForm.addEventListener('submit', (e) => this.handleConnect(e));

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
            const response = await fetch('/api/connect', {
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
        try {
            this.showLoading('Loading demo banking system...');
            this.updateStatus(true, 'Demo Mode');

            // Load demo graph
            const response = await fetch('/api/demo/graph');
            const graph = await response.json();

            console.log('Demo graph loaded:', graph);

            // Initialize visualization
            if (!this.visualization) {
                const { Visualization } = await import('./visualization.js');
                this.visualization = new Visualization('threejs-canvas');
            }

            // Render graph
            this.visualization.renderGraph(graph);

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

            const response = await fetch(`/api/graph/${this.connectionId}`);
            const graph = await response.json();

            console.log('Graph loaded:', graph);

            // Initialize visualization
            if (!this.visualization) {
                const { Visualization } = await import('./visualization.js');
                this.visualization = new Visualization('threejs-canvas');
            }

            // Render graph
            this.visualization.renderGraph(graph);

            this.hideLoading();
        } catch (error) {
            console.error('Graph loading error:', error);
            alert('Failed to load graph: ' + error.message);
            this.hideLoading();
        }
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${this.connectionId}`;

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
        const indicator = this.statusIndicator;
        const statusText = indicator.querySelector('.status-text');

        // Update status text with health score
        statusText.textContent = `${health.state.charAt(0).toUpperCase() + health.state.slice(1)} (${health.score}/100)`;

        // Update indicator class
        indicator.classList.remove('healthy', 'stressed', 'anomalous');
        indicator.classList.add(health.state);
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
        document.getElementById('transactionRate').textContent = metrics.transaction_rate || 0;
        document.getElementById('totalTransactions').textContent = (metrics.total_transactions || 0).toLocaleString();
        document.getElementById('fraudAlerts').textContent = metrics.fraud_alerts || 0;
        document.getElementById('averageAmount').textContent = '$' + (metrics.average_amount || 0).toFixed(2);
        document.getElementById('failedTransactions').textContent = metrics.failed_transactions || 0;
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
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
} else {
    new App();
}
