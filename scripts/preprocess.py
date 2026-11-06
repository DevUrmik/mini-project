
"""
Accident Hotspot Prediction and Road Safety Intelligence System
Reproducible Data Preprocessing Pipeline

Steps:
1. Detects raw Kaggle CSV in `data/raw/` or falls back to development sample in `data/samples/`.
2. Inspects schema, column types, and missing values.
3. Deduplicates accident IDs.
4. Validates geospatial boundaries (continental US coordinates).
5. Converts timestamps and engineers temporal features (Hour, Weekday, Month, Rush Hour, Weekend).
6. Preserves original severity scale (traffic delay impact 1-4).
7. Extracts focused state sample (California) for computationally efficient spatial clustering.
8. Persists cleaned datasets and metadata summary in `data/processed/`.
"""

import os
import sys
import json
import glob
from pathlib import Path
import pandas as pd
import numpy as np

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server.app.config import (
    RAW_DATA_DIR,
    PROCESSED_DATA_DIR,
    SAMPLES_DATA_DIR,
    CLEANED_DATA_PATH,
    CALIFORNIA_DATA_PATH,
    DEV_FIXTURE_PATH,
    PREPROCESSING_SUMMARY_PATH
)

def run_preprocessing(max_records: int = 250000):
    print("=" * 70)
    print("ACCIDENT ROAD SAFETY INTELLIGENCE - DATA PREPROCESSING PIPELINE")
    print("=" * 70)
    
    # 1. Locate dataset source
    raw_csvs = list(RAW_DATA_DIR.glob("*.csv"))
    is_synthetic = False
    
    if raw_csvs:
        input_csv = raw_csvs[0]
        data_source_label = f"Raw Kaggle Dataset: {input_csv.name}"
        print(f"[DATA SOURCE] Found raw dataset: {input_csv}")
    elif DEV_FIXTURE_PATH.exists():
        input_csv = DEV_FIXTURE_PATH
        is_synthetic = True
        data_source_label = "Development Sample Fixture (Kaggle Schema Compliant)"
        print(f"[DATA SOURCE] Raw Kaggle CSV not detected in data/raw/. Using development fixture: {input_csv}")
        print("[NOTICE] Clearly labeled as development fixture; replace with US_Accidents_March23.csv for production.")
    else:
        print("[ERROR] Neither data/raw/*.csv nor development sample found.")
        print("[ACTION] Running scripts/generate_dev_fixture.py to generate development sample...")
        from scripts.generate_dev_fixture import generate_dev_fixture
        generate_dev_fixture()
        input_csv = DEV_FIXTURE_PATH
        is_synthetic = True
        data_source_label = "Generated Development Sample Fixture"

    # 2. Load dataset
    print(f"\n[STEP 1/5] Loading records from {input_csv.name}...")
    # Load with selected relevant columns to maintain memory efficiency
    df = pd.read_csv(input_csv, low_memory=False)
    raw_count = len(df)
    print(f"Loaded {raw_count:,} raw records.")
    
    # Check for synthetic label flag
    if "Is_Synthetic_Dev_Fixture" in df.columns:
        is_synthetic = bool(df["Is_Synthetic_Dev_Fixture"].iloc[0])

    # 3. Inspect missing values
    missing_summary_before = df.isnull().sum().to_dict()
    
    # 4. Deduplicate and clean invalid coordinates
    print("\n[STEP 2/5] Deduplicating and validating geographic coordinates...")
    df = df.drop_duplicates(subset=["ID"])
    
    # Filter valid coordinates in Continental United States
    # Continental US: Lat [24.0, 50.0], Lng [-125.0, -66.0]
    valid_coords = (
        (df["Start_Lat"].notnull()) &
        (df["Start_Lng"].notnull()) &
        (df["Start_Lat"] >= 24.0) & (df["Start_Lat"] <= 50.0) &
        (df["Start_Lng"] >= -125.0) & (df["Start_Lng"] <= -66.0)
    )
    df = df[valid_coords].copy()
    print(f"Retained {len(df):,} records with verified GPS coordinates.")

    # 5. Timestamp Conversion & Temporal Feature Engineering
    print("\n[STEP 3/5] Converting timestamps and engineering temporal features...")
    df["Start_Time"] = pd.to_datetime(df["Start_Time"], errors="coerce")
    if "End_Time" in df.columns:
        df["End_Time"] = pd.to_datetime(df["End_Time"], errors="coerce")
    else:
        df["End_Time"] = df["Start_Time"] + pd.Timedelta(hours=1)
        
    # Drop records with invalid timestamps
    df = df.dropna(subset=["Start_Time"]).copy()
    
    # Feature extraction
    df["Hour"] = df["Start_Time"].dt.hour
    df["Weekday"] = df["Start_Time"].dt.weekday  # 0=Monday, 6=Sunday
    df["Day_OfWeek"] = df["Start_Time"].dt.day_name()
    df["Month"] = df["Start_Time"].dt.month
    df["Month_Name"] = df["Start_Time"].dt.month_name()
    df["Year"] = df["Start_Time"].dt.year
    df["Is_Weekend"] = df["Weekday"].isin([5, 6])
    df["Is_Rush_Hour"] = df["Hour"].isin([7, 8, 9, 16, 17, 18])
    
    # Duration in minutes
    df["Duration_Minutes"] = (df["End_Time"] - df["Start_Time"]).dt.total_seconds() / 60.0
    # Clean abnormal durations (clip between 5 mins and 24 hours)
    df["Duration_Minutes"] = df["Duration_Minutes"].clip(lower=5.0, upper=1440.0)

    # 6. Fill missing weather and road infrastructure features
    print("\n[STEP 4/5] Imputing missing attributes and normalizing categories...")
    # Numerical weather columns
    for col in ["Temperature(F)", "Humidity(%)", "Visibility(mi)", "Wind_Speed(mph)"]:
        if col in df.columns:
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)
        else:
            df[col] = 50.0

    # Categorical weather
    if "Weather_Condition" in df.columns:
        df["Weather_Condition"] = df["Weather_Condition"].fillna("Fair").astype(str).str.strip()
    else:
        df["Weather_Condition"] = "Fair"

    # Boolean road features
    for bool_col in ["Junction", "Crossing", "Traffic_Signal", "Stop", "Amenity", "Station", "Traffic_Calming"]:
        if bool_col in df.columns:
            df[bool_col] = df[bool_col].fillna(False).astype(bool)
        else:
            df[bool_col] = False

    # Ensure Severity is integer between 1 and 4
    df["Severity"] = df["Severity"].fillna(2).astype(int).clip(1, 4)
    
    # Project-defined grouping for high vs low impact traffic delay
    # Lower impact: 1-2, Higher impact: 3-4
    df["Severity_Group"] = np.where(df["Severity"] >= 3, "High Impact (3-4)", "Low Impact (1-2)")

    # Downsample if record count exceeds max_records
    if len(df) > max_records:
        print(f"Sampling {max_records:,} records stratified across Severity...")
        df = df.groupby("Severity", group_keys=False).apply(
            lambda x: x.sample(min(len(x), int(max_records * len(x) / len(df))), random_state=42)
        ).reset_index(drop=True)

    # 7. Extract state-focused subset for spatial clustering (California)
    print("\n[STEP 5/5] Generating geographically focused sample (California)...")
    ca_df = df[df["State"] == "CA"].copy()
    if len(ca_df) < 500:
        # Fallback to dominant state if CA has few records
        dominant_state = df["State"].value_counts().index[0]
        ca_df = df[df["State"] == dominant_state].copy()
        print(f"Using dominant state {dominant_state} for spatial sample ({len(ca_df):,} records).")
    else:
        print(f"Extracted {len(ca_df):,} California records for spatial hotspot clustering.")

    # 8. Save Processed Artifacts
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    df.to_csv(CLEANED_DATA_PATH, index=False)
    ca_df.to_csv(CALIFORNIA_DATA_PATH, index=False)
    
    # Compute summary statistics
    severity_dist = df["Severity"].value_counts().sort_index().to_dict()
    top_cities = df["City"].value_counts().head(10).to_dict()
    top_states = df["State"].value_counts().head(10).to_dict()
    top_weather = df["Weather_Condition"].value_counts().head(8).to_dict()
    
    summary_data = {
        "data_source": data_source_label,
        "is_synthetic": is_synthetic,
        "total_raw_records": raw_count,
        "cleaned_records": len(df),
        "california_sample_records": len(ca_df),
        "severity_distribution": {int(k): int(v) for k, v in severity_dist.items()},
        "average_severity": round(float(df["Severity"].mean()), 2),
        "high_impact_percentage": round(float((df["Severity"] >= 3).mean() * 100), 2),
        "top_states": {str(k): int(v) for k, v in top_states.items()},
        "top_cities": {str(k): int(v) for k, v in top_cities.items()},
        "top_weather_conditions": {str(k): int(v) for k, v in top_weather.items()},
        "temporal_range": {
            "earliest": str(df["Start_Time"].min()),
            "latest": str(df["Start_Time"].max())
        },
        "road_features_prevalence": {
            "junction_pct": round(float(df["Junction"].mean() * 100), 2),
            "crossing_pct": round(float(df["Crossing"].mean() * 100), 2),
            "traffic_signal_pct": round(float(df["Traffic_Signal"].mean() * 100), 2),
            "stop_pct": round(float(df["Stop"].mean() * 100), 2),
        }
    }
    
    with open(PREPROCESSING_SUMMARY_PATH, "w") as f:
        json.dump(summary_data, f, indent=2)

    print("\n" + "=" * 70)
    print(f"[SUCCESS] Preprocessing completed.")
    print(f"- Cleaned dataset: {CLEANED_DATA_PATH} ({len(df):,} records)")
    print(f"- California spatial dataset: {CALIFORNIA_DATA_PATH} ({len(ca_df):,} records)")
    print(f"- Summary metrics: {PREPROCESSING_SUMMARY_PATH}")
    print("=" * 70)
    return summary_data

if __name__ == "__main__":
    run_preprocessing()
