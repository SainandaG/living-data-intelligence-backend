/**
 * NodeXRay/index.jsx
 * Orchestrator — composes NodeXRayPanel from sub-chart components.
 *
 * Sub-components extracted:
 *   - QualityRadar.jsx       — data quality radar (SVG)
 *   - TransactionTimeline.jsx — area / bar / line charts
 *   - ActivityChart.jsx      — daily bar chart alias
 *   - GrowthProjection.jsx   — growth rate + risk indicators
 *
 * The main NodeXRayPanel.jsx still contains the full implementation.
 * This index re-exports it for backward compatibility while the incremental
 * split to use the extracted sub-components is completed.
 */
export { default } from '../NodeXRayPanel.jsx';
export { default as NodeXRayPanel } from '../NodeXRayPanel.jsx';
export { default as QualityRadar } from './QualityRadar.jsx';
export { TimelineAreaChart, DailyBarChart, ForecastLineChart } from './TransactionTimeline.jsx';
export { ActivityChart } from './ActivityChart.jsx';
export { default as GrowthProjection } from './GrowthProjection.jsx';
