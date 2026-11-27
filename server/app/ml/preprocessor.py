"""
Accident Severity Preprocessor and Feature Engineering Pipeline

Designed for reproducibility and production readiness:
- Provides Scikit-Learn ColumnTransformer pipelines (canonical 13-feature and extended 28-feature)
- Implements numerical imputation and scaling
- Implements categorical imputation and one-hot / ordinal encoding
- Engineers cyclical temporal features, spatial context, and weather/roadway flags
- Exposes helper for single-sample inference in FastAPI
"""

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, OrdinalEncoder, FunctionTransformer

# Canonical 13-feature lists (preserved for unit test & schema compatibility)
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

# Extended 28-feature pre-incident schema (zero data leakage)
EXTENDED_NUMERICAL_FEATURES = [
    "Start_Lat",
    "Start_Lng",
    "Temperature(F)",
    "Humidity(%)",
    "Visibility(mi)",
    "Wind_Speed(mph)",
    "Hour",
    "Month",
    "Hour_Sin",
    "Hour_Cos",
    "Month_Sin",
    "Month_Cos",
]

EXTENDED_CATEGORICAL_FEATURES = [
    "State",
    "Weather_Condition",
    "Day_OfWeek",
]

EXTENDED_BOOLEAN_FEATURES = [
    "Junction",
    "Crossing",
    "Traffic_Signal",
    "Stop",
    "Is_Rush_Hour",
    "Is_Weekend",
    "Amenity",
    "Give_Way",
    "Railway",
    "Station",
    "Low_Visibility",
    "Freezing_Temp",
    "High_Wind",
]

ALL_EXTENDED_FEATURES = (
    EXTENDED_NUMERICAL_FEATURES
    + EXTENDED_CATEGORICAL_FEATURES
    + EXTENDED_BOOLEAN_FEATURES
)

# Representative state centroids used as defaults when only state is provided at inference
STATE_DEFAULT_CENTROIDS = {
    "CA": (36.7783, -119.4179), "FL": (27.6648, -81.5158), "TX": (31.9686, -99.9018),
    "NY": (42.1657, -74.9481), "SC": (33.8361, -81.1637), "NC": (35.7596, -79.0193),
    "VA": (37.4316, -78.6569), "PA": (41.2033, -77.1945), "MN": (46.7296, -94.6859),
    "OR": (43.8041, -120.5542), "AZ": (34.0489, -111.0937), "GA": (32.1656, -82.9001),
    "IL": (40.6331, -89.3985), "TN": (35.5175, -86.5804), "MI": (44.3148, -85.6024),
    "WA": (47.7511, -120.7401), "OH": (40.4173, -82.9071), "CO": (39.5501, -105.7821),
    "NJ": (40.0583, -74.4057), "MA": (42.4072, -71.3824), "MD": (39.0458, -76.6413),
}

def cast_to_float(x):
    """Casts input array/dataframe to float to safely work with SimpleImputer."""
    return np.asarray(x, dtype=float)

def engineer_extended_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes zero-leakage cyclical temporal and weather-threshold features
    from raw pre-incident columns.
    """
    out = df.copy()
    hour = pd.to_numeric(out.get("Hour", 12), errors="coerce").fillna(12.0)
    minute = pd.to_numeric(out.get("Minute", 0), errors="coerce").fillna(0.0)
    exact_hour = hour + (minute / 60.0)
    month = pd.to_numeric(out.get("Month", 6), errors="coerce").fillna(6.0)
    vis = pd.to_numeric(out.get("Visibility(mi)", 10.0), errors="coerce").fillna(10.0)
    temp = pd.to_numeric(out.get("Temperature(F)", 65.0), errors="coerce").fillna(65.0)
    wind = pd.to_numeric(out.get("Wind_Speed(mph)", 5.0), errors="coerce").fillna(5.0)

    out["Hour_Sin"] = np.sin(2.0 * np.pi * exact_hour / 24.0)
    out["Hour_Cos"] = np.cos(2.0 * np.pi * exact_hour / 24.0)
    out["Month_Sin"] = np.sin(2.0 * np.pi * month / 12.0)
    out["Month_Cos"] = np.cos(2.0 * np.pi * month / 12.0)
    out["Low_Visibility"] = (vis <= 3.0).astype(float)
    out["Freezing_Temp"] = (temp <= 32.0).astype(float)
    out["High_Wind"] = (wind >= 15.0).astype(float)
    return out

def create_feature_pipeline() -> ColumnTransformer:
    """
    Constructs the canonical 13-feature Scikit-learn ColumnTransformer.
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

    return ColumnTransformer(
        transformers=[
            ("num", numerical_transformer, NUMERICAL_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES),
            ("bool", boolean_transformer, BOOLEAN_FEATURES),
        ],
        remainder="drop"
    )

def create_hgb_pipeline() -> ColumnTransformer:
    """
    Constructs the 28-feature ordinal-encoded ColumnTransformer for
    HistGradientBoostingClassifier with native categorical split support.
    """
    numerical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
    ])

    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="constant", fill_value="Unknown")),
        ("ordinal", OrdinalEncoder(
            handle_unknown="use_encoded_value",
            unknown_value=-1,
            encoded_missing_value=-1
        )),
    ])

    boolean_transformer = Pipeline(steps=[
        ("cast_float", FunctionTransformer(cast_to_float)),
        ("imputer", SimpleImputer(strategy="constant", fill_value=0.0)),
    ])

    return ColumnTransformer(
        transformers=[
            ("num", numerical_transformer, EXTENDED_NUMERICAL_FEATURES),
            ("cat", categorical_transformer, EXTENDED_CATEGORICAL_FEATURES),
            ("bool", boolean_transformer, EXTENDED_BOOLEAN_FEATURES),
        ],
        remainder="drop"
    )

def create_ohe_pipeline() -> ColumnTransformer:
    """
    Constructs the 28-feature one-hot encoded ColumnTransformer for linear
    and standard tree-ensemble classifiers (Logistic Regression, Decision Tree, Random Forest).
    """
    numerical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="constant", fill_value="Unknown")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False, max_categories=45)),
    ])

    boolean_transformer = Pipeline(steps=[
        ("cast_float", FunctionTransformer(cast_to_float)),
        ("imputer", SimpleImputer(strategy="constant", fill_value=0.0)),
    ])

    return ColumnTransformer(
        transformers=[
            ("num", numerical_transformer, EXTENDED_NUMERICAL_FEATURES),
            ("cat", categorical_transformer, EXTENDED_CATEGORICAL_FEATURES),
            ("bool", boolean_transformer, EXTENDED_BOOLEAN_FEATURES),
        ],
        remainder="drop"
    )

def prepare_inference_features(data: dict) -> pd.DataFrame:
    """
    Converts a raw JSON payload from the prediction API into a single-row
    DataFrame with all canonical and extended engineered features.
    """
    hour = int(data.get("hour", 12))
    minute = max(0, min(59, int(data.get("minute", 0))))
    month = int(data.get("month", 6))
    day_of_week = str(data.get("day_of_week", "Monday"))
    state = str(data.get("state", "CA")).upper()
    default_lat, default_lng = STATE_DEFAULT_CENTROIDS.get(state, (36.7783, -119.4179))

    lat = float(data["latitude"]) if data.get("latitude") is not None else default_lat
    lng = float(data["longitude"]) if data.get("longitude") is not None else default_lng

    is_rush_hour = bool(hour in [7, 8, 9, 16, 17, 18])
    is_weekend = bool(day_of_week.lower() in ["saturday", "sunday"])

    record = {
        "Start_Lat": lat,
        "Start_Lng": lng,
        "Temperature(F)": float(data.get("temperature", 65.0)),
        "Humidity(%)": float(data.get("humidity", 50.0)),
        "Visibility(mi)": float(data.get("visibility", 10.0)),
        "Wind_Speed(mph)": float(data.get("wind_speed", 5.0)),
        "Hour": hour,
        "Minute": minute,
        "Month": month,
        "State": state,
        "Weather_Condition": str(data.get("weather_condition", "Fair")),
        "Day_OfWeek": day_of_week,
        "Junction": bool(data.get("junction", False)),
        "Crossing": bool(data.get("crossing", False)),
        "Traffic_Signal": bool(data.get("traffic_signal", False)),
        "Stop": bool(data.get("stop", False)),
        "Is_Rush_Hour": is_rush_hour,
        "Is_Weekend": is_weekend,
        "Amenity": bool(data.get("amenity", False)),
        "Give_Way": bool(data.get("give_way", False)),
        "Railway": bool(data.get("railway", False)),
        "Station": bool(data.get("station", False)),
    }

    return engineer_extended_features(pd.DataFrame([record]))
