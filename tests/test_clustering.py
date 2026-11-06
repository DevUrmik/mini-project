"""
Unit Tests for Haversine Calculations and Spatial Clustering Logic
"""

import sys
from pathlib import Path
import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server.app.ml.haversine import (
    km_to_radians,
    radians_to_km,
    haversine_vectorized,
    EARTH_RADIUS_KM
)

def test_km_radians_conversion():
    km = 100.0
    rad = km_to_radians(km)
    reconverted = radians_to_km(rad)
    assert pytest.approx(reconverted, rel=1e-5) == km

def test_haversine_vectorized_known_distance():
    # Distance between Los Angeles (34.0522, -118.2437) and San Francisco (37.7749, -122.4194)
    # Known great-circle distance is approx 559 km (~347 miles)
    la_lat, la_lng = 34.0522, -118.2437
    sf_lat, sf_lng = np.array([37.7749]), np.array([-122.4194])

    distance_km = haversine_vectorized(la_lat, la_lng, sf_lat, sf_lng)[0]
    assert 550.0 < distance_km < 570.0

def test_haversine_zero_distance():
    lat = 34.0522
    lng = -118.2437
    dist = haversine_vectorized(lat, lng, np.array([lat]), np.array([lng]))[0]
    assert pytest.approx(dist, abs=1e-4) == 0.0

