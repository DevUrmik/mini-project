"""
Spatial Hotspots Route Handlers (K-Means & DBSCAN)
"""

from typing import Optional
from fastapi import APIRouter, Query
from server.app.schemas.accident import (
    KMeansHotspotsResponse,
    DBSCANHotspotsResponse
)
from server.app.services.hotspot_service import HotspotService

router = APIRouter(prefix="/hotspots", tags=["Hotspots"])

@router.get("", response_model=KMeansHotspotsResponse)
@router.get("/kmeans", response_model=KMeansHotspotsResponse)
def get_kmeans_hotspots(
    k: int = Query(10, ge=2, le=20, description="Number of clusters (K = 2 to 20)"),
    state: Optional[str] = Query(None, description="Filter clusters by state abbreviation (CA, FL, TX, ALL)")
):
    """
    Returns K-Means accident cluster centers, accident density counts,
    and average severity across historical coordinates, with optional state filtering.
    """
    hs = HotspotService.get_instance()
    return hs.get_kmeans_hotspots(k=k, state=state)

@router.get("/dbscan", response_model=DBSCANHotspotsResponse)
def get_dbscan_hotspots(
    state: Optional[str] = Query(None, description="Filter clusters by state abbreviation (CA, TX, NY, ALL)"),
    eps_km: Optional[float] = Query(None, ge=1.0, le=50.0, description="Optional custom neighborhood radius in km"),
    min_samples: Optional[int] = Query(None, ge=2, le=200, description="Optional custom density threshold")
):
    """
    Returns DBSCAN density clusters computed using true spherical Haversine distance,
    identifying high-density highway corridors and isolating noise/outlier incidents.
    Supports nationwide view, per-state precomputed clusters, and dynamic custom parameter execution.
    """
    hs = HotspotService.get_instance()
    return hs.get_dbscan_hotspots(state=state, eps_km=eps_km, min_samples=min_samples)

@router.get("/comparison")
def get_clustering_comparison():
    """Returns theoretical and empirical comparison between K-Means and DBSCAN algorithms."""
    hs = HotspotService.get_instance()
    return hs.get_clustering_comparison()

