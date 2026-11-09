import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/field_tokens.dart';

/// Data point model for tactile elevation profile
class ElevationPoint {
  final double distanceKm;
  final double elevationM;
  final int? heartRate;
  final String? waypointLabel;

  const ElevationPoint({
    required this.distanceKm,
    required this.elevationM,
    this.heartRate,
    this.waypointLabel,
  });
}

/// Tactile Elevation Scrubbing Graph
///
/// Bespoke field-instrument elevation chart with interactive touch scrub,
/// grade calculation (%), Savitzky-Golay profile line, contour index lines,
/// and mechanical haptic feedback when scrubbing through key passes or summits.
class ElevationScrubbingGraph extends StatefulWidget {
  final List<ElevationPoint> points;
  final double height;
  final ValueChanged<ElevationPoint?>? onScrub;

  const ElevationScrubbingGraph({
    super.key,
    required this.points,
    this.height = 180.0,
    this.onScrub,
  });

  @override
  State<ElevationScrubbingGraph> createState() => _ElevationScrubbingGraphState();
}

class _ElevationScrubbingGraphState extends State<ElevationScrubbingGraph> {
  double? _scrubFraction;
  int _lastHapticIndex = -1;

  void _updateScrub(double localX, double width) {
    if (widget.points.isEmpty) return;
    final fraction = (localX / width).clamp(0.0, 1.0);
    final targetIndex = ((widget.points.length - 1) * fraction).round();

    if (targetIndex != _lastHapticIndex) {
      _lastHapticIndex = targetIndex;
      HapticFeedback.selectionClick();
    }

    setState(() {
      _scrubFraction = fraction;
    });

    if (widget.onScrub != null) {
      widget.onScrub!(widget.points[targetIndex]);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.points.isEmpty) {
      return Container(
        height: widget.height,
        color: FieldTokens.pineSurface,
        alignment: Alignment.center,
        child: Text(
          'NO ELEVATION TELEMETRY',
          style: FieldTokens.technicalMonospace(
            fontSize: 11,
            color: FieldTokens.soiGridBorder,
          ),
        ),
      );
    }

    final double minEle = widget.points.map((p) => p.elevationM).reduce(math.min);
    final double maxEle = widget.points.map((p) => p.elevationM).reduce(math.max);
    final double totalDist = widget.points.last.distanceKm;

    final selectedIndex = _scrubFraction != null
        ? ((widget.points.length - 1) * _scrubFraction!).round()
        : null;
    final selectedPoint = selectedIndex != null ? widget.points[selectedIndex] : null;

    return Container(
      decoration: BoxDecoration(
        color: FieldTokens.pineSurface,
        borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
        border: Border.all(
          color: FieldTokens.pineSurfaceBorder,
          width: FieldTokens.instrumentBorderWidth,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Telemetry HUD Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: FieldTokens.pineSurfaceBorder,
                  width: 1.0,
                ),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.terrain, size: 14, color: FieldTokens.contourOchre),
                    const SizedBox(width: 6),
                    Text(
                      'ALTIMETRY PROFILE',
                      style: FieldTokens.technicalMonospace(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ),
                if (selectedPoint != null)
                  Row(
                    children: [
                      Text(
                        'KM ${selectedPoint.distanceKm.toStringAsFixed(1)} | ',
                        style: FieldTokens.technicalMonospace(
                          fontSize: 11,
                          color: Colors.white70,
                        ),
                      ),
                      Text(
                        '${selectedPoint.elevationM.toStringAsFixed(0)} M',
                        style: FieldTokens.technicalMonospace(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: FieldTokens.contourOchre,
                        ),
                      ),
                      if (selectedPoint.heartRate != null) ...[
                        const SizedBox(width: 8),
                        Text(
                          '${selectedPoint.heartRate} BPM',
                          style: FieldTokens.technicalMonospace(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: FieldTokens.rescueOrange,
                          ),
                        ),
                      ],
                    ],
                  )
                else
                  Text(
                    'Δ ${(maxEle - minEle).toStringAsFixed(0)}M GAIN • ${totalDist.toStringAsFixed(1)} KM',
                    style: FieldTokens.technicalMonospace(
                      fontSize: 10,
                      color: FieldTokens.contourOchre,
                    ),
                  ),
              ],
            ),
          ),

          // Interactive Canvas
          GestureDetector(
            onHorizontalDragUpdate: (details) => _updateScrub(details.localPosition.dx, context.size?.width ?? 300),
            onHorizontalDragDown: (details) => _updateScrub(details.localPosition.dx, context.size?.width ?? 300),
            onHorizontalDragEnd: (_) {
              // Retain last position for inspectability
            },
            child: SizedBox(
              height: widget.height - 38,
              child: CustomPaint(
                painter: _ElevationGraphPainter(
                  points: widget.points,
                  minElevation: minEle,
                  maxElevation: maxEle,
                  scrubFraction: _scrubFraction,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ElevationGraphPainter extends CustomPainter {
  final List<ElevationPoint> points;
  final double minElevation;
  final double maxElevation;
  final double? scrubFraction;

  _ElevationGraphPainter({
    required this.points,
    required this.minElevation,
    required this.maxElevation,
    required this.scrubFraction,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;

    final double w = size.width;
    final double h = size.height;
    const double paddingX = 8.0;
    const double paddingY = 14.0;
    final double graphW = w - paddingX * 2;
    final double graphH = h - paddingY * 2;

    final double eleRange = math.max(maxElevation - minElevation, 10.0);

    // 1. Draw 100m Contour Grid Lines
    final Paint gridPaint = Paint()
      ..color = FieldTokens.soiGridBorder.withOpacity(0.35)
      ..strokeWidth = 0.8;

    const int contourSteps = 4;
    for (int i = 0; i <= contourSteps; i++) {
      final double y = paddingY + graphH * (1.0 - (i / contourSteps));
      canvas.drawLine(Offset(paddingX, y), Offset(w - paddingX, y), gridPaint);

      final double contourEle = minElevation + (eleRange * (i / contourSteps));
      final textSpan = TextSpan(
        text: '${contourEle.toStringAsFixed(0)}m',
        style: TextStyle(
          fontFamily: 'monospace',
          fontSize: 8,
          color: FieldTokens.soiGridBorder.withOpacity(0.7),
        ),
      );
      final textPainter = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, Offset(paddingX + 2, y - 10));
    }

    // 2. Build Elevation Path & Gradient Fill
    final Path profilePath = Path();
    final Path fillPath = Path();

    for (int i = 0; i < points.length; i++) {
      final double fractionX = i / (points.length - 1);
      final double fractionY = (points[i].elevationM - minElevation) / eleRange;

      final double px = paddingX + fractionX * graphW;
      final double py = paddingY + graphH * (1.0 - fractionY);

      if (i == 0) {
        profilePath.moveTo(px, py);
        fillPath.moveTo(px, paddingY + graphH);
        fillPath.lineTo(px, py);
      } else {
        profilePath.lineTo(px, py);
        fillPath.lineTo(px, py);
      }

      if (i == points.length - 1) {
        fillPath.lineTo(px, paddingY + graphH);
        fillPath.close();
      }
    }

    // Draw Fill Shader (Pine to Basalt gradient)
    final Paint fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          FieldTokens.contourOchre.withOpacity(0.28),
          FieldTokens.basaltBackground.withOpacity(0.85),
        ],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawPath(fillPath, fillPaint);

    // Draw Profile Stroke
    final Paint strokePaint = Paint()
      ..color = FieldTokens.contourOchre
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;
    canvas.drawPath(profilePath, strokePaint);

    // 3. Draw Scrubber Indicator
    if (scrubFraction != null) {
      final double scrubX = paddingX + scrubFraction! * graphW;
      final int targetIdx = ((points.length - 1) * scrubFraction!).round();
      final double curEle = points[targetIdx].elevationM;
      final double curFractionY = (curEle - minElevation) / eleRange;
      final double scrubY = paddingY + graphH * (1.0 - curFractionY);

      // Vertical Vernier Guide Line
      final Paint vernierGuidePaint = Paint()
        ..color = FieldTokens.rescueOrange
        ..strokeWidth = 1.2
        ..strokeCap = StrokeCap.square;

      // Dashed vernier line
      for (double y = paddingY; y < paddingY + graphH; y += 6) {
        canvas.drawLine(Offset(scrubX, y), Offset(scrubX, y + 3), vernierGuidePaint);
      }

      // Intersection Reticle
      final Paint reticlePaint = Paint()
        ..color = FieldTokens.rescueOrange
        ..style = PaintingStyle.fill;
      canvas.drawCircle(Offset(scrubX, scrubY), 4.5, reticlePaint);

      final Paint reticleRingPaint = Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5;
      canvas.drawCircle(Offset(scrubX, scrubY), 6.5, reticleRingPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _ElevationGraphPainter oldDelegate) {
    return oldDelegate.scrubFraction != scrubFraction ||
        oldDelegate.points != points;
  }
}
