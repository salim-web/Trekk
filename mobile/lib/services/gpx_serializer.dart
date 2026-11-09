import 'dart:math' as math;

/// Single GPX TrackPoint data container
class GpxTrackPoint {
  final double latitude;
  final double longitude;
  final double elevationM;
  final DateTime timestamp;
  final int? heartRateBpm;

  const GpxTrackPoint({
    required this.latitude,
    required this.longitude,
    required this.elevationM,
    required this.timestamp,
    this.heartRateBpm,
  });
}

/// GPX 1.1 Compiler with Garmin TrackPointExtension Schema
///
/// Produces strictly conformant GPX 1.1 XML including:
/// - `<bounds>` calculated from track bounds
/// - Garmin TrackPointExtension v2 (`gpxtpx:hr`) for biometric heart rate
/// - ISO 8601 UTC timestamps
/// - Compatible with Strava, Garmin Connect, and QGIS
class GpxSerializer {
  /// Compiles points into a valid GPX 1.1 XML string
  static String compile({
    required String trackName,
    required List<GpxTrackPoint> points,
    String? description,
    String creator = 'TrekIndia Tactical Field Instrument v1.0',
  }) {
    if (points.isEmpty) {
      throw ArgumentError('Points list cannot be empty for GPX compilation');
    }

    double minLat = points.first.latitude;
    double maxLat = points.first.latitude;
    double minLon = points.first.longitude;
    double maxLon = points.first.longitude;

    for (final pt in points) {
      minLat = math.min(minLat, pt.latitude);
      maxLat = math.max(maxLat, pt.latitude);
      minLon = math.min(minLon, pt.longitude);
      maxLon = math.max(maxLon, pt.longitude);
    }

    final buffer = StringBuffer();
    buffer.writeln('<?xml version="1.0" encoding="UTF-8"?>');
    buffer.writeln('<gpx version="1.1" creator="$creator"');
    buffer.writeln('  xmlns="http://www.topografix.com/GPX/1/1"');
    buffer.writeln('  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    buffer.writeln('  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v2"');
    buffer.writeln('  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd');
    buffer.writeln('  http://www.garmin.com/xmlschemas/TrackPointExtension/v2 http://www.garmin.com/xmlschemas/TrackPointExtensionv2.xsd">');

    // Metadata & Bounds
    buffer.writeln('  <metadata>');
    buffer.writeln('    <name>$trackName</name>');
    if (description != null) {
      buffer.writeln('    <desc>$description</desc>');
    }
    buffer.writeln('    <time>${points.first.timestamp.toUtc().toIso8601String()}</time>');
    buffer.writeln(
      '    <bounds minlat="${minLat.toStringAsFixed(6)}" minlon="${minLon.toStringAsFixed(6)}" '
      'maxlat="${maxLat.toStringAsFixed(6)}" maxlon="${maxLon.toStringAsFixed(6)}"/>',
    );
    buffer.writeln('  </metadata>');

    // Track Segment
    buffer.writeln('  <trk>');
    buffer.writeln('    <name>$trackName</name>');
    buffer.writeln('    <type>hiking</type>');
    buffer.writeln('    <trkseg>');

    for (final pt in points) {
      buffer.writeln(
        '      <trkpt lat="${pt.latitude.toStringAsFixed(6)}" lon="${pt.longitude.toStringAsFixed(6)}">',
      );
      buffer.writeln('        <ele>${pt.elevationM.toStringAsFixed(1)}</ele>');
      buffer.writeln('        <time>${pt.timestamp.toUtc().toIso8601String()}</time>');

      if (pt.heartRateBpm != null && pt.heartRateBpm! > 0) {
        buffer.writeln('        <extensions>');
        buffer.writeln('          <gpxtpx:TrackPointExtension>');
        buffer.writeln('            <gpxtpx:hr>${pt.heartRateBpm}</gpxtpx:hr>');
        buffer.writeln('          </gpxtpx:TrackPointExtension>');
        buffer.writeln('        </extensions>');
      }

      buffer.writeln('      </trkpt>');
    }

    buffer.writeln('    </trkseg>');
    buffer.writeln('  </trk>');
    buffer.writeln('</gpx>');

    return buffer.toString();
  }
}
