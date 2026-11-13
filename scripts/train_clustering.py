"""
Accident Hotspot Identification: Nationwide K-Means & DBSCAN Spatial Clustering
Trained on the genuine multi-state 7.7M US Accidents spatial sample (193,209 records).
Supports ALL 49 states with nationwide clustering and per-state partitions.
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

def cluster_subset(df_subset: pd.DataFrame, scope_name: str, k_list: list, eps_km: float = 12.0, min_samples: int = 35):
    coords = df_subset[["Start_Lat", "Start_Lng"]].values
    coords_rad = np.radians(coords)
    n_points = len(df_subset)

    # 1. K-Means
    kmeans_results = {}
    for k in k_list:
        actual_k = min(k, n_points)
        km = KMeans(n_clusters=actual_k, random_state=42, n_init=10)
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

def train_spatial_clustering():
    print("=" * 70)
    print("NATIONWIDE ACCIDENT HOTSPOT CLUSTERING (K-MEANS & DBSCAN)")
    print("=" * 70)

    # 1. Load data: prioritize spatial parquet
    if SPATIAL_PARQUET_PATH.exists():
        print(f"[DATA] Loading verified nationwide spatial sample from {SPATIAL_PARQUET_PATH}...")
        df = pd.read_parquet(SPATIAL_PARQUET_PATH)
    elif SPATIAL_CSV_PATH.exists():
        print(f"[DATA] Loading verified spatial sample from {SPATIAL_CSV_PATH}...")
        df = pd.read_csv(SPATIAL_CSV_PATH)
    else:
        print(f"[DATA] Loading cleaned dataset from {CLEANED_DATA_PATH}...")
        df = pd.read_csv(CLEANED_DATA_PATH)

    print(f"Total available spatial records: {len(df):,}")
    print(f"Total unique states represented: {df['State'].nunique()}")

    # For nationwide DBSCAN, sample up to 45,000 points to keep BallTree distance matrix fast & memory-safe
    df_all_sample = df.sample(n=min(len(df), 45000), random_state=42)
    print("\n--- Clustering ALL states (Nationwide Continental US) ---")
    km_all, db_all = cluster_subset(df_all_sample, "ALL", [5, 8, 10, 15, 20], eps_km=14.0, min_samples=40)
    print(f"ALL: DBSCAN discovered {db_all['identified_clusters_count']} major metropolitan corridors nationwide.")

    by_state_km = {"ALL": km_all}
    by_state_db = {"ALL": db_all}

    # State specific clustering for top states with substantial accident volumes
    top_states = [
        ("CA", 30, [5, 8, 10, 15]),
        ("FL", 25, [4, 6, 8, 12]),
        ("TX", 25, [4, 6, 8, 12]),
        ("NY", 20, [3, 5, 8]),
        ("PA", 20, [3, 5, 8]),
        ("NC", 20, [3, 5, 8]),
        ("SC", 20, [3, 5, 8]),
        ("VA", 20, [3, 5, 8]),
        ("IL", 20, [3, 5, 8]),
        ("GA", 20, [3, 5, 8]),
        ("OH", 20, [3, 5, 8]),
        ("MI", 20, [3, 5, 8]),
        ("AZ", 15, [2, 4, 6]),
        ("MN", 15, [2, 4, 6]),
        ("OR", 15, [2, 4, 6]),
        ("WA", 15, [2, 4, 6]),
        ("TN", 15, [2, 4, 6]),
    ]

    for state, min_pts, k_list in top_states:
        sub = df[df["State"] == state]
        if len(sub) < 50:
            continue
        # Limit sub sample if very large
        if len(sub) > 15000:
            sub = sub.sample(n=15000, random_state=42)
        print(f"--- Clustering state: {state} ({len(sub):,} records) ---")
        km_s, db_s = cluster_subset(sub, state, k_list, eps_km=8.0, min_samples=min_pts)
        by_state_km[state] = km_s
        by_state_db[state] = db_s
        print(f"  {state}: DBSCAN found {db_s['identified_clusters_count']} clusters.")

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

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    with open(HOTSPOTS_KMEANS_PATH, "w") as f:
        json.dump(combined_kmeans, f, indent=2)

    with open(HOTSPOTS_DBSCAN_PATH, "w") as f:
        json.dump(combined_dbscan, f, indent=2)

    with open(MODELS_DIR / "clustering_comparison.json", "w") as f:
        json.dump(comparison, f, indent=2)

    # Sync to alternate models directory if different
    server_models_dir = REPO_ROOT / "server" / "models"
    repo_models_dir = REPO_ROOT / "models"
    alt_models_dir = repo_models_dir if MODELS_DIR.resolve() == server_models_dir.resolve() else server_models_dir
    alt_models_dir.mkdir(parents=True, exist_ok=True)
    for f_path in [HOTSPOTS_KMEANS_PATH, HOTSPOTS_DBSCAN_PATH, MODELS_DIR / "clustering_comparison.json"]:
        dest = alt_models_dir / f_path.name
        if f_path.resolve() != dest.resolve():
            shutil.copy2(f_path, dest)
    print(f"[SYNC] Mirrored clustering artifacts to {alt_models_dir}")

    print("\n" + "=" * 70)
    print("[SUCCESS] Multi-state spatial clustering complete.")
    print(f"- K-Means models saved: {HOTSPOTS_KMEANS_PATH}")
    print(f"- DBSCAN model saved: {HOTSPOTS_DBSCAN_PATH}")
    print("=" * 70)

if __name__ == "__main__":
    train_spatial_clustering()
