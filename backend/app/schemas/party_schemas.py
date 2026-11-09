"""Pydantic v2 Schemas for Trek Party, Spatial Media, P2P & Camp Sync."""

from typing import List, Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class UserBase(BaseModel):
    id: UUID
    name: str
    email: str


class TrekPartyCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=100)
    trail_id: Optional[UUID] = None
    starts_at: datetime
    ends_at: datetime


class TrekPartyResponse(BaseModel):
    id: UUID
    trail_id: Optional[UUID]
    name: str
    invite_code: str
    starts_at: datetime
    ends_at: datetime
    status: str
    created_at: datetime


class MemberAddRequest(BaseModel):
    user_id: UUID
    role: str = Field(default="trekker", pattern="^(leader|guide|sweeper|trekker)$")


class PartyMemberResponse(BaseModel):
    party_id: UUID
    user_id: UUID
    name: str
    role: str
    joined_at: datetime


class PartyMessageCreate(BaseModel):
    sender_id: UUID
    message_type: str = Field(..., pattern="^(ping|text|sos|voice_note)$")
    content: Optional[str] = None
    media_url: Optional[str] = None
    duration_seconds: Optional[int] = None


class PartyMessageResponse(BaseModel):
    id: UUID
    party_id: UUID
    sender_id: UUID
    message_type: str
    content: Optional[str]
    media_url: Optional[str]
    duration_seconds: Optional[int]
    created_at: datetime


class SpatialPhotoPinRequest(BaseModel):
    uploaded_by: UUID
    storage_key: str
    thumbnail_key: Optional[str] = None
    is_public: bool = False
    captured_at: datetime
    lat: Optional[float] = None
    lon: Optional[float] = None
    elevation_m: Optional[float] = None


class PartyMediaResponse(BaseModel):
    id: UUID
    party_id: UUID
    uploaded_by: UUID
    storage_key: str
    thumbnail_key: Optional[str]
    is_public: bool
    captured_at: datetime
    lat: Optional[float]
    lon: Optional[float]
    elevation_m: Optional[float]
    created_at: datetime


class CampSyncDiffRequest(BaseModel):
    client_id: str
    have_hashes: List[str]


class CampSyncDiffItem(BaseModel):
    hash: str
    size_bytes: int
    filename: str
    type: str
    captured_at: datetime
    lat: Optional[float]
    lon: Optional[float]
    ele: Optional[float]


class CampSyncDiffResponse(BaseModel):
    missing_from_client: List[CampSyncDiffItem]
    missing_from_server: List[str]


class BlePingPacket(BaseModel):
    party_hash: int
    msg_id: int
    msg_type: int
    ttl: int
    lat: float
    lon: float
    elevation_m: int
    battery_pct: int
    status_flags: int
