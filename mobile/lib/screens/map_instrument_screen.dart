import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../services/ble_mesh_service.dart';
import '../services/unified_collector_service.dart';
import '../theme/field_tokens.dart';
import '../widgets/field_instruments/knurled_hardware_button.dart';
import '../widgets/field_instruments/vernier_opacity_dial.dart';

enum MapLayerType {
  topo,
  satellite,
  outdoors,
  darkMatter,
}

/// Primary Field Instrument Screen: High-Res Topo/Satellite Maps + Vernier Dial + Telemetry HUD
class MapInstrumentScreen extends StatefulWidget {
  const MapInstrumentScreen({super.key});

  @override
  State<MapInstrumentScreen> createState() => _MapInstrumentScreenState();
}

class _MapInstrumentScreenState extends State<MapInstrumentScreen> {
  MapLibreMapController? _mapController;
  double _soiOpacity = 0.50;
  MapLayerType _activeLayer = MapLayerType.satellite;
  StreamSubscription<CombinedTelemetryPoint>? _telemetrySub;

  // Real Himalayan Coordinates (Kedarkantha Peak Ridge, Uttarakhand)
  CombinedTelemetryPoint _currentTelemetry = CombinedTelemetryPoint(
    latitude: 31.0234,
    longitude: 78.1723,
    elevationM: 3810.0,
    speedMps: 1.2,
    headingDegrees: 42.0,
    heartRateBpm: 138,
    climbRateMetersPerHour: 340.0,
    timestamp: DateTime.now(),
  );

  bool isSosTriggered = false;

  @override
  void initState() {
    super.initState();
    _telemetrySub = UnifiedCollectorService.instance.onTelemetryPoint.listen((data) {
      setState(() {
        _currentTelemetry = data;
      });
    });
  }

  @override
  void dispose() {
    _telemetrySub?.cancel();
    super.dispose();
  }

  void _onMapCreated(MapLibreMapController controller) {
    _mapController = controller;
    _updateRasterOpacity(_soiOpacity);
  }

  void _onOpacityChanged(double newOpacity) {
    setState(() {
      _soiOpacity = newOpacity;
    });
    _updateRasterOpacity(newOpacity);
  }

  void _updateRasterOpacity(double opacity) {
    if (_mapController != null) {
      try {
        _mapController!.setLayerVisibility('soi-vintage-raster-layer', opacity > 0.05);
      } catch (_) {}
    }
  }

  String _getStyleJson(MapLayerType type) {
    switch (type) {
      case MapLayerType.satellite:
        // ESRI World Imagery: High-resolution real satellite photography of mountains
        return jsonEncode({
          "version": 8,
          "sources": {
            "esri-sat": {
              "type": "raster",
              "tiles": [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              ],
              "tileSize": 256,
              "maxzoom": 19,
              "attribution": "© Esri, Maxar, Earthstar Geographics"
            }
          },
          "layers": [
            {
              "id": "bg",
              "type": "background",
              "paint": {"background-color": "#0F1210"}
            },
            {
              "id": "esri-sat-layer",
              "type": "raster",
              "source": "esri-sat",
              "minzoom": 0,
              "maxzoom": 22
            }
          ]
        });

      case MapLayerType.topo:
        // OpenTopoMap: Authentic 20m contour lines, trail paths, elevation markers
        return jsonEncode({
          "version": 8,
          "sources": {
            "opentopo": {
              "type": "raster",
              "tiles": ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
              "tileSize": 256,
              "maxzoom": 17,
              "attribution": "© OpenStreetMap contributors, SRTM | © OpenTopoMap"
            }
          },
          "layers": [
            {
              "id": "bg",
              "type": "background",
              "paint": {"background-color": "#F4EFE6"}
            },
            {
              "id": "opentopo-layer",
              "type": "raster",
              "source": "opentopo",
              "minzoom": 0,
              "maxzoom": 22
            }
          ]
        });

      case MapLayerType.outdoors:
        // ESRI World Topo: Beautiful shaded relief, mountain peaks, elevation benchmarks
        return jsonEncode({
          "version": 8,
          "sources": {
            "esri-topo": {
              "type": "raster",
              "tiles": [
                "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
              ],
              "tileSize": 256,
              "maxzoom": 19,
              "attribution": "© Esri, USGS, Garmin"
            }
          },
          "layers": [
            {
              "id": "bg",
              "type": "background",
              "paint": {"background-color": "#0F1210"}
            },
            {
              "id": "esri-topo-layer",
              "type": "raster",
              "source": "esri-topo",
              "minzoom": 0,
              "maxzoom": 22
            }
          ]
        });

      case MapLayerType.darkMatter:
        // Carto Dark Matter: High-contrast tactical night HUD
        return jsonEncode({
          "version": 8,
          "sources": {
            "carto-dark": {
              "type": "raster",
              "tiles": [
                "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png"
              ],
              "tileSize": 256,
              "maxzoom": 19,
              "attribution": "© OpenStreetMap contributors © CARTO"
            }
          },
          "layers": [
            {
              "id": "bg",
              "type": "background",
              "paint": {"background-color": "#0F1210"}
            },
            {
              "id": "carto-dark-layer",
              "type": "raster",
              "source": "carto-dark",
              "minzoom": 0,
              "maxzoom": 22
            }
          ]
        });
    }
  }

  void _triggerSos() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: FieldTokens.pineSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
          side: const BorderSide(color: FieldTokens.rescueOrange, width: 2.0),
        ),
        title: Text(
          'TRIGGER RESCUE SOS?',
          style: FieldTokens.technicalMonospace(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            color: FieldTokens.rescueOrange,
          ),
        ),
        content: Text(
          'This broadcasts an emergency distress packet over the 4-hop physical BLE mesh.\n\n'
          'COORDINATES:\n${_formatCoordinate(_currentTelemetry.latitude, true)}\n${_formatCoordinate(_currentTelemetry.longitude, false)}\n'
          'ALTITUDE: ${_currentTelemetry.elevationM.toStringAsFixed(0)} MSL',
          style: FieldTokens.technicalMonospace(fontSize: 11, color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('CANCEL', style: FieldTokens.technicalMonospace(color: Colors.white60)),
          ),
          KnurledHardwareButton(
            label: 'TRANSMIT SOS',
            isDestructive: true,
            height: 40,
            onPressed: () {
              Navigator.pop(ctx);
              BleMeshService.instance.sendSosAlert(
                lat: _currentTelemetry.latitude,
                lon: _currentTelemetry.longitude,
                sosCode: 1,
              );
              setState(() => isSosTriggered = true);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('DISTRESS PACKET BROADCASTED OVER PHYSICAL MESH'),
                  backgroundColor: FieldTokens.rescueOrange,
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  String _formatCoordinate(double val, bool isLat) {
    final deg = val.abs().floor();
    final minFloat = (val.abs() - deg) * 60;
    final min = minFloat.floor();
    final sec = ((minFloat - min) * 60).toStringAsFixed(1);
    final hemi = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return '$deg°$min\'$sec"$hemi';
  }

  @override
  Widget build(BuildContext context) {
    final isRecording = UnifiedCollectorService.instance.isRecording;

    return Scaffold(
      backgroundColor: FieldTokens.basaltBackground,
      body: Stack(
        children: [
          // 1. High-Performance MapLibre Canvas with Real High-Res Topo / Satellite Imagery
          MapLibreMap(
            key: ValueKey(_activeLayer),
            styleString: _getStyleJson(_activeLayer),
            initialCameraPosition: CameraPosition(
              target: LatLng(_currentTelemetry.latitude, _currentTelemetry.longitude),
              zoom: 14.2,
              tilt: 45.0,
            ),
            onMapCreated: _onMapCreated,
            myLocationEnabled: true,
            myLocationRenderMode: MyLocationRenderMode.compass,
          ),

          // 2. Top Telemetry HUD + Quick Map Layer Switcher
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: FieldTokens.pineSurface.withOpacity(0.92),
                  borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
                  border: Border.all(
                    color: FieldTokens.pineSurfaceBorder,
                    width: FieldTokens.instrumentBorderWidth,
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Status row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'SHEET 53J/3 • KEDARKANTHA HIMALAYAS',
                          style: FieldTokens.technicalMonospace(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: FieldTokens.contourOchre,
                          ),
                        ),
                        Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: isRecording ? FieldTokens.rescueOrange : FieldTokens.mossNeon,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              isRecording ? 'REC 1Hz' : 'MESH READY',
                              style: FieldTokens.technicalMonospace(
                                fontSize: 9,
                                fontWeight: FontWeight.w700,
                                color: isRecording ? FieldTokens.rescueOrange : FieldTokens.mossNeon,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),

                    // Telemetry row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _telemetryCell(
                          'POSITION',
                          '${_formatCoordinate(_currentTelemetry.latitude, true)}\n${_formatCoordinate(_currentTelemetry.longitude, false)}',
                        ),
                        _telemetryCell(
                          'ALTITUDE',
                          '${_currentTelemetry.elevationM.toStringAsFixed(0)} M\nMSL',
                          valueColor: FieldTokens.contourOchre,
                        ),
                        _telemetryCell(
                          'VERTICAL V',
                          '${_currentTelemetry.climbRateMetersPerHour >= 0 ? '+' : ''}${_currentTelemetry.climbRateMetersPerHour.toStringAsFixed(0)} M/H\nCLIMB',
                        ),
                        _telemetryCell(
                          'PULSE',
                          '${_currentTelemetry.heartRateBpm ?? "--"} BPM\nGATT HR',
                          valueColor: FieldTokens.rescueOrange,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),

                    // Tactile Map Layer Switcher
                    Container(
                      height: 28,
                      decoration: BoxDecoration(
                        color: const Color(0xFF131715),
                        borderRadius: BorderRadius.circular(2),
                        border: Border.all(color: FieldTokens.pineSurfaceBorder),
                      ),
                      child: Row(
                        children: [
                          _layerButton('SATELLITE', MapLayerType.satellite, Icons.satellite_alt_outlined),
                          _layerButton('TOPO CONTOUR', MapLayerType.topo, Icons.terrain),
                          _layerButton('OUTDOORS', MapLayerType.outdoors, Icons.landscape_outlined),
                          _layerButton('TACTICAL', MapLayerType.darkMatter, Icons.dark_mode_outlined),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // 3. Vernier Opacity Dial on Right Edge
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.only(right: 12.0),
              child: VernierOpacityDial(
                value: _soiOpacity,
                onChanged: _onOpacityChanged,
                height: 250,
                width: 76,
              ),
            ),
          ),

          // 4. Bottom Controls: Recording Toggle & Emergency SOS
          Positioned(
            left: 12,
            right: 12,
            bottom: 16,
            child: Row(
              children: [
                Expanded(
                  child: KnurledHardwareButton(
                    label: isRecording ? 'STOP EXPEDITION' : 'RECORD TRACK',
                    icon: isRecording ? Icons.stop : Icons.play_arrow,
                    accentColor: isRecording ? FieldTokens.rescueOrange : FieldTokens.mossNeon,
                    onPressed: () async {
                      if (isRecording) {
                        await UnifiedCollectorService.instance.stopExpeditionRecording('');
                        setState(() {});
                      } else {
                        await UnifiedCollectorService.instance.startExpeditionRecording('Kedarkantha_Ridge');
                        setState(() {});
                      }
                    },
                  ),
                ),
                const SizedBox(width: 12),
                KnurledHardwareButton(
                  label: 'SOS',
                  icon: Icons.warning_amber_rounded,
                  isDestructive: true,
                  onPressed: _triggerSos,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _layerButton(String label, MapLayerType type, IconData icon) {
    final bool isSelected = _activeLayer == type;
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          if (_activeLayer != type) {
            HapticFeedback.selectionClick();
            setState(() {
              _activeLayer = type;
            });
          }
        },
        child: Container(
          color: isSelected ? FieldTokens.contourOchre.withOpacity(0.25) : Colors.transparent,
          alignment: Alignment.center,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 11,
                color: isSelected ? FieldTokens.contourOchre : FieldTokens.soiGridBorder,
              ),
              const SizedBox(width: 3),
              Text(
                label,
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 7.5,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                  color: isSelected ? FieldTokens.contourOchre : FieldTokens.soiGridBorder,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _telemetryCell(String label, String value, {Color? valueColor}) {
    return Column(
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
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontFamily: 'monospace',
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: valueColor ?? Colors.white,
            height: 1.15,
          ),
        ),
      ],
    );
  }
}
