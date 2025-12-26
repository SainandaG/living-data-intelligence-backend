// Drill-Down Panel for exploring table records
export class DrillDownPanel {
    constructor(connectionId) {
        this.connectionId = connectionId;
        this.currentTable = null;
        this.panel = null;

        this.createPanel();
    }

    createPanel() {
        // Create drill-down panel element
        this.panel = document.createElement('div');
        this.panel.className = 'drill-down-panel hidden';
        this.panel.innerHTML = `
            <div class="drill-down-header">
                <h3 id="drillDownTitle">Table Explorer</h3>
                <button class="hierarchy-view-btn" id="viewFlowBtn">📊 View Flow</button>
                <button class="close-drill-down">×</button>
            </div>
            <div class="drill-down-body">
                <div class="drill-down-controls">
                    <input type="text" id="searchInput" placeholder="Search..." />
                    <select id="searchColumn">
                        <option value="">Select column...</option>
                    </select>
                    <button id="searchBtn" class="btn-primary">Search</button>
                </div>
                <div id="drillDownContent" class="drill-down-content">
                    <p class="placeholder">Click on a node to explore its data</p>
                </div>
            </div>
        `;

        document.body.appendChild(this.panel);

        // Event listeners
        this.panel.querySelector('.close-drill-down').addEventListener('click', () => this.hide());
        this.panel.querySelector('#searchBtn').addEventListener('click', () => this.handleSearch());
    }

    async show(nodeData) {
        this.currentTable = nodeData.name;
        this.panel.classList.remove('hidden');

        // Update title
        document.getElementById('drillDownTitle').textContent = `${nodeData.name} (${nodeData.type})`;

        // Load table data
        await this.loadTableData(nodeData.name);

        // Populate column dropdown
        this.populateColumns(nodeData.columns || []);
    }

    hide() {
        this.panel.classList.add('hidden');
    }

    async loadTableData(tableName) {
        try {
            const response = await fetch(`/api/drilldown/${this.connectionId}/table/${tableName}?limit=50`);
            const data = await response.json();

            this.displayRecords(data.records);
        } catch (error) {
            console.error('Error loading table data:', error);
            document.getElementById('drillDownContent').innerHTML = `
                <p class="error">Failed to load data: ${error.message}</p>
            `;
        }
    }

    displayRecords(records) {
        const content = document.getElementById('drillDownContent');

        if (!records || records.length === 0) {
            content.innerHTML = '<p class="placeholder">No records found</p>';
            return;
        }

        // Create table
        const columns = Object.keys(records[0]);

        let html = `
            <div class="records-table-container">
                <table class="records-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `<th>${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;

        records.forEach(record => {
            html += '<tr>';
            columns.forEach(col => {
                const value = record[col];
                const displayValue = value !== null && value !== undefined ? String(value) : '';
                html += `<td title="${displayValue}">${displayValue.substring(0, 50)}</td>`;
            });
            html += '</tr>';
        });

        html += `
                    </tbody>
                </table>
            </div>
            <p class="record-count">Showing ${records.length} records</p>
        `;

        content.innerHTML = html;
    }

    populateColumns(columns) {
        const select = document.getElementById('searchColumn');
        select.innerHTML = '<option value="">Select column...</option>';

        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col.name || col;
            option.textContent = col.name || col;
            select.appendChild(option);
        });
    }

    async handleSearch() {
        const searchValue = document.getElementById('searchInput').value;
        const searchColumn = document.getElementById('searchColumn').value;

        if (!searchValue || !searchColumn) {
            alert('Please enter search value and select a column');
            return;
        }

        try {
            const response = await fetch(
                `/api/drilldown/${this.connectionId}/table/${this.currentTable}/search?column=${searchColumn}&value=${searchValue}`
            );
            const data = await response.json();

            this.displayRecords(data.records);
        } catch (error) {
            console.error('Error searching:', error);
        }
    }
}
