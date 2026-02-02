from typing import List, Dict, Any

class ExplanationGenerator:
    """
    Generates natural language explanations from graph paths.
    """
    
    def generate(self, paths: List[List[Dict[str, Any]]]) -> str:
        """
        Generate summary explanation from top paths.
        """
        if not paths:
            return "No explanation available (no causal paths found)."
            
        # Analyze the primary path (highest influence)
        primary_path = paths[0]
        
        steps = []
        for i in range(len(primary_path) - 1):
            source = primary_path[i]
            target = primary_path[i+1]
            relation = target.get('edge_type', 'connected to') # Simplified
            steps.append(f"{source.get('name', 'Entity')} -> {relation} -> {target.get('name', 'Entity')}")
            
        return f"Primary cause traced through: {', '.join(steps)}."

    def explain_anomaly(self, anomaly_data: Dict[str, Any]) -> str:
        """Template based anomaly explanation"""
        return f"Anomaly detected in {anomaly_data.get('metric')} with score {anomaly_data.get('score')}. " \
               f"Standard deviation from mean: {anomaly_data.get('z_score')}."
