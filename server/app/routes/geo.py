"""
Dynamic Geographic Route Handlers for US States, Cities, and Calculated Map Bounds
"""

from typing import List, Optional
from fastapi import APIRouter, Query

from server.app.schemas.accident import (
    StateSummary,
    CitySummary,
    GeoBoundsResponse
)
from server.app.services.data_service import DataService

router = APIRouter(prefix="/geo", tags=["Geography"])

@router.get("/states", response_model=List[StateSummary])
def get_available_states():
    """
    Returns all available states present in the loaded dataset with their actual incident counts.
    Zero hardcoded state lists.
    """
    ds = DataService.get_instance()
    return ds.get_states()

@router.get("/cities", response_model=List[CitySummary])
def get_available_cities(
    state: Optional[str] = Query(None, description="Optional state abbreviation filter (e.g. CA, TX, FL)")
):
    """
    Returns available cities and their actual incident counts, optionally filtered by state.
    Zero hardcoded city lists.
    """
    ds = DataService.get_instance()
    return ds.get_cities(state=state)

@router.get("/bounds", response_model=GeoBoundsResponse)
def get_dataset_bounds(
    state: Optional[str] = Query(None, description="Optional state abbreviation to compute exact state bounds"),
    city: Optional[str] = Query(None, description="Optional city name to compute exact city bounds")
):
    """
    Calculates geographic bounding box coordinates directly from actual accident GPS records.
    Never uses arbitrary fixed constants or clips northern states.
    """
    ds = DataService.get_instance()
    return ds.get_bounds(state=state, city=city)

