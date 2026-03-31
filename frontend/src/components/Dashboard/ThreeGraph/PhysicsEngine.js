/**
 * PhysicsEngine.js
 * Responsibility: D3 force simulation configuration and galaxy/latent layout helpers.
 * Extracted from ThreeGraph.jsx.
 *
 * Note: The main simulation (simulationRef) lives inside ThreeGraph component because
 * it requires access to node mesh refs for position updates on each tick.
 * This module provides the pure configuration helpers.
 *
 * Exports:
 *   createForceSimulation(nodes, edges, options)  — configures d3-force-3d simulation
 *   applyGalaxyLayout(nodes, radius)              — re-exported from NodeRenderer for convenience
 */
import { forceSimulation, forceManyBody, forceLink, forceX, forceY, forceZ } from 'd3-force-3d';
import { logger } from '../../../utils/logger';
export { applyGalaxyLayout } from './NodeRenderer.js';

/**
 * Create and configure a 3D D3 force simulation.
 * @param {Array} nodes - graph nodes with id field
 * @param {Array} edges - graph edges with source/target
 * @param {Object} options - { onTick, onEnd, alphaDecay, velocityDecay }
 * @returns {Object} d3 simulation instance
 */
export function createForceSimulation(nodes, edges, options = {}) {
    const {
        onTick = () => {},
        onEnd = () => {},
        alphaDecay = 0.02,
        velocityDecay = 0.4,
        linkDistance = 200,
        chargeStrength = -120,
    } = options;

    const simulation = forceSimulation(nodes, 3)
        .alphaDecay(alphaDecay)
        .velocityDecay(velocityDecay)
        .force('charge', forceManyBody().strength(chargeStrength).distanceMax(1500))
        .force('x', forceX(0).strength(0.015))
        .force('y', forceY(0).strength(0.015))
        .force('z', forceZ(0).strength(0.015))
        .force('link', forceLink(edges)
            .id((d) => d.id)
            .distance(linkDistance)
            .strength(0.3)
        )
        .on('tick', onTick)
        .on('end', () => {
            logger.debug('[PhysicsEngine] Simulation settled');
            onEnd();
        });

    return simulation;
}
