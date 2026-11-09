"""3D Topographic Expedition Poster Generator.

Synthesizes a high-resolution, vector/raster expedition poster combining
Survey of India vintage cartography aesthetics, elevation profile curves,
corner graticules, and participant badges.
"""

from typing import List, Dict, Any


class ExpeditionPosterGenerator:
    """Generates vintage Survey of India style commemorative expedition posters."""

    @staticmethod
    def generate_svg_poster(
        party_name: str,
        soi_sheet_no: str,
        dates_str: str,
        distance_km: float,
        elevation_gain_m: float,
        max_altitude_m: float,
        elevation_profile: List[float],
        participants: List[str],
    ) -> str:
        """Renders an SVG poster with vintage SOI typography, graticule ticks (+),

        elevation spline, and tactile Himalayan field-badge styling.
        """
        width = 800
        height = 1100

        # Build elevation profile SVG polyline
        pts_svg = []
        if elevation_profile and len(elevation_profile) > 1:
            graph_x0 = 80
            graph_y0 = 620
            graph_w = 640
            graph_h = 200

            min_e = min(elevation_profile)
            max_e = max(elevation_profile)
            e_range = max(1.0, max_e - min_e)

            step = graph_w / (len(elevation_profile) - 1)
            for idx, alt in enumerate(elevation_profile):
                px = graph_x0 + idx * step
                py = graph_y0 - ((alt - min_e) / e_range) * graph_h
                pts_svg.append(f"{px:.1f},{py:.1f}")

            polyline_points = " ".join(pts_svg)
            polygon_fill = f"{graph_x0},{graph_y0} " + polyline_points + f" {graph_x0 + graph_w},{graph_y0}"
        else:
            polyline_points = "80,550 400,450 720,550"
            polygon_fill = "80,620 80,550 400,450 720,550 720,620"

        # Participant list SVG
        members_svg = []
        for i, name in enumerate(participants[:8]):
            col = i % 2
            row = i // 2
            x_pos = 120 + col * 320
            y_pos = 780 + row * 40
            members_svg.append(
                f'<text x="{x_pos}" y="{y_pos}" font-family="monospace" font-size="14" fill="#171D19" font-weight="bold">✦ {name.upper()}</text>'
            )
        members_str = "\n".join(members_svg)

        svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">
  <defs>
    <pattern id="contourLines" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 0 20 Q 20 0 40 20 T 80 20" fill="none" stroke="#E2DAC9" stroke-width="0.8" opacity="0.6"/>
    </pattern>
    <linearGradient id="elevationGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF5500" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#D99B26" stop-opacity="0.05"/>
    </linearGradient>
  </defs>

  <!-- Base Parchment Background -->
  <rect width="100%" height="100%" fill="#F4EFE6"/>
  <rect width="100%" height="100%" fill="url(#contourLines)"/>

  <!-- Vintage Double Neatline Border -->
  <rect x="30" y="30" width="740" height="1040" fill="none" stroke="#171D19" stroke-width="3"/>
  <rect x="40" y="40" width="720" height="1020" fill="none" stroke="#171D19" stroke-width="1"/>

  <!-- Four Corner Graticule Crosshairs (+) -->
  <g stroke="#171D19" stroke-width="2">
    <!-- Top-Left -->
    <line x1="20" y1="30" x2="40" y2="30"/>
    <line x1="30" y1="20" x2="30" y2="40"/>
    <!-- Top-Right -->
    <line x1="760" y1="30" x2="780" y2="30"/>
    <line x1="770" y1="20" x2="770" y2="40"/>
    <!-- Bottom-Left -->
    <line x1="20" y1="1070" x2="40" y2="1070"/>
    <line x1="30" y1="1060" x2="30" y2="1080"/>
    <!-- Bottom-Right -->
    <line x1="760" y1="1070" x2="780" y2="1070"/>
    <line x1="770" y1="1060" x2="770" y2="1080"/>
  </g>

  <!-- Header Banner -->
  <text x="400" y="90" font-family="'Space Grotesk', 'Courier New', sans-serif" font-size="14" fill="#D99B26" letter-spacing="4" text-anchor="middle" font-weight="900">SURVEY OF INDIA • HIMALAYAN EXPEDITION SERIES</text>
  <text x="400" y="140" font-family="'Space Grotesk', serif" font-size="36" fill="#171D19" letter-spacing="2" text-anchor="middle" font-weight="900">{party_name.upper()}</text>
  <text x="400" y="175" font-family="monospace" font-size="16" fill="#FF5500" letter-spacing="3" text-anchor="middle" font-weight="bold">SHEET NO. {soi_sheet_no} • {dates_str.upper()}</text>

  <!-- Technical Telemetry Box -->
  <rect x="70" y="210" width="660" height="90" fill="#171D19" rx="2"/>
  <line x1="290" y1="225" x2="290" y2="285" stroke="#25302A" stroke-width="2"/>
  <line x1="510" y1="225" x2="510" y2="285" stroke="#25302A" stroke-width="2"/>

  <!-- Telemetry Numbers -->
  <text x="180" y="245" font-family="monospace" font-size="12" fill="#D99B26" text-anchor="middle" letter-spacing="1">EXPEDITION DISTANCE</text>
  <text x="180" y="280" font-family="monospace" font-size="28" fill="#F4EFE6" text-anchor="middle" font-weight="900">{distance_km:.1f} KM</text>

  <text x="400" y="245" font-family="monospace" font-size="12" fill="#38BDF8" text-anchor="middle" letter-spacing="1">MAX ALTITUDE (MSL)</text>
  <text x="400" y="280" font-family="monospace" font-size="28" fill="#F4EFE6" text-anchor="middle" font-weight="900">{max_altitude_m:.0f} M</text>

  <text x="620" y="245" font-family="monospace" font-size="12" fill="#4ADE80" text-anchor="middle" letter-spacing="1">TOTAL VERTICAL ASCENT</text>
  <text x="620" y="280" font-family="monospace" font-size="28" fill="#F4EFE6" text-anchor="middle" font-weight="900">+{elevation_gain_m:.0f} M</text>

  <!-- Elevation Profile Graph -->
  <text x="80" y="360" font-family="monospace" font-size="13" fill="#171D19" font-weight="bold" letter-spacing="2">TOPOGRAPHICAL ELEVATION RELIEF (CARTODEM 30M)</text>
  
  <polygon points="{polygon_fill}" fill="url(#elevationGrad)"/>
  <polyline points="{polyline_points}" fill="none" stroke="#FF5500" stroke-width="3.5" stroke-linecap="round"/>
  
  <line x1="80" y1="620" x2="720" y2="620" stroke="#171D19" stroke-width="2"/>

  <!-- Squad Roster Section -->
  <rect x="70" y="690" width="660" height="260" fill="none" stroke="#D99B26" stroke-width="1.5" stroke-dasharray="4,4"/>
  <text x="400" y="730" font-family="monospace" font-size="15" fill="#171D19" text-anchor="middle" font-weight="900" letter-spacing="3">EXPEDITION SQUAD MEMBERS</text>
  {members_str}

  <!-- Footer Certification Stamp -->
  <circle cx="680" cy="980" r="45" fill="none" stroke="#D99B26" stroke-width="2"/>
  <text x="680" y="975" font-family="monospace" font-size="10" fill="#D99B26" text-anchor="middle" font-weight="bold">TREKINDIA</text>
  <text x="680" y="990" font-family="monospace" font-size="8" fill="#FF5500" text-anchor="middle">OFFICIAL</text>
  
  <text x="400" y="1030" font-family="monospace" font-size="11" fill="#71717A" text-anchor="middle">VERIFIED VIA POSTGIS LINESTRINGZ &amp; ISRO CARTODEM V3 R1 • TREKINDIA ENGINE</text>
</svg>
"""
        return svg_content.strip()


poster_generator = ExpeditionPosterGenerator()
