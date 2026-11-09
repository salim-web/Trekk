"""Unit tests for Trek Party State Machine & EXIF Spatial Pinning."""

from datetime import datetime, timezone, timedelta
from app.party.state_machine import PartyLifecycleManager
from app.party.exif_spatial import ExifSpatialPinningEngine


def test_party_state_machine_transitions():
    now = datetime.now(timezone.utc)
    starts_at = now + timedelta(days=2)
    ends_at = now + timedelta(days=5)

    # 1. Before trek starts -> planning
    state, _ = PartyLifecycleManager.evaluate_state("planning", starts_at, ends_at, now=now)
    assert state == "planning"
    assert PartyLifecycleManager.allows_new_members(state) is True

    # 2. During trek -> active
    during_trek = starts_at + timedelta(hours=10)
    state, _ = PartyLifecycleManager.evaluate_state("planning", starts_at, ends_at, now=during_trek)
    assert state == "active"
    assert PartyLifecycleManager.allows_media_upload(state) is True

    # 3. 2 days post-trek -> sync_window
    post_trek = ends_at + timedelta(days=2)
    state, _ = PartyLifecycleManager.evaluate_state("active", starts_at, ends_at, now=post_trek)
    assert state == "sync_window"
    assert PartyLifecycleManager.allows_media_upload(state) is True

    # 4. 15 days post-trek (>14 days) -> archived (frozen)
    frozen_trek = ends_at + timedelta(days=15)
    state, _ = PartyLifecycleManager.evaluate_state("sync_window", starts_at, ends_at, now=frozen_trek)
    assert state == "archived"
    assert PartyLifecycleManager.allows_media_upload(state) is False


def test_exif_spatial_interpolation():
    t0 = datetime(2026, 11, 9, 10, 0, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 11, 9, 10, 10, 0, tzinfo=timezone.utc)

    # Trackpoint A: 30.0N, 78.0E, 3000m at 10:00
    # Trackpoint B: 30.1N, 78.1E, 3200m at 10:10
    trackpoints = [
        (t0, 30.0, 78.0, 3000.0),
        (t1, 30.1, 78.1, 3200.0),
    ]

    # Photo captured exactly midway at 10:05
    photo_time = datetime(2026, 11, 9, 10, 5, 0, tzinfo=timezone.utc)
    coords = ExifSpatialPinningEngine.interpolate_trackpoints(photo_time, trackpoints)

    assert coords is not None
    lat, lon, ele = coords
    assert lat == 30.05
    assert lon == 78.05
    assert ele == 3100.0
