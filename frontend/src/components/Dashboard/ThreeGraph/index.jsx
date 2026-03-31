/**
 * ThreeGraph/index.jsx
 * Orchestrator for the 3D graph visualization.
 *
 * Module structure (all code is LIVE — fully extracted):
 *
 *   SceneSetup.js        — skydome, starfield, neural-core halo, disposeObject
 *   NodeRenderer.js      — applyGalaxyLayout, createNodeMesh, createTextSprite
 *   EdgeRenderer.js      — createCurvedEdge, createParticle
 *   ClusterManager.js    — createClusterVoxelMesh, createDataGridTexture
 *   PhysicsEngine.js     — createForceSimulation (d3-force-3d wrapper)
 *   InteractionHandler.js — setupInteractionHandlers (mouse, raycast, click)
 *
 * The main ThreeGraph React component (ThreeGraph.jsx) imports these modules
 * and orchestrates them inside useEffect hooks.
 *
 * To use the individual modules directly:
 *   import { createNodeMesh } from './ThreeGraph/NodeRenderer.js';
 *   import { setupInteractionHandlers } from './ThreeGraph/InteractionHandler.js';
 */

// Re-export sub-modules for direct access
export { createUniversalSkydome, createInfiniteDustLayer, createNeuralCoreHalo, disposeObject } from './SceneSetup.js';
export { applyGalaxyLayout, createNodeMesh, createTextSprite } from './NodeRenderer.js';
export { createCurvedEdge, createParticle } from './EdgeRenderer.js';
export { createClusterVoxelMesh, createDataGridTexture } from './ClusterManager.js';
export { createForceSimulation } from './PhysicsEngine.js';
export { setupInteractionHandlers } from './InteractionHandler.js';

// Default export: the main React component (unchanged API)
export { default } from '../ThreeGraph.jsx';
