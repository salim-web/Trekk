"""Unit tests for CartoDEM Snapping, Clamping and Savitzky-Golay Smoothing."""

import pytest
from app.geo.cartodem import CartoDemEngine
from app.schemas.geo_schemas import RawGpsPoint


def test_cartodem_snapping_and_smoothing():
    engine = CartoDemEngine()

    # Track with 15 points ascending Kedarkantha
    points = []
    base_time = 1731160000.0
    for i in range(15):
        points.append(
            RawGpsPoint(
                lat=31.0200 + i * 0.001,
                lon=78.1700 + i * 0.001,
                ele=3200.0 + i * 10.0 + (5.0 if i % 2 == 0 else -5.0),  # Noisy GPS jitter
                timestamp=base_time + i * 60.0,  # 60s intervals
            )
        )

    res = engine.snap_track(points, apply_smoothing=True, barometric_fallback=True)

    assert len(res.points) == 15
    assert res.total_gain_m >= 0.0
    assert res.max_elevation_m > 3000.0
    assert res.processing_time_ms >= 0.0


def test_climb_rate_velocity_clamping():
    engine = CartoDemEngine()
    base_time = 1731160000.0

    # Point 0 at 3000m, Point 1 attempts an impossible jump of +200m in 10s (violates < 1500m/hr = 0.4167 m/s)
    points = [
        RawGpsPoint(lat=31.02, lon=78.17, ele=3000.0, timestamp=base_time),
        RawGpsPoint(lat=31.021, lon=78.171, ele=3200.0, timestamp=base_time + 10.0),
    ]

    res = engine.snap_track(points, apply_smoothing=False, use_dem=False)
    assert len(res.points) == 2
    # In 10s, max elevation delta allowed is 10 * 0.4167 = ~4.17m
    p0 = res.points[0].ele_filtered
    p1 = res.points[1].ele_filtered
    assert abs(p1 - p0) <= 5.0
    assert res.points[1].clamped is True
