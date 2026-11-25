"""
Prediction Service: Loads Persisted Machine Learning Pipelines and Serves Inference
"""

import json
from typing import Dict, Any
import joblib

from server.app.config import (
    CLASSIFIER_MODEL_PATH,
    HIST_GBM_MODEL_PATH,
    BINARY_HIST_GBM_MODEL_PATH,
    PREPROCESSOR_PIPELINE_PATH,
    HGB_PREPROCESSOR_PIPELINE_PATH,
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
    _hgb_model = None
    _binary_model = None
    _preprocessor = None
    _hgb_preprocessor = None
    _metrics = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        # Fast initialization: load metrics metadata (sub-millisecond)
        if MODEL_METRICS_PATH.exists():
            with open(MODEL_METRICS_PATH, "r") as f:
                self._metrics = json.load(f)
        else:
            self._metrics = {}

    def _patch_imputer(self, pipeline):
        """Patch cross-version scikit-learn SimpleImputer attribute incompatibility."""
        if hasattr(pipeline, "transformers_"):
            for _, trans, _ in pipeline.transformers_:
                if hasattr(trans, "named_steps"):
                    for step in trans.named_steps.values():
                        if hasattr(step, "statistics_") and not hasattr(step, "_fill_dtype"):
                            step._fill_dtype = step.statistics_.dtype

    def _ensure_models_loaded(self):
        """Loads Scikit-Learn pipelines and models on-demand to optimize cold-start."""
        if (self._hgb_model is not None and self._hgb_preprocessor is not None) or (
            self._rf_model is not None and self._preprocessor is not None
        ):
            return

        if HIST_GBM_MODEL_PATH.exists() and HGB_PREPROCESSOR_PIPELINE_PATH.exists():
            try:
                self._hgb_model = joblib.load(HIST_GBM_MODEL_PATH)
                self._hgb_preprocessor = joblib.load(HGB_PREPROCESSOR_PIPELINE_PATH)
                self._patch_imputer(self._hgb_preprocessor)
                print(f"[PREDICTION SERVICE] Loaded HistGradientBoosting from {HIST_GBM_MODEL_PATH}")
            except Exception as e:
                print(f"[PREDICTION SERVICE ERROR] Failed to load HistGBM: {e}")

        if BINARY_HIST_GBM_MODEL_PATH.exists():
            try:
                self._binary_model = joblib.load(BINARY_HIST_GBM_MODEL_PATH)
            except Exception as e:
                print(f"[PREDICTION SERVICE WARNING] Failed to load Binary High-Impact model: {e}")

        if self._hgb_model is None and CLASSIFIER_MODEL_PATH.exists() and PREPROCESSOR_PIPELINE_PATH.exists():
            try:
                self._rf_model = joblib.load(CLASSIFIER_MODEL_PATH)
                self._preprocessor = joblib.load(PREPROCESSOR_PIPELINE_PATH)
                self._patch_imputer(self._preprocessor)
                print(f"[PREDICTION SERVICE] Loaded fallback Random Forest from {CLASSIFIER_MODEL_PATH}")
            except Exception as e:
                print(f"[PREDICTION SERVICE ERROR] Failed to load Random Forest: {e}")

    def is_model_ready(self) -> bool:
        return (
            (self._hgb_model is not None and self._hgb_preprocessor is not None)
            or (HIST_GBM_MODEL_PATH.exists() and HGB_PREPROCESSOR_PIPELINE_PATH.exists())
            or (CLASSIFIER_MODEL_PATH.exists() and PREPROCESSOR_PIPELINE_PATH.exists())
        )

    def get_model_metrics(self) -> Dict[str, Any]:
        return self._metrics or {}

    def predict(self, input_dict: dict) -> Dict[str, Any]:
        self._ensure_models_loaded()

        if self._hgb_model is not None and self._hgb_preprocessor is not None:
            active_model = self._hgb_model
            active_preprocessor = self._hgb_preprocessor
            model_name = "HistGradientBoosting Classifier (28-Feature)"
        elif self._rf_model is not None and self._preprocessor is not None:
            active_model = self._rf_model
            active_preprocessor = self._preprocessor
            model_name = "Random Forest Classifier"
        else:
            raise RuntimeError("Model or Preprocessor pipeline is not loaded. Please train models first.")

        # 1. Feature Engineering (match training format)
        single_row_df = prepare_inference_features(input_dict)

        # 2. Transform through fitted Scikit-Learn ColumnTransformer
        X_proc = active_preprocessor.transform(single_row_df)

        # 3. 4-Class Model Inference
        pred_class = int(active_model.predict(X_proc)[0])

        probabilities = []
        if hasattr(active_model, "predict_proba"):
            probs = active_model.predict_proba(X_proc)[0]
            classes = active_model.classes_
            for c, p in zip(classes, probs):
                c_int = int(c)
                probabilities.append({
                    "severity_class": c_int,
                    "label": SEVERITY_DESCRIPTIONS.get(c_int, {}).get("category", f"Severity {c_int}"),
                    "probability": round(float(p), 4),
                    "percentage": round(float(p * 100), 1)
                })
        else:
            for c_int in [1, 2, 3, 4]:
                p = 1.0 if c_int == pred_class else 0.0
                probabilities.append({
                    "severity_class": c_int,
                    "label": SEVERITY_DESCRIPTIONS.get(c_int, {}).get("category", f"Severity {c_int}"),
                    "probability": p,
                    "percentage": p * 100.0
                })

        # 4. Binary High-Impact (Severity 3-4) Risk Inference
        high_impact_risk = None
        if self._binary_model is not None and self._hgb_preprocessor is not None:
            X_hgb = self._hgb_preprocessor.transform(single_row_df)
            hi_prob = float(self._binary_model.predict_proba(X_hgb)[0][1])
            high_impact_risk = {
                "high_impact_probability": round(hi_prob, 4),
                "high_impact_percentage": round(hi_prob * 100.0, 1),
                "classification": "High Impact (Severity 3-4)" if hi_prob >= 0.5 else "Standard Impact (Severity 1-2)",
                "model": "HistGradientBoosting Binary"
            }

        desc_info = SEVERITY_DESCRIPTIONS.get(pred_class, {
            "category": f"Severity {pred_class}",
            "description": "Traffic delay impact level."
        })

        return {
            "predicted_severity": pred_class,
            "severity_category": desc_info["category"],
            "traffic_impact_description": desc_info["description"],
            "model_used": model_name,
            "class_probabilities": probabilities,
            "high_impact_risk": high_impact_risk,
            "input_summary": input_dict
        }
