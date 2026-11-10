"""Unit tests for Multi-Format Track Parser (.GPX, .TCX)."""

from app.geo.track_parser import backend_track_parser

SAMPLE_GPX = b"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Kedarkantha Summit</name>
    <trkseg>
      <trkpt lat="31.0772" lon="78.1831"><ele>1950.0</ele><time>2026-11-09T08:00:00Z</time></trkpt>
      <trkpt lat="31.0665" lon="78.1982"><ele>2770.0</ele><time>2026-11-09T08:30:00Z</time></trkpt>
      <trkpt lat="31.0460" lon="78.2045"><ele>3430.0</ele><time>2026-11-09T09:00:00Z</time></trkpt>
      <trkpt lat="31.0238" lon="78.1722"><ele>3810.0</ele><time>2026-11-09T10:00:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>
"""

SAMPLE_TCX = b"""<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Hiking">
      <Id>2026-11-09T08:00:00Z</Id>
      <Lap StartTime="2026-11-09T08:00:00Z">
        <Track>
          <Trackpoint>
            <Time>2026-11-09T08:00:00Z</Time>
            <Position>
              <LatitudeDegrees>31.0772</LatitudeDegrees>
              <LongitudeDegrees>78.1831</LongitudeDegrees>
            </Position>
            <AltitudeMeters>1950.0</AltitudeMeters>
          </Trackpoint>
          <Trackpoint>
            <Time>2026-11-09T08:30:00Z</Time>
            <Position>
              <LatitudeDegrees>31.0665</LatitudeDegrees>
              <LongitudeDegrees>78.1982</LongitudeDegrees>
            </Position>
            <AltitudeMeters>2770.0</AltitudeMeters>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>
"""


def test_parse_gpx():
    res = backend_track_parser.parse_file("kedarkantha.gpx", SAMPLE_GPX)
    assert res["total_points"] == 4
    assert res["max_elevation_m"] > 3000.0


def test_parse_tcx():
    res = backend_track_parser.parse_file("activity.tcx", SAMPLE_TCX)
    assert res["total_points"] == 2
    assert len(res["points"]) == 2
