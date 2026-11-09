import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../theme/field_tokens.dart';

/// Representation of a nearby party member on the physical BLE mesh
class MeshPeerNode {
  final String peerId;
  final String callsign;
  final int rssi; // -100 to -30 dBm
  final double bearingDegrees; // 0 to 360 relative to user heading
  final int batteryPercent;
  final int hopCount;
  final bool isSos;
  final DateTime lastSeen;

  const MeshPeerNode({
    required this.peerId,
    required this.callsign,
    required this.rssi,
    required this.bearingDegrees,
    required this.batteryPercent,
    required this.hopCount,
    this.isSos = false,
    required this.lastSeen,
  });
}

/// Campfire Mesh Radar Scanner
///
/// Circular polar sweep radar inspired by marine SONAR and tactical transceivers.
/// Maps BLE peer nodes based on estimated distance (derived from RSSI) and relative bearing.
/// Renders concentric range rings (-40, -65, -80, -95 dBm), sweep line, and pulsing blips.
class CampfireMeshRadar extends StatefulWidget {
  final List<MeshPeerNode> peers;
  final double size;
  final ValueChanged<MeshPeerNode>? onNodeSelected;

  const CampfireMeshRadar({
    super.key,
    required this.peers,
    this.size = 280.0,
    this.onNodeSelected,
  });

  @override
  State<CampfireMeshRadar> createState() => _CampfireMeshRadarState();
}

class _CampfireMeshRadarState extends State<CampfireMeshRadar>
    with SingleTickerProviderStateMixin {
  late AnimationController _sweepController;

  @override
  void initState() {
    super.initState();
    _sweepController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 4),
    )..repeat();
  }

  @override
  void dispose() {
    _sweepController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        color: FieldTokens.pineSurface,
        shape: BoxShape.circle,
        border: Border.all(
          color: FieldTokens.pineSurfaceBorder,
          width: 2.0,
        ),
        boxShadow: const [
          BoxShadow(
            color: Colors.black54,
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
      ),
      child: AnimatedBuilder(
        animation: _sweepController,
        builder: (context, child) {
          return CustomPaint(
            size: Size(widget.size, widget.size),
            painter: _RadarPainter(
              sweepAngle: _sweepController.value * 2 * math.pi,
              peers: widget.peers,
            ),
          );
        },
      ),
    );
  }
}

class _RadarPainter extends CustomPainter {
  final double sweepAngle;
  final List<MeshPeerNode> peers;

  _RadarPainter({required this.sweepAngle, required this.peers});

  @override
  void paint(Canvas canvas, Size size) {
    final Offset center = Offset(size.width / 2, size.height / 2);
    final double radius = (size.width / 2) - 8;

    // 1. Concentric Range Rings (dBm boundaries)
    final Paint ringPaint = Paint()
      ..color = FieldTokens.tactileSteel.withOpacity(0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    const ringFractions = [0.25, 0.50, 0.75, 1.0];
    final dbmLabels = ['-40 dBm', '-65 dBm', '-80 dBm', '-95 dBm'];

    for (int i = 0; i < ringFractions.length; i++) {
      final r = radius * ringFractions[i];
      canvas.drawCircle(center, r, ringPaint);

      // Label on top of ring
      final textSpan = TextSpan(
        text: dbmLabels[i],
        style: TextStyle(
          fontFamily: 'monospace',
          fontSize: 8,
          color: FieldTokens.soiGridBorder.withOpacity(0.6),
        ),
      );
      final textPainter = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      )..layout();
      textPainter.paint(canvas, Offset(center.dx + 4, center.dy - r - 2));
    }

    // 2. Graticule Crosshairs (N/S, E/W axes)
    final Paint axisPaint = Paint()
      ..color = FieldTokens.tactileSteel.withOpacity(0.4)
      ..strokeWidth = 1.0;

    canvas.drawLine(Offset(center.dx, center.dy - radius), Offset(center.dx, center.dy + radius), axisPaint);
    canvas.drawLine(Offset(center.dx - radius, center.dy), Offset(center.dx + radius, center.dy), axisPaint);

    // Cardinal Indicators
    _drawCardinal(canvas, center, radius, 'N', 0);
    _drawCardinal(canvas, center, radius, 'E', 90);
    _drawCardinal(canvas, center, radius, 'S', 180);
    _drawCardinal(canvas, center, radius, 'W', 270);

    // 3. Rotating Sweep Beam with phosphor fade
    final Paint sweepPaint = Paint()
      ..shader = SweepGradient(
        center: Alignment.center,
        startAngle: 0.0,
        endAngle: math.pi / 3,
        colors: [
          FieldTokens.mossNeon.withOpacity(0.40),
          FieldTokens.mossNeon.withOpacity(0.0),
        ],
        transform: GradientRotation(sweepAngle - math.pi / 3),
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawCircle(center, radius, sweepPaint);

    // Leading sweep needle line
    final Paint needlePaint = Paint()
      ..color = FieldTokens.mossNeon
      ..strokeWidth = 1.5;
    final Offset needleEnd = Offset(
      center.dx + radius * math.cos(sweepAngle),
      center.dy + radius * math.sin(sweepAngle),
    );
    canvas.drawLine(center, needleEnd, needlePaint);

    // 4. Draw Center Node (Self)
    final Paint selfPaint = Paint()..color = FieldTokens.glacierCyan;
    canvas.drawCircle(center, 4, selfPaint);

    // 5. Draw Mesh Peer Blips
    for (final peer in peers) {
      // Map RSSI (-40 to -100 dBm) to radius fraction (0.15 to 0.95)
      final clampedRssi = peer.rssi.clamp(-100, -35);
      final normalizedDist = (clampedRssi - (-35)) / (-100 - (-35));
      final peerDist = radius * (0.15 + normalizedDist * 0.80);

      final radBearing = (peer.bearingDegrees - 90) * (math.pi / 180.0);
      final peerPos = Offset(
        center.dx + peerDist * math.cos(radBearing),
        center.dy + peerDist * math.sin(radBearing),
      );

      final Color blipColor = peer.isSos
          ? FieldTokens.rescueOrange
          : (peer.hopCount == 1 ? FieldTokens.mossNeon : FieldTokens.contourOchre);

      // Glowing outer pulse
      final Paint glowPaint = Paint()
        ..color = blipColor.withOpacity(0.3)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(peerPos, peer.isSos ? 10 : 7, glowPaint);

      // Blip center
      final Paint blipPaint = Paint()..color = blipColor;
      canvas.drawCircle(peerPos, 4, blipPaint);

      // Callsign & RSSI Tag
      final callsignSpan = TextSpan(
        text: '${peer.callsign} (${peer.rssi}dBm)',
        style: TextStyle(
          fontFamily: 'monospace',
          fontSize: 8,
          fontWeight: FontWeight.w700,
          color: blipColor,
        ),
      );
      final callsignPainter = TextPainter(
        text: callsignSpan,
        textDirection: TextDirection.ltr,
      )..layout();
      callsignPainter.paint(canvas, Offset(peerPos.dx + 6, peerPos.dy - 6));
    }
  }

  void _drawCardinal(Canvas canvas, Offset center, double radius, String text, double deg) {
    final rad = (deg - 90) * (math.pi / 180);
    final pos = Offset(
      center.dx + (radius - 12) * math.cos(rad),
      center.dy + (radius - 12) * math.sin(rad),
    );

    final span = TextSpan(
      text: text,
      style: const TextStyle(
        fontFamily: 'monospace',
        fontSize: 9,
        fontWeight: FontWeight.w800,
        color: FieldTokens.tactileSteel,
      ),
    );
    final painter = TextPainter(
      text: span,
      textDirection: TextDirection.ltr,
    )..layout();
    painter.paint(canvas, Offset(pos.dx - painter.width / 2, pos.dy - painter.height / 2));
  }

  @override
  bool shouldRepaint(covariant _RadarPainter oldDelegate) {
    return oldDelegate.sweepAngle != sweepAngle || oldDelegate.peers != peers;
  }
}
