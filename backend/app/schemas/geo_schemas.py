"""Pydantic v2 Schemas for Geospatial & Topographical Operations."""

import math
from typing import List, Optional, Tuple
from pydantic import BaseModel, Field, field_validator


class RawGpsPoint(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    ele: Optional[float] = Field(default=None, description="Raw GPS or barometric elevation in meters")
    timestamp: float = Field(..., description="Epoch timestamp in seconds")


class SnappedGpsPoint(BaseModel):
    lat: float
    lon: float
    ele_raw: Optional[float]
    ele_snapped: float
    ele_filtered: float
    snapped_msl: float
    timestamp: float
    clamped: bool = False


class ElevationSnapRequest(BaseModel):
    points: List[RawGpsPoint] = Field(..., min_length=1, description="Sequential GPS trackpoints")
    source_dem: str = Field(default="cartodem_30m", description="DEM source (e.g., cartodem_30m, srtm_30m)")
    apply_smoothing: bool = Field(default=True, description="Apply Savitzky-Golay smoothing")
    barometric_fallback: bool = Field(default=True, description="Fallback to barometric altitude if DEM void")


class ElevationSnapResponse(BaseModel):
    points: List[SnappedGpsPoint]
    total_gain_m: float
    total_loss_m: float
    max_elevation_m: float
    min_elevation_m: float
    void_fill_count: int
    processing_time_ms: float


class SoiGeoreferenceRequest(BaseModel):
    sheet_number: str = Field(..., pattern=r"^[0-9]{2}[A-Z]/[0-9]{1,2}$", json_schema_extra={"example": "53J/3"})
    # Top-Left, Top-Right, Bottom-Right, Bottom-Left corners (lat, lon)
    corners_latlon: Tuple[
        Tuple[float, float],
        Tuple[float, float],
        Tuple[float, float],
        Tuple[float, float],
    ] = Field(
        ...,
        description="4-corner neatline coordinates: (TL, TR, BR, BL)",
    )
    min_zoom: int = Field(default=11, ge=8, le=18)
    max_zoom: int = Field(default=15, ge=8, le=18)


class SoiGeoreferenceResponse(BaseModel):
    sheet_number: str
    mbtiles_url: str
    bounds_bbox: List[float]  # [min_lon, min_lat, max_lon, max_lat]
    min_zoom: int
    max_zoom: int
    status: str
    message: str


class OsmHarvestRequest(BaseModel):
    # [min_lat, min_lon, max_lat, max_lon]
    bbox: List[float] = Field(..., min_length=4, max_length=4, description="Bounding box [min_lat, min_lon, max_lat, max_lon]")
    categories: List[str] = Field(
        default=["hiking_routes", "springs", "drinking_water", "campsites", "peaks", "passes"],
        description="OSM tags to harvest",
    )

    @field_validator("bbox")
    @classmethod
    def validate_bbox(cls, bbox: List[float]) -> List[float]:
        min_lat, min_lon, max_lat, max_lon = bbox
        if not all(math.isfinite(value) for value in bbox):
            raise ValueError("bbox coordinates must be finite")
        if not (-90 <= min_lat < max_lat <= 90 and -180 <= min_lon < max_lon <= 180):
            raise ValueError("bbox must have ordered latitude and longitude bounds within WGS84")
        if max_lat - min_lat > 0.5 or max_lon - min_lon > 0.5:
            raise ValueError("bbox may span at most 0.5 degrees per side")
        return bbox


class OsmHarvestFeature(BaseModel):
    osm_id: int
    osm_type: str
    category: str
    name: Optional[str] = "Unnamed Trail/POI"
    geometry_type: str
    coordinates: List
    tags: dict = {}


class OsmHarvestResponse(BaseModel):
    status: str
    total_harvested: int
    features: List[OsmHarvestFeature]
