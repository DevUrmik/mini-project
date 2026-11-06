"""
Unit and Integration Tests for FastAPI Endpoints and ML Inference
"""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from server.app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client

def test_health_endpoint(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["data_loaded"] is True
    assert data["model_loaded"] is True

def test_dashboard_summary_endpoint(client):
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_accidents"] > 0
    assert "severity_distribution" in data
    assert "2" in data["severity_distribution"]

def test_accidents_endpoint(client):
    response = client.get("/api/accidents?limit=15")
    assert response.status_code == 200
    accidents = response.json()
    assert isinstance(accidents, list)
    assert len(accidents) == 15
    first = accidents[0]
    assert "latitude" in first
    assert "longitude" in first
    assert "severity" in first

def test_kmeans_hotspots_endpoint(client):
    response = client.get("/api/hotspots?k=10")
    assert response.status_code == 200
    data = response.json()
    assert data["algorithm"] == "K-Means"
    assert data["k"] == 10
    assert len(data["clusters"]) == 10
    assert "center_lat" in data["clusters"][0]

def test_dbscan_hotspots_endpoint(client):
    response = client.get("/api/hotspots/dbscan")
    assert response.status_code == 200
    data = response.json()
    assert "DBSCAN" in data["algorithm"]
    assert data["distance_metric"] == "Haversine (Great-Circle Spherical Distance)"
    assert data["identified_clusters_count"] > 0
    assert "noise_percentage" in data

def test_time_analytics_endpoint(client):
    response = client.get("/api/analytics/time")
    assert response.status_code == 200
    data = response.json()
    assert len(data["hourly"]) == 24
    assert len(data["daily"]) == 7
    assert "rush_hour_breakdown" in data

def test_weather_analytics_endpoint(client):
    response = client.get("/api/analytics/weather")
    assert response.status_code == 200
    data = response.json()
    assert len(data["weather_conditions"]) > 0
    assert len(data["temperature_distribution"]) > 0

def test_models_metrics_endpoint(client):
    response = client.get("/api/models/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "models" in data
    assert "random_forest" in data["models"]
    assert "decision_tree" in data["models"]
    assert "logistic_regression" in data["models"]
    assert "feature_importances" in data
    assert len(data["feature_importances"]) > 0

def test_predict_severity_endpoint(client):
    payload = {
        "temperature": 72.0,
        "humidity": 45.0,
        "visibility": 10.0,
        "wind_speed": 6.0,
        "weather_condition": "Clear",
        "hour": 8,
        "day_of_week": "Tuesday",
        "junction": True,
        "crossing": False,
        "traffic_signal": True,
        "stop": False
    }
    response = client.post("/api/predict/severity", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_severity"] in [1, 2, 3, 4]
    assert "traffic_impact_description" in data
    assert len(data["class_probabilities"]) == 4

