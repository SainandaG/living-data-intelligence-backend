# -*- coding: utf-8 -*-
"""
GRAVITY ENGINE
--------------
Agentic AI service that calculates the 'Gravity' (Importance) of individual records
based on global context distribution (Z-Scores) and relational pull.
"""
import logging
import numpy as np
from typing import List, Dict, Any
from app.services.db_connector import db_connector

logger = logging.getLogger(__name__)

class GravityEngine:
    def __init__(self):
        pass

    async def calculate_gravity(self, connection_id: str, table: str, column: str, limit: int = 200) -> List[Dict[str, Any]]:
        """
        Fetch records and calculate gravity scores using PCA and K-Means.
        `column` is the primary column of interest; it is included in the response
        so callers can identify which field drove the analysis.
        """
        import logging as _log
        _log.getLogger(__name__).debug(
            "GravityEngine: calculating gravity for %s.%s (limit=%d)", table, column, limit
        )
        try:
            # Table Resolver: Case-insensitive check
            actual_table_name = table
            from app.services.schema_analyzer import schema_analyzer
            schema = schema_analyzer.get_analysis_result(connection_id)
            if schema:
                table_names_lower = {t.name.lower(): t.name for t in schema.tables}
                if table.lower() in table_names_lower:
                    actual_table_name = table_names_lower[table.lower()]

            # 1. Fetch raw data with quoting
            quoted_table = db_connector.quote_identifier(connection_id, actual_table_name)
            query = f"SELECT * FROM {quoted_table} LIMIT {limit}"
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
                # GUARD: Check for sufficient data for PCA
                if len(df_encoded) < 2:
                    # Not enough data for variance/PCA
                    return self._assign_default_gravity(records)
                
                # GUARD: Check for zero variance (all values identical)
                if df_encoded.var().sum() == 0:
                     return self._assign_default_gravity(records)

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
                
                # print(f"✅ Statistical Proof: PCA variance explained ratio: {pca.explained_variance_ratio_}")

            except ImportError:
                # print("⚠️ sklearn not found, using simple heuristics")
                # Fallback logic would go here
                return self._assign_default_gravity(records)
            except Exception as e:
                logger.debug(f"Statistical analysis error: {e}")
                return self._assign_default_gravity(records)

            # 4. Enrich records
            enriched_records = []
            for i, record in enumerate(records):
                enriched_records.append({
                    "id": f"rec_{i}",
                    "data": record,
                    "primary_column": column,
                    "gravity_score": float(gravity_scores[i]),
                    "cluster_group": int(clusters[i]),
                    "is_anomaly": gravity_scores[i] < 20,  # Low gravity = outlier away from mean
                    # Scaling PCA coords to visualization space (-200 to 200)
                    "pos_x": float(coords[i][0] * 50),
                    "pos_y": float(coords[i][1] * 50),
                    "pos_z": float(coords[i][2] * 50),
                    "orbital_radius": float(np.linalg.norm(coords[i]) * 50),
                })
                
            # print(f"🪐 GravityEngine: Processed {len(enriched_records)} records with Statistical Proof.")
            return enriched_records
            
        except Exception as e:
            logger.debug(f"Gravity calculation failed: {e}")
            return []

    def _assign_default_gravity(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Fallback when PCA/KMeans cannot run (< 2 rows, zero variance, or sklearn missing).
        Assigns a uniform neutral gravity score (50/100) so the caller always receives
        a usable list rather than an empty one.  The `_note` field communicates provenance.
        """
        import logging as _log
        _log.getLogger(__name__).debug(
            "GravityEngine: using default gravity for %d record(s) — stats unavailable", len(records)
        )
        return [
            {
                "id": f"rec_{i}",
                "data": record,
                "gravity_score": 50.0,
                "cluster_group": 0,
                "is_anomaly": False,
                "pos_x": 0.0,
                "pos_y": 0.0,
                "pos_z": 0.0,
                "orbital_radius": 0.0,
                "_note": "default_gravity_insufficient_variance",
            }
            for i, record in enumerate(records)
        ]

gravity_engine = GravityEngine()
