import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
    OrbitControls,
    TransformControls,
    EffectComposer,
    RenderPass,
    UnrealBloomPass
} from 'three-stdlib';
import { SeededRNG } from '../../utils/mathUtils';
import { getLatentRegistry } from './LatentSpaceLogic_Core.js';
import EdgeStatsPanel from './EdgeStatsPanel';
import NodeXRayPanel from './NodeXRayPanel';
import DataLensPanel from './Controls/DataLensPanel';
import NodeSelectorPanel from './Controls/NodeSelectorPanel';
import { logger } from '../../utils/logger';



/**
 * Step 1 — Enrich Node Data (Before applyLatentSpaceLayout)
 * Your nodes need two new derived fields.
 */

// ── Module imports — all code extracted to focused sub-modules ────────────────
export {
    enrichNodesWithDependency,
    LENS_CATEGORIES,
    getLensCategories,
    computeCentroids,
    getManifoldHeight,
    createLatentManifold,
    applyLatentSpaceLayout,
    propagateImpact,
    create3DAxes,
    createFlowArrows,
    createLatentBridgeEdge,
} from './LatentSpace/computations.js';

export { LatentSpaceUIOverlay } from './LatentSpace/LatentSpaceOverlay.jsx';
export { LatentWorld } from './LatentSpace/LatentWorld.jsx';
export { latentStyles, default as latentStylesDefault } from './LatentSpace/styles.js';
// ─────────────────────────────────────────────────────────────────────────────
