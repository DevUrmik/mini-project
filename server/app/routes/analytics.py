"""
Road Safety Intelligence Analytics Route Handlers
"""

from fastapi import APIRouter
from server.app.schemas.analytics import (
    TimeAnalyticsResponse,
    WeatherAnalyticsResponse,
    InfrastructureAnalyticsResponse
)
from server.app.services.data_service import DataService

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/time", response_model=TimeAnalyticsResponse)
def get_time_analytics():
    """Returns hourly and daily accident volume distributions and rush-hour breakdowns."""
    ds = DataService.get_instance()
    return ds.get_time_analytics()

@router.get("/weather", response_model=WeatherAnalyticsResponse)
def get_weather_analytics():
    """Returns weather condition frequencies, temperature distributions, and severity correlation insights."""
    ds = DataService.get_instance()
    return ds.get_weather_analytics()

@router.get("/infrastructure", response_model=InfrastructureAnalyticsResponse)
def get_infrastructure_analytics():
    """Returns accident occurrence and severity metrics across road features (Junctions, Signals, Crossings)."""
    ds = DataService.get_instance()
    return ds.get_infrastructure_analytics()

