import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:health/health.dart';
import '../db/database_helper.dart';

/// Telemetry reading bundled from GNSS + BLE Wearables
class CombinedTelemetryPoint {
  final double latitude;
  final double longitude;
  final double elevationM;
  final double speedMps;
  final double headingDegrees;
  final int? heartRateBpm;
  final double climbRateMetersPerHour;
  final DateTime timestamp;

  const CombinedTelemetryPoint({
    required this.latitude,
    required this.longitude,
    required this.elevationM,
    required this.speedMps,
    required this.headingDegrees,
    this.heartRateBpm,
    required this.climbRateMetersPerHour,
    required this.timestamp,
  });
}

/// Unified Telemetry Collector
///
/// Ingests:
/// 1. GNSS Location Stream (1Hz, High Accuracy)
/// 2. BLE Heart Rate GATT Service (UUID 0x180D / 0x2A37)
/// 3. Health Connect / HealthKit fallback polling
/// 4. Computes live rate-of-climb (m/hour) and logs to offline SQLite
class UnifiedCollectorService {
  static final UnifiedCollectorService instance = UnifiedCollectorService._init();
  UnifiedCollectorService._init();

  int? _activeTrackId;
  StreamSubscription<Position>? _positionSubscription;
  StreamSubscription<List<int>>? _hrSubscription;
  Timer? _healthFallbackTimer;

  int? _lastKnownHeartRate;
  Position? _previousPosition;
  DateTime? _previousTime;
  double _lastClimbRateMph = 0.0;

  final StreamController<CombinedTelemetryPoint> _telemetryController =
      StreamController<CombinedTelemetryPoint>.broadcast();
  Stream<CombinedTelemetryPoint> get onTelemetryPoint => _telemetryController.stream;

  bool get isRecording => _activeTrackId != null;
  int? get activeTrackId => _activeTrackId;

  /// Start recording an expedition track
  Future<int> startExpeditionRecording(String trackName) async {
    final trackId = await DatabaseHelper.instance.startNewTrack(trackName);
    _activeTrackId = trackId;

    // Check location permission
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    // 1. Start High-Precision GNSS Stream
    const locationSettings = LocationSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 3, // Update every 3 meters
    );

    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen(_handleNewPosition);

    // 2. Start Health Connect fallback polling (every 10 seconds if no BLE HR)
    _healthFallbackTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      _pollHealthFallback();
    });

    return trackId;
  }

  /// Connect to standard Bluetooth LE Heart Rate Monitor (Service 0x180D)
  Future<void> connectBleHeartRate(BluetoothDevice device) async {
    try {
      await device.connect(autoConnect: true);
      final services = await device.discoverServices();

      for (final service in services) {
        // 0x180D: Heart Rate Service
        if (service.uuid.toString().toUpperCase().contains('180D')) {
          for (final char in service.characteristics) {
            // 0x2A37: Heart Rate Measurement Characteristic
            if (char.uuid.toString().toUpperCase().contains('2A37')) {
              await char.setNotifyValue(true);
              _hrSubscription?.cancel();
              _hrSubscription = char.lastValueStream.listen(_parseHeartRateMeasurement);
              debugPrint('[BLE HR] Subscribed to 0x2A37 Heart Rate characteristic');
            }
          }
        }
      }
    } catch (e) {
      debugPrint('[BLE HR] Connection error: $e');
    }
  }

  /// Bit-level parser for Bluetooth SIG 0x2A37 standard
  void _parseHeartRateMeasurement(List<int> data) {
    if (data.isEmpty) return;

    final int flags = data[0];
    int hrValue;

    // Bit 0: 0 = 8-bit format, 1 = 16-bit format
    if ((flags & 0x01) == 0) {
      hrValue = data[1];
    } else {
      hrValue = data[1] | (data[2] << 8);
    }

    _lastKnownHeartRate = hrValue;
  }

  /// Health Connect / Apple HealthKit polling bridge
  Future<void> _pollHealthFallback() async {
    if (_lastKnownHeartRate != null) return; // Dedicated BLE strap active

    try {
      final health = Health();
      final now = DateTime.now();
      final points = await health.getHealthDataFromTypes(
        startTime: now.subtract(const Duration(minutes: 1)),
        endTime: now,
        types: [HealthDataType.HEART_RATE],
      );

      if (points.isNotEmpty) {
        final lastPoint = points.last;
        if (lastPoint.value is NumericHealthValue) {
          _lastKnownHeartRate = (lastPoint.value as NumericHealthValue).numericValue.round();
        }
      }
    } catch (_) {}
  }

  void _handleNewPosition(Position pos) {
    final now = DateTime.now();

    // Compute Climb Rate in meters/hour
    if (_previousPosition != null && _previousTime != null) {
      final double deltaEle = pos.altitude - _previousPosition!.altitude;
      final double deltaSeconds = now.difference(_previousTime!).inMilliseconds / 1000.0;

      if (deltaSeconds > 0) {
        // meters/second * 3600 = meters/hour
        _lastClimbRateMph = (deltaEle / deltaSeconds) * 3600.0;
      }
    }

    _previousPosition = pos;
    _previousTime = now;

    final telemetry = CombinedTelemetryPoint(
      latitude: pos.latitude,
      longitude: pos.longitude,
      elevationM: pos.altitude,
      speedMps: pos.speed,
      headingDegrees: pos.heading,
      heartRateBpm: _lastKnownHeartRate,
      climbRateMetersPerHour: _lastClimbRateMph,
      timestamp: now,
    );

    // Save to offline SQLite database if currently recording
    if (_activeTrackId != null) {
      DatabaseHelper.instance.insertTrackPoint(
        trackId: _activeTrackId!,
        lat: pos.latitude,
        lon: pos.longitude,
        ele: pos.altitude,
        heartRate: _lastKnownHeartRate,
        timestamp: now,
      );
    }

    _telemetryController.add(telemetry);
  }

  /// Stop current recording and clean up listeners
  Future<void> stopExpeditionRecording(String gpxBlob) async {
    if (_activeTrackId != null) {
      await DatabaseHelper.instance.endTrack(_activeTrackId!, gpxBlob);
      _activeTrackId = null;
    }

    _positionSubscription?.cancel();
    _positionSubscription = null;
    _healthFallbackTimer?.cancel();
    _healthFallbackTimer = null;
  }

  void dispose() {
    _positionSubscription?.cancel();
    _hrSubscription?.cancel();
    _healthFallbackTimer?.cancel();
    _telemetryController.close();
  }
}
