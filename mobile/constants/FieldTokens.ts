/**
 * TrekIndia Bespoke Design Tokens
 * Tactile Himalayan Field-Instrument Design System
 */

export const FieldColors = {
  // Base OLED basalt & chassis
  basaltBackground: '#0F1210',
  obsidianBasalt: '#0F1210',
  pineSurface: '#171D19',
  deepPine: '#171D19',
  pineSurfaceBorder: '#25302A',
  tactileSteel: '#3F4943',

  // Vintage Survey of India (SOI) Cartography
  soiParchment: '#F4EFE6',
  parchment: '#F4EFE6',
  soiParchmentText: '#1A1916',
  soiGridBorder: '#D4CBBB',

  // Functional Tactical Accents
  rescueOrange: '#FF5500',       // Active tracking, SOS, summits, primary triggers
  contourOchre: '#D99B26',       // 100m elevation contours, campsites, badges
  glacierCyan: '#38BDF8',        // Water sources, glaciers, user-imported tracks
  mossNeon: '#4ADE80',           // Active BLE mesh nodes, healthy battery, trailheads
  hazardYellow: '#FACC15',       // Avalanche warnings, steep grade
  soiRidgeViolet: '#A855F7',     // AI-detected SOI ridgelines & candidate trails

  // Strava Brand
  stravaOrange: '#FC5200',
};

export const FieldTypography = {
  monospace: 'monospace',
  mono: 'monospace',
  body: 'System',
  bold: '700' as const,
  heavy: '900' as const,
};

export const FieldDimensions = {
  borderChamferRadius: 4,
  instrumentBorderWidth: 1.2,
};

export default {
  FieldColors,
  FieldTypography,
  FieldDimensions,
};
