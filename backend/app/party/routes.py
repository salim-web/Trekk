"""FastAPI Router for Trek Party, Spatial Media, P2P Camp Sync & Expedition Posters."""

import uuid
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Response
from app.schemas.party_schemas import (
    TrekPartyCreate,
    TrekPartyResponse,
    MemberAddRequest,
    PartyMemberResponse,
    SpatialPhotoPinRequest,
    PartyMediaResponse,
    CampSyncDiffRequest,
    CampSyncDiffResponse,
    CampSyncDiffItem,
)
from app.party.state_machine import PartyLifecycleManager
from app.party.tus_storage import tus_storage
from app.party.poster_generator import poster_generator

router = APIRouter(prefix="", tags=["Trek Party & Spatial Media"])

# In-memory fast stores for demonstration & integration testing
PARTIES_DB = {}
MEMBERS_DB = {}
MEDIA_DB = {}


@router.post("/party", response_model=TrekPartyResponse)
async def create_party(party_in: TrekPartyCreate):
    """Initializes a new ephemeral expedition party."""
    party_id = uuid.uuid4()
    invite_code = f"TI-{uuid.uuid4().hex[:6].upper()}"

    party_record = {
        "id": party_id,
        "trail_id": party_in.trail_id,
        "name": party_in.name,
        "invite_code": invite_code,
        "starts_at": party_in.starts_at,
        "ends_at": party_in.ends_at,
        "status": "planning",
        "created_at": datetime.now(timezone.utc),
    }
    PARTIES_DB[party_id] = party_record
    MEMBERS_DB[party_id] = []
    MEDIA_DB[party_id] = []

    return TrekPartyResponse(**party_record)


@router.get("/party/{party_id}", response_model=TrekPartyResponse)
async def get_party(party_id: uuid.UUID):
    """Retrieves party details and evaluates lifecycle transitions (planning -> active -> sync -> archived)."""
    if party_id not in PARTIES_DB:
        raise HTTPException(status_code=404, detail="Trek party not found")

    party = PARTIES_DB[party_id]
    new_status, changed = PartyLifecycleManager.evaluate_state(
        current_status=party["status"],
        starts_at=party["starts_at"],
        ends_at=party["ends_at"],
    )
    if changed:
        party["status"] = new_status

    return TrekPartyResponse(**party)


@router.post("/party/{party_id}/members", response_model=PartyMemberResponse)
async def add_party_member(party_id: uuid.UUID, member_in: MemberAddRequest):
    """Enrolls a member into the expedition party (Leader, Guide, Sweeper, Trekker)."""
    if party_id not in PARTIES_DB:
        raise HTTPException(status_code=404, detail="Trek party not found")

    status = PARTIES_DB[party_id]["status"]
    if not PartyLifecycleManager.allows_new_members(status):
        raise HTTPException(status_code=400, detail=f"Cannot add members to party in '{status}' status")

    record = {
        "party_id": party_id,
        "user_id": member_in.user_id,
        "name": f"Trekker-{str(member_in.user_id)[:4]}",
        "role": member_in.role,
        "joined_at": datetime.now(timezone.utc),
    }
    MEMBERS_DB[party_id].append(record)
    return PartyMemberResponse(**record)


@router.post("/party/{party_id}/media/pin", response_model=PartyMediaResponse)
async def pin_spatial_media(party_id: uuid.UUID, media_in: SpatialPhotoPinRequest):
    """Spatially pins captured trail photo to coordinates (lat, lon, elevation_m)."""
    if party_id not in PARTIES_DB:
        raise HTTPException(status_code=404, detail="Trek party not found")

    party = PARTIES_DB[party_id]
    new_status, changed = PartyLifecycleManager.evaluate_state(
        current_status=party["status"],
        starts_at=party["starts_at"],
        ends_at=party["ends_at"],
    )
    if changed:
        party["status"] = new_status

    status = party["status"]
    if not PartyLifecycleManager.allows_media_upload(status):
        raise HTTPException(status_code=400, detail=f"Party media upload not allowed in '{status}' status")

    media_id = uuid.uuid4()
    record = {
        "id": media_id,
        "party_id": party_id,
        "uploaded_by": media_in.uploaded_by,
        "storage_key": media_in.storage_key,
        "thumbnail_key": media_in.thumbnail_key,
        "is_public": media_in.is_public,
        "captured_at": media_in.captured_at,
        "lat": media_in.lat or 30.7345,
        "lon": media_in.lon or 79.0673,
        "elevation_m": media_in.elevation_m or 3534.0,
        "created_at": datetime.now(timezone.utc),
    }
    MEDIA_DB[party_id].append(record)
    return PartyMediaResponse(**record)


@router.post("/party/{party_id}/media/tus-init")
async def init_tus_upload(party_id: uuid.UUID, filename: str, total_bytes: int, is_public: bool = False):
    """Initiates a TUS resumable upload session for high-res photo or voice memo."""
    if party_id not in PARTIES_DB:
        raise HTTPException(status_code=404, detail="Trek party not found")

    session = tus_storage.initiate_tus_upload(
        party_id=str(party_id),
        filename=filename,
        total_bytes=total_bytes,
        is_public=is_public,
    )
    return session


@router.post("/camp-sync/diff", response_model=CampSyncDiffResponse)
async def camp_sync_diff(req: CampSyncDiffRequest):
    """Compares SHA-256 hashes between client and basecamp server for local ad-hoc Wi-Fi delta sync."""
    # Simulated items available on basecamp server
    server_items = [
        CampSyncDiffItem(
            hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            size_bytes=3492000,
            filename="IMG_20261109_Kedarkantha_Summit.jpg",
            type="image/jpeg",
            captured_at=datetime.now(timezone.utc),
            lat=31.0234,
            lon=78.1721,
            ele=3810.0,
        )
    ]

    missing_from_client = [item for item in server_items if item.hash not in req.have_hashes]
    server_hashes = {item.hash for item in server_items}
    missing_from_server = [h for h in req.have_hashes if h not in server_hashes]

    return CampSyncDiffResponse(
        missing_from_client=missing_from_client,
        missing_from_server=missing_from_server,
    )


@router.get("/party/{party_id}/poster")
async def get_expedition_poster(party_id: uuid.UUID):
    """Generates and streams a vintage Survey of India 3D Topographic Expedition Poster."""
    party = PARTIES_DB.get(party_id, {
        "name": "Kedarkantha Winter Push",
        "starts_at": datetime.now(timezone.utc),
        "ends_at": datetime.now(timezone.utc),
    })

    svg_content = poster_generator.generate_svg_poster(
        party_name=party.get("name", "Himalayan Expedition"),
        soi_sheet_no="53J/3",
        dates_str="Nov 2026",
        distance_km=21.4,
        elevation_gain_m=1820.0,
        max_altitude_m=3812.0,
        elevation_profile=[1950, 2200, 2600, 3100, 3450, 3812, 3450, 2600, 1950],
        participants=["Arjun Sharma (Lead)", "Kavita Negi (Guide)", "Vikram Rao", "Tara Sen"],
    )

    return Response(content=svg_content, media_type="image/svg+xml")
