/**
 * timing.js
 * Named constants for all magic-number timeouts and intervals.
 * Replaces 22 hardcoded setTimeout/setInterval values across the codebase.
 *
 * Files to update:
 *   App.jsx (12), VoiceControl.jsx (3), useWebSocket.ts (2),
 *   apiClient.js (1), AgentStatusPanel.jsx (1), SoundSystem.js (2), errorHandler.js (1)
 */

/** How long toast/notification messages remain visible (ms) */
export const TOAST_DURATION = 4000;

/** How long AI status messages stay before auto-clearing (ms) */
export const STATUS_CLEAR_DELAY = 5000;

/** Delay before showing the connection modal on first load (ms) */
export const MODAL_DELAY = 500;

/** WebSocket reconnect timeout ceiling — max back-off (ms) */
export const RECONNECT_TIMEOUT = 30000;

/** Agent status panel polling interval (ms) — override with VITE_AGENT_POLL_INTERVAL */
export const AGENT_POLL_INTERVAL = Number(import.meta.env.VITE_AGENT_POLL_INTERVAL) || 10000;

/** Realtime metrics polling / system vitals refresh (ms) — override with VITE_METRICS_POLL_INTERVAL */
export const METRICS_POLL_INTERVAL = Number(import.meta.env.VITE_METRICS_POLL_INTERVAL) || 5000;

/** Dashboard layout vitals refresh interval (ms) — override with VITE_VITALS_POLL_INTERVAL */
export const VITALS_POLL_INTERVAL = Number(import.meta.env.VITE_VITALS_POLL_INTERVAL) || 5000;

/** Intelligence dashboard data refresh (ms) — override with VITE_INTELLIGENCE_POLL_INTERVAL */
export const INTELLIGENCE_POLL_INTERVAL = Number(import.meta.env.VITE_INTELLIGENCE_POLL_INTERVAL) || 15000;

/** Delay before camera arrives at drill-down node (ms) — cinematic transition */
export const DRILLDOWN_CAMERA_DELAY = 1200;

/** How long the db_reconnecting toast stays before clearing (ms) */
export const DB_RECONNECT_TOAST_DURATION = 30000;

/** Short link-share toast duration (ms) */
export const SHARE_TOAST_DURATION = 3000;

/** Position update debounce for PerspectiveLineageView (ms) */
export const LINEAGE_POSITION_DEBOUNCE = 800;

/** Simulation update toast auto-clear (ms) */
export const SIM_UPDATE_TOAST_DURATION = 4000;

/** How long to show the neural core AI status after graph load (ms) */
export const AI_STATUS_CLEAR_DELAY = 5000;

/** SemanticSearchDiscovery debounce before firing search (ms) */
export const SEARCH_DEBOUNCE = 400;

/** Node formation simulation agent state poll (ms) — override with VITE_FORMATION_POLL_INTERVAL */
export const FORMATION_POLL_INTERVAL = Number(import.meta.env.VITE_FORMATION_POLL_INTERVAL) || 2000;

/** Generation log panel auto-hide delay (ms) */
export const GENERATION_LOG_HIDE_DELAY = 3000;
