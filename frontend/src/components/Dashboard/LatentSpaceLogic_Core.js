import { logger } from '../../utils/logger';
// ============================================================
// LATENT SPACE LOGIC — COMPLETE ISOLATED SYSTEM
// Handles: Cluster Assignment, Real-Time WebSocket,
//          Node Registry, Diff Patching — All Lenses
// Does NOT mutate graphData.nodes under any circumstance
// ============================================================

// ─────────────────────────────────────────────
// INTERNAL ISOLATED REGISTRY
// ─────────────────────────────────────────────
let latentNodeRegistry = new Map();
let _latentSocket = null;
let _onNodeUpdateCallback = null;
let _activeLens = 'ops';

// ─────────────────────────────────────────────
// ENTRY POINT — Call when Latent Space activates
// ─────────────────────────────────────────────
export function initLatentRegistry(graphDataNodes, activeLens, onNodeUpdate) {
    _activeLens = activeLens;
    _onNodeUpdateCallback = onNodeUpdate;
    latentNodeRegistry.clear();
    window.__latentRegistry = latentNodeRegistry; // Expose for verification tests

    graphDataNodes.forEach(node => {
        // Basic cloning of needed properties
        const cloned = {
            ...node,
            _latentX: node.x || 0,
            _latentY: node.y || 0,
            _latentZ: node.z || 0,
            _targetX: null,
            _targetY: null,
            _targetZ: null,
            _currentCluster: null,
            _needsTransition: false,
            _color: null,
        };

        // Assign initial cluster on entry
        cloned._currentCluster = resolveCluster(cloned, activeLens);

        // Set initial target position based on cluster
        const pos = getClusterTargetPosition(cloned._currentCluster, cloned);
        cloned._targetX = pos.x;
        cloned._targetY = pos.y;
        cloned._targetZ = pos.z;

        latentNodeRegistry.set(node.id, cloned);
    });
}

// ─────────────────────────────────────────────
// LENS SWITCH — Re-resolve all clusters without
// reinitializing or reconnecting WebSocket
// ─────────────────────────────────────────────
export function switchLatentLens(newLens) {
    _activeLens = newLens;

    latentNodeRegistry.forEach(node => {
        const prevCluster = node._currentCluster;
        const newCluster = resolveCluster(node, newLens);

        if (newCluster !== prevCluster) {
            node._currentCluster = newCluster;
            const pos = getClusterTargetPosition(newCluster, node);
            node._targetX = pos.x;
            node._targetY = pos.y;
            node._targetZ = pos.z;
            node._needsTransition = true;
        }
    });
}

// ─────────────────────────────────────────────
// CLUSTER RESOLUTION — All Three Lenses
// Priority: Anomaly → Sensitivity/Infra → Health → Normal
// ─────────────────────────────────────────────
export function resolveCluster(node, lens) {
    const result = _resolveClusterInternal(node, lens);
    logger.debug(`[CLUSTER] ${node.id} -> ${lens} -> ${result}`);
    return result;
}

function _resolveClusterInternal(node, lens) {
    const healthScore = node.vitality ?? node.healthScore ?? 0;

    const isAnomalous =
        node.is_anomalous ||
        node.isAnomalous ||
        healthScore < 25 ||
        (healthScore < 50 && node.affectedDownstreamCount > 3) ||
        (healthScore < 50 && node.dependencyDepth > 4);

    const nodeNameLower = (node.name || node.id || '').toLowerCase();
    const nodeType = (node.table_type || node.type || '').toLowerCase();

    const filteredUpstreams = (node.upstreamNodeIds || [])
        .filter(id => id !== 'hub' && id !== 'DATABASE_CORE');
    const hasUpstream =
        filteredUpstreams.length > 0 ||
        node.dependencyDepth > 0;

    // ── OPS LENS ──────────────────────────────
    if (lens === 'ops' || lens === 'tier3') {
        // Gate 1: Anomaly always wins — even independent facts
        if (isAnomalous) return 'red';

        // Gate 2: Independent facts and sources (healthy only)
        const isYellowCandidate =
            (node.isFactTable || node.isSource) && !hasUpstream;
        if (isYellowCandidate) return 'yellow';

        // Gate 3: Dependent facts
        if (node.isFactTable && hasUpstream) return 'blue';

        // Gate 4: Everything healthy and non-fact
        return 'green';
    }

    // ── SECURITY LENS ─────────────────────────
    if (lens === 'security') {
        const isSensitive =
            nodeType === 'credential' ||
            nodeType === 'pii' ||
            nodeType === 'sensitive' ||
            nodeNameLower.includes('auth') ||
            nodeNameLower.includes('key') ||
            nodeNameLower.includes('password') ||
            nodeNameLower.includes('token') ||
            nodeNameLower.includes('fraud') ||
            nodeNameLower.includes('payment') ||
            nodeNameLower.includes('encrypt') ||
            nodeNameLower.includes('secret');

        // Gate 1: Anomaly always hits Red — including fraud tables
        if (isAnomalous) return 'red';

        // Gate 2: Sensitive but degraded — visible warning
        if (isSensitive && healthScore < 90) return 'orange';

        // Gate 3: Sensitive and fully healthy — elevated guarded
        if (isSensitive) return 'blue';

        // Gate 4: Non-sensitive degraded nodes
        if (healthScore < 60) return 'red';
        if (healthScore < 90) return 'orange';

        // Gate 5: Healthy — split by dependency
        if (hasUpstream) return 'blue';
        return 'green';
    }

    // ── ENERGY LENS ───────────────────────────
    if (lens === 'energy') {
        const isInfrastructure =
            // Type-based
            nodeType === 'bess' ||
            nodeType === 'grid' ||
            nodeType === 'meter' ||
            nodeType === 'iot_device' ||
            nodeType === 'charging_station' ||
            // Name-based — closes the gap with ThreeGraph.jsx color logic
            nodeNameLower.includes('battery') ||
            nodeNameLower.includes('batteries') ||
            nodeNameLower.includes('bess') ||
            nodeNameLower.includes('grid') ||
            nodeNameLower.includes('meter') ||
            nodeNameLower.includes('transformer') ||
            nodeNameLower.includes('inverter') ||
            nodeNameLower.includes('telemetry') ||
            nodeNameLower.includes('sensor') ||
            nodeNameLower.includes('iot') ||
            nodeNameLower.includes('charger') ||
            nodeNameLower.includes('station');

        // Gate 1: Anything broken or anomalous hits Red immediately
        if (isAnomalous || healthScore === 0) return 'red';

        // Gate 2: Infrastructure showing degradation
        if (isInfrastructure && healthScore < 80) return 'orange';

        // Gate 3: Healthy infrastructure
        if (isInfrastructure) return 'blue';

        // Gate 4: Non-infrastructure degraded
        if (healthScore < 80) return 'orange';

        // Gate 5: Everything else — consumers
        return 'green';
    }
}

// ─────────────────────────────────────────────
// CLUSTER COLORS
// ─────────────────────────────────────────────
export function getClusterColor(cluster) {
    const colors = {
        red: '#ff2244',
        orange: '#ff8800',
        yellow: '#ffdd00',
        blue: '#0088ff',
        green: '#00ff88',
    };
    return colors[cluster] || '#ffffff';
}

// ─────────────────────────────────────────────
// CLUSTER TARGET POSITIONS
// Mountain center coordinates in 3D world space
// ─────────────────────────────────────────────
const CLUSTER_CENTERS = {
    red: { x: -1800, z: -1800 },
    yellow: { x: 1800, z: -1800 },
    blue: { x: -1800, z: 1800 },
    orange: { x: 0, z: -2200 },
    green: { x: 1800, z: 1800 },
};

export function getClusterTargetPosition(cluster, node) {
    const center = CLUSTER_CENTERS[cluster] || CLUSTER_CENTERS.green;

    // Organic spread — larger tables sit closer to center
    const rowNorm = Math.log10((node.row_count || 1) + 1);
    const spread = Math.max(200, 800 - rowNorm * 60);
    const theta = Math.random() * Math.PI * 2;

    const x = center.x + Math.cos(theta) * spread;
    const z = center.z + Math.sin(theta) * spread;

    // Y is resolved by manifold height — passed in from ThreeGraph
    const y = node._manifoldY || 0;

    return { x, y, z };
}

// ─────────────────────────────────────────────
// REAL-TIME WEBSOCKET — Fully Isolated
// Never touches graphData.nodes
// ─────────────────────────────────────────────
export function startLatentWebSocket(retryDelay = 3000) {
    if (_latentSocket &&
        _latentSocket.readyState === WebSocket.OPEN) return;

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/latent-stream`;
    _latentSocket = new WebSocket(wsUrl);

    _latentSocket.onopen = () => {
        logger.debug('[LATENT] WebSocket connected');
    };

    _latentSocket.onmessage = (event) => {
        try {
            const diff = JSON.parse(event.data);
            patchLatentNode(diff);
        } catch (e) {
            logger.warn('[LATENT] Bad diff payload', e);
        }
    };

    _latentSocket.onclose = () => {
        const nextDelay = Math.min(retryDelay * 2, 30000); // exponential backoff, max 30s
        logger.warn(`[LATENT] WebSocket closed — reconnecting in ${nextDelay / 1000}s`);
        setTimeout(() => startLatentWebSocket(nextDelay), nextDelay);
    };

    _latentSocket.onerror = (e) => {
        // Error will be followed by onclose — don't double-reconnect
        if (e && e.target && typeof e.target.close === 'function') {
            e.target.close();
        } else if (_latentSocket) {
            _latentSocket.close();
        }
    };
}

export function stopLatentWebSocket() {
    if (_latentSocket) {
        _latentSocket.close();
        _latentSocket = null;
    }
}

// ─────────────────────────────────────────────
// DIFF PATCHER — Patches one node, reruns
// cluster logic, triggers transition if changed
// ─────────────────────────────────────────────
function patchLatentNode(diff) {
    const node = latentNodeRegistry.get(diff.node_id);
    if (!node) return;

    const prevCluster = node._currentCluster;

    // Patch only the fields that arrived
    Object.assign(node, diff);

    // Re-resolve cluster for this node only
    const newCluster = resolveCluster(node, _activeLens);

    if (newCluster !== prevCluster) {
        node._currentCluster = newCluster;
        const pos = getClusterTargetPosition(newCluster, node);
        node._targetX = pos.x;
        node._targetY = pos.y;
        node._targetZ = pos.z;
        node._needsTransition = true;

        logger.debug(
            `[LATENT] Node ${node.id} moved: ${prevCluster} → ${newCluster}`
        );
    }

    // Always notify ThreeGraph so color/label updates even
    // if cluster didn't change (e.g. health score tick)
    if (_onNodeUpdateCallback) _onNodeUpdateCallback(node);
}

// ─────────────────────────────────────────────
// REGISTRY ACCESSOR — ThreeGraph reads from this
// ─────────────────────────────────────────────
export function getLatentRegistry() {
    return latentNodeRegistry;
}
