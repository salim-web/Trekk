import 'dart:ui';
import 'package:flutter/material.dart';

/// TrekIndia Bespoke Design Tokens: Tactile Himalayan Field-Instrument.
///
/// Combines Vintage Survey of India (SOI) Cartography with Teenage Engineering
/// & Garmin Marq tactile hardware aesthetics.
class FieldTokens {
  FieldTokens._();

  // --- Palette: High-Sunlight & OLED Battery Optimized ---
  static const Color basaltBackground = Color(0xFF0F1210); // OLED black basalt
  static const Color pineSurface = Color(0xFF171D19);      // Instrument bezel / chassis
  static const Color pineSurfaceBorder = Color(0xFF25302A); // Hard chamfered border
  static const Color tactileSteel = Color(0xFF3F4943);     // Screws, knurled dial ribs

  // Vintage Survey of India (SOI) Cartography
  static const Color soiParchment = Color(0xFFF4EFE6);     // 1:50k Topo map cards
  static const Color soiParchmentText = Color(0xFF1A1916); // High-contrast ink
  static const Color soiGridBorder = Color(0xFFD4CBBB);    // Graticule gridline tint

  // High-Visibility Functional Technical Accents
  static const Color rescueOrange = Color(0xFFFF5500);     // Active tracking, SOS, live needles
  static const Color contourOchre = Color(0xFFD99B26);     // 100m elevation contours & badges
  static const Color glacierCyan = Color(0xFF38BDF8);      // Perennial water sources & glaciers
  static const Color mossNeon = Color(0xFF4ADE80);         // Active BLE mesh nodes & healthy battery
  static const Color hazardYellow = Color(0xFFFACC15);     // Avalanche warnings & high climb rate

  // --- Typography Styles ---
  // Technical Tabular Monospace (JetBrains Mono equivalent)
  static TextStyle technicalMonospace({
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.w600,
    Color color = Colors.white,
    double letterSpacing = 0.5,
  }) {
    return TextStyle(
      fontFamily: 'monospace',
      fontFeatures: const [FontFeature.tabularFigures()],
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: 1.2,
    );
  }

  // Display / Technical Header (Space Grotesk equivalent)
  static TextStyle displayHeader({
    double fontSize = 20,
    FontWeight fontWeight = FontWeight.w800,
    Color color = Colors.white,
    double letterSpacing = 1.2,
  }) {
    return TextStyle(
      fontFamily: 'sans-serif',
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: letterSpacing,
      height: 1.15,
    );
  }

  // Vintage SOI Cartographic Italic Label
  static TextStyle vintageCartoLabel({
    double fontSize = 11,
    FontWeight fontWeight = FontWeight.w600,
    Color color = soiParchmentText,
  }) {
    return TextStyle(
      fontFamily: 'serif',
      fontStyle: FontStyle.italic,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      letterSpacing: 0.8,
    );
  }

  // --- Tactile Dimensions ---
  static const double borderChamferRadius = 3.0;
  static const double instrumentBorderWidth = 1.2;
}
