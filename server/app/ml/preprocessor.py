"""
Accident Severity Preprocessor and Feature Engineering Pipeline

Designed for reproducibility and production readiness:
- Provides Scikit-Learn ColumnTransformer pipeline
- Implements numerical imputation and scaling
- Implements categorical imputation and one-hot encoding
- Handles boolean road features
- Exposes helper for single-sample inference in FastAPI
"""

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, FunctionTransformer

# Canonical feature lists for accident severity modeling
NUMERICAL_FEATURES = [
    "Temperature(F)",
    "Humidity(%)",
    "Visibility(mi)",
    "Wind_Speed(mph)",
    "Hour",
]

CATEGORICAL_FEATURES = [
    "Weather_Condition",
    "Day_OfWeek",
]

BOOLEAN_FEATURES = [
    "Junction",
    "Crossing",
    "Traffic_Signal",
    "Stop",
    "Is_Rush_Hour",
    "Is_Weekend",
]

ALL_MODEL_FEATURES = NUMERICAL_FEATURES + CATEGORICAL_FEATURES + BOOLEAN_FEATURES

def cast_to_float(x):
    """Casts input array/dataframe to float to safely work with SimpleImputer."""
    return np.asarray(x, dtype=float)

def create_feature_pipeline() -> ColumnTransformer:
    """
    Constructs a Scikit-learn ColumnTransformer.
    
    1. Numerical Pipeline:
       - SimpleImputer (median): Handles missing weather observations robustly without outlier distortion.
       - StandardScaler: Standardizes continuous metrics to zero mean and unit variance.
       
    2. Categorical Pipeline:
       - SimpleImputer ('Unknown'): Captures missing weather condition records cleanly.
       - OneHotEncoder: Encodes categorical attributes without imposing ordinal bias.
       
    3. Boolean Pipeline:
       - SimpleImputer (False): Defaults missing infrastructure flags to False.
       - Passthrough as numeric 0/1 indicator.
    """
    numerical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="constant", fill_value="Unknown")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    boolean_transformer = Pipeline(steps=[
        ("cast_float", FunctionTransformer(cast_to_float)),
        ("imputer", SimpleImputer(strategy="constant", fill_value=0.0)),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numerical_transformer, NUMERICAL_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES),
            ("bool", boolean_transformer, BOOLEAN_FEATURES),
        ],
        remainder="drop"
    )
    
    return preprocessor

def prepare_inference_features(data: dict) -> pd.DataFrame:
    """
    Converts a raw JSON payload from the prediction API into a single-row
    DataFrame with engineered temporal features matching the training schema.
    """
    hour = int(data.get("hour", 12))
    day_of_week = str(data.get("day_of_week", "Monday"))
    
    # Feature engineering for rush-hour and weekend
    is_rush_hour = bool(hour in [7, 8, 9, 16, 17, 18])
    is_weekend = bool(day_of_week.lower() in ["saturday", "sunday"])
    
    record = {
        "Temperature(F)": float(data.get("temperature", 65.0)),
        "Humidity(%)": float(data.get("humidity", 50.0)),
        "Visibility(mi)": float(data.get("visibility", 10.0)),
        "Wind_Speed(mph)": float(data.get("wind_speed", 5.0)),
        "Hour": hour,
        "Weather_Condition": str(data.get("weather_condition", "Fair")),
        "Day_OfWeek": day_of_week,
        "Junction": bool(data.get("junction", False)),
        "Crossing": bool(data.get("crossing", False)),
        "Traffic_Signal": bool(data.get("traffic_signal", False)),
        "Stop": bool(data.get("stop", False)),
        "Is_Rush_Hour": is_rush_hour,
        "Is_Weekend": is_weekend,
    }
    
    return pd.DataFrame([record])
