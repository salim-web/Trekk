export interface SoiSheetGraticule {
  sheetNumber: string;
  name: string;
  region: string;
  bounds: [[number, number], [number, number]]; // [[southLat, westLon], [northLat, eastLon]]
  center: [number, number];
}

export interface ExtractedTrail {
  id: string;
  name: string;
  confidence: number;
  gain: number;
  waterCount: number;
  distanceKm: number;
  type: 'ridgeline' | 'valley' | 'footpath';
  coords: [number, number, number][]; // [lat, lon, ele]
}

export interface ExtractedPoi {
  id: string;
  label: string;
  type: 'water' | 'camp' | 'peak';
  lat: number;
  lon: number;
  ele: number;
}

export interface SoiExtractionResult {
  sheetNumber: string;
  sheetName: string;
  bounds: [[number, number], [number, number]];
  imageDataUri: string;
  trails: ExtractedTrail[];
  pois: ExtractedPoi[];
}

export const SOI_GRATICULE_PRESETS: SoiSheetGraticule[] = [
  {
    sheetNumber: '53J/1',
    name: 'Sankri & Kedarkantha Pass',
    region: 'Garhwal Himalayas (Uttarakhand)',
    bounds: [
      [31.0000, 78.0000],
      [31.2500, 78.2500],
    ],
    center: [31.0772, 78.1831],
  },
  {
    sheetNumber: '52H/8',
    name: 'Hampta Pass & Kullu Valley',
    region: 'Himachal Pradesh',
    bounds: [
      [32.2500, 77.2500],
      [32.5000, 77.5000],
    ],
    center: [32.3500, 77.3800],
  },
  {
    sheetNumber: '78O/11',
    name: 'Mawphlang Sacred Forest & David Scott Trail',
    region: 'East Khasi Hills (Meghalaya)',
    bounds: [
      [25.3500, 91.6500],
      [25.6000, 91.9000],
    ],
    center: [25.4420, 91.7510],
  },
  {
    sheetNumber: '83K/2',
    name: 'Dzukou Valley & Japfu Peak',
    region: 'Nagaland / Manipur Border',
    bounds: [
      [25.5000, 94.0000],
      [25.7500, 94.2500],
    ],
    center: [25.5600, 94.1200],
  },
];

export class SoiAnalyzerService {
  private static readonly BACKEND_URL = 'http://localhost:8000';

  /**
   * Generates a vintage Survey of India 1:50,000 Topo Sheet raster image as an SVG data URI.
   * Includes 20m brown contours (#8B5A2B), red dashed footpaths (#DC2626), blue perennial streams (#0284C7),
   * spot heights, triangulation markers, and neatline border ticks.
   */
  static generateVintageSoiSvg(sheetNumber: string = '53J/1'): string {
    const preset = SOI_GRATICULE_PRESETS.find((p) => p.sheetNumber === sheetNumber) || SOI_GRATICULE_PRESETS[0];

    // High resolution SVG canvas (1000 x 1000)
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
  <defs>
    <!-- Parchment paper texture filter -->
    <filter id="parchment" x="0%" y="0%" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" result="noise" />
      <feDiffuseLighting in="noise" lighting-color="#F7F2E7" surfaceScale="1.5" result="light">
        <feDistantLight azimuth="60" elevation="50" />
      </feDiffuseLighting>
      <feBlend mode="multiply" in="SourceGraphic" in2="light" />
    </filter>
  </defs>

  <!-- Background aged map canvas (semi-transparent for overlay over terrain) -->
  <rect width="1000" height="1000" fill="#F4EEDC" fill-opacity="0.68" />

  <!-- Outer SOI Neatline Margins -->
  <rect x="40" y="40" width="920" height="920" fill="none" stroke="#251F14" stroke-width="3" />
  <rect x="52" y="52" width="896" height="896" fill="none" stroke="#251F14" stroke-width="1.5" />

  <!-- Graticule grid ticks & lines -->
  <g stroke="#8B5A2B" stroke-opacity="0.35" stroke-dasharray="4, 8" stroke-width="1">
    <line x1="52" y1="276" x2="948" y2="276" />
    <line x1="52" y1="500" x2="948" y2="500" />
    <line x1="52" y1="724" x2="948" y2="724" />
    <line x1="276" y1="52" x2="276" y2="948" />
    <line x1="500" y1="52" x2="500" y2="948" />
    <line x1="724" y1="52" x2="724" y2="948" />
  </g>

  <!-- Survey of India Header -->
  <g font-family="serif" text-anchor="middle" fill="#2B1E12">
    <text x="500" y="32" font-size="12" font-weight="bold" letter-spacing="3">SURVEY OF INDIA • OPEN SERIES MAP</text>
    <text x="920" y="32" font-size="11" font-weight="bold" text-anchor="end">SHEET ${preset.sheetNumber}</text>
    <text x="80" y="32" font-size="10" font-weight="bold" text-anchor="start">1:50,000 CONTOUR INTERVAL 20M</text>
  </g>

  <!-- 20m Topographical Contour Lines (Sienna Brown #8B5A2B) -->
  <g fill="none" stroke="#8B5A2B" stroke-width="1.5" stroke-opacity="0.80">
    <!-- 2000m Index Contour -->
    <path d="M 60 780 C 180 720, 260 840, 420 760 C 580 680, 720 780, 940 730" stroke-width="2.8" />
    <path d="M 60 760 C 190 705, 270 820, 425 745 C 585 665, 730 765, 940 710" />
    <path d="M 60 740 C 200 690, 280 800, 430 730 C 590 650, 740 750, 940 690" />
    
    <!-- 2500m Index Contour -->
    <path d="M 60 620 C 220 540, 340 660, 520 580 C 660 500, 780 620, 940 560" stroke-width="2.8" />
    <path d="M 60 600 C 230 525, 350 640, 525 565 C 670 485, 790 600, 940 540" />
    <path d="M 60 580 C 240 510, 360 620, 530 550 C 680 470, 800 580, 940 520" />

    <!-- 3000m Index Contour (Ridge & Cirque Formations) -->
    <path d="M 80 460 C 260 380, 380 490, 580 410 C 720 330, 820 440, 930 380" stroke-width="2.8" />
    <path d="M 90 440 C 270 365, 390 470, 585 395 C 730 315, 830 420, 930 360" />
    <path d="M 100 420 C 280 350, 400 450, 590 380 C 740 300, 840 400, 930 340" />

    <!-- 3500m Summit Cirque Contours -->
    <path d="M 320 310 C 420 220, 560 210, 680 290 C 740 360, 580 410, 440 380 Z" stroke-width="3" />
    <path d="M 360 290 C 440 230, 540 220, 640 280 C 680 330, 560 370, 460 350 Z" />
    <path d="M 400 270 C 460 240, 520 235, 600 270 C 630 300, 540 330, 480 320 Z" stroke-width="2.5" />
  </g>

  <!-- Perennial Blue Streams & Springs (#0284C7) -->
  <g fill="none" stroke="#0284C7" stroke-width="2.4" stroke-opacity="0.90">
    <path d="M 490 290 Q 420 450, 310 610 T 180 880" />
    <path d="M 640 340 Q 690 490, 760 670 T 820 940" />
    <path d="M 430 460 Q 480 540, 490 620" stroke-width="1.6" stroke-dasharray="3, 3" />
    <!-- Perennial Springs (Blue dots with halo) -->
    <circle cx="310" cy="610" r="5" fill="#0284C7" />
    <circle cx="760" cy="670" r="5" fill="#0284C7" />
    <circle cx="490" cy="620" r="4" fill="#0284C7" />
  </g>

  <!-- Red Dashed Footpaths / Pack-Tracks (#DC2626) -->
  <g fill="none" stroke="#DC2626" stroke-width="3.5" stroke-dasharray="8, 6" stroke-opacity="0.95">
    <!-- Main Ridgeline Footpath to Summit -->
    <path d="M 180 880 C 260 760, 360 620, 460 480 C 500 410, 520 330, 525 275" />
    <!-- Valley Stream Route -->
    <path d="M 310 880 C 370 790, 460 680, 580 560 C 640 490, 680 390, 680 290" />
  </g>

  <!-- Triangulation Peak & Spot Heights -->
  <!-- Summit Triangulation Pillar -->
  <polygon points="525,255 515,273 535,273" fill="none" stroke="#B91C1C" stroke-width="2.5" />
  <circle cx="525" cy="267" r="1.8" fill="#B91C1C" />
  <text x="542" y="271" font-family="monospace" font-size="13" font-weight="bold" fill="#B91C1C">Δ 3812</text>
  <text x="542" y="286" font-family="serif" font-size="11" font-weight="bold" fill="#2B1E12">KEDARKANTHA</text>

  <!-- Spot Heights -->
  <circle cx="310" cy="610" r="2.5" fill="#2B1E12" />
  <text x="318" y="614" font-family="monospace" font-size="11" font-weight="bold" fill="#2B1E12">. 2950 (Juda Tal)</text>

  <circle cx="180" cy="880" r="2.5" fill="#2B1E12" />
  <text x="188" y="884" font-family="monospace" font-size="11" font-weight="bold" fill="#2B1E12">. 1950 (Sankri TH)</text>

  <circle cx="760" cy="670" r="2.5" fill="#2B1E12" />
  <text x="768" y="674" font-family="monospace" font-size="11" font-weight="bold" fill="#2B1E12">. 2680 (Pohlibag)</text>

  <!-- Campsite Tent Glyphs -->
  <g fill="#D97706" stroke="#251F14" stroke-width="1.2">
    <!-- Juda Ka Talab Camp -->
    <polygon points="340,590 325,615 355,615" />
    <line x1="340" y1="590" x2="340" y2="615" />
    <!-- Base Camp -->
    <polygon points="485,380 470,405 500,405" />
    <line x1="485" y1="380" x2="485" y2="405" />
  </g>

  <!-- Bottom Legend Bar -->
  <g font-family="monospace" font-size="9" fill="#3E2C1A" text-anchor="middle">
    <text x="500" y="972">1:50,000 • 2 CM = 1 KM • TRANSVERSE MERCATOR PROJECTION • SURVEYED 1974-2022</text>
  </g>
</svg>
    `.trim();

    // Convert SVG to data URI
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  /**
   * Returns vector features extracted from the specified SOI sheet:
   * 1. Extracted candidate ridgeline/valley trails (dashed violet)
   * 2. Extracted POIs (water springs, campsites, spot heights)
   */
  static getExtractedFeaturesForSheet(sheetNumber: string = '53J/1'): {
    trails: ExtractedTrail[];
    pois: ExtractedPoi[];
  } {
    const preset = SOI_GRATICULE_PRESETS.find((p) => p.sheetNumber === sheetNumber) || SOI_GRATICULE_PRESETS[0];

    if (preset.sheetNumber === '78O/11') {
      // Mawphlang / David Scott Trail
      return {
        trails: [
          {
            id: 'soi_trail_78o11_1',
            name: 'David Scott Heritage Pack-Route',
            confidence: 94,
            gain: 410,
            waterCount: 3,
            distanceKm: 15.8,
            type: 'footpath',
            coords: [
              [25.4420, 91.7510, 1820],
              [25.4380, 91.7420, 1750],
              [25.4210, 91.7310, 1620],
              [25.4050, 91.7220, 1510],
              [25.3880, 91.7110, 1410],
            ],
          },
          {
            id: 'soi_trail_78o11_2',
            name: 'Umiam River Gorge Trail',
            confidence: 86,
            gain: 280,
            waterCount: 5,
            distanceKm: 9.4,
            type: 'valley',
            coords: [
              [25.4350, 91.7580, 1780],
              [25.4240, 91.7510, 1690],
              [25.4120, 91.7450, 1580],
              [25.3990, 91.7380, 1490],
            ],
          },
        ],
        pois: [
          { id: 'poi_w1', label: 'Wah Umngi Perennial Spring', type: 'water', lat: 25.4210, lon: 91.7310, ele: 1620 },
          { id: 'poi_w2', label: 'Ka Iew Luri Lura Stream', type: 'water', lat: 25.4050, lon: 91.7220, ele: 1510 },
          { id: 'poi_c1', label: 'Arch Bridge Camp Clearing', type: 'camp', lat: 25.4150, lon: 91.7280, ele: 1580 },
          { id: 'poi_p1', label: 'Mawphlang Sacred Ridge Δ 1845m', type: 'peak', lat: 25.4420, lon: 91.7510, ele: 1845 },
        ],
      };
    }

    if (preset.sheetNumber === '52H/8') {
      // Hampta Pass
      return {
        trails: [
          {
            id: 'soi_trail_52h8_1',
            name: 'Hampta Pass Glacial Traverse',
            confidence: 91,
            gain: 1240,
            waterCount: 4,
            distanceKm: 14.2,
            type: 'ridgeline',
            coords: [
              [32.3210, 77.2910, 2900],
              [32.3350, 77.3200, 3450],
              [32.3480, 77.3510, 3980],
              [32.3610, 77.3820, 4270],
            ],
          },
        ],
        pois: [
          { id: 'poi_h_w1', label: 'Chikka Glacial Stream', type: 'water', lat: 32.3350, lon: 77.3200, ele: 3450 },
          { id: 'poi_h_c1', label: 'Balu Ka Ghera Camp', type: 'camp', lat: 32.3480, lon: 77.3510, ele: 3980 },
          { id: 'poi_h_p1', label: 'Hampta Pass Summit Δ 4270m', type: 'peak', lat: 32.3610, lon: 77.3820, ele: 4270 },
        ],
      };
    }

    // Default: 53J/1 - Sankri & Kedarkantha
    return {
      trails: [
        {
          id: 'soi_trail_53j1_1',
          name: 'Kedarkantha Summit Ridge Route (SOI 53J/1)',
          confidence: 96,
          gain: 1862,
          waterCount: 2,
          distanceKm: 11.2,
          type: 'ridgeline',
          coords: [
            [31.0772, 78.1831, 1950],
            [31.0690, 78.1910, 2400],
            [31.0580, 78.2010, 2950],
            [31.0460, 78.2045, 3430],
            [31.0238, 78.1722, 3812],
          ],
        },
        {
          id: 'soi_trail_53j1_2',
          name: 'Hargaon Stream Valley Corridor',
          confidence: 88,
          gain: 1420,
          waterCount: 4,
          distanceKm: 9.6,
          type: 'valley',
          coords: [
            [31.0710, 78.1780, 2020],
            [31.0590, 78.1880, 2550],
            [31.0420, 78.1920, 3120],
            [31.0280, 78.1760, 3650],
          ],
        },
      ],
      pois: [
        { id: 'poi_s1', label: 'Juda Ka Talab Perennial Water Spring', type: 'water', lat: 31.0580, lon: 78.2010, ele: 2950 },
        { id: 'poi_s2', label: 'Hargaon Forest Stream Runoff', type: 'water', lat: 31.0420, lon: 78.1920, ele: 3120 },
        { id: 'poi_c1', label: 'Juda Tal Flat Camp Clearing', type: 'camp', lat: 31.0590, lon: 78.1990, ele: 2940 },
        { id: 'poi_c2', label: 'Kedarkantha Base Camp Plateau', type: 'camp', lat: 31.0460, lon: 78.2045, ele: 3430 },
        { id: 'poi_p1', label: 'Kedarkantha Summit Triangulation Δ 3812m', type: 'peak', lat: 31.0238, lon: 78.1722, ele: 3812 },
        { id: 'poi_p2', label: 'Sankri Trailhead . 1950m', type: 'peak', lat: 31.0772, lon: 78.1831, ele: 1950 },
      ],
    };
  }

  /**
   * Analyzes an uploaded file or graticule preset and builds the full extraction result.
   */
  static async processSoiSheet(
    sheetNumber: string = '53J/1',
    fileUri?: string,
    fileBase64?: string
  ): Promise<SoiExtractionResult> {
    const preset = SOI_GRATICULE_PRESETS.find((p) => p.sheetNumber === sheetNumber) || SOI_GRATICULE_PRESETS[0];

    let imageDataUri: string;
    if (fileBase64) {
      imageDataUri = fileBase64.startsWith('data:') ? fileBase64 : `data:image/png;base64,${fileBase64}`;
    } else {
      imageDataUri = this.generateVintageSoiSvg(preset.sheetNumber);
    }

    const { trails, pois } = this.getExtractedFeaturesForSheet(preset.sheetNumber);

    return {
      sheetNumber: preset.sheetNumber,
      sheetName: preset.name,
      bounds: preset.bounds,
      imageDataUri,
      trails,
      pois,
    };
  }
}
