"""
Haversine Geographic Distance Calculations and Clustering Helpers

Provides accurate spherical distance calculations for geospatial clustering.
Latitude and longitude are spherical angular coordinates; treating them as
Euclidean Cartesian coordinates introduces severe spatial distortion, especially
at higher latitudes.

Earth radius approximation: 6,371.0088 kilometers (WGS-84 mean radius).
"""

import numpy as np

EARTH_RADIUS_KM = 6371.0088
EARTH_RADIUS_MILES = 3958.7613

def km_to_radians(km: float) -> float:
    """
    Converts kilometers into spherical radians for Scikit-Learn DBSCAN haversine metric.
    
    Formula:
    radians = distance / earth_radius
    """
    return km / EARTH_RADIUS_KM

def radians_to_km(radians: float) -> float:
    """
    Converts spherical radians back into kilometers.
    """
    return radians * EARTH_RADIUS_KM

def haversine_vectorized(lat1: float, lng1: float, lat2: np.ndarray, lng2: np.ndarray) -> np.ndarray:
    """
    Calculates great-circle distance between a single reference point and an array of points in kilometers.
    """
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    delta_phi = np.radians(lat2 - lat1)
    delta_lambda = np.radians(lng2 - lng1)

    a = np.sin(delta_phi / 2.0)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda / 2.0)**2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))

    return EARTH_RADIUS_KM * c

