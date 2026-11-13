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
    res_data = response.json()
    items = res_data["items"] if isinstance(res_data, dict) and "items" in res_data else res_data
    assert len(items) == 15
    first = items[0]
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

def test_geographic_multi_state_coverage(client):
    # Test multi-state sampling
    res = client.get("/api/accidents?limit=1500")
    assert res.status_code == 200
    res_data = res.json()
    items = res_data["items"] if isinstance(res_data, dict) and "items" in res_data else res_data
    states = {d["state"] for d in items}
    assert "CA" in states and "TX" in states and "FL" in states

    # Test Texas specifically
    res_tx = client.get("/api/accidents?state=TX&limit=500")
    assert res_tx.status_code == 200
    tx_res = res_tx.json()
    tx_items = tx_res["items"] if isinstance(tx_res, dict) and "items" in tx_res else tx_res
    assert len(tx_items) > 0
    assert all(d["state"] == "TX" for d in tx_items)

    # Test Florida specifically
    res_fl = client.get("/api/accidents?state=FL&limit=500")
    assert res_fl.status_code == 200
    fl_res = res_fl.json()
    fl_items = fl_res["items"] if isinstance(fl_res, dict) and "items" in fl_res else fl_res
    assert len(fl_items) > 0
    assert all(d["state"] == "FL" for d in fl_items)

def test_geo_endpoints(client):
    # States
    res_states = client.get("/api/geo/states")
    assert res_states.status_code == 200
    states_data = res_states.json()
    assert len(states_data) >= 49
    state_codes = [s["state"] for s in states_data]
    assert "CA" in state_codes and "TX" in state_codes and "NY" in state_codes

    # Cities
    res_cities = client.get("/api/geo/cities?state=CA")
    assert res_cities.status_code == 200
    cities_ca = res_cities.json()
    assert len(cities_ca) > 0
    assert any(c["city"] == "Los Angeles" for c in cities_ca)

    # Bounds
    res_bounds = client.get("/api/geo/bounds")
    assert res_bounds.status_code == 200
    bounds_data = res_bounds.json()
    assert bounds_data["min_lat"] >= 24.0
    assert bounds_data["max_lat"] <= 50.0
    assert bounds_data["total_records"] > 0

def test_multi_state_clustering_endpoints(client):
    # DBSCAN ALL
    res_all = client.get("/api/hotspots/dbscan")
    assert res_all.status_code == 200
    cities_all = [c["dominant_city"] for c in res_all.json()["clusters"]]
    assert any(city in cities_all for city in ["Los Angeles", "San Jose", "Bronx", "Houston", "Miami"])

    # DBSCAN TX
    res_tx = client.get("/api/hotspots/dbscan?state=TX")
    assert res_tx.status_code == 200
    assert len(res_tx.json()["clusters"]) > 0

    # DBSCAN FL
    res_fl = client.get("/api/hotspots/dbscan?state=FL")
    assert res_fl.status_code == 200
    assert len(res_fl.json()["clusters"]) > 0


