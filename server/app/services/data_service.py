"""
Data Service: Caching, Filtering, and Statistical Analytics
"""

import json
from pathlib import Path
from typing import List, Dict, Optional, Any
import pandas as pd
import numpy as np

from server.app.config import (
    CLEANED_DATA_PATH,
    PREPROCESSING_SUMMARY_PATH,
    DEV_FIXTURE_PATH
)

class DataService:
    _instance = None
    _df: Optional[pd.DataFrame] = None
    _summary: Optional[Dict[str, Any]] = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        # Load dataset
        path = CLEANED_DATA_PATH if CLEANED_DATA_PATH.exists() else DEV_FIXTURE_PATH
        if path.exists():
            print(f"[DATA SERVICE] Loading dataset into memory from {path}...")
            self._df = pd.read_csv(path, low_memory=False)
            print(f"[DATA SERVICE] Successfully cached {len(self._df):,} records.")
        else:
            print("[DATA SERVICE WARNING] Dataset file not found.")
            self._df = pd.DataFrame()

        # Load precomputed summary if available
        if PREPROCESSING_SUMMARY_PATH.exists():
            with open(PREPROCESSING_SUMMARY_PATH, "r") as f:
                self._summary = json.load(f)
        else:
            self._summary = {}

    def get_summary(self) -> Dict[str, Any]:
        if not self._summary and not self._df.empty:
            # Generate dynamically if json is absent
            sev_dist = self._df["Severity"].value_counts().sort_index().to_dict()
            return {
                "data_source": "Loaded Dataset",
                "is_synthetic": bool("Is_Synthetic_Dev_Fixture" in self._df.columns),
                "total_accidents": len(self._df),
                "average_severity": round(float(self._df["Severity"].mean()), 2),
                "high_impact_percentage": round(float((self._df["Severity"] >= 3).mean() * 100), 2),
                "severity_distribution": {str(k): int(v) for k, v in sev_dist.items()},
                "top_states": {str(k): int(v) for k, v in self._df["State"].value_counts().head(8).items()},
                "top_cities": {str(k): int(v) for k, v in self._df["City"].value_counts().head(8).items()},
                "top_weather_conditions": {str(k): int(v) for k, v in self._df["Weather_Condition"].value_counts().head(8).items()},
                "road_features_prevalence": {
                    "junction_pct": round(float(self._df["Junction"].mean() * 100), 2) if "Junction" in self._df.columns else 0.0,
                    "crossing_pct": round(float(self._df["Crossing"].mean() * 100), 2) if "Crossing" in self._df.columns else 0.0,
                    "traffic_signal_pct": round(float(self._df["Traffic_Signal"].mean() * 100), 2) if "Traffic_Signal" in self._df.columns else 0.0,
                    "stop_pct": round(float(self._df["Stop"].mean() * 100), 2) if "Stop" in self._df.columns else 0.0,
                },
                "temporal_range": {
                    "earliest": str(self._df["Start_Time"].min()) if "Start_Time" in self._df.columns else "N/A",
                    "latest": str(self._df["Start_Time"].max()) if "Start_Time" in self._df.columns else "N/A"
                }
            }
        
        # Format from loaded json
        return {
            "total_accidents": self._summary.get("cleaned_records", len(self._df)),
            "average_severity": self._summary.get("average_severity", 2.3),
            "high_impact_percentage": self._summary.get("high_impact_percentage", 25.0),
            "data_source": self._summary.get("data_source", "Cleaned US Accidents Dataset"),
            "is_synthetic": self._summary.get("is_synthetic", False),
            "severity_distribution": {str(k): int(v) for k, v in self._summary.get("severity_distribution", {}).items()},
            "top_states": self._summary.get("top_states", {}),
            "top_cities": self._summary.get("top_cities", {}),
            "top_weather_conditions": self._summary.get("top_weather_conditions", {}),
            "road_features_prevalence": self._summary.get("road_features_prevalence", {}),
            "temporal_range": self._summary.get("temporal_range", {"earliest": "", "latest": ""})
        }

    def get_accidents(
        self,
        limit: int = 500,
        state: Optional[str] = None,
        city: Optional[str] = None,
        severity: Optional[int] = None,
        min_lat: Optional[float] = None,
        max_lat: Optional[float] = None,
        min_lng: Optional[float] = None,
        max_lng: Optional[float] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if self._df.empty:
            return []

        filtered = self._df
        if state and state.upper() != "ALL":
            filtered = filtered[filtered["State"].str.upper() == state.upper()]
        if city and city.lower() != "all":
            filtered = filtered[filtered["City"].str.lower() == city.lower()]
        if severity:
            filtered = filtered[filtered["Severity"] == severity]

        # Date range filtering
        if start_date and "Start_Time" in filtered.columns:
            filtered = filtered[filtered["Start_Time"] >= str(start_date)]
        if end_date and "Start_Time" in filtered.columns:
            filtered = filtered[filtered["Start_Time"] <= f"{end_date} 23:59:59"]

        # Bounding box viewport filtering
        if min_lat is not None and max_lat is not None:
            filtered = filtered[(filtered["Start_Lat"] >= min_lat) & (filtered["Start_Lat"] <= max_lat)]
        if min_lng is not None and max_lng is not None:
            filtered = filtered[(filtered["Start_Lng"] >= min_lng) & (filtered["Start_Lng"] <= max_lng)]

        # Sample up to limit records for map rendering without overwhelming frontend
        sample_size = min(limit, len(filtered))
        sampled = filtered.sample(n=sample_size, random_state=42) if len(filtered) > sample_size else filtered

        records = []
        for _, row in sampled.iterrows():
            records.append({
                "id": str(row.get("ID", "")),
                "severity": int(row.get("Severity", 2)),
                "start_time": str(row.get("Start_Time", "")),
                "latitude": round(float(row.get("Start_Lat", 0.0)), 5),
                "longitude": round(float(row.get("Start_Lng", 0.0)), 5),
                "city": str(row.get("City", "Unknown")),
                "state": str(row.get("State", "CA")),
                "weather_condition": str(row.get("Weather_Condition", "Fair")),
                "temperature_f": round(float(row.get("Temperature(F)", 65.0)), 1),
                "junction": bool(row.get("Junction", False)),
                "traffic_signal": bool(row.get("Traffic_Signal", False))
            })
        return records

    def get_time_analytics(self) -> Dict[str, Any]:
        if self._df.empty:
            return {"hourly": [], "daily": [], "rush_hour_breakdown": {}}

        total = len(self._df)
        # Hourly breakdown
        hourly_counts = self._df["Hour"].value_counts().sort_index()
        hourly_list = []
        for h in range(24):
            count = int(hourly_counts.get(h, 0))
            hourly_list.append({
                "hour": h,
                "count": count,
                "percentage": round(float(count / total * 100), 2),
                "is_rush_hour": bool(h in [7, 8, 9, 16, 17, 18])
            })

        # Day of week breakdown
        days_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        daily_counts = self._df["Day_OfWeek"].value_counts().to_dict() if "Day_OfWeek" in self._df.columns else {}
        daily_list = []
        for d in days_order:
            count = int(daily_counts.get(d, 0))
            daily_list.append({
                "day": d,
                "count": count,
                "percentage": round(float(count / total * 100), 2) if total > 0 else 0.0,
                "is_weekend": bool(d in ["Saturday", "Sunday"])
            })

        # Rush hour vs non rush hour
        rush_count = int(self._df["Is_Rush_Hour"].sum()) if "Is_Rush_Hour" in self._df.columns else 0
        non_rush_count = total - rush_count
        rush_breakdown = {
            "rush_hour_accidents": rush_count,
            "non_rush_hour_accidents": non_rush_count,
            "rush_hour_percentage": round(float(rush_count / total * 100), 2) if total > 0 else 0.0,
            "rush_hours": "07:00-10:00 & 16:00-19:00",
            "observation": "Historical incident rates peak during morning and evening rush commutes due to high vehicular density and junction congestion."
        }

        return {
            "hourly": hourly_list,
            "daily": daily_list,
            "rush_hour_breakdown": rush_breakdown
        }

    def get_weather_analytics(self) -> Dict[str, Any]:
        if self._df.empty:
            return {"weather_conditions": [], "temperature_distribution": [], "insights": []}

        total = len(self._df)
        # Weather condition breakdown with average severity
        weather_stats = []
        top_conditions = self._df["Weather_Condition"].value_counts().head(7).index
        for cond in top_conditions:
            subset = self._df[self._df["Weather_Condition"] == cond]
            weather_stats.append({
                "condition": cond,
                "accident_count": len(subset),
                "average_severity": round(float(subset["Severity"].mean()), 2),
                "percentage": round(float(len(subset) / total * 100), 2)
            })

        # Temperature distribution bins
        bins = [-50, 32, 50, 70, 85, 130]
        labels = ["< 32°F (Freezing)", "32-50°F (Cold)", "50-70°F (Mild)", "70-85°F (Warm)", "> 85°F (Hot)"]
        temp_series = pd.cut(self._df["Temperature(F)"], bins=bins, labels=labels)
        temp_counts = temp_series.value_counts()[labels]
        
        temp_stats = []
        for label in labels:
            sub = self._df[temp_series == label]
            temp_stats.append({
                "temp_range": label,
                "accident_count": int(temp_counts[label]),
                "average_severity": round(float(sub["Severity"].mean()), 2) if len(sub) > 0 else 0.0
            })

        insights = [
            "Most accidents occur during clear and fair conditions simply because fair weather corresponds to higher overall Vehicle Miles Traveled (VMT).",
            "Adverse weather conditions like Fog and Heavy Rain exhibit a higher proportion of prolonged traffic delays (higher Severity).",
            "Cold and freezing temperatures show elevated severity indexes compared to moderate temperatures, reflecting icy road surface hazards."
        ]

        return {
            "weather_conditions": weather_stats,
            "temperature_distribution": temp_stats,
            "insights": insights
        }

    def get_infrastructure_analytics(self) -> Dict[str, Any]:
        if self._df.empty:
            return {"features": [], "insights": []}

        features = ["Junction", "Traffic_Signal", "Crossing", "Stop"]
        stats = []
        for feat in features:
            if feat in self._df.columns:
                present = self._df[self._df[feat] == True]
                absent = self._df[self._df[feat] == False]
                stats.append({
                    "feature": feat.replace("_", " "),
                    "present_count": len(present),
                    "absent_count": len(absent),
                    "present_avg_severity": round(float(present["Severity"].mean()), 2) if len(present) > 0 else 0.0,
                    "absent_avg_severity": round(float(absent["Severity"].mean()), 2) if len(absent) > 0 else 0.0,
                    "present_percentage": round(float(len(present) / len(self._df) * 100), 2)
                })

        insights = [
            "Accidents near highway junctions frequently result in higher average delay durations due to bottlenecking and complex merges.",
            "Traffic signals and pedestrian crossings correlate with frequent lower-speed collisions, resulting in lower traffic delay durations (Severity 1-2).",
            "Intersection safety interventions such as traffic calming and adaptive signaling show high promise in reducing multi-vehicle pileups."
        ]

        return {
            "features": stats,
            "insights": insights
        }

