"""Integration tests for TrekIndia FastAPI API endpoints."""

import uuid
from datetime import datetime, timezone
from threading import get_ident

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.db.database import get_db
from app.db.models import PartyMedia, TrekParty, TrekPartyMember, User
from app.main import app


@pytest_asyncio.fixture
async def party_db_override():
    records = {}

    class Session:
        async def get(self, model, key):
            return records.get(model, {}).get(key)

        def add(self, record):
            model_records = records.setdefault(type(record), {})
            if isinstance(record, TrekPartyMember):
                key = (record.party_id, record.user_id)
            else:
                if getattr(record, "id", None) is None:
                    record.id = uuid.uuid4()
                key = record.id
            if isinstance(record, TrekParty):
                record.created_at = datetime.now(timezone.utc)
            elif isinstance(record, TrekPartyMember):
                record.joined_at = datetime.now(timezone.utc)
            elif isinstance(record, PartyMedia):
                record.created_at = datetime.now(timezone.utc)
            model_records[key] = record

        async def flush(self):
            pass

    async def override_get_db():
        yield Session()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield records
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "CartoDEM" in data["engine"]


@pytest.mark.asyncio
async def test_elevation_snap_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "points": [
                {"lat": 31.0772, "lon": 78.1831, "ele": 1950.0, "timestamp": 1731160000},
                {"lat": 31.0690, "lon": 78.1910, "ele": 2400.0, "timestamp": 1731163600},
                {"lat": 31.0580, "lon": 78.2010, "ele": 2950.0, "timestamp": 1731167200},
                {"lat": 31.0238, "lon": 78.1722, "ele": 3810.0, "timestamp": 1731174400},
            ],
            "apply_smoothing": True,
            "barometric_fallback": True,
        }
        resp = await client.post("/api/v1/elevation/snap", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["points"]) == 4
        assert data["total_gain_m"] > 0
        assert data["max_elevation_m"] > 3000


@pytest.mark.asyncio
async def test_party_lifecycle_api(party_db_override):
    user_id = uuid.UUID("11111111-2222-3333-4444-555555555555")
    party_db_override[User] = {
        user_id: User(id=user_id, name="Trekker One", email="trekker@example.com")
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create Party currently active (started yesterday, ends in 3 days)
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        starts_at = (now - timedelta(days=1)).isoformat()
        ends_at = (now + timedelta(days=3)).isoformat()

        party_payload = {
            "name": "Kedarkantha Winter Expedition 2026",
            "starts_at": starts_at,
            "ends_at": ends_at,
        }
        create_resp = await client.post("/api/v1/party", json=party_payload)
        assert create_resp.status_code == 200
        party = create_resp.json()
        party_id = party["id"]
        assert party["name"] == "Kedarkantha Winter Expedition 2026"
        assert party["invite_code"].startswith("TI-")

        # 2. Get Party
        get_resp = await client.get(f"/api/v1/party/{party_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == party_id

        # 3. Add Member
        member_payload = {
            "user_id": "11111111-2222-3333-4444-555555555555",
            "role": "guide",
        }
        member_resp = await client.post(f"/api/v1/party/{party_id}/members", json=member_payload)
        assert member_resp.status_code == 200
        assert member_resp.json()["role"] == "guide"

        # 4. Pin Spatial Photo
        pin_payload = {
            "uploaded_by": "11111111-2222-3333-4444-555555555555",
            "storage_key": "parties/kedarkantha/summit_ridge_frozen.jpg",
            "captured_at": "2026-12-18T10:30:00Z",
            "lat": 0.0,
            "lon": 0.0,
            "elevation_m": 3810.0,
            "is_public": True,
        }
        pin_resp = await client.post(f"/api/v1/party/{party_id}/media/pin", json=pin_payload)
        assert pin_resp.status_code == 200
        media = pin_resp.json()
        assert media["storage_key"] == "parties/kedarkantha/summit_ridge_frozen.jpg"
        assert media["lat"] == 0.0
        assert media["lon"] == 0.0
        assert party_db_override[TrekParty][uuid.UUID(party_id)].name == party["name"]
        assert (uuid.UUID(party_id), user_id) in party_db_override[TrekPartyMember]
        assert len(party_db_override[PartyMedia]) == 1


@pytest.mark.asyncio
async def test_georeference_soi_rejects_oversized_upload(monkeypatch):
    import app.geo.routes as geo_routes

    monkeypatch.setattr(geo_routes, "MAX_SOI_UPLOAD_BYTES", 3)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/geo/soi/georeference",
            data={
                "sheet_number": "53J/3",
                "tl_lat": "31.1", "tl_lon": "78.1",
                "tr_lat": "31.1", "tr_lon": "78.2",
                "br_lat": "31.0", "br_lon": "78.2",
                "bl_lat": "31.0", "bl_lon": "78.1",
            },
            files={"sheet_file": ("sheet.tif", b"four", "image/tiff")},
        )
    assert response.status_code == 413


@pytest.mark.asyncio
async def test_georeference_soi_runs_pipeline_off_event_loop(monkeypatch):
    import app.geo.routes as geo_routes
    from app.schemas.geo_schemas import SoiGeoreferenceResponse

    seen = {}
    main_thread = get_ident()

    def fake_georeference(**kwargs):
        seen["thread"] = get_ident()
        with open(kwargs["input_pdf_or_image_path"], "rb") as uploaded:
            seen["content"] = uploaded.read()
        return SoiGeoreferenceResponse(
            sheet_number="53J/3", mbtiles_url="/tiles/test.mbtiles",
            bounds_bbox=[78.1, 31.0, 78.2, 31.1], min_zoom=11, max_zoom=15,
            status="ready", message="Georeferenced",
        )

    monkeypatch.setattr(geo_routes.soi_pipeline, "georeference_sheet", fake_georeference)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/geo/soi/georeference",
            data={
                "sheet_number": "53J/3",
                "tl_lat": "31.1", "tl_lon": "78.1",
                "tr_lat": "31.1", "tr_lon": "78.2",
                "br_lat": "31.0", "br_lon": "78.2",
                "bl_lat": "31.0", "bl_lon": "78.1",
            },
            files={"sheet_file": ("sheet.tif", b"map", "image/tiff")},
        )
    assert response.status_code == 200
    assert seen["content"] == b"map"
    assert seen["thread"] != main_thread


def test_soi_without_gdal_reports_placeholder_not_georeferenced(tmp_path, monkeypatch):
    import app.geo.soi_pipeline as pipeline_module
    from app.geo.soi_pipeline import SoiPipeline

    monkeypatch.setattr(pipeline_module, "HAS_GDAL", False)
    result = SoiPipeline(output_dir=str(tmp_path)).georeference_sheet(
        input_pdf_or_image_path="unused.tif",
        sheet_number="53J/3",
        corners_latlon=((31.1, 78.1), (31.1, 78.2), (31.0, 78.2), (31.0, 78.1)),
    )
    assert result.status == "fallback_generated"
    assert "was not georeferenced" in result.message


@pytest.mark.asyncio
async def test_osm_harvest_rejects_unbounded_bbox():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/geo/harvest-osm",
            json={"bbox": [30.0, 78.0, 30.6, 78.5]},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_osm_harvest_runs_off_event_loop(monkeypatch):
    import app.geo.routes as geo_routes
    from app.schemas.geo_schemas import OsmHarvestResponse

    main_thread = get_ident()
    seen = []

    def fake_harvest(bbox):
        seen.append(get_ident())
        return OsmHarvestResponse(status="success", total_harvested=0, features=[])

    monkeypatch.setattr(geo_routes.overpass_harvester, "harvest", fake_harvest)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/geo/harvest-osm",
            json={"bbox": [30.0, 78.0, 30.2, 78.2]},
        )
    assert response.status_code == 200
    assert seen and seen[0] != main_thread


@pytest.mark.asyncio
async def test_strava_token_exchange_runs_off_event_loop(monkeypatch):
    import app.strava.routes as strava_routes

    main_thread = get_ident()
    seen = []

    class Response:
        status_code = 200

        def json(self):
            return {"access_token": "test"}

    def fake_post(*args, **kwargs):
        seen.append(get_ident())
        return Response()

    monkeypatch.setattr(strava_routes.requests, "post", fake_post)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/strava/oauth/exchange", json={"code": "test"})
    assert response.status_code == 200
    assert seen and seen[0] != main_thread


@pytest.mark.asyncio
async def test_analyze_soi_sheet_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/geo/analyze-soi-sheet", data={"sheet_number": "53J/1"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["sheet_number"] == "53J/1"
        assert len(data["candidates"]) >= 2


@pytest.mark.asyncio
async def test_track_import_api():
    gpx_sample = b"""<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="Test">
      <trk>
        <name>Hampta Pass Test Trail</name>
        <trkseg>
          <trkpt lat="32.2396" lon="77.1887"><ele>2050.0</ele><time>2026-11-09T08:00:00Z</time></trkpt>
          <trkpt lat="32.2450" lon="77.2100"><ele>2480.0</ele><time>2026-11-09T09:00:00Z</time></trkpt>
          <trkpt lat="32.2900" lon="77.3700"><ele>4270.0</ele><time>2026-11-09T13:00:00Z</time></trkpt>
        </trkseg>
      </trk>
    </gpx>"""

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        files = {"file": ("hampta_pass.gpx", gpx_sample, "application/gpx+xml")}
        resp = await client.post("/api/v1/tracks/import", files=files)
        assert resp.status_code == 200
        data = resp.json()
        assert data["filename"] == "hampta_pass.gpx"
        assert data["total_points"] == 3
        assert data["total_gain_m"] >= 0
        assert data["total_loss_m"] >= 0
        assert len(data["points"]) == 3
