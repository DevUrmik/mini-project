"""
Hotspot Service: Serves precomputed K-Means and DBSCAN Spatial Clusters
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional

from server.app.config import (
    HOTSPOTS_KMEANS_PATH,
    HOTSPOTS_DBSCAN_PATH,
    MODELS_DIR
)

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

    def get_kmeans_hotspots(self, k: int = 10) -> Dict[str, Any]:
        key = f"k_{k}"
        if self._kmeans_data and key in self._kmeans_data:
            entry = self._kmeans_data[key]
            return {
                "algorithm": "K-Means",
                "k": k,
                "inertia": entry["inertia"],
                "total_clusters": len(entry["clusters"]),
                "clusters": entry["clusters"]
            }
        
        # Fallback to closest available k
        if self._kmeans_data:
            available_k = list(self._kmeans_data.keys())
            first_entry = self._kmeans_data[available_k[0]]
            return {
                "algorithm": "K-Means",
                "k": first_entry["k"],
                "inertia": first_entry["inertia"],
                "total_clusters": len(first_entry["clusters"]),
                "clusters": first_entry["clusters"]
            }

        return {"algorithm": "K-Means", "k": k, "inertia": 0.0, "total_clusters": 0, "clusters": []}

    def get_dbscan_hotspots(self) -> Dict[str, Any]:
        if self._dbscan_data:
            return self._dbscan_data
        return {
            "algorithm": "DBSCAN",
            "distance_metric": "Haversine",
            "parameters": {},
            "total_analyzed_points": 0,
            "identified_clusters_count": 0,
            "clustered_points_count": 0,
            "noise_points_count": 0,
            "noise_percentage": 0.0,
            "clusters": []
        }

    def get_clustering_comparison(self) -> Dict[str, Any]:
        return self._comparison_data or {}

