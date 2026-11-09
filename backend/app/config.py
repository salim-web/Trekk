"""TrekIndia Backend Configuration.

Loads environment variables with Pydantic v2 Settings.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    PROJECT_NAME: str = "TrekIndia Geospatial & Telemetry Platform"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Database & PostGIS
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://trekindia:alpine_pass_2026@localhost:5432/trekindia_db",
        description="Async SQLAlchemy connection string for PostgreSQL with PostGIS",
    )
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Topographical & GDAL Settings
    CARTODEM_VRT_PATH: str = "/var/data/cartodem/cartodem_himalayas.vrt"
    SOI_STORAGE_DIR: str = "/var/data/soi_sheets"
    TILE_OUTPUT_DIR: str = "/var/data/tiles"
    MAX_ELEVATION_RATE_M_PER_S: float = 0.4167  # 1500 m / hr

    # Cloudflare R2 / S3 Storage
    S3_ENDPOINT_URL: str = "https://mock-r2.cloudflarestorage.com"
    S3_ACCESS_KEY_ID: str = "mock_key_id"
    S3_SECRET_ACCESS_KEY: str = "mock_secret_key"
    S3_BUCKET_NAME: str = "trekindia-media"
    S3_PUBLIC_DOMAIN: str = "https://media.trekindia.org"
    S3_REGION_NAME: str = "auto"

    # Strava API Partner Integration
    STRAVA_CLIENT_ID: str = "109284"
    STRAVA_CLIENT_SECRET: str = "mock_strava_secret"
    STRAVA_REDIRECT_URI: str = "https://api.trekindia.org/api/v1/auth/strava/callback"

    # Security & CORS
    JWT_SECRET: str = "super_secret_basalt_hmac_sha256_key_at_least_64_bytes_long_himalayan"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 30  # 30 days
    CORS_ORIGINS: List[str] = ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="allow",
    )


settings = Settings()
