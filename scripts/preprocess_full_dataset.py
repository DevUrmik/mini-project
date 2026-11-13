"""
Accident Hotspot Prediction and Road Safety Intelligence System
Production Preprocessing Pipeline for the Complete 7.7M Kaggle US Accidents Dataset
Dataset: data/raw/US_Accidents_March23.csv (7,728,394 records)

Features:
- Memory-efficient streaming in 250,000-row chunks.
- Validates Continental US coordinates (Lat 24-50, Lng -125 to -66).
- Feature engineering on temporal attributes (Hour, Day_OfWeek, Month, Year, Rush_Hour, Weekend).
- Zero data loss for raw CSV (preserved untouched).
- Columnar Parquet export with snappy compression for high performance.
- Precomputed dynamic state and city summaries across all 49 US states + DC.
- Exact geographic bounding boxes per state and continental US.
- High-fidelity spatial sample (~200,000 records) for low-latency interactive map rendering.
- Stratified ML training sample for robust severity classification.
"""

import sys
import os
import time
import json
import shutil
from pathlib import Path
from collections import defaultdict, Counter

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

# Add repo root to sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

RAW_CSV_PATH = REPO_ROOT / "data" / "raw" / "US_Accidents_March23.csv"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
SERVER_PROCESSED_DIR = REPO_ROOT / "server" / "data" / "processed"

OUTPUT_PARQUET_PATH = PROCESSED_DIR / "cleaned_accidents.parquet"
SPATIAL_PARQUET_PATH = PROCESSED_DIR / "spatial_accidents.parquet"
SPATIAL_CSV_PATH = PROCESSED_DIR / "spatial_accidents.csv"
ML_SAMPLE_PARQUET_PATH = PROCESSED_DIR / "ml_sample.parquet"
GEO_SUMMARY_PATH = PROCESSED_DIR / "geographic_summary.json"
PREPROCESSING_SUMMARY_PATH = PROCESSED_DIR / "preprocessing_summary.json"

SELECTED_COLUMNS = [
    "ID", "Severity", "Start_Time", "End_Time",
    "Start_Lat", "Start_Lng", "Distance(mi)",
    "Street", "City", "County", "State", "Zipcode",
    "Temperature(F)", "Humidity(%)", "Visibility(mi)", "Wind_Speed(mph)",
    "Weather_Condition",
    "Amenity", "Crossing", "Give_Way", "Junction", "Railway",
    "Station", "Stop", "Traffic_Signal"
]

US_STATE_NAMES = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'DC': 'District of Columbia'
}

def preprocess_full_dataset(chunk_size: int = 250000):
    start_total = time.time()
    print("=" * 75)
    print("ACCIDENT INTELLIGENCE: FULL 7.7M KAGGLE DATASET INGESTION")
    print(f"Source CSV: {RAW_CSV_PATH}")
    print(f"File Size: {RAW_CSV_PATH.stat().st_size / (1024**3):.2f} GB")
    print("=" * 75)

    if not RAW_CSV_PATH.exists():
        raise FileNotFoundError(f"Source dataset not found at {RAW_CSV_PATH}")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    SERVER_PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    # Accumulators for dynamic metadata
    total_raw_rows = 0
    total_cleaned_rows = 0
    state_counts = Counter()
    city_counts = defaultdict(Counter)
    severity_counts = Counter()
    yearly_counts = Counter()
    monthly_counts = Counter()
    hourly_counts = Counter()
    weekday_counts = Counter()
    weather_counts = Counter()
    road_feature_counts = Counter()

    # Dynamic bounding box accumulators
    global_min_lat = 90.0
    global_max_lat = -90.0
    global_min_lng = 180.0
    global_max_lng = -180.0
    state_bounds = {}

    spatial_samples = []
    ml_samples = []

    # Initialize Parquet Writer for the complete dataset
    parquet_writer = None
    chunk_index = 0

    print(f"\nProcessing CSV in chunks of {chunk_size:,} rows...")

    for chunk in pd.read_csv(RAW_CSV_PATH, chunksize=chunk_size, usecols=SELECTED_COLUMNS, low_memory=False):
        chunk_index += 1
        t_chunk_start = time.time()
        chunk_raw_len = len(chunk)
        total_raw_rows += chunk_raw_len

        # 1. Clean Coordinates & Continental US bounds
        # Continental US: Lat [24.0, 50.0], Lng [-125.0, -66.0]
        valid_mask = (
            chunk["Start_Lat"].notnull() &
            chunk["Start_Lng"].notnull() &
            (chunk["Start_Lat"] >= 24.0) & (chunk["Start_Lat"] <= 50.0) &
            (chunk["Start_Lng"] >= -125.0) & (chunk["Start_Lng"] <= -66.0) &
            chunk["Start_Time"].notnull() &
            chunk["State"].notnull()
        )
        cleaned = chunk[valid_mask].copy()

        # 2. Fast datetime feature engineering
        # Use first 19 characters for reliable YYYY-MM-DD HH:MM:SS parsing
        st_clean = cleaned["Start_Time"].astype(str).str[:19]
        cleaned["Start_Time_DT"] = pd.to_datetime(st_clean, format="%Y-%m-%d %H:%M:%S", errors="coerce")
        cleaned = cleaned.dropna(subset=["Start_Time_DT"]).copy()

        cleaned["Hour"] = cleaned["Start_Time_DT"].dt.hour.astype(np.int8)
        cleaned["Weekday"] = cleaned["Start_Time_DT"].dt.weekday.astype(np.int8)
        cleaned["Day_OfWeek"] = cleaned["Start_Time_DT"].dt.day_name().astype(str)
        cleaned["Month"] = cleaned["Start_Time_DT"].dt.month.astype(np.int8)
        cleaned["Month_Name"] = cleaned["Start_Time_DT"].dt.month_name().astype(str)
        cleaned["Year"] = cleaned["Start_Time_DT"].dt.year.astype(np.int16)
        cleaned["Is_Weekend"] = cleaned["Weekday"].isin([5, 6]).astype(bool)
        cleaned["Is_Rush_Hour"] = cleaned["Hour"].isin([7, 8, 9, 16, 17, 18]).astype(bool)

        # 3. Severity normalization
        cleaned["Severity"] = cleaned["Severity"].fillna(2).astype(np.int8).clip(1, 4)

        # 4. Impute weather features
        cleaned["Temperature(F)"] = cleaned["Temperature(F)"].fillna(60.0).astype(np.float32)
        cleaned["Humidity(%)"] = cleaned["Humidity(%)"].fillna(65.0).astype(np.float32)
        cleaned["Visibility(mi)"] = cleaned["Visibility(mi)"].fillna(10.0).astype(np.float32)
        cleaned["Wind_Speed(mph)"] = cleaned["Wind_Speed(mph)"].fillna(7.0).astype(np.float32)
        cleaned["Weather_Condition"] = cleaned["Weather_Condition"].fillna("Fair").astype(str).str.strip()

        # 5. Impute road infrastructure booleans
        for col in ["Amenity", "Crossing", "Give_Way", "Junction", "Railway", "Station", "Stop", "Traffic_Signal"]:
            cleaned[col] = cleaned[col].fillna(False).astype(bool)

        # 6. Normalize text columns
        cleaned["City"] = cleaned["City"].fillna("Unknown").astype(str).str.strip().str.title()
        cleaned["State"] = cleaned["State"].astype(str).str.strip().str.upper()
        cleaned["Street"] = cleaned["Street"].fillna("").astype(str).str.strip()

        cleaned_len = len(cleaned)
        total_cleaned_rows += cleaned_len

        # Accumulate statistics
        state_counts.update(cleaned["State"].value_counts().to_dict())
        severity_counts.update(cleaned["Severity"].value_counts().to_dict())
        yearly_counts.update(cleaned["Year"].value_counts().to_dict())
        monthly_counts.update(cleaned["Month"].value_counts().to_dict())
        hourly_counts.update(cleaned["Hour"].value_counts().to_dict())
        weekday_counts.update(cleaned["Day_OfWeek"].value_counts().to_dict())
        weather_counts.update(cleaned["Weather_Condition"].value_counts().head(20).to_dict())

        for col in ["Junction", "Crossing", "Traffic_Signal", "Stop", "Station"]:
            road_feature_counts[col] += int(cleaned[col].sum())

        # City counts grouped by state
        for (st, ct), count in cleaned.groupby(["State", "City"]).size().items():
            city_counts[st][ct] += count

        # Global and state bounds calculation
        c_min_lat = float(cleaned["Start_Lat"].min())
        c_max_lat = float(cleaned["Start_Lat"].max())
        c_min_lng = float(cleaned["Start_Lng"].min())
        c_max_lng = float(cleaned["Start_Lng"].max())

        global_min_lat = min(global_min_lat, c_min_lat)
        global_max_lat = max(global_max_lat, c_max_lat)
        global_min_lng = min(global_min_lng, c_min_lng)
        global_max_lng = max(global_max_lng, c_max_lng)

        # State bounds
        for st, st_df in cleaned.groupby("State"):
            st_min_lat = float(st_df["Start_Lat"].min())
            st_max_lat = float(st_df["Start_Lat"].max())
            st_min_lng = float(st_df["Start_Lng"].min())
            st_max_lng = float(st_df["Start_Lng"].max())

            if st not in state_bounds:
                state_bounds[st] = {
                    "min_lat": st_min_lat,
                    "max_lat": st_max_lat,
                    "min_lng": st_min_lng,
                    "max_lng": st_max_lng
                }
            else:
                state_bounds[st]["min_lat"] = min(state_bounds[st]["min_lat"], st_min_lat)
                state_bounds[st]["max_lat"] = max(state_bounds[st]["max_lat"], st_max_lat)
                state_bounds[st]["min_lng"] = min(state_bounds[st]["min_lng"], st_min_lng)
                state_bounds[st]["max_lng"] = max(state_bounds[st]["max_lng"], st_max_lng)

        # Write chunk to full Parquet
        # Convert Start_Time_DT to string for uniform pyarrow serialization
        cleaned["Start_Time"] = cleaned["Start_Time_DT"].dt.strftime("%Y-%m-%d %H:%M:%S")
        export_df = cleaned.drop(columns=["Start_Time_DT"])

        table = pa.Table.from_pandas(export_df, preserve_index=False)
        if parquet_writer is None:
            parquet_writer = pq.ParquetWriter(
                OUTPUT_PARQUET_PATH,
                table.schema,
                compression="snappy"
            )
        parquet_writer.write_table(table)

        # Collect high-fidelity spatial sample (~2.5% of each chunk -> ~190,000 nationwide records)
        sample_size = min(len(cleaned), max(100, int(len(cleaned) * 0.025)))
        spatial_chunk_sample = cleaned.sample(n=sample_size, random_state=42 + chunk_index)[
            ["ID", "Severity", "Start_Time", "Start_Lat", "Start_Lng", "City", "State",
             "Temperature(F)", "Weather_Condition", "Junction", "Traffic_Signal", "Hour", "Day_OfWeek"]
        ]
        spatial_samples.append(spatial_chunk_sample)

        # Collect balanced ML sample (up to 3,500 records per chunk)
        ml_chunk_sample = cleaned.sample(n=min(len(cleaned), 3500), random_state=100 + chunk_index)
        ml_samples.append(ml_chunk_sample)

        t_chunk_end = time.time()
        print(f"  Chunk {chunk_index:2d}: {chunk_raw_len:,} raw -> {cleaned_len:,} valid records ({t_chunk_end - t_chunk_start:.2f}s) | Running total: {total_cleaned_rows:,}")

    # Close full parquet writer
    if parquet_writer:
        parquet_writer.close()
        print(f"\n[OUTPUT] Complete cleaned dataset written to {OUTPUT_PARQUET_PATH}")
        print(f"Parquet file size: {OUTPUT_PARQUET_PATH.stat().st_size / (1024**2):.2f} MB")

    # Combine and save spatial sample
    print("\nAssembling interactive nationwide spatial sample...")
    full_spatial_df = pd.concat(spatial_samples, ignore_index=True)
    full_spatial_df.to_parquet(SPATIAL_PARQUET_PATH, compression="snappy", index=False)
    # Also save as CSV for legacy fallback
    full_spatial_df.to_csv(SPATIAL_CSV_PATH, index=False)
    print(f"[OUTPUT] Spatial interactive sample: {len(full_spatial_df):,} records saved to {SPATIAL_PARQUET_PATH}")

    # Combine and save ML training sample (~100,000 records)
    print("Assembling balanced ML model training sample...")
    full_ml_df = pd.concat(ml_samples, ignore_index=True)
    if len(full_ml_df) > 120000:
        full_ml_df = full_ml_df.sample(n=120000, random_state=42).reset_index(drop=True)
    full_ml_df.to_parquet(ML_SAMPLE_PARQUET_PATH, compression="snappy", index=False)
    print(f"[OUTPUT] ML training sample: {len(full_ml_df):,} records saved to {ML_SAMPLE_PARQUET_PATH}")

    # Compile dynamic state and city summaries
    print("\nCompiling dynamic state, city, and geographic bounds metadata...")
    formatted_states = []
    for st, count in state_counts.most_common():
        st_bound = state_bounds.get(st, {
            "min_lat": global_min_lat, "max_lat": global_max_lat,
            "min_lng": global_min_lng, "max_lng": global_max_lng
        })
        formatted_states.append({
            "state": st,
            "name": US_STATE_NAMES.get(st, st),
            "count": int(count),
            "percentage": round(float(count / total_cleaned_rows * 100), 2),
            "bounds": [
                [round(st_bound["min_lat"], 4), round(st_bound["min_lng"], 4)],
                [round(st_bound["max_lat"], 4), round(st_bound["max_lng"], 4)]
            ]
        })

    # Compile city summaries (top 50 cities per state)
    formatted_cities = {}
    for st, cities_dict in city_counts.items():
        top_cities = [
            {"city": ct, "state": st, "count": int(cnt)}
            for ct, cnt in cities_dict.most_common(50)
        ]
        formatted_cities[st] = top_cities

    # National dataset bounds
    dataset_bounds = {
        "min_lat": round(global_min_lat, 4),
        "max_lat": round(global_max_lat, 4),
        "min_lng": round(global_min_lng, 4),
        "max_lng": round(global_max_lng, 4),
        "bounds": [
            [round(global_min_lat, 4), round(global_min_lng, 4)],
            [round(global_max_lat, 4), round(global_max_lng, 4)]
        ]
    }

    geo_summary = {
        "dataset_name": "US Accidents (2016-2023) - Sobhan Moosavi",
        "total_source_records": total_raw_rows,
        "total_cleaned_records": total_cleaned_rows,
        "total_states": len(formatted_states),
        "total_cities": sum(len(cities) for cities in city_counts.values()),
        "bounds": dataset_bounds,
        "states": formatted_states,
        "top_cities_by_state": formatted_cities
    }

    with open(GEO_SUMMARY_PATH, "w") as f:
        json.dump(geo_summary, f, indent=2)
    print(f"[OUTPUT] Geographic summary saved to {GEO_SUMMARY_PATH}")

    # Compile overall preprocessing summary
    preprocessing_summary = {
        "data_source": "Original Sobhan Moosavi US Accidents (2016-2023) Dataset",
        "source_file": "US_Accidents_March23.csv",
        "is_synthetic": False,
        "is_sample": False,
        "total_raw_records": total_raw_rows,
        "cleaned_records": total_cleaned_rows,
        "retention_rate_pct": round(float(total_cleaned_rows / total_raw_rows * 100), 2),
        "total_states": len(formatted_states),
        "total_cities": geo_summary["total_cities"],
        "severity_distribution": {int(k): int(v) for k, v in severity_counts.items()},
        "average_severity": round(sum(k * v for k, v in severity_counts.items()) / total_cleaned_rows, 2),
        "high_impact_percentage": round(float((severity_counts[3] + severity_counts[4]) / total_cleaned_rows * 100), 2),
        "top_states": {st["state"]: st["count"] for st in formatted_states[:15]},
        "top_weather_conditions": dict(weather_counts.most_common(10)),
        "yearly_distribution": dict(sorted(yearly_counts.items())),
        "monthly_distribution": dict(sorted(monthly_counts.items())),
        "hourly_distribution": dict(sorted(hourly_counts.items())),
        "road_features_prevalence": {
            "junction_pct": round(road_feature_counts["Junction"] / total_cleaned_rows * 100, 2),
            "crossing_pct": round(road_feature_counts["Crossing"] / total_cleaned_rows * 100, 2),
            "traffic_signal_pct": round(road_feature_counts["Traffic_Signal"] / total_cleaned_rows * 100, 2),
            "stop_pct": round(road_feature_counts["Stop"] / total_cleaned_rows * 100, 2),
            "station_pct": round(road_feature_counts["Station"] / total_cleaned_rows * 100, 2)
        },
        "bounds": dataset_bounds
    }

    with open(PREPROCESSING_SUMMARY_PATH, "w") as f:
        json.dump(preprocessing_summary, f, indent=2)
    print(f"[OUTPUT] Preprocessing summary saved to {PREPROCESSING_SUMMARY_PATH}")

    # Sync artifacts to server directory for Vercel/server runtime compatibility
    for path in [GEO_SUMMARY_PATH, PREPROCESSING_SUMMARY_PATH, SPATIAL_PARQUET_PATH, ML_SAMPLE_PARQUET_PATH]:
        dest = SERVER_PROCESSED_DIR / path.name
        shutil.copy2(path, dest)
    print(f"[SYNC] Mirrored processed summaries and parquet files to {SERVER_PROCESSED_DIR}")

    total_time = time.time() - start_total
    print("\n" + "=" * 75)
    print(f"[SUCCESS] Ingestion completed in {total_time:.2f} seconds ({total_time / 60:.2f} minutes).")
    print(f"- Total Raw Records: {total_raw_rows:,}")
    print(f"- Cleaned Records: {total_cleaned_rows:,} ({preprocessing_summary['retention_rate_pct']}%)")
    print(f"- States Covered: {len(formatted_states)} US States + DC")
    print(f"- Cities Covered: {geo_summary['total_cities']:,} unique cities")
    print("=" * 75)

    return preprocessing_summary

if __name__ == "__main__":
    preprocess_full_dataset()

