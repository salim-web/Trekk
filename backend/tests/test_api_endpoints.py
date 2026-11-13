"""Integration tests for TrekIndia FastAPI API endpoints."""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


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
async def test_party_lifecycle_api():
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
