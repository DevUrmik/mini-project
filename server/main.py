"""
Vercel Serverless Entrypoint for FastAPI Service
"""
import sys
import types
from pathlib import Path

# Ensure server root is in sys.path
SERVER_DIR = Path(__file__).resolve().parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

# Ensure 'server' package resolves in sys.modules when deployed with root="server"
if "server" not in sys.modules:
    server_pkg = types.ModuleType("server")
    server_pkg.__path__ = [str(SERVER_DIR)]
    server_pkg.__file__ = str(SERVER_DIR / "__init__.py")
    sys.modules["server"] = server_pkg

from app.main import app

# Export ASGI application for Vercel Functions
__all__ = ["app"]
