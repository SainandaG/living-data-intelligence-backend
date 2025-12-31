// Circle Packing Visualization using D3.js
export class CirclePacking {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.svg = null;
        this.data = null;
        this.onCircleClick = null;

        // Entity color mapping
        this.entityColors = {
            'transaction': '#fbbf24',
            'account': '#22d3ee',
            'customer': '#f87171',
            'fraud': '#ef4444',
            'branch': '#34d399',
            'loan': '#8b5cf6',
            'card': '#f472b6',
            'payment': '#10b981',
            'product': '#6366f1',
            'employee': '#ec4899',
            'audit': '#94a3b8',
            'report': '#38bdf8',
            'other': '#64748b'
        };

        this.typeColors = {
            'pk': '#fbbf24',
            'fk': '#22d3ee',
            'column': '#667eea',
            'group': 'rgba(255,255,255,0.05)'
        };

        this.init();
    }

    init() {
        // Create SVG
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('background', 'transparent');

        // Add resize listener
        window.addEventListener('resize', () => this.resize());
    }

    render(graphData) {
        try {
            console.log('Circle packing render called with:', graphData);

            if (!graphData || !graphData.nodes) {
                console.error('Invalid graph data:', graphData);
                return;
            }

            // Convert graph data to hierarchical structure
            const hierarchyData = this.convertToHierarchy(graphData);
            console.log('Hierarchy data:', hierarchyData);

            if (!hierarchyData || !hierarchyData.children || hierarchyData.children.length === 0) {
                console.warn('No data to visualize');
                // Show message
                this.svg.selectAll('*').remove();
                this.svg.append('text')
                    .attr('x', this.width / 2)
                    .attr('y', this.height / 2)
                    .attr('text-anchor', 'middle')
                    .style('fill', '#718096')
                    .style('font-size', '16px')
                    .text('No tables to visualize');
                return;
            }

            // Create pack layout
            const pack = d3.pack()
                .size([this.width, this.height])
                .padding(3);

            // Create hierarchy
            const root = d3.hierarchy(hierarchyData)
                .sum(d => d.value)
                .sort((a, b) => b.value - a.value);

            // Apply pack layout
            pack(root);

            // Clear existing
            this.svg.selectAll('*').remove();

            // Create groups for each circle
            const node = this.svg.selectAll('g')
                .data(root.descendants())
                .join('g')
                .attr('transform', d => `translate(${d.x},${d.y})`)
                .style('cursor', d => d.depth > 0 ? 'pointer' : 'default');

            // Add circles
            node.append('circle')
                .attr('r', d => d.r)
                .attr('fill', d => {
                    if (d.depth === 0) return 'transparent';
                    if (d.depth === 1) return this.getGroupColor(d.data.name);
                    return this.entityColors[d.data.entity] || this.entityColors['other'];
                })
                .attr('stroke', d => {
                    if (d.depth === 0) return 'none';
                    return 'rgba(255, 255, 255, 0.3)';
                })
                .attr('stroke-width', d => d.depth === 1 ? 2 : 1)
                .attr('opacity', d => d.depth === 1 ? 0.3 : 0.8)
                .on('mouseover', function (event, d) {
                    if (d.depth > 0) {
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .attr('opacity', 1)
                            .attr('stroke-width', 3);
                    }
                })
                .on('mouseout', function (event, d) {
                    if (d.depth > 0) {
                        d3.select(this)
                            .transition()
                            .duration(200)
                            .attr('opacity', d.depth === 1 ? 0.3 : 0.8)
                            .attr('stroke-width', d.depth === 1 ? 2 : 1);
                    }
                })
                .on('click', (event, d) => {
                    event.stopPropagation();
                    console.log('Circle clicked:', d.data.name, 'Depth:', d.depth);

                    if (d.depth === 2 && this.onCircleClick) {
                        // Clicked on a specific table - Drill down directly
                        this.onCircleClick(d.data);
                    } else if (d.depth === 1) {
                        // Clicked on a group - Zoom in using D3 transition
                        if (this.focus !== d) {
                            this.zoom(event, d);
                        } else {
                            // If already focused, drilling down to the first child or showing group view
                            // For now, let's just zoom out if clicked again or stay zoomed
                            this.zoom(event, root); // Zoom back out
                        }
                    }
                });

            // Add global click to zoom out
            this.svg.on('click', (event) => {
                this.zoom(event, root);
            });

            // Add tooltips
            node.append('title')
                .text(d => {
                    if (d.depth === 0) return '';
                    if (d.depth === 1) return `${d.data.name} Group`;
                    return `${d.data.name}\nType: ${d.data.type}\nRows: ${d.data.row_count?.toLocaleString() || 0}`;
                });

            // Add Labels
            node.filter(d => d.depth > 0)
                .append('text')
                .attr('dy', '0.35em')
                .attr('text-anchor', 'middle')
                .style('font-size', d => d.depth === 1 ? '14px' : '10px')
                .style('fill', d => d.depth === 1 ? '#64748b' : '#1e293b')
                .style('opacity', d => d.r > 20 ? 1 : 0)
                .text(d => d.data.name);
        } catch (error) {
            console.error('Error rendering circle packing:', error);
            this.svg.selectAll('*').remove();
            this.svg.append('text')
                .attr('x', this.width / 2)
                .attr('y', this.height / 2)
                .attr('text-anchor', 'middle')
                .style('fill', '#ff4757')
                .style('font-size', '16px')
                .text('Error rendering visualization');
        }
    }

    convertToHierarchy(graphData) {
        // Group tables by entity type
        const groups = {};

        graphData.nodes.forEach(node => {
            if (node.is_hub) return; // Skip hub

            const entity = node.entity || 'other';
            if (!groups[entity]) {
                groups[entity] = {
                    name: entity,
                    children: []
                };
            }

            groups[entity].children.push({
                name: node.name,
                value: Math.max(node.row_count || 100, 100),
                type: node.type,
                entity: node.entity,
                row_count: node.row_count,
                ...node
            });
        });

        // Convert to hierarchy format
        return {
            name: 'root',
            children: Object.values(groups)
        };
    }

    zoom(event, d) {
        this.focus = d;

        const k = this.width / d.r / 2;
        const x = d.x;
        const y = d.y;

        console.log('Zooming to:', d.data.name);

        this.svg.transition()
            .duration(750)
            .tween('zoom', () => {
                // Determine current transform
                const i = d3.interpolateZoom(this.view || [this.width / 2, this.height / 2, this.width], [x, y, d.r * 2 + 50]);
                return t => {
                    const [nx, ny, nr] = i(t);
                    this.view = [nx, ny, nr];
                    const k = this.width / nr;
                    this.svg.selectAll('g')
                        .attr('transform', d => `translate(${(d.x - nx) * k + this.width / 2},${(d.y - ny) * k + this.height / 2})`);

                    // Scale circles
                    this.svg.selectAll('circle')
                        .attr('r', d => d.r * k);

                    // Scale text
                    this.svg.selectAll('text')
                        .style('font-size', d => `${Math.min(d.r * k / 3, 16)}px`)
                        .style('opacity', d => {
                            // Hide labels if too small or if zooming into a different group
                            if (d.parent === this.focus || d === this.focus) return 1;
                            return d.r * k > 20 ? 1 : 0;
                        });
                };
            });
    }

    // Helper to get color
    getGroupColor(groupName) {
        // Semi-transparent version of entity color
        const color = this.entityColors[groupName] || this.entityColors['other'];
        return color + '40'; // Add alpha
    }

    renderHierarchy(rootData) {
        console.log('Rendering Detail Hierarchy', rootData);
        this.svg.selectAll('*').remove();

        const pack = d3.pack()
            .size([this.width, this.height])
            .padding(10);

        const root = d3.hierarchy(rootData)
            .sum(d => d.size || 100)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        pack(root);

        const node = this.svg.selectAll('g')
            .data(root.descendants())
            .join('g')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        node.append('circle')
            .attr('r', d => d.r)
            .attr('fill', d => {
                if (d.depth === 0) return 'rgba(255,255,255,0.02)';
                if (d.depth === 1) return this.typeColors.group;
                return this.typeColors[d.data.type] || this.typeColors.column;
            })
            .attr('stroke', 'rgba(255,255,255,0.1)')
            .attr('stroke-width', 1)
            .style('filter', d => d.depth > 1 ? `drop-shadow(0 0 8px ${this.typeColors[d.data.type] || '#667eea'}60)` : 'none');

        node.filter(d => d.r > 20)
            .append('text')
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .style('fill', '#fff')
            .style('font-weight', '700')
            .style('font-size', d => d.depth === 1 ? '16px' : '10px')
            .style('pointer-events', 'none')
            .text(d => d.data.name);
    }

    resize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        if (this.svg) {
            this.svg
                .attr('width', this.width)
                .attr('height', this.height);
        }

        // Re-render if data exists
        if (this.data) {
            this.render(this.data);
        }
    }

    clear() {
        if (this.svg) {
            this.svg.selectAll('*').remove();
        }
    }
}
