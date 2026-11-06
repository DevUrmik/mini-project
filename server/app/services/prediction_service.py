"""
Prediction Service: Loads Persisted Machine Learning Pipeline and Serves Inference
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
import joblib

from server.app.config import (
    CLASSIFIER_MODEL_PATH,
    LOGISTIC_MODEL_PATH,
    DECISION_TREE_MODEL_PATH,
    PREPROCESSOR_PIPELINE_PATH,
    MODEL_METRICS_PATH
)
from server.app.ml.preprocessor import prepare_inference_features

SEVERITY_DESCRIPTIONS = {
    1: {
        "category": "Minor Traffic Impact",
        "description": "Short expected delay (< 15 mins). Usually localized shoulder or curb incidents with minimal flow restriction."
    },
    2: {
        "category": "Moderate Traffic Delay",
        "description": "Standard commute delay (15 - 45 mins). One lane may be blocked, causing noticeable slowdowns during peak hours."
    },
    3: {
        "category": "Heavy Traffic Disruption",
        "description": "Significant travel delay (45 - 90 mins). Multiple travel lanes impacted, requiring emergency responder staging and lane detours."
    },
    4: {
        "category": "Severe Roadway Obstruction",
        "description": "Prolonged travel delay (> 90 mins). Full or near-total freeway closure, hazardous clearance, or structural road impediment."
    }
}

class PredictionService:
    _instance = None
    _rf_model = None
    _preprocessor = None
    _metrics = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        print("[PREDICTION SERVICE] Loading trained ML models and pipeline...")
        if CLASSIFIER_MODEL_PATH.exists():
            self._rf_model = joblib.load(CLASSIFIER_MODEL_PATH)
            print(f"[PREDICTION SERVICE] Loaded Random Forest from {CLASSIFIER_MODEL_PATH}")
        else:
            print("[PREDICTION SERVICE WARNING] Random Forest model not found.")

        if PREPROCESSOR_PIPELINE_PATH.exists():
            self._preprocessor = joblib.load(PREPROCESSOR_PIPELINE_PATH)
            # Patch cross-version scikit-learn SimpleImputer attribute incompatibility
            if hasattr(self._preprocessor, "transformers_"):
                for _, trans, _ in self._preprocessor.transformers_:
                    if hasattr(trans, "named_steps"):
                        for step in trans.named_steps.values():
                            if hasattr(step, "statistics_") and not hasattr(step, "_fill_dtype"):
                                step._fill_dtype = step.statistics_.dtype
            print(f"[PREDICTION SERVICE] Loaded Preprocessor from {PREPROCESSOR_PIPELINE_PATH}")
        else:
            print("[PREDICTION SERVICE WARNING] Preprocessor pipeline not found.")

        if MODEL_METRICS_PATH.exists():
            with open(MODEL_METRICS_PATH, "r") as f:
                self._metrics = json.load(f)
        else:
            self._metrics = {}

    def get_model_metrics(self) -> Dict[str, Any]:
        return self._metrics or {}

    def predict(self, input_dict: dict) -> Dict[str, Any]:
        if self._rf_model is None or self._preprocessor is None:
            raise RuntimeError("Model or Preprocessor pipeline is not loaded. Please train models first.")

        # 1. Feature Engineering (match training format)
        single_row_df = prepare_inference_features(input_dict)

        # 2. Transform through fitted Scikit-Learn ColumnTransformer
        X_proc = self._preprocessor.transform(single_row_df)

        # 3. Model Inference
        pred_class = int(self._rf_model.predict(X_proc)[0])
        
        # 4. Probabilities
        probabilities = []
        if hasattr(self._rf_model, "predict_proba"):
            probs = self._rf_model.predict_proba(X_proc)[0]
            classes = self._rf_model.classes_
            for c, p in zip(classes, probs):
                c_int = int(c)
                probabilities.append({
                    "severity_class": c_int,
                    "label": f"Severity {c_int}: {SEVERITY_DESCRIPTIONS.get(c_int, {}).get('category', '')}",
                    "probability": round(float(p), 4),
                    "percentage": round(float(p * 100), 2)
                })
        else:
            probabilities = [{
                "severity_class": pred_class,
                "label": f"Severity {pred_class}",
                "probability": 1.0,
                "percentage": 100.0
            }]

        sev_meta = SEVERITY_DESCRIPTIONS.get(pred_class, {
            "category": f"Severity Level {pred_class}",
            "description": "Historical traffic delay impact estimate."
        })

        return {
            "predicted_severity": pred_class,
            "severity_category": sev_meta["category"],
            "traffic_impact_description": sev_meta["description"],
            "model_used": "Random Forest Classifier (Balanced Class Weights)",
            "class_probabilities": probabilities,
            "input_summary": {
                "weather": input_dict.get("weather_condition", "Fair"),
                "temperature": f"{input_dict.get('temperature', 65)}°F",
                "time": f"{input_dict.get('hour', 12):02d}:00 on {input_dict.get('day_of_week', 'Monday')}",
                "is_rush_hour": bool(int(input_dict.get("hour", 12)) in [7, 8, 9, 16, 17, 18]),
                "road_features": [k for k in ["junction", "traffic_signal", "crossing", "stop"] if input_dict.get(k)]
            },
            "disclaimer": (
                "Notice: This prediction represents traffic impact duration based on historical records. "
                "It is not an indicator of personal bodily injury or fatality probability."
            )
        }

