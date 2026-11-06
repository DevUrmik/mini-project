"""
Dashboard & Health Route Handlers
"""

from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException

from server.app.schemas.accident import (
    DashboardSummaryResponse,
    AccidentSummary,
    HealthResponse
)
from server.app.services.data_service import DataService
from server.app.services.prediction_service import PredictionService

router = APIRouter(tags=["Dashboard"])

@router.get("/health", response_model=HealthResponse)
def get_health():
    """Health check endpoint reporting API status and model readiness."""
    ds = DataService.get_instance()
    ps = PredictionService.get_instance()
    return {
        "status": "healthy",
        "version": "1.0.0",
        "uptime": "online",
        "data_loaded": ds._df is not None and not ds._df.empty,
        "model_loaded": ps._rf_model is not None and ps._preprocessor is not None
    }

@router.get("/dashboard/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary():
    """Returns top-level overview metrics, severity breakdown, and geographic distribution."""
    ds = DataService.get_instance()
    return ds.get_summary()

@router.get("/accidents", response_model=List[AccidentSummary])
def get_accidents(
    limit: int = Query(500, ge=1, le=2500, description="Max number of sampled accidents to return"),
    state: Optional[str] = Query(None, description="Filter by state abbreviation (e.g. CA, FL, TX)"),
    city: Optional[str] = Query(None, description="Filter by city name"),
    severity: Optional[int] = Query(None, ge=1, le=4, description="Filter by severity level (1-4)"),
    min_lat: Optional[float] = Query(None, description="Bounding box minimum latitude"),
    max_lat: Optional[float] = Query(None, description="Bounding box maximum latitude"),
    min_lng: Optional[float] = Query(None, description="Bounding box minimum longitude"),
    max_lng: Optional[float] = Query(None, description="Bounding box maximum longitude"),
    start_date: Optional[str] = Query(None, description="Filter start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter end date (YYYY-MM-DD)")
):
    """Retrieves sampled accident records with optional geographic viewport, date range, and state filtering."""
    ds = DataService.get_instance()
    return ds.get_accidents(
        limit=limit,
        state=state,
        city=city,
        severity=severity,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lng=min_lng,
        max_lng=max_lng,
        start_date=start_date,
        end_date=end_date
    )

