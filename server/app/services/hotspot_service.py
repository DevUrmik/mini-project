"""
Hotspot Service: Serves precomputed and dynamic K-Means and DBSCAN Spatial Clusters
Supports all 49 US States + DC with true great-circle Haversine spherical distance.
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional, List
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN

from server.app.config import (
    HOTSPOTS_KMEANS_PATH,
    HOTSPOTS_DBSCAN_PATH,
    MODELS_DIR
)
from server.app.ml.haversine import km_to_radians, haversine_vectorized

class HotspotService:
    _instance = None
    _kmeans_data: Optional[Dict[str, Any]] = None
    _dbscan_data: Optional[Dict[str, Any]] = None
    _comparison_data: Optional[Dict[str, Any]] = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        if HOTSPOTS_KMEANS_PATH.exists():
            with open(HOTSPOTS_KMEANS_PATH, "r") as f:
                self._kmeans_data = json.load(f)
        else:
            self._kmeans_data = {}

        if HOTSPOTS_DBSCAN_PATH.exists():
            with open(HOTSPOTS_DBSCAN_PATH, "r") as f:
                self._dbscan_data = json.load(f)
        else:
            self._dbscan_data = {}

        comparison_path = MODELS_DIR / "clustering_comparison.json"
        if comparison_path.exists():
            with open(comparison_path, "r") as f:
                self._comparison_data = json.load(f)
        else:
            self._comparison_data = {}

    def get_kmeans_hotspots(self, k: int = 10, state: Optional[str] = None) -> Dict[str, Any]:
        st = state.upper() if state and state.upper() != "ALL" else "ALL"

        scope_data = None
        if self._kmeans_data:
            if "by_state" in self._kmeans_data and st in self._kmeans_data["by_state"]:
                scope_data = self._kmeans_data["by_state"][st]
            elif st == "ALL":
                scope_data = self._kmeans_data.get("by_state", {}).get("ALL", self._kmeans_data)

        if scope_data:
            key = f"k_{k}"
            if key in scope_data:
                entry = scope_data[key]
                return {
                    "algorithm": "K-Means",
                    "k": entry.get("k", k),
                    "inertia": entry.get("inertia", 0.0),
                    "total_clusters": len(entry.get("clusters", [])),
                    "clusters": entry.get("clusters", [])
                }
            # Fallback to closest available k in scope
            avail = [k_entry for k_entry in scope_data.keys() if k_entry.startswith("k_")]
            if avail:
                first_entry = scope_data[avail[0]]
                return {
                    "algorithm": "K-Means",
                    "k": first_entry.get("k", k),
                    "inertia": first_entry.get("inertia", 0.0),
                    "total_clusters": len(first_entry.get("clusters", [])),
                    "clusters": first_entry.get("clusters", [])
                }

        # Dynamic computation if not precomputed
        return self._compute_dynamic_kmeans(k=k, state=st)

    def get_dbscan_hotspots(
        self,
        state: Optional[str] = None,
        eps_km: Optional[float] = None,
        min_samples: Optional[int] = None
    ) -> Dict[str, Any]:
        st = state.upper() if state and state.upper() != "ALL" else "ALL"

        # If custom parameters requested, compute dynamically
        if eps_km is not None or min_samples is not None:
            return self._compute_dynamic_dbscan(
                state=st,
                eps_km=eps_km or 8.5,
                min_samples=min_samples or 20
            )

        # Use precomputed artifact if available
        if self._dbscan_data:
            if "by_state" in self._dbscan_data and st in self._dbscan_data["by_state"]:
                return self._dbscan_data["by_state"][st]
            if st == "ALL":
                if "by_state" in self._dbscan_data and "ALL" in self._dbscan_data["by_state"]:
                    return self._dbscan_data["by_state"]["ALL"]
                top_level = {k: v for k, v in self._dbscan_data.items() if k != "by_state"}
                return top_level

        # Fallback to dynamic computation
        return self._compute_dynamic_dbscan(state=st, eps_km=8.5, min_samples=20)

    def _compute_dynamic_kmeans(self, k: int, state: str) -> Dict[str, Any]:
        from server.app.services.data_service import DataService
        df = DataService.get_instance()._df
        if df is None or df.empty:
            return {"algorithm": "K-Means", "k": k, "inertia": 0.0, "total_clusters": 0, "clusters": []}

        sub = df if state == "ALL" else df[df["State"] == state]
        if sub.empty:
            return {"algorithm": "K-Means", "k": k, "inertia": 0.0, "total_clusters": 0, "clusters": []}

        actual_k = min(k, len(sub))
        if actual_k <= 0:
            return {"algorithm": "K-Means", "k": k, "inertia": 0.0, "total_clusters": 0, "clusters": []}

        coords = sub[["Start_Lat", "Start_Lng"]].values
        km = KMeans(n_clusters=actual_k, random_state=42, n_init=5)
        km.fit(coords)
        inertia = float(km.inertia_)
        labels = km.labels_
        centers = km.cluster_centers_

        clusters_info = []
        n_points = len(sub)
        for c_idx in range(actual_k):
            mask = (labels == c_idx)
            cluster_pts = sub[mask]
            c_lat, c_lng = centers[c_idx]

            dominant_city = cluster_pts["City"].mode()[0] if not cluster_pts.empty and "City" in cluster_pts.columns else "Unknown"
            dom_state = cluster_pts["State"].mode()[0] if not cluster_pts.empty and "State" in cluster_pts.columns else state
            avg_sev = float(cluster_pts["Severity"].mean()) if not cluster_pts.empty else 2.0

            dist_km = haversine_vectorized(c_lat, c_lng, cluster_pts["Start_Lat"].values, cluster_pts["Start_Lng"].values) if len(cluster_pts) > 0 else np.array([0.0])

            clusters_info.append({
                "cluster_id": c_idx,
                "center_lat": round(float(c_lat), 5),
                "center_lng": round(float(c_lng), 5),
                "accident_count": int(mask.sum()),
                "accident_percentage": round(float(mask.sum() / n_points * 100), 2),
                "average_severity": round(avg_sev, 2),
                "spread_radius_km": round(float(np.mean(dist_km)), 2),
                "dominant_city": str(dominant_city),
                "state": str(dom_state)
            })

        clusters_info.sort(key=lambda x: x["accident_count"], reverse=True)
        return {
            "algorithm": "K-Means",
            "k": actual_k,
            "inertia": round(inertia, 2),
            "total_clusters": len(clusters_info),
            "clusters": clusters_info
        }

    def _compute_dynamic_dbscan(self, state: str, eps_km: float, min_samples: int) -> Dict[str, Any]:
        from server.app.services.data_service import DataService
        df = DataService.get_instance()._df
        if df is None or df.empty:
            return {
                "algorithm": "DBSCAN", "distance_metric": "Haversine", "parameters": {"eps_km": eps_km, "min_samples": min_samples},
                "total_analyzed_points": 0, "identified_clusters_count": 0, "clustered_points_count": 0, "noise_points_count": 0, "noise_percentage": 0.0, "clusters": []
            }

        sub = df if state == "ALL" else df[df["State"] == state]
        n_points = len(sub)

        if n_points < min_samples:
            return {
                "algorithm": "DBSCAN",
                "distance_metric": "Haversine (Great-Circle Spherical Distance)",
                "parameters": {"eps_km": eps_km, "min_samples": min_samples},
                "total_analyzed_points": n_points,
                "identified_clusters_count": 0,
                "clustered_points_count": 0,
                "noise_points_count": n_points,
                "noise_percentage": 100.0,
                "clusters": [],
                "status_message": f"Insufficient incident density in {state} to meet threshold ({n_points} incidents < {min_samples} required)."
            }

        coords = sub[["Start_Lat", "Start_Lng"]].values
        coords_rad = np.radians(coords)
        eps_rad = km_to_radians(eps_km)

        dbscan = DBSCAN(eps=eps_rad, min_samples=min_samples, metric="haversine", algorithm="ball_tree")
        db_labels = dbscan.fit_predict(coords_rad)

        unique_labels = sorted(list(set(db_labels) - {-1}))
        n_clusters = len(unique_labels)
        noise_count = int(np.sum(db_labels == -1))
        noise_pct = round(float(noise_count / n_points * 100), 2)
        clustered_count = n_points - noise_count

        dbscan_clusters = []
        for c_id in unique_labels:
            mask = (db_labels == c_id)
            cluster_pts = sub[mask]

            c_lat = float(cluster_pts["Start_Lat"].mean())
            c_lng = float(cluster_pts["Start_Lng"].mean())
            dominant_city = cluster_pts["City"].mode()[0] if "City" in cluster_pts.columns else "Unknown"
            dom_state = cluster_pts["State"].mode()[0] if "State" in cluster_pts.columns else state
            avg_sev = float(cluster_pts["Severity"].mean())

            dist_km = haversine_vectorized(c_lat, c_lng, cluster_pts["Start_Lat"].values, cluster_pts["Start_Lng"].values)

            dbscan_clusters.append({
                "cluster_id": int(c_id),
                "center_lat": round(c_lat, 5),
                "center_lng": round(c_lng, 5),
                "accident_count": int(mask.sum()),
                "accident_percentage": round(float(mask.sum() / n_points * 100), 2),
                "average_severity": round(avg_sev, 2),
                "spread_radius_km": round(float(np.mean(dist_km)), 2),
                "dominant_city": str(dominant_city),
                "state": str(dom_state)
            })

        dbscan_clusters.sort(key=lambda x: x["accident_count"], reverse=True)
        return {
            "algorithm": "DBSCAN (Density-Based Spatial Clustering of Applications with Noise)",
            "distance_metric": "Haversine (Great-Circle Spherical Distance)",
            "parameters": {
                "eps_km": eps_km,
                "eps_radians": round(eps_rad, 6),
                "min_samples": min_samples
            },
            "total_analyzed_points": n_points,
            "identified_clusters_count": n_clusters,
            "clustered_points_count": clustered_count,
            "noise_points_count": noise_count,
            "noise_percentage": noise_pct,
            "clusters": dbscan_clusters
        }

    def get_clustering_comparison(self) -> Dict[str, Any]:
        return self._comparison_data or {}


