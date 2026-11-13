"""
Accident Hotspot Prediction and Road Safety Intelligence System
FastAPI Application Entry Point
"""

import sys
import types
from pathlib import Path

# Ensure 'server' package resolves in sys.modules whether running inside server/ (Vercel) or from repo root
_current_dir = Path(__file__).resolve().parent  # server/app
_server_dir = _current_dir.parent               # server/

if str(_server_dir) not in sys.path:
    sys.path.insert(0, str(_server_dir))

if "server" not in sys.modules:
    _server_pkg = types.ModuleType("server")
    _server_pkg.__path__ = [str(_server_dir)]
    _server_pkg.__file__ = str(_server_dir / "__init__.py")
    sys.modules["server"] = _server_pkg

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from server.app.config import API_TITLE, API_VERSION, CORS_ORIGINS
from server.app.services.data_service import DataService
from server.app.services.hotspot_service import HotspotService
from server.app.services.prediction_service import PredictionService

from server.app.routes import (
    dashboard,
    hotspots,
    models,
    predict,
    analytics,
    geo
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Resilient startup for serverless environments (cold-start optimized)
    try:
        DataService.get_instance()
    except Exception as e:
        print(f"[STARTUP WARNING] DataService initialization: {e}")
    try:
        HotspotService.get_instance()
    except Exception as e:
        print(f"[STARTUP WARNING] HotspotService initialization: {e}")
    yield

app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description=(
        "Production-grade Road Safety Intelligence API providing spatial accident "
        "hotspot clustering (K-Means & DBSCAN with Haversine spherical distance), "
        "machine learning severity classification, empirical model evaluation, "
        "and data-driven accident analytics based on the US Accidents dataset."
    ),
    lifespan=lifespan
)

# Configure CORS for Vite + React 19 frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits all local and deployed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Route Routers under both "/api" and "" (root)
# This guarantees routes match whether Vercel preserves or strips the /api prefix
for prefix in ["/api", ""]:
    app.include_router(dashboard.router, prefix=prefix)
    app.include_router(hotspots.router, prefix=prefix)
    app.include_router(models.router, prefix=prefix)
    app.include_router(predict.router, prefix=prefix)
    app.include_router(analytics.router, prefix=prefix)
    app.include_router(geo.router, prefix=prefix)

@app.get("/", include_in_schema=False)
def root():
    """Redirects base URL directly to interactive Swagger UI documentation."""
    return RedirectResponse(url="/docs")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.app.main:app", host="127.0.0.1", port=8000, reload=True)

