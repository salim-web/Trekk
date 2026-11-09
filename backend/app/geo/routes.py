"""FastAPI Router for Geospatial & Topographical Operations."""

import os
import shutil
import tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from app.schemas.geo_schemas import (
    ElevationSnapRequest,
    ElevationSnapResponse,
    SoiGeoreferenceResponse,
    OsmHarvestRequest,
    OsmHarvestResponse,
)
from app.geo.cartodem import cartodem_engine
from app.geo.soi_pipeline import soi_pipeline
from app.geo.overpass_harvester import overpass_harvester

router = APIRouter(prefix="", tags=["Geospatial & Topography"])


@router.post("/elevation/snap", response_model=ElevationSnapResponse)
async def snap_elevation(request: ElevationSnapRequest):
    """Snaps noisy GPS elevation trackpoints against CartoDEM 30m raster,

    applies velocity clamping (<1500m/hr), and Savitzky-Golay smoothing.
    """
    try:
        return cartodem_engine.snap_track(
            points=request.points,
            apply_smoothing=request.apply_smoothing,
            barometric_fallback=request.barometric_fallback,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Elevation snapping error: {str(e)}")


@router.post("/geo/soi/georeference", response_model=SoiGeoreferenceResponse)
async def georeference_soi_sheet(
    sheet_number: str = Form(..., description="e.g. 53J/3"),
    tl_lat: float = Form(...),
    tl_lon: float = Form(...),
    tr_lat: float = Form(...),
    tr_lon: float = Form(...),
    br_lat: float = Form(...),
    br_lon: float = Form(...),
    bl_lat: float = Form(...),
    bl_lon: float = Form(...),
    min_zoom: int = Form(11),
    max_zoom: int = Form(15),
    sheet_file: UploadFile = File(...),
):
    """Georeferences an uploaded Survey of India 1:50k PDF/GeoTIFF using 4-corner neatline GCPs

    and exports an EPSG:3857 MBTiles raster tile archive.
    """
    corners = (
        (tl_lat, tl_lon),
        (tr_lat, tr_lon),
        (br_lat, br_lon),
        (bl_lat, bl_lon),
    )

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(sheet_file.filename)[1]) as tmp:
        shutil.copyfileobj(sheet_file.file, tmp)
        tmp_path = tmp.name

    try:
        result = soi_pipeline.georeference_sheet(
            input_pdf_or_image_path=tmp_path,
            sheet_number=sheet_number,
            corners_latlon=corners,
            min_zoom=min_zoom,
            max_zoom=max_zoom,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Georeferencing pipeline failed: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.post("/geo/harvest-osm", response_model=OsmHarvestResponse)
async def harvest_osm(request: OsmHarvestRequest):
    """Harvests paths, water springs, campsites, and peaks within a Himalayan bounding box via Overpass QL."""
    try:
        return overpass_harvester.harvest(bbox=request.bbox)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OSM harvest failed: {str(e)}")
