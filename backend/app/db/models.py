"""SQLAlchemy 2.0 PostGIS Declarative Models for TrekIndia."""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    Boolean,
    Integer,
    Float,
    ForeignKey,
    Enum,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    strava_tokens = Column(JSONB, default=dict)
    badges_json = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class Trail(Base):
    __tablename__ = "trails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    difficulty = Column(String(50), nullable=False)  # easy, moderate, strenuous, alpine_expedition
    # 3D Linestring in WGS84 with Elevation: (lon, lat, ele)
    geom = Column(Geometry(geometry_type="LINESTRINGZ", srid=4326), nullable=False)
    soi_sheet_no = Column(String(50), nullable=False, index=True)  # e.g., '53J/3'
    distance_km = Column(Float, nullable=False, default=0.0)
    elevation_gain_m = Column(Float, nullable=False, default=0.0)
    max_altitude_m = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_trails_geom", "geom", postgresql_using="gist"),
    )


class TrekParty(Base):
    __tablename__ = "trek_parties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trail_id = Column(UUID(as_uuid=True), ForeignKey("trails.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    invite_code = Column(String(16), unique=True, nullable=False, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(
        Enum("planning", "active", "sync_window", "archived", name="trek_party_status"),
        nullable=False,
        default="planning",
        index=True,
    )
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class TrekPartyMember(Base):
    __tablename__ = "trek_party_members"

    party_id = Column(UUID(as_uuid=True), ForeignKey("trek_parties.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role = Column(
        Enum("leader", "guide", "sweeper", "trekker", name="party_member_role"),
        nullable=False,
        default="trekker",
    )
    joined_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class PartyMessage(Base):
    __tablename__ = "party_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    party_id = Column(UUID(as_uuid=True), ForeignKey("trek_parties.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message_type = Column(String(30), nullable=False)  # ping, text, sos, voice_note
    content = Column(Text, nullable=True)
    media_url = Column(Text, nullable=True)
    duration_seconds = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_party_messages_party", "party_id", "created_at"),
    )


class PartyMedia(Base):
    __tablename__ = "party_media"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    party_id = Column(UUID(as_uuid=True), ForeignKey("trek_parties.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    storage_key = Column(String(512), nullable=False)
    thumbnail_key = Column(String(512), nullable=True)
    is_public = Column(Boolean, nullable=False, default=False)
    captured_at = Column(DateTime(timezone=True), nullable=False)
    # 3D Point with Elevation: (lon, lat, ele)
    location = Column(Geometry(geometry_type="POINTZ", srid=4326), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_party_media_location", "location", postgresql_using="gist"),
    )
