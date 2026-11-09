import 'package:flutter/material.dart';
import '../../theme/field_tokens.dart';

/// Survey of India (SOI) Grid Stamp Card
///
/// Authentic cartographic index card styling inspired by 1:50,000 Open Series Maps.
/// Features sepia parchment background, authentic four-corner graticule crosshairs (`+`),
/// neatline double-border, official sheet classification stamps, and high-contrast typography.
class SoiGridStampCard extends StatelessWidget {
  final String sheetNumber; // e.g. "53J/3"
  final String regionTitle; // e.g. "UTTARAKHAND - TEHRI GARHWAL"
  final String latRange; // e.g. "30°15'N to 30°30'N"
  final String lonRange; // e.g. "78°00'E to 78°15'E"
  final double scaleRatio; // e.g. 50000
  final Widget? child;

  const SoiGridStampCard({
    super.key,
    required this.sheetNumber,
    required this.regionTitle,
    required this.latRange,
    required this.lonRange,
    this.scaleRatio = 50000,
    this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: FieldTokens.soiParchment,
        borderRadius: BorderRadius.circular(2.0),
        border: Border.all(
          color: FieldTokens.soiParchmentText,
          width: 1.5,
        ),
        boxShadow: const [
          BoxShadow(
            color: Colors.black45,
            blurRadius: 6,
            offset: Offset(2, 3),
          ),
        ],
      ),
      child: CustomPaint(
        painter: _SoiCardBorderPainter(),
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Series
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'SURVEY OF INDIA',
                    style: TextStyle(
                      fontFamily: 'serif',
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2.0,
                      color: FieldTokens.soiParchmentText,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      border: Border.all(color: FieldTokens.soiParchmentText, width: 1.0),
                      color: FieldTokens.soiParchment,
                    ),
                    child: Text(
                      'SHEET $sheetNumber',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        color: FieldTokens.soiParchmentText,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),

              // Region Subtitle
              Text(
                regionTitle.toUpperCase(),
                style: const TextStyle(
                  fontFamily: 'serif',
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.2,
                  color: FieldTokens.soiParchmentText,
                ),
              ),

              const SizedBox(height: 8),
              // Cartographic Graticule Metadata Box
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: FieldTokens.soiParchmentText.withOpacity(0.5),
                    width: 0.8,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _metaColumn('LAT BOUNDS', latRange),
                    Container(height: 20, width: 1, color: FieldTokens.soiParchmentText.withOpacity(0.4)),
                    _metaColumn('LON BOUNDS', lonRange),
                    Container(height: 20, width: 1, color: FieldTokens.soiParchmentText.withOpacity(0.4)),
                    _metaColumn('SCALE', '1 : ${scaleRatio.toInt()}'),
                  ],
                ),
              ),

              if (child != null) ...[
                const SizedBox(height: 10),
                child!,
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _metaColumn(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontFamily: 'monospace',
            fontSize: 7,
            fontWeight: FontWeight.w600,
            color: FieldTokens.soiParchmentText.withOpacity(0.7),
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontFamily: 'monospace',
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: FieldTokens.soiParchmentText,
          ),
        ),
      ],
    );
  }
}

class _SoiCardBorderPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;

    final Paint crosshairPaint = Paint()
      ..color = FieldTokens.soiParchmentText
      ..strokeWidth = 1.0;

    const double chSize = 6.0;

    // Corner Crosshairs (+)
    // Top-Left
    canvas.drawLine(const Offset(4, 4 - chSize), const Offset(4, 4 + chSize), crosshairPaint);
    canvas.drawLine(const Offset(4 - chSize, 4), const Offset(4 + chSize, 4), crosshairPaint);

    // Top-Right
    canvas.drawLine(Offset(w - 4, 4 - chSize), Offset(w - 4, 4 + chSize), crosshairPaint);
    canvas.drawLine(Offset(w - 4 - chSize, 4), Offset(w - 4 + chSize, 4), crosshairPaint);

    // Bottom-Left
    canvas.drawLine(Offset(4, h - 4 - chSize), Offset(4, h - 4 + chSize), crosshairPaint);
    canvas.drawLine(Offset(4 - chSize, h - 4), Offset(4 + chSize, h - 4), crosshairPaint);

    // Bottom-Right
    canvas.drawLine(Offset(w - 4, h - 4 - chSize), Offset(w - 4, h - 4 + chSize), crosshairPaint);
    canvas.drawLine(Offset(w - 4 - chSize, h - 4), Offset(w - 4 + chSize, h - 4), crosshairPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
