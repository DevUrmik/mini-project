"""
Unit Tests for Data Preprocessor and Feature Engineering
"""

import sys
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server.app.ml.preprocessor import (
    create_feature_pipeline,
    prepare_inference_features,
    ALL_MODEL_FEATURES
)

def test_prepare_inference_features():
    raw_input = {
        "temperature": 75.0,
        "humidity": 60.0,
        "visibility": 8.0,
        "wind_speed": 10.0,
        "weather_condition": "Rain",
        "hour": 8,
        "day_of_week": "Monday",
        "junction": True,
        "crossing": False,
        "traffic_signal": True,
        "stop": False
    }
    df = prepare_inference_features(raw_input)
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 1
    assert df["Hour"].iloc[0] == 8
    assert bool(df["Is_Rush_Hour"].iloc[0]) is True
    assert bool(df["Is_Weekend"].iloc[0]) is False
    assert bool(df["Junction"].iloc[0]) is True
    assert df["Weather_Condition"].iloc[0] == "Rain"

def test_feature_pipeline_fit_transform():
    # Synthetic small batch
    data = {
        "Temperature(F)": [65.0, 72.0, np.nan, 80.0],
        "Humidity(%)": [50.0, np.nan, 70.0, 45.0],
        "Visibility(mi)": [10.0, 8.0, 5.0, np.nan],
        "Wind_Speed(mph)": [5.0, 12.0, 8.0, 3.0],
        "Hour": [8, 14, 18, 22],
        "Weather_Condition": ["Fair", "Rain", "Fog", None],
        "Day_OfWeek": ["Monday", "Wednesday", "Friday", "Sunday"],
        "Junction": [True, False, True, False],
        "Crossing": [False, True, False, False],
        "Traffic_Signal": [True, False, False, True],
        "Stop": [False, False, False, False],
        "Is_Rush_Hour": [True, False, True, False],
        "Is_Weekend": [False, False, False, True]
    }
    df = pd.DataFrame(data)
    pipeline = create_feature_pipeline()
    X_transformed = pipeline.fit_transform(df)

    assert X_transformed.shape[0] == 4
    # Ensure no NaN remains in transformed matrix
    assert not np.isnan(X_transformed).any()
