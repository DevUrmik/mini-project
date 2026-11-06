"""
Spatial Hotspots Route Handlers (K-Means & DBSCAN)
"""

from fastapi import APIRouter, Query
from server.app.schemas.accident import (
    KMeansHotspotsResponse,
    DBSCANHotspotsResponse
)
from server.app.services.hotspot_service import HotspotService

router = APIRouter(prefix="/hotspots", tags=["Hotspots"])

@router.get("", response_model=KMeansHotspotsResponse)
def get_kmeans_hotspots(
    k: int = Query(10, ge=5, le=20, description="Number of clusters (K = 5, 8, 10, 15, 20)")
):
    """
    Returns K-Means accident cluster centers, accident density counts,
    and average severity across historical coordinates.
    """
    hs = HotspotService.get_instance()
    return hs.get_kmeans_hotspots(k=k)

@router.get("/dbscan", response_model=DBSCANHotspotsResponse)
def get_dbscan_hotspots():
    """
    Returns DBSCAN density clusters computed using true spherical Haversine distance,
    identifying high-density highway corridors and isolating noise/outlier incidents.
    """
    hs = HotspotService.get_instance()
    return hs.get_dbscan_hotspots()

@router.get("/comparison")
def get_clustering_comparison():
    """Returns theoretical and empirical comparison between K-Means and DBSCAN algorithms."""
    hs = HotspotService.get_instance()
    return hs.get_clustering_comparison()

