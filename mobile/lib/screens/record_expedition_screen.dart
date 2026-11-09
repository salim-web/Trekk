import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/seeded_trails.dart';
import '../services/ble_mesh_service.dart';
import '../services/unified_collector_service.dart';
import '../theme/field_tokens.dart';
import '../widgets/field_instruments/elevation_scrubbing_graph.dart';
import '../widgets/field_instruments/knurled_hardware_button.dart';

class RecordExpeditionScreen extends StatefulWidget {
  final TrailModel? initialTrail;

  const RecordExpeditionScreen({super.key, this.initialTrail});

  @override
  State<RecordExpeditionScreen> createState() => _RecordExpeditionScreenState();
}

class _RecordExpeditionScreenState extends State<RecordExpeditionScreen> {
  StreamSubscription<CombinedTelemetryPoint>? _telemetrySub;

  CombinedTelemetryPoint _telemetry = CombinedTelemetryPoint(
    latitude: 31.0234,
    longitude: 78.1723,
    elevationM: 3810.0,
    speedMps: 1.2,
    headingDegrees: 45.0,
    heartRateBpm: 138,
    climbRateMetersPerHour: 320.0,
    timestamp: DateTime.now(),
  );

  final List<ElevationPoint> _recordedElePoints = [
    const ElevationPoint(distanceKm: 0.0, elevationM: 1950.0, heartRate: 85),
    const ElevationPoint(distanceKm: 1.2, elevationM: 2280.0, heartRate: 122),
    const ElevationPoint(distanceKm: 2.8, elevationM: 2650.0, heartRate: 136),
    const ElevationPoint(distanceKm: 4.1, elevationM: 3120.0, heartRate: 144),
    const ElevationPoint(distanceKm: 5.5, elevationM: 3480.0, heartRate: 152),
    const ElevationPoint(distanceKm: 6.8, elevationM: 3810.0, heartRate: 160),
  ];

  double _sosSlidePosition = 0.0;
  bool _sosConfirmed = false;

  @override
  void initState() {
    super.initState();
    _telemetrySub = UnifiedCollectorService.instance.onTelemetryPoint.listen((data) {
      setState(() {
        _telemetry = data;
        _recordedElePoints.add(
          ElevationPoint(
            distanceKm: _recordedElePoints.length * 0.2,
            elevationM: data.elevationM,
            heartRate: data.heartRateBpm,
          ),
        );
      });
    });
  }

  @override
  void dispose() {
    _telemetrySub?.cancel();
    super.dispose();
  }

  void _triggerSos() {
    BleMeshService.instance.sendSosAlert(
      lat: _telemetry.latitude,
      lon: _telemetry.longitude,
      sosCode: 1, // Medical emergency
    );
    setState(() => _sosConfirmed = true);
    HapticFeedback.heavyImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('EMERGENCY DISTRESS BROADCASTED OVER 4-HOP BLE MESH!'),
        backgroundColor: FieldTokens.rescueOrange,
        duration: Duration(seconds: 5),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isRecording = UnifiedCollectorService.instance.isRecording;
    final trailName = widget.initialTrail?.name ?? "Alpine Free Track";

    return Scaffold(
      backgroundColor: FieldTokens.basaltBackground,
      appBar: AppBar(
        title: Text(
          'RECORD EXPEDITION',
          style: FieldTokens.technicalMonospace(fontSize: 14, fontWeight: FontWeight.w800),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 14),
            alignment: Alignment.center,
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: isRecording ? FieldTokens.rescueOrange : FieldTokens.mossNeon,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  isRecording ? 'LIVE REC' : 'STANDBY',
                  style: FieldTokens.technicalMonospace(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: isRecording ? FieldTokens.rescueOrange : FieldTokens.mossNeon,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Active Trail Banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: FieldTokens.pineSurface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: FieldTokens.pineSurfaceBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ACTIVE TRAIL TARGET',
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 8.5,
                      color: FieldTokens.soiGridBorder.withValues(alpha: 0.8),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    trailName.toUpperCase(),
                    style: FieldTokens.technicalMonospace(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Live Telemetry Grid (4 Essential Metrics)
            Row(
              children: [
                Expanded(
                  child: _telemetryCard(
                    'ALTITUDE (MSL)',
                    '${_telemetry.elevationM.toStringAsFixed(0)} M',
                    FieldTokens.contourOchre,
                    Icons.terrain,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _telemetryCard(
                    'HEART RATE',
                    '${_telemetry.heartRateBpm ?? 138} BPM',
                    FieldTokens.rescueOrange,
                    Icons.favorite_border,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _telemetryCard(
                    'CLIMB VELOCITY',
                    '${_telemetry.climbRateMetersPerHour >= 0 ? '+' : ''}${_telemetry.climbRateMetersPerHour.toStringAsFixed(0)} M/H',
                    FieldTokens.glacierCyan,
                    Icons.speed,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _telemetryCard(
                    'GROUND SPEED',
                    '${(_telemetry.speedMps * 3.6).toStringAsFixed(1)} KM/H',
                    FieldTokens.mossNeon,
                    Icons.directions_walk,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Real-Time Altimetry Graph
            ElevationScrubbingGraph(
              points: _recordedElePoints,
              height: 180,
            ),
            const SizedBox(height: 20),

            // Start / Stop Recording Push Button
            KnurledHardwareButton(
              label: isRecording ? 'PAUSE / STOP RECORDING' : 'START RECORDING EXPEDITION',
              icon: isRecording ? Icons.pause : Icons.play_arrow,
              accentColor: isRecording ? FieldTokens.rescueOrange : FieldTokens.mossNeon,
              height: 52,
              onPressed: () async {
                if (isRecording) {
                  await UnifiedCollectorService.instance.stopExpeditionRecording('');
                  setState(() {});
                } else {
                  await UnifiedCollectorService.instance.startExpeditionRecording('Expedition_${DateTime.now().day}_Nov');
                  setState(() {});
                }
              },
            ),
            const SizedBox(height: 24),

            // Safe Protected "Slide-to-Trigger" SOS Control
            Text(
              'EMERGENCY SOS (BLE MESH DISTRESS)',
              style: FieldTokens.technicalMonospace(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: FieldTokens.rescueOrange,
              ),
            ),
            const SizedBox(height: 8),
            Container(
              height: 52,
              decoration: BoxDecoration(
                color: const Color(0xFF1F1210),
                borderRadius: BorderRadius.circular(26),
                border: Border.all(color: FieldTokens.rescueOrange.withValues(alpha: 0.6)),
              ),
              child: Stack(
                children: [
                  Center(
                    child: Text(
                      _sosConfirmed ? 'DISTRESS TRANSMITTED' : '>>> SLIDE TO TRIGGER SOS >>>',
                      style: FieldTokens.technicalMonospace(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        color: FieldTokens.rescueOrange,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                  Positioned(
                    left: _sosSlidePosition,
                    top: 2,
                    bottom: 2,
                    child: GestureDetector(
                      onHorizontalDragUpdate: (details) {
                        final maxDrag = MediaQuery.of(context).size.width - 32 - 50;
                        setState(() {
                          _sosSlidePosition = (_sosSlidePosition + details.delta.dx).clamp(0.0, maxDrag);
                        });
                        if (_sosSlidePosition >= maxDrag * 0.9 && !_sosConfirmed) {
                          _triggerSos();
                        }
                      },
                      onHorizontalDragEnd: (_) {
                        if (!_sosConfirmed) {
                          setState(() => _sosSlidePosition = 0.0);
                        }
                      },
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: const BoxDecoration(
                          color: FieldTokens.rescueOrange,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(color: Colors.black45, blurRadius: 4),
                          ],
                        ),
                        child: const Icon(Icons.warning_amber_rounded, color: Colors.black, size: 24),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _telemetryCard(String title, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: FieldTokens.pineSurface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: FieldTokens.pineSurfaceBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 8.5,
                  fontWeight: FontWeight.w600,
                  color: FieldTokens.soiGridBorder.withValues(alpha: 0.9),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: FieldTokens.technicalMonospace(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
