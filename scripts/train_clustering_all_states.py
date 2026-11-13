"""
Comprehensive Nationwide & All-State Hotspot Clustering (K-Means & DBSCAN)
Precomputes spatial clustering for ALL 49 US States + DC.
Distinguishes states with high corridor density from sparse rural states with insufficient density.
Ensures zero missing-state errors and enables configurable parameters.
"""

import sys
import json
import shutil
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from server.app.config import (
    SPATIAL_PARQUET_PATH,
    SPATIAL_CSV_PATH,
    CLEANED_DATA_PATH,
    HOTSPOTS_KMEANS_PATH,
    HOTSPOTS_DBSCAN_PATH,
    MODELS_DIR
)
from server.app.ml.haversine import km_to_radians, haversine_vectorized

def cluster_subset(df_subset: pd.DataFrame, scope_name: str, k_list: list, eps_km: float = 8.5, min_samples: int = 20):
    coords = df_subset[["Start_Lat", "Start_Lng"]].values
    coords_rad = np.radians(coords)
    n_points = len(df_subset)

    # 1. K-Means
    kmeans_results = {}
    for k in k_list:
        actual_k = min(k, n_points)
        if actual_k <= 0:
            continue
        km = KMeans(n_clusters=actual_k, random_state=42, n_init=5)
        km.fit(coords)
        inertia = float(km.inertia_)
        labels = km.labels_
        centers = km.cluster_centers_

        clusters_info = []
        for c_idx in range(actual_k):
            mask = (labels == c_idx)
            cluster_pts = df_subset[mask]
            c_lat, c_lng = centers[c_idx]

            dominant_city = cluster_pts["City"].mode()[0] if not cluster_pts.empty and "City" in cluster_pts.columns else "Unknown"
            dom_state = cluster_pts["State"].mode()[0] if not cluster_pts.empty and "State" in cluster_pts.columns else scope_name
            avg_sev = float(cluster_pts["Severity"].mean()) if not cluster_pts.empty else 2.0

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
                "accident_percentage": round(float(mask.sum() / n_points * 100), 2),
                "average_severity": round(avg_sev, 2),
                "spread_radius_km": round(spread_km, 2),
                "dominant_city": str(dominant_city),
                "state": str(dom_state)
            })

        clusters_info.sort(key=lambda x: x["accident_count"], reverse=True)
        kmeans_results[f"k_{k}"] = {
            "k": actual_k,
            "inertia": round(inertia, 2),
            "clusters": clusters_info
        }

    # 2. DBSCAN with Haversine metric
    if n_points < min_samples:
        # Sparse state: insufficient points to meet density threshold
        return kmeans_results, {
            "algorithm": "DBSCAN (Density-Based Spatial Clustering of Applications with Noise)",
            "distance_metric": "Haversine (Great-Circle Spherical Distance)",
            "parameters": {
                "eps_km": eps_km,
                "eps_radians": round(km_to_radians(eps_km), 6),
                "min_samples": min_samples
            },
            "total_analyzed_points": n_points,
            "identified_clusters_count": 0,
            "clustered_points_count": 0,
            "noise_points_count": n_points,
            "noise_percentage": 100.0,
            "clusters": [],
            "status_message": f"Insufficient spatial incident density for corridor clusters ({n_points} incidents < {min_samples} min threshold). All incidents are spatially isolated."
        }

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
        cluster_pts = df_subset[mask]

        c_lat = float(cluster_pts["Start_Lat"].mean())
        c_lng = float(cluster_pts["Start_Lng"].mean())
        dominant_city = cluster_pts["City"].mode()[0] if "City" in cluster_pts.columns else "Unknown"
        dom_state = cluster_pts["State"].mode()[0] if "State" in cluster_pts.columns else scope_name
        avg_sev = float(cluster_pts["Severity"].mean())

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
            "accident_percentage": round(float(mask.sum() / n_points * 100), 2),
            "average_severity": round(avg_sev, 2),
            "spread_radius_km": round(spread_km, 2),
            "dominant_city": str(dominant_city),
            "state": str(dom_state)
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
        "total_analyzed_points": n_points,
        "identified_clusters_count": n_clusters,
        "clustered_points_count": clustered_count,
        "noise_points_count": noise_count,
        "noise_percentage": noise_pct,
        "clusters": dbscan_clusters
    }

    return kmeans_results, dbscan_summary

def run_all_state_clustering():
    print("=" * 80)
    print("PRECOMPUTING NATIONWIDE & ALL-STATE CLUSTERING (49 STATES + DC)")
    print("=" * 80)

    # 1. Load Data
    data_path = SPATIAL_PARQUET_PATH if SPATIAL_PARQUET_PATH.exists() else CLEANED_DATA_PATH
    print(f"Loading spatial records from {data_path}...")
    df = pd.read_parquet(data_path) if str(data_path).endswith(".parquet") else pd.read_csv(data_path)
    all_states = sorted(df["State"].unique().tolist())
    print(f"Total spatial records: {len(df):,} across {len(all_states)} states: {', '.join(all_states)}")

    # 2. Nationwide Clustering
    print("\n--- Clustering ALL (Continental US Nationwide View) ---")
    df_all_sample = df.sample(n=min(len(df), 45000), random_state=42)
    km_all, db_all = cluster_subset(df_all_sample, "ALL", [5, 8, 10, 15, 20], eps_km=14.0, min_samples=40)
    print(f"Nationwide DBSCAN discovered {db_all['identified_clusters_count']} major metropolitan corridors.")

    by_state_km = {"ALL": km_all}
    by_state_db = {"ALL": db_all}

    # 3. Iterate over ALL 49 States + DC
    print("\n--- Computing State-by-State Clustering Partitions ---")
    for st in all_states:
        sub = df[df["State"] == st]
        n_sub = len(sub)

        # Cap very large states to 15,000 to keep BallTree fast
        if n_sub > 15000:
            sub = sub.sample(n=15000, random_state=42)

        # Adaptive parameters
        if n_sub >= 5000:
            min_pts = 25
            k_list = [5, 8, 10, 15]
            eps = 8.0
        elif n_sub >= 1000:
            min_pts = 18
            k_list = [3, 5, 8, 10]
            eps = 8.5
        elif n_sub >= 250:
            min_pts = 12
            k_list = [2, 4, 6]
            eps = 9.0
        elif n_sub >= 50:
            min_pts = 8
            k_list = [2, 3, 5]
            eps = 10.0
        else:
            # Sparse state (e.g. VT with 17, SD with 5)
            min_pts = 10
            k_list = [1, 2]
            eps = 12.0

        km_s, db_s = cluster_subset(sub, st, k_list, eps_km=eps, min_samples=min_pts)
        by_state_km[st] = km_s
        by_state_db[st] = db_s
        cluster_count = db_s["identified_clusters_count"]
        print(f"  {st:<3}: {n_sub:>5} pts -> DBSCAN: {cluster_count:>2} clusters | K-Means: k={k_list}")

    combined_dbscan = dict(db_all)
    combined_dbscan["by_state"] = by_state_db

    combined_kmeans = dict(km_all)
    combined_kmeans["by_state"] = by_state_km

    comparison = {
        "k_means": {
            "name": "K-Means",
            "distance_assumption": "Euclidean on geographic coordinate plane",
            "cluster_geometry": "Convex, spherical clusters around centroids",
            "noise_handling": "Forces all outliers into the nearest centroid",
            "hyperparameters": "K (number of regional partitions)",
            "computational_speed": "Fast O(n * K * i)",
            "primary_use_case": "Partitioning multi-state or statewide geography into administrative patrol zones"
        },
        "dbscan": {
            "name": "DBSCAN",
            "distance_assumption": "True Haversine spherical distance on Earth's surface",
            "cluster_geometry": "Arbitrary geometric corridors following actual highway networks",
            "noise_handling": f"Separates isolated rural accidents as noise ({db_all['noise_percentage']}% nationwide)",
            "hyperparameters": "Epsilon (great-circle radius) and MinPts (density threshold)",
            "computational_speed": "BallTree spatial indexing O(n log n)",
            "primary_use_case": "Pinpointing genuine high-density accident corridors and urban blackspots"
        }
    }

    # Save to both repo and server models directories
    repo_models_dir = REPO_ROOT / "models"
    server_models_dir = REPO_ROOT / "server" / "models"
    for d in [repo_models_dir, server_models_dir]:
        d.mkdir(parents=True, exist_ok=True)
        with open(d / "hotspots_kmeans.json", "w") as f:
            json.dump(combined_kmeans, f, indent=2)
        with open(d / "hotspots_dbscan.json", "w") as f:
            json.dump(combined_dbscan, f, indent=2)
        with open(d / "clustering_comparison.json", "w") as f:
            json.dump(comparison, f, indent=2)

    print("\n" + "=" * 80)
    print(f"[SUCCESS] All {len(all_states)} states + DC precomputed and persisted.")
    print("=" * 80)

if __name__ == "__main__":
    run_all_state_clustering()

