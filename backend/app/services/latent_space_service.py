"""
latent_space_service.py
Projects table nodes into a 3D coordinate space for visualization.

DATA PROVENANCE:
  Latent coordinates are CALCULATED, not discovered by PCA or ML embedding.
  They are deterministic formulas applied to graph metrics:

    latent_x = (revenue_proxy - 5000) * x_gain        #  value/centrality axis
    latent_y = (risk_score * 50) + (importance * 500)  #  risk/importance axis
    latent_z = (variance - 2.5) * z_gain               #  stability axis

  Inputs are a mix of real and derived values:
    - revenue_proxy, risk_score, importance: derived from NeuralCore graph metrics
    - variance: estimated from row_count and anomaly signals
    - The resulting x/y/z positions reflect structural relationships, NOT
      statistical dimensionality reduction of actual column data.

  Every coordinate response includes a `_meta.source = "formula_projection"` field.
"""
import math
import time
from typing import Dict, List, Any

class LatentSpaceService:
    """
    Reality-Driven Latent Space Mapping
    Derives position and motion from the immutable state chain.
    """
    
    def __init__(self):
        self.y_gain = 400.0   # Risk amplification
        self.x_gain = 800.0   # Value/Centrality amplification
        self.z_gain = 300.0   # Stability amplification
        
        # State Tracking for Motion Derivation
        self.motion_cache: Dict[str, Dict[str, Any]] = {} # node_id -> {v, a, last_pos}

    def calculate_latent_coordinates(self, node: Dict[str, Any], metrics: Dict[str, Any], anomalies: List[Dict[str, Any]]) -> Dict[str, float]:
        """
        Map StateDelta metrics to fixed semantic axes.
        
        Axes:
        - X (VALUE): Centrality + Data Scale
        - Y (RISK): Anomaly Intensity (Z-Scores)
        - Z (STABILITY): Vitality - Performance Drift
        """
        node_name = node.get('name')
        importance = float(node.get('importance_score', 0.5))
        
        # 1. VALUE (X-Axis) - Structural significance + Cluster Spread
        node_id = node.get('id', '')
        if node_id == 'hub':
            latent_x = 0.0
            latent_y = 0.0 # Absolute Center
            latent_z = 0.0
        else:
            # WEZU STRATEGY MAPPING (100% Parity)
            # X (VALUE): Lifetime Revenue
            # Y (RISK): Health Risk (Inverse of SoH)
            # Z (STABILITY): Swap Variance
            
            revenue = float(node.get('revenue') or node.get('lifetime_revenue', 0.0))
            soh = float(node.get('soh_percentage') or node.get('vitality', 100.0))
            variance = float(node.get('swap_frequency_variance') or node.get('swap_variance', 0.0))

            # Scale for Majestic Mountains (Y-Axis)
            risk_score = 100.0 - soh
            
            latent_x = (revenue - 5000) * 2.0
            latent_y = (risk_score * 50.0) + (importance * 500.0) # Base lift
            latent_z = (variance - 2.5) * 400.0

        coords = {
            'latent_x': round(latent_x, 2),
            'latent_y': round(latent_y, 2),
            'latent_z': round(latent_z, 2),
            '_meta': {
                'source': 'formula_projection',
                'description': (
                    'Coordinates computed from graph metrics using linear scaling formulas. '
                    'Not produced by PCA, UMAP, or ML-based dimensionality reduction.'
                ),
                'axes': {
                    'x': 'value/centrality  (revenue_proxy - 5000) * x_gain',
                    'y': 'risk/importance  (risk_score * 50) + (importance * 500)',
                    'z': 'stability  (variance - 2.5) * z_gain',
                },
                'inputs_are_real': False,
                'inputs_are_graph_derived': True,
            }
        }

        # 4. MOTION ANALYSIS (Reality Emergence)
        motion = self._derive_motion(node_name, coords)
        coords.update(motion)

        return coords

    def _derive_motion(self, node_id: str, current: Dict[str, float]) -> Dict[str, Any]:
        """Calculate Velocity and Acceleration from state history."""
        now = time.time()
        prev = self.motion_cache.get(node_id)
        
        motion = {
            'vx': 0.0, 'vy': 0.0, 'vz': 0.0,
            'velocity_magnitude': 0.0,
            'acceleration': 0.0,
            'motion_pattern': 'stable'
        }

        if prev:
            dt = max(0.1, now - prev['time'])
            
            # Velocity (Rate of Change)
            vx = (current['latent_x'] - prev['x']) / dt
            vy = (current['latent_y'] - prev['y']) / dt
            vz = (current['latent_z'] - prev['z']) / dt
            
            v_mag = math.sqrt(vx**2 + vy**2 + vz**2)
            
            # Acceleration (Change in Velocity)
            dv = v_mag - prev['v_mag']
            accel = dv / dt
            
            motion.update({
                'vx': round(vx, 2), 'vy': round(vy, 2), 'vz': round(vz, 2),
                'velocity_magnitude': round(v_mag, 2),
                'acceleration': round(accel, 2)
            })
            
            # Classify Character
            if v_mag < 1.0: motion['motion_pattern'] = 'stable'
            elif vy > 20.0: motion['motion_pattern'] = 'collapsing' # Sharp rise in risk
            elif accel > 10.0: motion['motion_pattern'] = 'accelerating'
            else: motion['motion_pattern'] = 'drifting'

        # Update Cache
        self.motion_cache[node_id] = {
            'x': current['latent_x'],
            'y': current['latent_y'],
            'z': current['latent_z'],
            'v_mag': motion['velocity_magnitude'],
            'time': now
        }

        return motion

    def generate_manifold_data(self, nodes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Project the collective state onto a continuous risk manifold."""
        emitters = []
        for node in nodes:
            # STRICT SEMANTIC COLORING for manifold peaks
            color = self._get_semantic_color(node)
            
            emitters.append({
                'x': node.get('latent_x', 0),
                'y': node.get('latent_y', 0),
                'z': node.get('latent_z', 0),
                'weight': (float(node.get('importance_score', 1.0)) * 30.0) + (abs(node.get('latent_y', 0)) / 0.8), # Supreme influence
                'color': color,
                'classification': node.get('table_type', 'dimension')
            })

        return {
            'emitters': emitters,
            'resolution': 64,
            'sigma': 1000.0,
            'explanation': "Manifold represents the Risk/Value topology of the system state."
        }

    def _get_semantic_color(self, node: Dict[str, Any]) -> str:
        """Derive color based on business entity (Reference Image: Green, Blue, Yellow, Red)."""
        
        # Hub/Core is always orange
        if node.get('id') == 'hub' or node.get('id') == 'DATABASE_CORE':
            return '#FF9F1A'  # Orange Neural Core
        
        business_entity = str(node.get('business_entity', 'other')).lower()

        # ROBUST INFERENCE (Matched to Coordinates)
        if business_entity == 'other' or not business_entity:
            name = str(node.get('name', '')).lower()
            if any(x in name for x in ['cust', 'user', 'client', 'account', 'profile']):
                business_entity = 'customer'
            elif any(x in name for x in ['sale', 'trans', 'pay', 'order', 'bill', 'inv']):
                business_entity = 'transaction'
            elif any(x in name for x in ['prod', 'item', 'serv', 'cat', 'sku']):
                business_entity = 'product'
            elif any(x in name for x in ['log', 'audit', 'err', 'fail', 'fraud']):
                business_entity = 'fraud'
            else:
                business_entity = 'other'
        
        # 4-Color Palette (Reference Matched)
        entity_colors = {
            # Green Mountain: Customer-facing
            'customer': '#4CAF50', 'user': '#4CAF50', 'client': '#4CAF50', 'account': '#4CAF50',
            
            # Blue Mountain: Transactions
            'transaction': '#2196F3', 'payment': '#2196F3', 'transfer': '#2196F3', 'card': '#2196F3',
            
            # Yellow Mountain: Products/Services
            'product': '#FFC107', 'service': '#FFC107', 'loan': '#FFC107', 'branch': '#FFC107',
            
            # Red Mountain: Risk/Audit
            'fraud': '#F44336', 'audit': '#F44336', 'alert': '#F44336', 'other': '#F44336'
        }
        
        return entity_colors.get(business_entity, '#94A3B8')  # Default gray

# Global Instance
latent_space_service = LatentSpaceService()
