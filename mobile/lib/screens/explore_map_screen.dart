import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:maplibre_gl/maplibre_gl.dart';
import '../data/seeded_trails.dart';
import '../theme/field_tokens.dart';
import '../widgets/field_instruments/elevation_scrubbing_graph.dart';
import '../widgets/field_instruments/soi_grid_stamp_card.dart';

enum MapLayerStyle {
  openTopo,
  esriSatellite,
  openStreetMap,
  cartoDark,
}

class ExploreMapScreen extends StatefulWidget {
  final ValueChanged<TrailModel>? onSelectTrailForRecord;

  const ExploreMapScreen({super.key, this.onSelectTrailForRecord});

  @override
  State<ExploreMapScreen> createState() => _ExploreMapScreenState();
}

class _ExploreMapScreenState extends State<ExploreMapScreen> {
  MapLibreMapController? _mapController;
  MapLayerStyle _currentLayerStyle = MapLayerStyle.openTopo;
  double _soiOverlayOpacity = 0.0;
  String _activeFilter = 'All Trails';
  String _searchQuery = '';

  late TrailModel _selectedTrail;
  final PageController _carouselController = PageController(viewportFraction: 0.88);

  final List<String> _filters = [
    'All Trails',
    'Himalayas',
    'North-East',
    'Western Ghats',
    'Water Points',
    'Campsites',
    'SOI Grid',
  ];

  @override
  void initState() {
    super.initState();
    _selectedTrail = SeededTrailsData.trails.first;
  }

  @override
  void dispose() {
    _carouselController.dispose();
    super.dispose();
  }

  List<TrailModel> get _filteredTrails {
    return SeededTrailsData.trails.where((trail) {
      final matchesQuery = _searchQuery.isEmpty ||
          trail.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          trail.state.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          trail.soiSheet.toLowerCase().contains(_searchQuery.toLowerCase());

      if (!matchesQuery) return false;

      if (_activeFilter == 'Himalayas') {
        return trail.region == 'Himalayas';
      } else if (_activeFilter == 'North-East') {
        return trail.region == 'North-East';
      } else if (_activeFilter == 'Western Ghats') {
        return trail.region == 'Western Ghats';
      } else if (_activeFilter == 'Water Points') {
        return trail.waypoints.any((w) => w.type.contains('water'));
      } else if (_activeFilter == 'Campsites') {
        return trail.waypoints.any((w) => w.type.contains('campsite'));
      }
      return true;
    }).toList();
  }

  String _getMapStyleJson(MapLayerStyle style) {
    String tileUrl;
    int maxZoom = 19;
    String bgColor = "#0F1210";

    switch (style) {
      case MapLayerStyle.openTopo:
        tileUrl = "https://tile.opentopomap.org/{z}/{x}/{y}.png";
        maxZoom = 17;
        bgColor = "#EAE4D8";
        break;
      case MapLayerStyle.esriSatellite:
        tileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        maxZoom = 19;
        break;
      case MapLayerStyle.openStreetMap:
        tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
        maxZoom = 19;
        bgColor = "#F2EFE9";
        break;
      case MapLayerStyle.cartoDark:
        tileUrl = "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png";
        maxZoom = 20;
        break;
    }

    return jsonEncode({
      "version": 8,
      "sources": {
        "base-raster-source": {
          "type": "raster",
          "tiles": [tileUrl],
          "tileSize": 256,
          "maxzoom": maxZoom,
          "attribution": "© OpenStreetMap contributors, OpenTopoMap, Esri"
        }
      },
      "layers": [
        {
          "id": "bg-layer",
          "type": "background",
          "paint": {"background-color": bgColor}
        },
        {
          "id": "base-raster-layer",
          "type": "raster",
          "source": "base-raster-source",
          "minzoom": 0,
          "maxzoom": 22
        }
      ]
    });
  }

  void _onMapCreated(MapLibreMapController controller) {
    _mapController = controller;
    _drawTrailPolylinesAndWaypoints();
  }

  Future<void> _drawTrailPolylinesAndWaypoints() async {
    if (_mapController == null) return;

    try {
      await _mapController!.clearLines();
      await _mapController!.clearCircles();

      // Render all trail polylines (Selected trail bright orange, others subtle ochre)
      for (final trail in SeededTrailsData.trails) {
        final bool isSelected = trail.id == _selectedTrail.id;
        final latLngs = trail.routeCoords.map((c) => LatLng(c[0], c[1])).toList();

        await _mapController!.addLine(
          LineOptions(
            geometry: latLngs,
            lineColor: isSelected ? "#FF5500" : "#D99B26",
            lineWidth: isSelected ? 4.5 : 2.5,
            lineOpacity: isSelected ? 0.95 : 0.65,
          ),
        );

        // If selected, plot high-contrast waypoints
        if (isSelected) {
          for (final wp in trail.waypoints) {
            String color = "#4ADE80"; // Default start green
            if (wp.type.contains('water')) color = "#38BDF8"; // Cyan
            if (wp.type.contains('campsite')) color = "#D99B26"; // Amber
            if (wp.type == 'summit' || wp.type == 'pass') color = "#FF5500"; // Orange

            await _mapController!.addCircle(
              CircleOptions(
                geometry: LatLng(wp.lat, wp.lon),
                circleColor: color,
                circleRadius: 6.5,
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 2.0,
              ),
            );
          }
        }
      }
    } catch (_) {}
  }

  void _jumpToTrail(TrailModel trail) {
    setState(() {
      _selectedTrail = trail;
    });

    _drawTrailPolylinesAndWaypoints();

    _mapController?.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(
          target: LatLng(trail.startLat, trail.startLon),
          zoom: 12.5,
          tilt: 35.0,
        ),
      ),
    );
  }

  void _openLayerSwitcherSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: FieldTokens.pineSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'MAP LAYERS & TOPOGRAPHY',
                        style: FieldTokens.technicalMonospace(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 20, color: Colors.white70),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _buildLayerOption('OPENTOPO', MapLayerStyle.openTopo, Icons.terrain, setSheetState),
                      const SizedBox(width: 8),
                      _buildLayerOption('SATELLITE', MapLayerStyle.esriSatellite, Icons.satellite_alt, setSheetState),
                      const SizedBox(width: 8),
                      _buildLayerOption('STREET', MapLayerStyle.openStreetMap, Icons.map, setSheetState),
                      const SizedBox(width: 8),
                      _buildLayerOption('TACTICAL', MapLayerStyle.cartoDark, Icons.dark_mode, setSheetState),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Text(
                    'SOI 1:50,000 VINTAGE SHEET OVERLAY',
                    style: FieldTokens.technicalMonospace(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: FieldTokens.contourOchre,
                    ),
                  ),
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      activeTrackColor: FieldTokens.contourOchre,
                      thumbColor: FieldTokens.rescueOrange,
                      inactiveTrackColor: FieldTokens.pineSurfaceBorder,
                    ),
                    child: Slider(
                      value: _soiOverlayOpacity,
                      min: 0.0,
                      max: 1.0,
                      onChanged: (val) {
                        setSheetState(() => _soiOverlayOpacity = val);
                        setState(() => _soiOverlayOpacity = val);
                        HapticFeedback.selectionClick();
                      },
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Pure Vector (0%)', style: TextStyle(fontFamily: 'monospace', fontSize: 10, color: Colors.white60)),
                      Text('${(_soiOverlayOpacity * 100).toInt()}% Opacity', style: FieldTokens.technicalMonospace(fontSize: 11, color: FieldTokens.contourOchre)),
                      Text('Full 1:50k Sheet (100%)', style: TextStyle(fontFamily: 'monospace', fontSize: 10, color: Colors.white60)),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildLayerOption(String name, MapLayerStyle style, IconData icon, StateSetter setSheetState) {
    final isSelected = _currentLayerStyle == style;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setSheetState(() => _currentLayerStyle = style);
          setState(() => _currentLayerStyle = style);
          HapticFeedback.selectionClick();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? FieldTokens.rescueOrange.withValues(alpha: 0.2) : const Color(0xFF131715),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected ? FieldTokens.rescueOrange : FieldTokens.pineSurfaceBorder,
              width: 1.5,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, size: 20, color: isSelected ? FieldTokens.rescueOrange : Colors.white60),
              const SizedBox(height: 6),
              Text(
                name,
                style: FieldTokens.technicalMonospace(
                  fontSize: 8.5,
                  fontWeight: FontWeight.w700,
                  color: isSelected ? FieldTokens.rescueOrange : Colors.white70,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showTrailDetailSheet(TrailModel trail) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: FieldTokens.pineSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        final elePoints = trail.routeCoords.map((c) {
          final idx = trail.routeCoords.indexOf(c);
          final dist = (trail.distanceKm / (trail.routeCoords.length - 1)) * idx;
          return ElevationPoint(distanceKm: dist, elevationM: c[2]);
        }).toList();

        return DraggableScrollableSheet(
          initialChildSize: 0.72,
          minChildSize: 0.45,
          maxChildSize: 0.95,
          expand: false,
          builder: (_, scrollController) {
            return SingleChildScrollView(
              controller: scrollController,
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          trail.name.toUpperCase(),
                          style: FieldTokens.technicalMonospace(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: FieldTokens.rescueOrange.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: FieldTokens.rescueOrange),
                        ),
                        child: Text(
                          trail.difficulty.toUpperCase(),
                          style: FieldTokens.technicalMonospace(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: FieldTokens.rescueOrange,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${trail.state} • ${trail.duration} • SOI ${trail.soiSheet}',
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: FieldTokens.contourOchre),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    trail.description,
                    style: const TextStyle(fontSize: 13, height: 1.4, color: Colors.white70),
                  ),
                  const SizedBox(height: 16),
                  ElevationScrubbingGraph(
                    points: elePoints,
                    height: 180,
                  ),
                  const SizedBox(height: 16),
                  SoiGridStampCard(
                    sheetNumber: trail.soiSheet,
                    regionTitle: '${trail.state} - ${trail.region}',
                    latRange: '${trail.startLat.toStringAsFixed(2)}°N',
                    lonRange: '${trail.startLon.toStringAsFixed(2)}°E',
                    scaleRatio: 50000,
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: FieldTokens.rescueOrange,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    icon: const Icon(Icons.navigation_outlined, size: 20),
                    label: Text(
                      'START NAVIGATION ON THIS TRAIL',
                      style: FieldTokens.technicalMonospace(fontSize: 12, fontWeight: FontWeight.w900),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      widget.onSelectTrailForRecord?.call(trail);
                    },
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final trailsList = _filteredTrails;

    return Scaffold(
      backgroundColor: FieldTokens.basaltBackground,
      body: Stack(
        children: [
          // 1. Full Screen Interactive Map
          MapLibreMap(
            key: ValueKey(_currentLayerStyle),
            styleString: _getMapStyleJson(_currentLayerStyle),
            initialCameraPosition: CameraPosition(
              target: LatLng(_selectedTrail.startLat, _selectedTrail.startLon),
              zoom: 12.5,
              tilt: 30.0,
            ),
            onMapCreated: _onMapCreated,
            myLocationEnabled: true,
            myLocationRenderMode: MyLocationRenderMode.compass,
          ),

          // 2. Floating Search & Filter Header
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      // Search Pill
                      Expanded(
                        child: Container(
                          height: 46,
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          decoration: BoxDecoration(
                            color: FieldTokens.pineSurface.withValues(alpha: 0.94),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: FieldTokens.pineSurfaceBorder),
                            boxShadow: const [
                              BoxShadow(color: Colors.black45, blurRadius: 8, offset: Offset(0, 3)),
                            ],
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.search, size: 20, color: FieldTokens.contourOchre),
                              const SizedBox(width: 10),
                              Expanded(
                                child: TextField(
                                  style: const TextStyle(color: Colors.white, fontSize: 13),
                                  decoration: const InputDecoration(
                                    hintText: 'Search trails, peaks, or SOI sheet...',
                                    hintStyle: TextStyle(color: Colors.white38, fontSize: 13),
                                    border: InputBorder.none,
                                    isDense: true,
                                  ),
                                  onChanged: (q) => setState(() => _searchQuery = q),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Layers Floating Circle Button
                      GestureDetector(
                        onTap: _openLayerSwitcherSheet,
                        child: Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(
                            color: FieldTokens.pineSurface.withValues(alpha: 0.94),
                            shape: BoxShape.circle,
                            border: Border.all(color: FieldTokens.pineSurfaceBorder),
                            boxShadow: const [
                              BoxShadow(color: Colors.black45, blurRadius: 8, offset: Offset(0, 3)),
                            ],
                          ),
                          child: const Icon(Icons.layers_outlined, size: 22, color: FieldTokens.contourOchre),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // Filter Chips
                  SizedBox(
                    height: 32,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _filters.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (context, i) {
                        final filter = _filters[i];
                        final isSel = _activeFilter == filter;
                        return GestureDetector(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setState(() => _activeFilter = filter);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: isSel ? FieldTokens.rescueOrange : FieldTokens.pineSurface.withValues(alpha: 0.90),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSel ? FieldTokens.rescueOrange : FieldTokens.pineSurfaceBorder,
                              ),
                            ),
                            child: Text(
                              filter,
                              style: FieldTokens.technicalMonospace(
                                fontSize: 10.5,
                                fontWeight: isSel ? FontWeight.w800 : FontWeight.w600,
                                color: isSel ? Colors.black : Colors.white70,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 3. Bottom Horizontal Trail Card Carousel
          Positioned(
            left: 0,
            right: 0,
            bottom: 16,
            child: SizedBox(
              height: 125,
              child: trailsList.isEmpty
                  ? Container(
                      margin: const EdgeInsets.symmetric(horizontal: 20),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: FieldTokens.pineSurface,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'NO TRAILS FOUND FOR THIS FILTER',
                        style: FieldTokens.technicalMonospace(fontSize: 11, color: Colors.white54),
                      ),
                    )
                  : PageView.builder(
                      controller: _carouselController,
                      itemCount: trailsList.length,
                      onPageChanged: (idx) {
                        _jumpToTrail(trailsList[idx]);
                      },
                      itemBuilder: (context, index) {
                        final trail = trailsList[index];
                        final isSelected = trail.id == _selectedTrail.id;

                        return GestureDetector(
                          onTap: () {
                            _jumpToTrail(trail);
                            _showTrailDetailSheet(trail);
                          },
                          child: Container(
                            margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: FieldTokens.pineSurface.withValues(alpha: 0.95),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected ? FieldTokens.rescueOrange : FieldTokens.pineSurfaceBorder,
                                width: isSelected ? 2.0 : 1.0,
                              ),
                              boxShadow: const [
                                BoxShadow(color: Colors.black54, blurRadius: 10, offset: Offset(0, 4)),
                              ],
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Text(
                                        trail.name.toUpperCase(),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: FieldTokens.technicalMonospace(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w800,
                                          color: Colors.white,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        '${trail.state} • ${trail.distanceKm} KM • ${trail.maxAltM}m',
                                        style: const TextStyle(
                                          fontFamily: 'monospace',
                                          fontSize: 10.5,
                                          color: FieldTokens.contourOchre,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Row(
                                        children: [
                                          _badge(trail.difficulty, FieldTokens.rescueOrange),
                                          const SizedBox(width: 6),
                                          _badge('SOI ${trail.soiSheet}', FieldTokens.mossNeon),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.white38),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _badge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color, width: 0.8),
      ),
      child: Text(
        text.toUpperCase(),
        style: FieldTokens.technicalMonospace(
          fontSize: 8.5,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
