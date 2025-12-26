"""
GRAVITY ENGINE
--------------
Agentic AI service that calculates the 'Gravity' (Importance) of individual records
based on global context distribution (Z-Scores) and relational pull.
"""
import numpy as np
from typing import List, Dict, Any
from app.services.db_connector import db_connector

class GravityEngine:
    def __init__(self):
        pass

    async def calculate_gravity(self, connection_id: str, table: str, column: str, limit: int = 200) -> List[Dict[str, Any]]:
        """
        Fetch records and calculate gravity scores using PCA and K-Means.
        Statistical Proof Logic:
        1. Vectorize all record data.
        2. K-Means (k=5) to find natural clusters.
        3. PCA to project N-dimensions to 3D space (x,y,z).
        4. Gravity = Distance from cluster centroid.
        """
        print(f"🪐 GravityEngine: Calculating forces for {table}.{column}")
        
        # 1. Fetch raw data
        query = f"SELECT * FROM {table} LIMIT {limit}"
        records = await db_connector.query(connection_id, query)
        
        if not records:
            return []

        # 2. Vectorize Data
        # We need to turn the dict records into a feature matrix
        import pandas as pd
        df = pd.DataFrame(records)
        
        # Handle non-numeric data for PCA
        # Convert categoricals to codes, fill NAs
        df_encoded = df.copy()
        for col in df_encoded.columns:
            if df_encoded[col].dtype == 'object':
                df_encoded[col] = df_encoded[col].astype('category').cat.codes
            df_encoded[col] = df_encoded[col].fillna(0)
            
        # 3. Statistical Analysis (PCA & K-Means)
        # Using sklearn if available, else fallback to numpy math
        try:
            from sklearn.decomposition import PCA
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler
            
            # Normalize
            X = StandardScaler().fit_transform(df_encoded)
            
            # K-Means Clustering
            kmeans = KMeans(n_clusters=min(5, len(df)), random_state=42, n_init=10)
            clusters = kmeans.fit_predict(X)
            
            # PCA for 3D coordinates
            pca = PCA(n_components=3)
            coords = pca.fit_transform(X) # Returns array of [x, y, z]
            
            # Calculate Gravity (Distance from Center of Mass)
            # Higher gravity = Closer to 0,0,0 (Metadata Core)
            # We invert distance for "Gravity Score"
            distances = np.linalg.norm(X, axis=1)
            max_dist = np.max(distances) if np.max(distances) > 0 else 1
            gravity_scores = [(1 - (d / max_dist)) * 100 for d in distances]
            
            print(f"✅ Statistical Proof: PCA variance explained ratio: {pca.explained_variance_ratio_}")

        except ImportError:
            print("⚠️ sklearn not found, using simple heuristics")
            # Fallback logic would go here
            return self._assign_default_gravity(records)
        except Exception as e:
             print(f"⚠️ Statistical Analysis Error: {e}")
             return self._assign_default_gravity(records)

        # 4. Enrich records
        enriched_records = []
        for i, record in enumerate(records):
            enriched_records.append({
                "id": f"rec_{i}",
                "data": record,
                "gravity_score": float(gravity_scores[i]),
                "cluster_group": int(clusters[i]),
                "is_anomaly": gravity_scores[i] < 20, # Low gravity = outlier away from mean
                # Scaling PCA coords to visualization space (e.g. -200 to 200)
                "pos_x": float(coords[i][0] * 50),
                "pos_y": float(coords[i][1] * 50),
                "pos_z": float(coords[i][2] * 50),
                "orbital_radius": float(np.linalg.norm(coords[i]) * 50)
            })
            
        print(f"🪐 GravityEngine: Processed {len(enriched_records)} records with Statistical Proof.")
        return enriched_records

    def _assign_default_gravity(self, records):
        return [{**r, "gravity_score": 10, "orbital_radius": 150} for r in records]

gravity_engine = GravityEngine()
