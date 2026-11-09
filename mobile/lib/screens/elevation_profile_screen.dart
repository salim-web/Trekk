import 'package:flutter/material.dart';
import '../services/gpx_serializer.dart';
import '../theme/field_tokens.dart';
import '../widgets/field_instruments/elevation_scrubbing_graph.dart';
import '../widgets/field_instruments/knurled_hardware_button.dart';
import '../widgets/field_instruments/soi_grid_stamp_card.dart';

/// Altimetry & Topographical Profile Screen
class ElevationProfileScreen extends StatefulWidget {
  const ElevationProfileScreen({super.key});

  @override
  State<ElevationProfileScreen> createState() => _ElevationProfileScreenState();
}

class _ElevationProfileScreenState extends State<ElevationProfileScreen> {
  // Mock Himalayan expedition track data (Kedarkantha Ascent)
  final List<ElevationPoint> _profilePoints = [
    const ElevationPoint(distanceKm: 0.0, elevationM: 1950.0, heartRate: 85),
    const ElevationPoint(distanceKm: 1.5, elevationM: 2200.0, heartRate: 122),
    const ElevationPoint(distanceKm: 3.0, elevationM: 2540.0, heartRate: 135),
    const ElevationPoint(distanceKm: 4.8, elevationM: 2890.0, heartRate: 142),
    const ElevationPoint(distanceKm: 6.2, elevationM: 3120.0, heartRate: 148),
    const ElevationPoint(distanceKm: 7.5, elevationM: 3450.0, heartRate: 156),
    const ElevationPoint(distanceKm: 9.0, elevationM: 3780.0, heartRate: 164),
    const ElevationPoint(distanceKm: 10.2, elevationM: 3810.0, heartRate: 168), // Summit
    const ElevationPoint(distanceKm: 11.8, elevationM: 3400.0, heartRate: 130),
    const ElevationPoint(distanceKm: 13.5, elevationM: 2950.0, heartRate: 115),
    const ElevationPoint(distanceKm: 15.0, elevationM: 2600.0, heartRate: 105),
  ];

  ElevationPoint? _inspectedPoint;

  void _exportGpx() {
    final gpxPoints = _profilePoints.map((p) {
      return GpxTrackPoint(
        latitude: 31.0234 + (p.distanceKm * 0.005),
        longitude: 78.1723 + (p.distanceKm * 0.004),
        elevationM: p.elevationM,
        timestamp: DateTime.now().subtract(Duration(minutes: (15 - p.distanceKm).toInt() * 20)),
        heartRateBpm: p.heartRate,
      );
    }).toList();

    final gpxXml = GpxSerializer.compile(
      trackName: 'Kedarkantha Ridge Summit',
      description: 'Himalayan winter ascent, Sheet 53J/3',
      points: gpxPoints,
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: FieldTokens.pineSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
          side: const BorderSide(color: FieldTokens.pineSurfaceBorder),
        ),
        title: Text(
          'GARMIN GPX 1.1 EXPORT',
          style: FieldTokens.technicalMonospace(fontSize: 13, fontWeight: FontWeight.w800, color: FieldTokens.contourOchre),
        ),
        content: SizedBox(
          width: double.maxFinite,
          height: 240,
          child: SingleChildScrollView(
            child: SelectableText(
              gpxXml,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 9, color: Colors.white70),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('DISMISS', style: FieldTokens.technicalMonospace(color: Colors.white60)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FieldTokens.basaltBackground,
      appBar: AppBar(
        title: Text(
          'ALTIMETRY & TOPOGRAPHY',
          style: FieldTokens.technicalMonospace(fontSize: 14, fontWeight: FontWeight.w800),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Interactive Elevation Scrubbing Graph
            ElevationScrubbingGraph(
              points: _profilePoints,
              height: 200,
              onScrub: (pt) {
                setState(() => _inspectedPoint = pt);
              },
            ),
            const SizedBox(height: 16),

            // 2. Telemetry Card Grid
            Row(
              children: [
                Expanded(
                  child: _metricBox(
                    label: 'TOTAL ASCENT',
                    value: '+1,860 M',
                    accentColor: FieldTokens.contourOchre,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _metricBox(
                    label: 'PEAK ALTITUDE',
                    value: '3,810 M',
                    accentColor: FieldTokens.rescueOrange,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _metricBox(
                    label: 'MAX GRADE',
                    value: '28.4 %',
                    accentColor: FieldTokens.glacierCyan,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // 3. Vintage Survey of India Sheet Stamp
            SoiGridStampCard(
              sheetNumber: '53J/3',
              regionTitle: 'UTTARAKHAND - TEHRI GARHWAL',
              latRange: '30°15\'N - 30°30\'N',
              lonRange: '78°00\'E - 78°15\'E',
              scaleRatio: 50000,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 4),
                  Text(
                    'CONTOURS: 20 METRES INTERVAL • MSL DATUM\nISRO CartoDEM v3 Bilinear Filter Applied',
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 8,
                      fontWeight: FontWeight.w600,
                      color: FieldTokens.soiParchmentText.withOpacity(0.75),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // 4. Action: Compile GPX with Garmin TrackPointExtension
            KnurledHardwareButton(
              label: 'EXPORT GPX (GARMIN BIOMETRIC)',
              icon: Icons.file_download_outlined,
              accentColor: FieldTokens.contourOchre,
              onPressed: _exportGpx,
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _metricBox({required String label, required String value, required Color accentColor}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      decoration: BoxDecoration(
        color: FieldTokens.pineSurface,
        borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
        border: Border.all(color: FieldTokens.pineSurfaceBorder, width: FieldTokens.instrumentBorderWidth),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              fontFamily: 'monospace',
              fontSize: 8,
              color: FieldTokens.soiGridBorder.withOpacity(0.8),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: FieldTokens.technicalMonospace(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: accentColor,
            ),
          ),
        ],
      ),
    );
  }
}
