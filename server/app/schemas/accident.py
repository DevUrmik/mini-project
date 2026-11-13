"""
Pydantic Schemas for Accident Records, Dashboard Summary, and Hotspots
"""

from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

class AccidentSummary(BaseModel):
    id: str
    severity: int
    start_time: str
    latitude: float
    longitude: float
    city: Optional[str] = None
    state: Optional[str] = None
    weather_condition: Optional[str] = None
    temperature_f: Optional[float] = None
    junction: bool = False
    traffic_signal: bool = False

class DashboardSummaryResponse(BaseModel):
    total_accidents: int
    average_severity: float
    high_impact_percentage: float
    data_source: str
    is_synthetic: bool
    severity_distribution: Dict[str, int]
    top_states: Dict[str, int]
    top_cities: Dict[str, int]
    top_weather_conditions: Dict[str, int]
    road_features_prevalence: Dict[str, float]
    temporal_range: Dict[str, str]

class HotspotCluster(BaseModel):
    cluster_id: int
    center_lat: float
    center_lng: float
    accident_count: int
    accident_percentage: float
    average_severity: float
    spread_radius_km: float
    dominant_city: str
    state: Optional[str] = None

class KMeansHotspotsResponse(BaseModel):
    algorithm: str = "K-Means"
    k: int
    inertia: float
    total_clusters: int
    clusters: List[HotspotCluster]

class DBSCANHotspotsResponse(BaseModel):
    algorithm: str
    distance_metric: str
    parameters: Dict[str, Any]
    total_analyzed_points: int
    identified_clusters_count: int
    clustered_points_count: int
    noise_points_count: int
    noise_percentage: float
    clusters: List[HotspotCluster]
    status_message: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    version: str
    uptime: str
    data_loaded: bool
    model_loaded: bool

class PaginatedAccidentsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: List[AccidentSummary]

class StateSummary(BaseModel):
    state: str
    name: str
    count: int

class CitySummary(BaseModel):
    city: str
    state: str
    count: int

class GeoBoundsResponse(BaseModel):
    min_lat: float
    max_lat: float
    min_lng: float
    max_lng: float
    bounds: List[List[float]]
    total_records: int

