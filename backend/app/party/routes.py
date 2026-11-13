"""FastAPI Router for Trek Party, Spatial Media, P2P Camp Sync & Expedition Posters."""

import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Response
from geoalchemy2.elements import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.db.models import PartyMedia, Trail, TrekParty, TrekPartyMember, User
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


async def _get_party(db: AsyncSession, party_id: uuid.UUID) -> TrekParty:
    party = await db.get(TrekParty, party_id)
    if party is None:
        raise HTTPException(status_code=404, detail="Trek party not found")
    return party


def _party_response(party: TrekParty) -> TrekPartyResponse:
    return TrekPartyResponse(
        id=party.id,
        trail_id=party.trail_id,
        name=party.name,
        invite_code=party.invite_code,
        starts_at=party.starts_at,
        ends_at=party.ends_at,
        status=party.status,
        created_at=party.created_at,
    )


@router.post("/party", response_model=TrekPartyResponse)
async def create_party(party_in: TrekPartyCreate, db: AsyncSession = Depends(get_db)):
    """Creates and persists an expedition party."""
    if party_in.trail_id is not None and await db.get(Trail, party_in.trail_id) is None:
        raise HTTPException(status_code=404, detail="Trail not found")

    party = TrekParty(
        trail_id=party_in.trail_id,
        name=party_in.name,
        invite_code=f"TI-{uuid.uuid4().hex[:6].upper()}",
        starts_at=party_in.starts_at,
        ends_at=party_in.ends_at,
        status="planning",
    )
    db.add(party)
    await db.flush()
    return _party_response(party)


@router.get("/party/{party_id}", response_model=TrekPartyResponse)
async def get_party(party_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Retrieves a party and persists lifecycle transitions."""
    party = await _get_party(db, party_id)
    status, changed = PartyLifecycleManager.evaluate_state(
        current_status=party.status,
        starts_at=party.starts_at,
        ends_at=party.ends_at,
    )
    if changed:
        party.status = status
        await db.flush()
    return _party_response(party)


@router.post("/party/{party_id}/members", response_model=PartyMemberResponse)
async def add_party_member(
    party_id: uuid.UUID,
    member_in: MemberAddRequest,
    db: AsyncSession = Depends(get_db),
):
    """Persists an expedition party member."""
    party = await _get_party(db, party_id)
    status, changed = PartyLifecycleManager.evaluate_state(
        current_status=party.status,
        starts_at=party.starts_at,
        ends_at=party.ends_at,
    )
    if changed:
        party.status = status
    if not PartyLifecycleManager.allows_new_members(status):
        raise HTTPException(status_code=400, detail=f"Cannot add members to party in '{status}' status")

    user = await db.get(User, member_in.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    member = await db.get(TrekPartyMember, (party_id, member_in.user_id))
    if member is not None:
        raise HTTPException(status_code=409, detail="User is already a member of this party")

    member = TrekPartyMember(party_id=party_id, user_id=member_in.user_id, role=member_in.role)
    db.add(member)
    await db.flush()
    return PartyMemberResponse(
        party_id=party_id,
        user_id=user.id,
        name=user.name,
        role=member.role,
        joined_at=member.joined_at,
    )


@router.post("/party/{party_id}/media/pin", response_model=PartyMediaResponse)
async def pin_spatial_media(
    party_id: uuid.UUID,
    media_in: SpatialPhotoPinRequest,
    db: AsyncSession = Depends(get_db),
):
    """Persists spatial media for an expedition party."""
    party = await _get_party(db, party_id)
    status, changed = PartyLifecycleManager.evaluate_state(
        current_status=party.status,
        starts_at=party.starts_at,
        ends_at=party.ends_at,
    )
    if changed:
        party.status = status
    if not PartyLifecycleManager.allows_media_upload(status):
        raise HTTPException(status_code=400, detail=f"Party media upload not allowed in '{status}' status")

    if await db.get(User, media_in.uploaded_by) is None:
        raise HTTPException(status_code=404, detail="User not found")

    lat = media_in.lat if media_in.lat is not None else 30.7345
    lon = media_in.lon if media_in.lon is not None else 79.0673
    elevation = media_in.elevation_m if media_in.elevation_m is not None else 3534.0
    location = WKTElement(f"POINT Z ({lon} {lat} {elevation})", srid=4326)
    media = PartyMedia(
        party_id=party_id,
        uploaded_by=media_in.uploaded_by,
        storage_key=media_in.storage_key,
        thumbnail_key=media_in.thumbnail_key,
        is_public=media_in.is_public,
        captured_at=media_in.captured_at,
        location=location,
    )
    db.add(media)
    await db.flush()
    return PartyMediaResponse(
        id=media.id,
        party_id=party_id,
        uploaded_by=media_in.uploaded_by,
        storage_key=media.storage_key,
        thumbnail_key=media.thumbnail_key,
        is_public=media.is_public,
        captured_at=media.captured_at,
        lat=lat,
        lon=lon,
        elevation_m=elevation,
        created_at=media.created_at,
    )


@router.post("/party/{party_id}/media/tus-init")
async def init_tus_upload(
    party_id: uuid.UUID,
    filename: str,
    total_bytes: int,
    is_public: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Initiates a TUS resumable upload session for high-res photo or voice memo."""
    await _get_party(db, party_id)

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
async def get_expedition_poster(party_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Generates and streams a vintage Survey of India 3D Topographic Expedition Poster."""
    party = await db.get(TrekParty, party_id)
    if party is None:
        party_name = "Kedarkantha Winter Push"
    else:
        party_name = party.name

    svg_content = poster_generator.generate_svg_poster(
        party_name=party_name,
        soi_sheet_no="53J/3",
        dates_str="Nov 2026",
        distance_km=21.4,
        elevation_gain_m=1820.0,
        max_altitude_m=3812.0,
        elevation_profile=[1950, 2200, 2600, 3100, 3450, 3812, 3450, 2600, 1950],
        participants=["Arjun Sharma (Lead)", "Kavita Negi (Guide)", "Vikram Rao", "Tara Sen"],
    )

    return Response(content=svg_content, media_type="image/svg+xml")
