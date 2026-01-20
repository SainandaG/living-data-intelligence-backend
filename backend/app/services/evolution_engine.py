"""
Evolution Engine
Generates database snapshots at specific points in time.
Part of the Database Evolution Playback system.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import math
from app.services.temporal_analyzer import temporal_analyzer

class EvolutionEngine:
    """
    Interpolates database state between birth and current state.
    """
    
    async def get_snapshot(self, connection_id: str, target_time: datetime) -> Dict[str, Any]:
        """
        Generate a snapshot of what the database looked like at target_time.
        """
        evo_data = temporal_analyzer.get_result(connection_id)
        if not evo_data:
            evo_data = await temporal_analyzer.analyze_evolution(connection_id)
            
        snapshot = {
            "timestamp": target_time.isoformat(),
            "tables": [],
            "milestones": [],
            "global_metrics": {
                "avg_vitality": 0,
                "data_density": 0,
                "intelligence_score": 0
            }
        }
        
        # Current time as reference (ensure timezone-aware)
        now = datetime.now()
        if now.tzinfo is None:
            now = now.astimezone()
        
        # Ensure target_time is timezone-aware
        if target_time.tzinfo is None:
            target_time = target_time.astimezone()
        
        total_vitality = 0
        
        for table in evo_data['table_evolution']:
            birth_date = table['birth_date']
            
            # Ensure birth_date is timezone-aware
            if birth_date and isinstance(birth_date, str):
                birth_date = datetime.fromisoformat(birth_date.replace('Z', '+00:00'))
            
            if birth_date and birth_date.tzinfo is None:
                birth_date = birth_date.astimezone()

            # If table hasn't been born yet, skip it
            if not birth_date or birth_date > target_time:
                continue
                
            # Calculate interpolated size
            time_since_birth = (target_time - birth_date)
            days_active = time_since_birth.days + (time_since_birth.seconds / 86400)
            days_active = max(0.01, days_active)
            
            # Mathematical Growth Modeling (Logistic-style or Linear with Noise)
            # N(t) = N_max * (t / t_total) ^ alpha
            total_history_days = max(1, (now - birth_date).days)
            growth_progress = min(1.0, days_active / total_history_days)
            
            estimated_count = int(table['current_size'] * (growth_progress ** 1.2)) # Slight acceleration
            estimated_count = min(table['current_size'], estimated_count)
            estimated_count = max(1, estimated_count)
            
            # --- TIME INTELLIGENCE: AGE FACTOR ---
            # 1.0 = Brand new (Bright), 0.2 = Very old (Dim)
            # We treat nodes born within the last 10% of the CURRENT timeline as "New"
            age_days = max(0, (target_time - birth_date).days)
            age_factor = max(0.2, 1.0 - (age_days / 180)) # Becomes "dim" over 6 months
            
            # Importance mapping
            importance_str = str(table.get('importance', 'low')).lower()
            importance_map = {
                "critical": 3.0,
                "high": 2.2,
                "medium": 1.5,
                "low": 0.8
            }
            importance_val = importance_map.get(importance_str, 1.0)
            
            # --- ML Analysis Simulation for Evolution ---
            # Ensure estimated_count is at least 1 for math
            safe_count = max(1, estimated_count)
            n_term = math.log10(safe_count + 1)
            
            node_glow = (0.8 * n_term * age_factor) + (0.6 * importance_val)
            vitality = min(100, (n_term * 20) + (importance_val * 5))
            
            total_vitality += vitality
            
            # Safe relative size
            real_current_size = max(1, table.get('current_size', 1))
            relative_size = min(1.0, estimated_count / real_current_size)
            
            snapshot["tables"].append({
                "name": table['table_name'],
                "row_count": estimated_count,
                "is_new": age_days < 7,
                "age_factor": round(age_factor, 2),
                "relative_size": round(relative_size, 3),
                "vitality": int(vitality),
                "node_glow": round(node_glow, 2),
                "importance": importance_val
            })
            
        # Filter milestones up to this point
        snapshot["milestones"] = [
            m for m in evo_data['milestones'] 
            if datetime.fromisoformat(m['date'].replace('Z', '+00:00')) <= target_time
        ]
        
        # Aggregate Global Metrics
        if snapshot["tables"]:
            snapshot["global_metrics"]["avg_vitality"] = int(total_vitality / len(snapshot["tables"]))
            snapshot["global_metrics"]["intelligence_score"] = round(sum(t['node_glow'] for t in snapshot["tables"]) / len(snapshot["tables"]), 2)
            snapshot["global_metrics"]["data_density"] = sum(t['row_count'] for t in snapshot["tables"])
        
        return snapshot

    async def generate_keyframes(self, connection_id: str, steps: int = 50) -> List[Dict[str, Any]]:
        """
        Generate a sequence of snapshots for smooth animation playback.
        """
        evo_data = temporal_analyzer.get_result(connection_id)
        if not evo_data:
            evo_data = await temporal_analyzer.analyze_evolution(connection_id)
            
        start_date = datetime.fromisoformat(evo_data['start_date'])
        end_date = datetime.fromisoformat(evo_data['end_date'])
        duration = end_date - start_date
        
        keyframes = []
        for i in range(steps + 1):
            target_time = start_date + (duration * (i / steps))
            snapshot = await self.get_snapshot(connection_id, target_time)
            keyframes.append(snapshot)
            
        return keyframes

# Global instance
evolution_engine = EvolutionEngine()
