"""
Vercel Serverless Entrypoint for FastAPI Service
"""
from app.main import app

# Export ASGI application for Vercel Functions
__all__ = ["app"]

