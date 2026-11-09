"""TrekIndia FastAPI Application Entrypoint."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.geo.routes import router as geo_router
from app.party.routes import router as party_router

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("trekindia.main")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Tactile Field-Instrument Topographical Engine & P2P Himalayan Expedition Mesh",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route prefixes
app.include_router(geo_router, prefix=settings.API_V1_PREFIX)
app.include_router(party_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["System"])
async def health_check():
    """System health check and topographical engine readiness."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "climb_rate_clamp_mps": settings.MAX_ELEVATION_RATE_M_PER_S,
        "engine": "CartoDEM v3 R1 + PostGIS + GDAL",
    }
