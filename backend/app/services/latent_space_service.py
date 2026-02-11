import math
import time
from typing import Dict, List, Any, Optional
from app.services.neural_core import neural_core

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
            # 4-ZONE SPATIAL SEGMENTATION (Business Entity Based)
            # Wide separation to create distinct mountain ranges
            business_entity = str(node.get('entity', node.get('business_entity', 'other'))).lower()
            
            # Map business entities to 4 distinct zones (Reference Image)
            entity_zones = {
                # Zone 1: Green Mountain (Customer-facing entities)
                'customer': -11000, 'user': -11000, 'client': -11000, 'account': -11000,
                
                # Zone 2: Blue Mountain (Transactional entities)
                'transaction': -3500, 'payment': -3500, 'transfer': -3500, 'card': -3500,
                
                # Zone 3: Yellow Mountain (Product/Service entities)
                'product': 3500, 'service': 3500, 'loan': 3500, 'branch': 3500,
                
                # Zone 4: Red Mountain (Risk/Audit entities)
                'fraud': 11000, 'audit': 11000, 'alert': 11000, 'other': 11000
            }
            
            base_x = entity_zones.get(business_entity, 0)  # Default to center if unknown
            
            # Add cluster-based jitter within each zone for natural spread
            cluster_id = node.get('cluster', '0')
            cluster_jitter = (hash(str(cluster_id)) % 2500) - 1250
            
            # Add importance-based offset for depth
            row_log = math.log10(max(1, node.get('row_count', 0))) * 150
            latent_x = base_x + cluster_jitter + row_log

            # 2. RISK (Y-Axis) - Majestic Analytical Peaks
            max_z = 0.0
            for a in (anomalies or []):
                try:
                    if node_name and node_name.lower() in [str(n).lower() for n in a.get('affected_nodes', [])]:
                        max_z = max(max_z, float(a.get('z_score', 0)))
                except: continue
            
            # DRAMATIC VERTICAL SCALE (User Request: Majestic Mountains)
            latent_y = (importance * 1200.0) + (max_z * 1800.0)

            # 3. HEALTH (Z-Axis) - Stability / Perspective
            vitality = float(node.get('vitality', 50.0)) / 100.0
            latent_z = (vitality - 0.5) * self.z_gain * 8.0

        coords = {
            'latent_x': round(latent_x, 2),
            'latent_y': round(latent_y, 2),
            'latent_z': round(latent_z, 2)
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
        
        business_entity = str(node.get('entity', node.get('business_entity', 'other'))).lower()
        
        # 4-Color Palette (Reference Matched)
        entity_colors = {
            # Green Mountain: Customer-facing
            'customer': '#4CAF50', 'user': '#4CAF50', 'client': '#4CAF50', 'account': '#4CAF50',
            
            # Blue Mountain: Transactions
            'transaction': '#2196F3', 'payment': '#2196F3', 'transfer': '#2196F3', 'card': '#2196F3',
            
            # Yellow Mountain: Products/Services
            'product': '#FFC107', 'service': '#FFC107', 'loan': '#FFC107', 'branch': '#FFC107',
            
            # Red Mountain: Risk/Audit
            'fraud': '#F44336', 'audit': '#F44336', 'alert': '#F44336', 'other': '#94A3B8'

        }
        
        return entity_colors.get(business_entity, '#94A3B8')  # Default gray

# Global Instance
latent_space_service = LatentSpaceService()
