// Main Application Controller
export class App {
    constructor() {
        this.connectionId = null;
        this.websocket = null;
        this.visualization = null;
        this.drillDownPanel = null;
        this.circlePacking = null;
        this.graphData = null;

        // Ensure DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('App initialization started');

        // Event listeners
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            console.log('Attaching connect button listener');
            connectBtn.addEventListener('click', () => this.showConnectionModal());
        } else {
            console.error('CRITICAL: Connect button not found in DOM');
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideConnectionModal());
        }

        const connectionForm = document.getElementById('connectionForm');
        if (connectionForm) {
            connectionForm.addEventListener('submit', (e) => this.handleConnect(e));
        }

        // Update port based on database type
        const dbTypeSelect = document.getElementById('dbType');
        if (dbTypeSelect) {
            dbTypeSelect.addEventListener('change', (e) => {
                const portInput = document.getElementById('port');
                if (portInput) {
                    if (e.target.value === 'mysql') portInput.value = '3306';
                    else if (e.target.value === 'postgresql') portInput.value = '5432';
                    else if (e.target.value === 'mongodb') portInput.value = '27017';
                }
            });
        }

        // Back button
        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.showCirclePackingView());
        }

        // AI Analyst Input
        const aiInput = document.getElementById('aiInput');
        if (aiInput) {
            aiInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleAIChat();
            });
            const chatBtn = aiInput.nextElementSibling;
            if (chatBtn) chatBtn.onclick = () => this.handleAIChat();
        }
    }

    async handleAIChat() {
        const input = document.getElementById('aiInput');
        const query = input.value.trim();
        if (!query || !this.connectionId) return;

        // 1. Add user message
        this.addChatMessage('user', query);
        input.value = '';

        // 2. Fetch AI response
        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, connection_id: this.connectionId })
            });

            const data = await response.json();
            if (response.ok) {
                this.addChatMessage('ai', data.response);
            } else {
                this.addChatMessage('ai', "I apologize, but I encountered an error analyzing that request.");
            }
        } catch (error) {
            this.addChatMessage('ai', "The analysis neural link was interrupted.");
        }
    }

    addChatMessage(sender, text) {
        const history = document.getElementById('aiChatHistory');
        if (!history) return;

        const msg = document.createElement('div');
        msg.className = `msg ${sender}`;
        msg.textContent = text;
        history.appendChild(msg);
        history.scrollTop = history.scrollHeight;
    }

    showConnectionModal() {
        const modal = document.getElementById('connectionModal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    hideConnectionModal() {
        const modal = document.getElementById('connectionModal');
        if (modal) {
            modal.classList.add('hidden');
        }
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
            const response = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (response.ok) {
                this.connectionId = data.connection_id;
                this.hideConnectionModal();
                await this.loadGraph();
                this.connectWebSocket();
            } else {
                alert(`Connection failed: ${data.detail}`);
            }
        } catch (error) {
            console.error('Connection error:', error);
            alert(`Connection failed: ${error.message}`);
        }
    }

    async loadGraph() {
        try {
            console.log('Loading graph for connection:', this.connectionId);

            const response = await fetch(`/api/graph/${this.connectionId}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const graph = await response.json();
            console.log('Graph loaded:', graph);

            if (!graph || !graph.nodes) {
                throw new Error('Invalid graph data received');
            }

            // Initialize circle packing visualization
            if (!this.circlePacking) {
                console.log('Initializing circle packing...');
                const { CirclePacking } = await import('./circle-packing.js');
                this.circlePacking = new CirclePacking('circlePacking');

                // Set up click handler to drill down to 3D graph
                this.circlePacking.onCircleClick = (tableData) => {
                    console.log('Table clicked:', tableData);
                    this.showTableGraph(tableData);
                };
            }

            // Show circle packing view
            this.showCirclePackingView();

            // Render circle packing
            console.log('Rendering circle packing...');
            this.circlePacking.render(graph);
            this.circlePacking.data = graph;

            // Populate Legend
            this.updateLegend(this.circlePacking.entityColors);

            // Initialize 3D visualization (but don't show yet)
            if (!this.visualization) {
                console.log('Initializing 3D visualization...');
                const { Visualization } = await import('./visualization.js');
                this.visualization = new Visualization('threejs-canvas');

                // Set up node click handler for 3D view
                this.visualization.onNodeClick = (nodeData) => {
                    this.handleNodeSelection(nodeData);
                };

                // Set up drilldown button
                const drillBtn = document.getElementById('drilldownBtn');
                if (drillBtn) {
                    drillBtn.onclick = () => this.showInvestigation(this.selectedNode);
                }

                // Set up overlay close
                const closeBtn = document.getElementById('closeDrilldown');
                if (closeBtn) {
                    closeBtn.onclick = () => this.hideInvestigation();
                }
            }

            // Pre-render 3D graph (hidden)
            console.log('Pre-rendering 3D graph...');
            this.visualization.renderGraph(graph);
            this.graphData = graph;

            console.log('Graph loading complete!');

        } catch (error) {
            console.error('Error loading graph:', error);
            console.error('Error stack:', error.stack);
            alert(`Failed to load graph: ${error.message}`);
        }
    }

    showCirclePackingView() {
        console.log('App: Transitioning to Overview');
        if (window.ui) window.ui.switchView('dashboard');

        // Update breadcrumb
        this.updateBreadcrumb('Overview');
    }

    handleNodeSelection(nodeData) {
        if (nodeData.is_hub) return;
        this.selectedNode = nodeData;

        const panel = document.getElementById('selectedNodeInfo');
        if (!panel) return;

        panel.style.display = 'block';

        // Populate fields
        document.getElementById('nodeTitleDisplay').textContent = nodeData.name;
        document.getElementById('nodeEntityType').textContent = nodeData.entity || 'unknown';
        document.getElementById('nodeRecordCount').textContent = (nodeData.row_count || 0).toLocaleString();

        // Populate Tags (Columns)
        const tagsContainer = document.getElementById('nodeTagsDisplay');
        if (tagsContainer) {
            tagsContainer.innerHTML = (nodeData.columns || [])
                .slice(0, 10) // Show first 10
                .map(col => `<div class="tag">${col.name}</div>`)
                .join('');
            if (nodeData.columns && nodeData.columns.length > 10) {
                tagsContainer.innerHTML += `<div class="tag">+${nodeData.columns.length - 10} more</div>`;
            }
        }
    }

    async showInvestigation(nodeData) {
        if (!nodeData) return;

        const overlay = document.getElementById('circle-pack-overlay');
        overlay.classList.add('visible');

        // Set header info
        document.getElementById('drilldownTitle').textContent = nodeData.name;
        document.getElementById('drilldownColCount').textContent = nodeData.columns ? nodeData.columns.length : 0;
        document.getElementById('drilldownPKCount').textContent = nodeData.columns ? nodeData.columns.filter(c => c.is_pk).length : 0;

        // Render Internal Circle Pack
        if (!this.detailCirclePack) {
            const { CirclePacking } = await import('./circle-packing.js');
            this.detailCirclePack = new CirclePacking('drilldownContainer');
        }

        // Transform table data to hierarchical form for D3
        const hierarchy = {
            name: nodeData.name,
            children: [
                {
                    name: 'Primary Keys',
                    children: (nodeData.columns || []).filter(c => c.is_pk).map(c => ({ name: c.name, size: 200, type: 'pk' }))
                },
                {
                    name: 'Foreign Keys',
                    children: (nodeData.columns || []).filter(c => c.is_fk).map(c => ({ name: c.name, size: 150, type: 'fk' }))
                },
                {
                    name: 'Data Columns',
                    children: (nodeData.columns || []).filter(c => !c.is_pk && !c.is_fk).map(c => ({ name: c.name, size: 100, type: 'column' }))
                }
            ]
        };

        this.detailCirclePack.renderHierarchy(hierarchy);
    }

    hideInvestigation() {
        const overlay = document.getElementById('circle-pack-overlay');
        overlay.classList.remove('visible');
    }

    showTableGraph(tableData) {
        console.log('App: Drilling down into:', tableData.name);
        if (window.ui) window.ui.switchView('graph');

        // Update breadcrumb
        this.updateBreadcrumb('Overview', tableData.name);

        // Filter graph to show only related nodes
        if (this.graphData) {
            const focusedGraph = this.filterGraphForTable(tableData.name);
            if (this.visualization) {
                this.visualization.renderGraph(focusedGraph);
                // Also trigger selection for the main table automatically
                const tableNode = focusedGraph.nodes.find(n => n.id === tableData.name);
                if (tableNode) this.handleNodeSelection(tableNode);
            }
        }
    }

    filterGraphForTable(tableName) {
        // Create a focused view showing the selected table and its connections
        const relatedNodes = new Set([tableName]);
        const relatedEdges = [];

        // Find all directly connected nodes
        this.graphData.edges.forEach(edge => {
            if (edge.source === tableName) {
                relatedNodes.add(edge.target);
                relatedEdges.push(edge);
            } else if (edge.target === tableName) {
                relatedNodes.add(edge.source);
                relatedEdges.push(edge);
            }
        });

        // Filter nodes
        const filteredNodes = this.graphData.nodes.filter(node =>
            relatedNodes.has(node.id) || node.is_hub
        );

        return {
            nodes: filteredNodes,
            edges: relatedEdges
        };
    }

    updateBreadcrumb(...items) {
        const breadcrumb = document.getElementById('breadcrumb');
        if (!breadcrumb) return;

        breadcrumb.innerHTML = items.map((item, index) => {
            const isLast = index === items.length - 1;
            return `<span class="breadcrumb-item ${isLast ? 'active' : ''}">${item}</span>`;
        }).join('<span class="breadcrumb-separator">›</span>');
    }

    updateLegend(colors) {
        const legendItems = document.getElementById('legendItems');
        if (!legendItems) return;

        legendItems.innerHTML = Object.entries(colors)
            .map(([entity, color]) => `
                <div class="legend-item">
                    <div class="legend-dot" style="background: ${color}"></div>
                    <span>${entity.charAt(0).toUpperCase() + entity.slice(1)}</span>
                </div>
            `).join('');
    }

    connectWebSocket() {
        const wsUrl = `ws://${window.location.host}/ws/${this.connectionId}`;
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
        };
    }

    handleRealtimeUpdate(data) {
        // console.log('Realtime update:', data);

        // Update Stats Dashboard
        if (data.metrics) {
            const elements = {
                tps: data.metrics.tps || Math.floor(Math.random() * 50) + 300,
                fraudAlerts: data.metrics.fraud_alerts || 0,
                avgAmount: (data.metrics.avg_amount || 0).toFixed(1) + 'K',
                failedTx: data.metrics.failed_transactions || 0,
                totalRows: (data.metrics.total_rows / 1000000).toFixed(1) + 'M',
                activeNodes: data.metrics.active_nodes || this.graphData?.nodes?.length || 0
            };

            for (const [id, value] of Object.entries(elements)) {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            }
        }

        // Update anomaly indicator (Safely)
        if (data.health) {
            const anomalyIndicator = document.getElementById('anomalyIndicator');
            if (anomalyIndicator) {
                const healthText = data.health.state === 'healthy' ? 'Healthy' :
                    data.health.state === 'stressed' ? 'Stressed' : 'Anomalous';
                const score = data.health.score || 0;

                // Update text
                const textEl = anomalyIndicator.querySelector('span:last-child') || anomalyIndicator;
                textEl.textContent = `${healthText} (${score}/100)`;

                // Update color
                if (data.health.state === 'healthy') {
                    anomalyIndicator.style.borderColor = '#00ff88';
                    anomalyIndicator.style.background = 'rgba(0, 255, 136, 0.1)';
                    if (textEl !== anomalyIndicator) textEl.style.color = '#00ff88';
                } else if (data.health.state === 'stressed') {
                    anomalyIndicator.style.borderColor = '#ffd60a';
                    anomalyIndicator.style.background = 'rgba(255, 214, 10, 0.1)';
                    if (textEl !== anomalyIndicator) textEl.style.color = '#ffd60a';
                } else {
                    anomalyIndicator.style.borderColor = '#ff4757';
                    anomalyIndicator.style.background = 'rgba(255, 71, 87, 0.1)';
                    if (textEl !== anomalyIndicator) textEl.style.color = '#ff4757';
                }
            }
        }

        // Handle anomalies
        if (data.anomalies && data.anomalies.length > 0) {
            data.anomalies.forEach(anomaly => {
                this.showAnomalyNotification(anomaly);
            });
        }

        // Add particles if available
        if (data.particles && this.visualization) {
            data.particles.forEach(particle => {
                this.visualization.addParticle(particle);
            });
        }
    }

    showAnomalyNotification(anomaly) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `anomaly-notification ${anomaly.severity}`;
        notification.innerHTML = `
            <strong>${anomaly.severity.toUpperCase()}</strong>
            <p>${anomaly.explanation}</p>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 15px 20px;
            background: ${anomaly.severity === 'critical' ? 'rgba(255, 71, 87, 0.9)' : 'rgba(255, 214, 10, 0.9)'};
            border-radius: 8px;
            color: #fff;
            font-size: 13px;
            max-width: 300px;
            z-index: 1100;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
}

// Initialize app when DOM is ready
// Exported class is instantiated in index.html
// if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', () => new App());
// } else {
//     new App();
// }
