import { describe, it, expect } from 'bun:test';
import { TrackParserService } from '../services/TrackParser';

describe('TrackParserService', () => {
  it('correctly parses GPX 1.1 with elevations and Garmin HR extension', () => {
    const gpxSample = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="Garmin Edge 830"
      xmlns="http://www.topografix.com/GPX/1/1"
      xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
      <trk>
        <name>Kedarkantha Summit Ridge</name>
        <trkseg>
          <trkpt lat="31.025500" lon="78.174800">
            <ele>3790.5</ele>
            <time>2026-11-09T06:15:00Z</time>
            <extensions>
              <gpxtpx:TrackPointExtension>
                <gpxtpx:hr>142</gpxtpx:hr>
              </gpxtpx:TrackPointExtension>
            </extensions>
          </trkpt>
          <trkpt lat="31.023800" lon="78.172200">
            <ele>3812.0</ele>
            <time>2026-11-09T06:30:00Z</time>
            <extensions>
              <gpxtpx:TrackPointExtension>
                <gpxtpx:hr>158</gpxtpx:hr>
              </gpxtpx:TrackPointExtension>
            </extensions>
          </trkpt>
        </trkseg>
      </trk>
    </gpx>`;

    const track = TrackParserService.parseTrack('kedarkantha.gpx', gpxSample);
    expect(track.name).toBe('Kedarkantha Summit Ridge');
    expect(track.sourceFormat).toBe('gpx');
    expect(track.points.length).toBe(2);
    expect(track.points[0].latitude).toBeCloseTo(31.0255, 4);
    expect(track.points[0].elevation).toBeCloseTo(3790.5, 1);
    expect(track.points[0].heartRate).toBe(142);
    expect(track.points[1].elevation).toBeCloseTo(3812.0, 1);
    expect(track.points[1].heartRate).toBe(158);
    expect(track.maxAltitudeM).toBe(3812);
    expect(track.minAltitudeM).toBe(3791);
    expect(track.elevationGainM).toBeGreaterThan(20);
  });

  it('uses the GPX route name only when no track exists', () => {
    const gpx = `<gpx><trk><trkseg><trkpt lat="1" lon="2" /></trkseg></trk><rte><name>Other route</name></rte></gpx>`;
    expect(TrackParserService.parseTrack('fallback.gpx', gpx).name).toBe('fallback');
  });

  it('correctly parses TCX with HeartRateBpm', () => {
    const tcxSample = `<?xml version="1.0" encoding="UTF-8"?>
    <TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
      <Activities>
        <Activity Sport="Hiking">
          <Id>2026-11-09T05:00:00Z</Id>
          <Lap>
            <Track>
              <Trackpoint>
                <Time>2026-11-09T05:00:00Z</Time>
                <Position>
                  <LatitudeDegrees>32.2396</LatitudeDegrees>
                  <LongitudeDegrees>77.1887</LongitudeDegrees>
                </Position>
                <AltitudeMeters>2050.0</AltitudeMeters>
                <HeartRateBpm>
                  <Value>125</Value>
                </HeartRateBpm>
              </Trackpoint>
              <Trackpoint>
                <Time>2026-11-09T06:00:00Z</Time>
                <Position>
                  <LatitudeDegrees>32.2450</LatitudeDegrees>
                  <LongitudeDegrees>77.2100</LongitudeDegrees>
                </Position>
                <AltitudeMeters>2480.0</AltitudeMeters>
                <HeartRateBpm>
                  <Value>138</Value>
                </HeartRateBpm>
              </Trackpoint>
            </Track>
          </Lap>
        </Activity>
      </Activities>
    </TrainingCenterDatabase>`;

    const track = TrackParserService.parseTrack('hampta_lap.tcx', tcxSample);
    expect(track.sourceFormat).toBe('tcx');
    expect(track.points.length).toBe(2);
    expect(track.points[0].latitude).toBeCloseTo(32.2396, 4);
    expect(track.points[0].elevation).toBe(2050);
    expect(track.points[0].heartRate).toBe(125);
    expect(track.elevationGainM).toBeGreaterThanOrEqual(430);
  });

  it('gracefully handles empty or route-only GPX', () => {
    const minimalGpx = `<?xml version="1.0"?>
    <gpx version="1.1">
      <rte>
        <name>Emergency Ridge Escape</name>
        <rtept lat="30.5" lon="78.5"><ele>2100</ele></rtept>
        <rtept lat="30.6" lon="78.6"><ele>2300</ele></rtept>
      </rte>
    </gpx>`;

    const track = TrackParserService.parseTrack('escape.gpx', minimalGpx);
    expect(track.name).toBe('Emergency Ridge Escape');
    expect(track.points.length).toBe(2);
    expect(track.points[0].latitude).toBe(30.5);
    expect(track.points[1].latitude).toBe(30.6);
  });
});
