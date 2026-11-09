import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/field_tokens.dart';

/// Tactile Knurled Vernier Opacity Dial.
///
/// Hardware-inspired thumb-wheel running along the screen edge.
/// Replaces standard Material sliders for controlling Survey of India (SOI)
/// raster overlay opacity. Triggers physical haptic ticks at every 5% step.
class VernierOpacityDial extends StatefulWidget {
  final double value; // 0.0 to 1.0
  final ValueChanged<double> onChanged;
  final double height;
  final double width;

  const VernierOpacityDial({
    super.key,
    required this.value,
    required this.onChanged,
    this.height = 240.0,
    this.width = 72.0,
  });

  @override
  State<VernierOpacityDial> createState() => _VernierOpacityDialState();
}

class _VernierOpacityDialState extends State<VernierOpacityDial> {
  int _lastHapticStep = -1;

  void _handleDrag(DragUpdateDetails details) {
    // Invert delta: dragging up increases opacity, dragging down decreases
    final double deltaFraction = -details.primaryDelta! / widget.height;
    final double nextVal = (widget.value + deltaFraction).clamp(0.0, 1.0);

    // Calculate 5% haptic step (0 to 20)
    final int currentStep = (nextVal * 20).round();
    if (currentStep != _lastHapticStep) {
      _lastHapticStep = currentStep;
      HapticFeedback.selectionClick();
    }

    widget.onChanged(nextVal);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onVerticalDragUpdate: _handleDrag,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: FieldTokens.pineSurface,
          borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
          border: Border.all(
            color: FieldTokens.pineSurfaceBorder,
            width: FieldTokens.instrumentBorderWidth,
          ),
        ),
        child: CustomPaint(
          size: Size(widget.width, widget.height),
          painter: _VernierDialPainter(value: widget.value),
        ),
      ),
    );
  }
}

class _VernierDialPainter extends CustomPainter {
  final double value;

  _VernierDialPainter({required this.value});

  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;

    // 1. Draw Knurled Thumb-Wheel Barrel (Left half)
    final Paint barrelPaint = Paint()..color = const Color(0xFF131715);
    final Rect barrelRect = Rect.fromLTWH(4, 8, w * 0.42, h - 16);
    canvas.drawRRect(
      RRect.fromRectAndRadius(barrelRect, const Radius.circular(2)),
      barrelPaint,
    );

    // Draw Knurled Ribs on Barrel
    final Paint ribPaint = Paint()
      ..color = FieldTokens.tactileSteel
      ..strokeWidth = 1.2;

    const int ribCount = 28;
    final double ribSpacing = (h - 24) / ribCount;
    // Offset ribs dynamically as dial spins
    final double offset = (value * 80) % ribSpacing;

    for (double y = 12 + offset; y < h - 12; y += ribSpacing) {
      canvas.drawLine(
        Offset(8, y),
        Offset(w * 0.42, y),
        ribPaint,
      );
    }

    // 2. Draw Vernier Scale Ticks & Numbers (Right half)
    final Paint tickPaint = Paint()
      ..color = FieldTokens.soiGridBorder
      ..strokeWidth = 1.0;

    final Paint majorTickPaint = Paint()
      ..color = FieldTokens.contourOchre
      ..strokeWidth = 1.8;

    const int totalSteps = 20; // 5% per step
    for (int i = 0; i <= totalSteps; i++) {
      final double fraction = i / totalSteps;
      final double yPos = (h - 20) - fraction * (h - 40);
      final bool isMajor = (i % 5 == 0); // 0%, 25%, 50%, 75%, 100%

      if (isMajor) {
        // Major Tick
        canvas.drawLine(
          Offset(w * 0.48, yPos),
          Offset(w * 0.76, yPos),
          majorTickPaint,
        );

        // Percentage Text
        final textSpan = TextSpan(
          text: '${(fraction * 100).toInt()}',
          style: const TextStyle(
            fontFamily: 'monospace',
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: FieldTokens.contourOchre,
          ),
        );
        final textPainter = TextPainter(
          text: textSpan,
          textDirection: TextDirection.ltr,
        )..layout();
        textPainter.paint(canvas, Offset(w * 0.80, yPos - 5));
      } else {
        // Minor Tick
        canvas.drawLine(
          Offset(w * 0.48, yPos),
          Offset(w * 0.62, yPos),
          tickPaint,
        );
      }
    }

    // 3. Draw Active Value Needle Pointer (Safety Rescue Orange)
    final double needleY = (h - 20) - value * (h - 40);
    final Paint needlePaint = Paint()
      ..color = FieldTokens.rescueOrange
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(
      Offset(2, needleY),
      Offset(w * 0.46, needleY),
      needlePaint,
    );

    // Indicator Arrowhead
    final Path arrowPath = Path()
      ..moveTo(w * 0.46, needleY - 4)
      ..lineTo(w * 0.52, needleY)
      ..lineTo(w * 0.46, needleY + 4)
      ..close();
    canvas.drawPath(arrowPath, Paint()..color = FieldTokens.rescueOrange);
  }

  @override
  bool shouldRepaint(covariant _VernierDialPainter oldDelegate) {
    return oldDelegate.value != value;
  }
}
