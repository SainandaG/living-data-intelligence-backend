/**
 * LatentSpace/index.js
 * Barrel export — import from here instead of LatentSpaceLogic.jsx directly.
 *
 * All code is live (not stubs):
 *   computations.js       — 620 lines of pure 3D math and layout functions
 *   LatentSpaceOverlay.jsx — 740 lines: UI overlay component
 *   LatentWorld.jsx        — 385 lines: 3D React component
 *   styles.js              — 24 lines: shared inline style constants
 */
export {
    enrichNodesWithDependency, LENS_CATEGORIES, getLensCategories,
    computeCentroids, getManifoldHeight, createLatentManifold,
    applyLatentSpaceLayout, propagateImpact,
    create3DAxes, createFlowArrows, createLatentBridgeEdge,
} from './computations.js';

export { LatentSpaceUIOverlay } from './LatentSpaceOverlay.jsx';
export { LatentWorld } from './LatentWorld.jsx';
export { latentStyles } from './styles.js';
