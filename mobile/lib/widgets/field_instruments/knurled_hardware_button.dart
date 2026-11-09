import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/field_tokens.dart';

/// Tactile Knurled Hardware Push Button
///
/// Hardware-inspired push button designed to emulate rugged field radio switches.
/// Provides deep mechanical travel feedback via heavy haptics, solid bevelled borders,
/// knurled edge patterns, and optional status LED pip.
class KnurledHardwareButton extends StatefulWidget {
  final String label;
  final IconData? icon;
  final VoidCallback onPressed;
  final Color accentColor;
  final bool isDestructive;
  final bool isLoading;
  final double height;

  const KnurledHardwareButton({
    super.key,
    required this.label,
    this.icon,
    required this.onPressed,
    this.accentColor = FieldTokens.rescueOrange,
    this.isDestructive = false,
    this.isLoading = false,
    this.height = 48.0,
  });

  @override
  State<KnurledHardwareButton> createState() => _KnurledHardwareButtonState();
}

class _KnurledHardwareButtonState extends State<KnurledHardwareButton> {
  bool _isPressed = false;

  void _handleTapDown(TapDownDetails details) {
    setState(() => _isPressed = true);
    HapticFeedback.heavyImpact();
  }

  void _handleTapUp(TapUpDetails details) {
    setState(() => _isPressed = false);
    widget.onPressed();
  }

  void _handleTapCancel() {
    setState(() => _isPressed = false);
  }

  @override
  Widget build(BuildContext context) {
    final effectiveColor = widget.isDestructive ? FieldTokens.rescueOrange : widget.accentColor;

    return GestureDetector(
      onTapDown: widget.isLoading ? null : _handleTapDown,
      onTapUp: widget.isLoading ? null : _handleTapUp,
      onTapCancel: widget.isLoading ? null : _handleTapCancel,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 60),
        height: widget.height,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: _isPressed ? const Color(0xFF1E2420) : FieldTokens.pineSurface,
          borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
          border: Border.all(
            color: _isPressed ? effectiveColor : FieldTokens.pineSurfaceBorder,
            width: FieldTokens.instrumentBorderWidth,
          ),
          boxShadow: _isPressed
              ? []
              : [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.4),
                    offset: const Offset(0, 2),
                    blurRadius: 3,
                  ),
                ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Knurled hardware teeth on left edge
            _buildKnurlPattern(),
            const SizedBox(width: 10),

            if (widget.isLoading)
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2.0,
                  valueColor: AlwaysStoppedAnimation<Color>(effectiveColor),
                ),
              )
            else if (widget.icon != null) ...[
              Icon(widget.icon, size: 16, color: effectiveColor),
              const SizedBox(width: 8),
            ],

            Text(
              widget.label.toUpperCase(),
              style: FieldTokens.technicalMonospace(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: _isPressed ? effectiveColor : Colors.white,
                letterSpacing: 1.2,
              ),
            ),

            const SizedBox(width: 10),
            // Knurled hardware teeth on right edge
            _buildKnurlPattern(),
          ],
        ),
      ),
    );
  }

  Widget _buildKnurlPattern() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        4,
        (index) => Container(
          width: 3,
          height: 2,
          margin: const EdgeInsets.symmetric(vertical: 1.5),
          decoration: BoxDecoration(
            color: FieldTokens.tactileSteel,
            borderRadius: BorderRadius.circular(0.5),
          ),
        ),
      ),
    );
  }
}
