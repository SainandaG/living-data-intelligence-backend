"""
Neural Core Package

Provides the NeuralCore singleton, split into focused sub-modules:
  - schema_scanner   : update_schema_context, _analyze_table_intelligence, process_signal
  - metrics          : get_core_metrics, get_column_intelligence, get_bulk_analysis_report
  - signal_processor : save_snapshot, _get_context, predict_links, predict_importance
  - analysis_reporter: get_priority_level, get_ontology_type, get_tables_by_filter
"""
from app.services.neural_core.core import neural_core, NeuralCore

__all__ = ["neural_core", "NeuralCore"]
