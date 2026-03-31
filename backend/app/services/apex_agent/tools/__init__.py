from .schema_inspector import SchemaInspectorTool
from .data_sampler import DataSamplerTool
from .ml_runner import MLRunnerTool
from .anomaly_detector_tool import AnomalyDetectorTool
from .insight_writer import InsightWriterTool
from .action_trigger import ActionTriggerTool

TOOL_REGISTRY = {
    "inspect_schema":   SchemaInspectorTool(),
    "sample_data":      DataSamplerTool(),
    "run_ml":           MLRunnerTool(automl=False),
    "run_automl":       MLRunnerTool(automl=True),
    "detect_anomalies": AnomalyDetectorTool(),
    "write_insight":    InsightWriterTool(),
    "trigger_decision": ActionTriggerTool(),
    # Lightweight aliases handled inside executor
    "resolve_entity":   SchemaInspectorTool(),
    "engineer_features": DataSamplerTool(),
    "compute_metric":   DataSamplerTool(),
    "explain_result":   MLRunnerTool(automl=False),
    "search_memory":    InsightWriterTool(),
}

__all__ = ["TOOL_REGISTRY"]
