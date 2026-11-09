import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'field_tokens.dart';

/// TrekIndia Global Theme Definition.
///
/// Strictly enforces the Anti-Generic Ban List:
/// No soft purple/lavender tints, no fuzzy drop shadows, no standard FABs.
class AppTheme {
  AppTheme._();

  static ThemeData get darkFieldInstrumentTheme {
    return ThemeData(
      useMaterial3: false, // Ban default Material 3 styling
      brightness: Brightness.dark,
      scaffoldBackgroundColor: FieldTokens.basaltBackground,
      primaryColor: FieldTokens.rescueOrange,
      canvasColor: FieldTokens.basaltBackground,

      // Color Scheme
      colorScheme: const ColorScheme.dark(
        primary: FieldTokens.rescueOrange,
        secondary: FieldTokens.contourOchre,
        surface: FieldTokens.pineSurface,
        background: FieldTokens.basaltBackground,
        error: FieldTokens.rescueOrange,
        onPrimary: Colors.black,
        onSecondary: Colors.black,
        onSurface: Colors.white,
        onBackground: Colors.white,
      ),

      // App Bar Theme
      appBarTheme: AppBarTheme(
        backgroundColor: FieldTokens.pineSurface,
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: Colors.white, size: 20),
        titleTextStyle: FieldTokens.technicalMonospace(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: Colors.white,
          letterSpacing: 1.5,
        ),
        systemOverlayStyle: const SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          systemNavigationBarColor: FieldTokens.basaltBackground,
          systemNavigationBarIconBrightness: Brightness.light,
        ),
      ),

      // Card Theme (Hard chamfered 3px radius, crisp 1.2px tactile border)
      cardTheme: CardThemeData(
        color: FieldTokens.pineSurface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
          side: const BorderSide(
            color: FieldTokens.pineSurfaceBorder,
            width: FieldTokens.instrumentBorderWidth,
          ),
        ),
      ),

      // Icon Theme
      iconTheme: const IconThemeData(
        color: FieldTokens.mossNeon,
        size: 20,
      ),

      // Divider Theme
      dividerTheme: const DividerThemeData(
        color: FieldTokens.pineSurfaceBorder,
        thickness: 1.2,
        space: 1.2,
      ),
    );
  }
}
