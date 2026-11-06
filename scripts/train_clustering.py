"""
Accident Hotspot Identification: K-Means & DBSCAN Spatial Clustering

Key Concepts for Machine Learning Viva:
1. Haversine Metric:
   - Latitude/Longitude are angular coordinates on a sphere.
   - Euclidean distance d = sqrt(dx^2 + dy^2) ignores Earth's curvature and causes distortion.
   - Haversine computes true great-circle distance: d = 2 * R * arcsin(sqrt(...)).
   - For Scikit-Learn DBSCAN with metric='haversine', coordinates MUST be in radians,
     and epsilon MUST be in radians (eps_rad = eps_km / R).

2. Hotspot Interpretation:
   - Hotspots represent historical spatial concentrations of recorded accidents.
   - They do not definitively prove road defects without traffic exposure normalization (VMT).
"""

import sys
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server.app.config import (
    CALIFORNIA_DATA_PATH,
    CLEANED_DATA_PATH,
    HOTSPOTS_KMEANS_PATH,
    HOTSPOTS_DBSCAN_PATH,
    MODELS_DIR
)
from server.app.ml.haversine import EARTH_RADIUS_KM, km_to_radians, haversine_vectorized

def train_spatial_clustering(max_points: int = 20000):
    print("=" * 70)
    print("ACCIDENT HOTSPOT CLUSTERING PIPELINE (K-MEANS & DBSCAN)")
    print("=" * 70)

    # 1. Load data
    data_path = CALIFORNIA_DATA_PATH if CALIFORNIA_DATA_PATH.exists() else CLEANED_DATA_PATH
    print(f"[DATA] Loading coordinates from {data_path}...")
    df = pd.read_csv(data_path)
    print(f"Total available records: {len(df):,}")

    # Subsample if dataset is large to guarantee fast Haversine BallTree execution
    if len(df) > max_points:
        print(f"Subsampling {max_points:,} records for fast clustering...")
        sample_df = df.sample(n=max_points, random_state=42).copy()
    else:
        sample_df = df.copy()

    coords = sample_df[["Start_Lat", "Start_Lng"]].values
    coords_rad = np.radians(coords)

    # =========================================================================
    # TASK 1: K-MEANS CLUSTERING
    # =========================================================================
    print("\n[TASK 1/2] Running K-Means Clustering for multiple K values...")
    k_values = [5, 8, 10, 15, 20]
    kmeans_results = {}
    
    for k in k_values:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        km.fit(coords)
        inertia = float(km.inertia_)
        
        # Calculate cluster properties
        labels = km.labels_
        centers = km.cluster_centers_
        
        clusters_info = []
        for c_idx in range(k):
            mask = (labels == c_idx)
            cluster_pts = sample_df[mask]
            c_lat, c_lng = centers[c_idx]
            
            # Approximate dominant city & severity
            dominant_city = cluster_pts["City"].mode()[0] if not cluster_pts.empty and "City" in cluster_pts.columns else "Unknown"
            avg_sev = float(cluster_pts["Severity"].mean()) if not cluster_pts.empty else 2.0
            
            # Compute spread (mean distance from center in km)
            if len(cluster_pts) > 0:
                dist_km = haversine_vectorized(
                    c_lat, c_lng,
                    cluster_pts["Start_Lat"].values,
                    cluster_pts["Start_Lng"].values
                )
                spread_km = float(np.mean(dist_km))
            else:
                spread_km = 0.0
                
            clusters_info.append({
                "cluster_id": c_idx,
                "center_lat": round(float(c_lat), 5),
                "center_lng": round(float(c_lng), 5),
                "accident_count": int(mask.sum()),
                "accident_percentage": round(float(mask.sum() / len(sample_df) * 100), 2),
                "average_severity": round(avg_sev, 2),
                "spread_radius_km": round(spread_km, 2),
                "dominant_city": str(dominant_city)
            })
            
        # Sort by accident count descending
        clusters_info.sort(key=lambda x: x["accident_count"], reverse=True)
        
        kmeans_results[f"k_{k}"] = {
            "k": k,
            "inertia": round(inertia, 2),
            "clusters": clusters_info
        }
        print(f"  - K = {k:2d} | Inertia: {inertia:10.2f} | Largest Cluster: {clusters_info[0]['accident_count']} accidents ({clusters_info[0]['dominant_city']})")

    # =========================================================================
    # TASK 2: DBSCAN CLUSTERING WITH HAVERSINE METRIC
    # =========================================================================
    print("\n[TASK 2/2] Running DBSCAN with Haversine spherical distance metric...")
    # Target parameter: Epsilon = 7.5 km (~4.6 miles), min_samples = 35 points
    eps_km = 7.5
    eps_rad = km_to_radians(eps_km)
    min_samples = 35

    print(f"  Parameters: eps = {eps_km} km ({eps_rad:.6f} radians), min_samples = {min_samples}")
    dbscan = DBSCAN(eps=eps_rad, min_samples=min_samples, metric="haversine", algorithm="ball_tree")
    db_labels = dbscan.fit_predict(coords_rad)

    unique_labels = set(db_labels)
    n_clusters = len(unique_labels - {-1})
    noise_count = int(np.sum(db_labels == -1))
    noise_pct = round(float(noise_count / len(sample_df) * 100), 2)
    clustered_count = len(sample_df) - noise_count

    print(f"  Result: {n_clusters} dense spatial clusters found, {noise_count} noise/outlier points ({noise_pct}%).")

    dbscan_clusters = []
    for c_id in sorted(list(unique_labels - {-1})):
        mask = (db_labels == c_id)
        cluster_pts = sample_df[mask]
        
        c_lat = float(cluster_pts["Start_Lat"].mean())
        c_lng = float(cluster_pts["Start_Lng"].mean())
        dominant_city = cluster_pts["City"].mode()[0] if "City" in cluster_pts.columns else "Unknown"
        avg_sev = float(cluster_pts["Severity"].mean())
        
        # Cluster bounding radius
        dist_km = haversine_vectorized(
            c_lat, c_lng,
            cluster_pts["Start_Lat"].values,
            cluster_pts["Start_Lng"].values
        )
        spread_km = float(np.mean(dist_km))
        
        dbscan_clusters.append({
            "cluster_id": int(c_id),
            "center_lat": round(c_lat, 5),
            "center_lng": round(c_lng, 5),
            "accident_count": int(mask.sum()),
            "accident_percentage": round(float(mask.sum() / len(sample_df) * 100), 2),
            "average_severity": round(avg_sev, 2),
            "spread_radius_km": round(spread_km, 2),
            "dominant_city": str(dominant_city)
        })

    dbscan_clusters.sort(key=lambda x: x["accident_count"], reverse=True)

    dbscan_summary = {
        "algorithm": "DBSCAN (Density-Based Spatial Clustering of Applications with Noise)",
        "distance_metric": "Haversine (Great-Circle Spherical Distance)",
        "parameters": {
            "eps_km": eps_km,
            "eps_radians": round(eps_rad, 6),
            "min_samples": min_samples
        },
        "total_analyzed_points": len(sample_df),
        "identified_clusters_count": n_clusters,
        "clustered_points_count": clustered_count,
        "noise_points_count": noise_count,
        "noise_percentage": noise_pct,
        "clusters": dbscan_clusters
    }

    # =========================================================================
    # TASK 3: ALGORITHM COMPARISON
    # =========================================================================
    comparison = {
        "k_means": {
            "name": "K-Means",
            "distance_assumption": "Euclidean on geographic coordinate plane (Cartesian approximation)",
            "cluster_geometry": "Convex, spherical clusters around centroids",
            "noise_handling": "Forces all outliers into the nearest centroid",
            "hyperparameters": "K (number of clusters must be chosen a priori)",
            "computational_speed": "Fast O(n * K * i)",
            "primary_use_case": "Partitioning entire geography into administrative or operational service zones"
        },
        "dbscan": {
            "name": "DBSCAN",
            "distance_assumption": "True Haversine spherical distance on Earth's surface",
            "cluster_geometry": "Arbitrary geometric shapes following actual freeway corridors and intersections",
            "noise_handling": f"Explicitly separates isolated rural accidents as noise ({noise_pct}% isolated)",
            "hyperparameters": "Epsilon (search radius) and MinPts (density threshold)",
            "computational_speed": "Requires BallTree spatial indexing O(n log n)",
            "primary_use_case": "Pinpointing genuine high-density accident corridors and dense highway blackspots"
        }
    }

    # Export artifacts
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with open(HOTSPOTS_KMEANS_PATH, "w") as f:
        json.dump(kmeans_results, f, indent=2)
        
    with open(HOTSPOTS_DBSCAN_PATH, "w") as f:
        json.dump(dbscan_summary, f, indent=2)
        
    with open(MODELS_DIR / "clustering_comparison.json", "w") as f:
        json.dump(comparison, f, indent=2)

    print("\n" + "=" * 70)
    print(f"[SUCCESS] Spatial Clustering complete.")
    print(f"- K-Means models saved: {HOTSPOTS_KMEANS_PATH}")
    print(f"- DBSCAN model saved: {HOTSPOTS_DBSCAN_PATH}")
    print(f"- Comparison saved: {MODELS_DIR / 'clustering_comparison.json'}")
    print("=" * 70)

if __name__ == "__main__":
    train_spatial_clustering()

