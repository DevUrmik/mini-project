"""
Application Configuration and Directory Paths
"""

import os
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
SAMPLES_DATA_DIR = DATA_DIR / "samples"
MODELS_DIR = BASE_DIR / "models"
DOCS_DIR = BASE_DIR / "docs"

# Ensure runtime directories exist
for directory in [DATA_DIR, RAW_DATA_DIR, PROCESSED_DATA_DIR, SAMPLES_DATA_DIR, MODELS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Dataset file paths
CLEANED_DATA_PATH = PROCESSED_DATA_DIR / "cleaned_accidents.csv"
CALIFORNIA_DATA_PATH = PROCESSED_DATA_DIR / "california_accidents.csv"
DEV_FIXTURE_PATH = SAMPLES_DATA_DIR / "us_accidents_dev_fixture.csv"
PREPROCESSING_SUMMARY_PATH = PROCESSED_DATA_DIR / "preprocessing_summary.json"

# ML Artifact paths
CLASSIFIER_MODEL_PATH = MODELS_DIR / "severity_random_forest.joblib"
LOGISTIC_MODEL_PATH = MODELS_DIR / "severity_logistic_regression.joblib"
DECISION_TREE_MODEL_PATH = MODELS_DIR / "severity_decision_tree.joblib"
PREPROCESSOR_PIPELINE_PATH = MODELS_DIR / "preprocessor_pipeline.joblib"
MODEL_METRICS_PATH = MODELS_DIR / "model_metrics.json"
HOTSPOTS_KMEANS_PATH = MODELS_DIR / "hotspots_kmeans.json"
HOTSPOTS_DBSCAN_PATH = MODELS_DIR / "hotspots_dbscan.json"

# Application Settings
API_TITLE = "Accident Hotspot Prediction & Road Safety Intelligence API"
API_VERSION = "1.0.0"
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

