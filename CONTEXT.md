# TrekIndia System Context & Architecture Record 🧭

*Document Version*: `1.0.0-PROD`  
*Target Environments*: Mobile (Flutter 3.22+ iOS/Android) & Backend (Python 3.11+ FastAPI / PostGIS / GDAL)  
*Architectural Objective*: Offline-First Himalayan Navigation & Tactile Instrument Monorepo.

---

## 1. System State & Architectural Decisions (ADR)

### ADR-001: Offline-First Hybrid Topographical Rendering
- **Decision**: Combine MapLibre GL native vector contours (MVT, zoom 8-16) with georeferenced Survey of India (SOI) 1:50,000 raster layers (`EPSG:3857` MBTiles/XYZ) rendered over custom tile layers.
- **Rationale**: Vector tiles provide crisp 60fps rotation, 3D terrain pitch, and dynamic hillshading. SOI vintage sheets supply historical bridle paths, natural perennial springs, and Survey benchmarks that modern OSM data often omits in high-altitude Ladakh and Himachal Pradesh.
- **Implementation**: The custom `VernierOpacityDial` hardware-slider widget directly manipulates the raster layer opacity in real-time between 0.0 (Pure Modern Vector) and 1.0 (Full Vintage SOI Topo Sheet).

### ADR-002: Dual-Tier Physical Mesh Architecture
- **Decision**: Reject reliance on internet or cellular SMS gateways in backcountry. Implement a 2-Tier mesh:
  - **Tier 1 (Trail-in-Motion)**: Raw BLE non-connectable advertisements carrying a tightly packed 31-byte binary packet with 4-hop multi-hop flood-fill relay and duty-cycled radio (1.5s active / 8s sleep).
  - **Tier 2 (Basecamp / Tent Sync)**: Embedded HTTP/WebSocket `shelf` server run on the party leader's device over local Android/iOS Wi-Fi hotspot, allowing 20-40 MB/s bulk delta sync of media and voice notes.
- **Rationale**: BLE provides continuous low-energy pinging (~100m range, 0.5% battery/hr), while ad-hoc Wi-Fi enables bulk media transfer without cloud infrastructure.

### ADR-003: CartoDEM Snapping & Velocity Clamping
- **Decision**: GPS elevation from budget phones suffers ±30-60m barometric/ephemeris jitter. Backend CartoDEM snapping ingests ISRO 30m GeoTIFFs, performs 2D bilinear interpolation, and applies a Savitzky-Golay filter (window=11, polyorder=2).
- **Invariant**: Vertical speed must be strictly clamped to $< 1500\text{ m/hr}$ (or $0.416\text{ m/s}$); any points violating this threshold indicate cliff bounce/multipath error and are smoothed along the interpolated slope.

### ADR-004: Anti-Generic Tactile Design System ("Himalayan Field-Instrument")
- **Decision**: Complete ban on Material 3 tinted purple/blue cards, floating action buttons with standard shadows, and generic web layouts.
- **Aesthetic**: Teenage Engineering physical hardware + Garmin Marq + Vintage Survey of India 1960s Topo Cartography.
- **Tokens**: Deep Pine (`#171D19`) & Obsidian Basalt (`#0F1210`), SOI Parchment (`#F4EFE6`), Rescue Orange (`#FF5500`), Contour Ochre (`#D99B26`), Glacier Cyan (`#38BDF8`), Moss Neon (`#4ADE80`).

---

## 2. Design Tokens & Visual Specifications

| Token Name | Hex Code | Purpose / Usage |
|---|---|---|
| `basaltBackground` | `#0F1210` | Base background, OLED power saver |
| `pineSurface` | `#171D19` | Instrument card surfaces, dials, bezel housings |
| `pineSurfaceBorder` | `#25302A` | Hard chamfered border for instrument frames |
| `soiParchment` | `#F4EFE6` | Vintage map cards, SOI sheet headers, printed stamps |
| `soiParchmentText` | `#1A1916` | High-contrast dark ink for parchment cards |
| `rescueOrange` | `#FF5500` | SOS trigger, live recording active, needle pointers |
| `contourOchre` | `#D99B26` | 100m/20m contour index lines, elevation labels |
| `glacierCyan` | `#38BDF8` | Water sources, glacial streams, waypoint markers |
| `mossNeon` | `#4ADE80` | BLE mesh node active status, battery healthy, synced |
| `hazardYellow` | `#FACC15` | Weather alerts, high-climb warnings, avalanche zone |
| `tactileSteel` | `#3F4943` | Knurled wheel ribs, hardware screws, graticule ticks |

### Typography Tokens
- **Display / Headers**: `SpaceGrotesk` / `Syne` (Bold, uppercase, letter-spacing +1.2px)
- **Technical Telemetry**: `JetBrainsMono` (Strictly tabular numbers `fontFeatures: [FontFeature.tabularFigures()]`)
- **Vintage Cartographic Labels**: `EBGaramond` or `Serif` italicized for spot elevations and river names.

---

## 3. Database Schemas

### 3.1 PostGIS Backend Schema (PostgreSQL 16 + PostGIS 3.4)

```sql
-- 1. Users & Strava Credentials
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    strava_tokens JSONB DEFAULT '{}'::jsonb,
    badges_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Trails & Geographic LinestringZ
CREATE TABLE trails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    difficulty VARCHAR(50) NOT NULL CHECK (difficulty IN ('easy', 'moderate', 'strenuous', 'alpine_expedition')),
    geom GEOMETRY(LineStringZ, 4326) NOT NULL,
    soi_sheet_no VARCHAR(50) NOT NULL, -- e.g. '53J/3', '52H/14'
    distance_km DOUBLE PRECISION NOT NULL,
    elevation_gain_m DOUBLE PRECISION NOT NULL,
    max_altitude_m DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trails_geom ON trails USING GIST (geom);

-- 3. Ephemeral Trek Parties
CREATE TYPE trek_party_status AS ENUM ('planning', 'active', 'sync_window', 'archived');

CREATE TABLE trek_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trail_id UUID REFERENCES trails(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    invite_code VARCHAR(16) UNIQUE NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status trek_party_status NOT NULL DEFAULT 'planning',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_trek_parties_invite ON trek_parties (invite_code);

-- 4. Trek Party Members
CREATE TYPE party_member_role AS ENUM ('leader', 'guide', 'sweeper', 'trekker');

CREATE TABLE trek_party_members (
    party_id UUID NOT NULL REFERENCES trek_parties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role party_member_role NOT NULL DEFAULT 'trekker',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (party_id, user_id)
);

-- 5. Party P2P Messages & Telemetry
CREATE TABLE party_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES trek_parties(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_type VARCHAR(30) NOT NULL, -- 'ping', 'text', 'sos', 'voice_note'
    content TEXT,
    media_url TEXT,
    duration_seconds INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_party_messages_party ON party_messages(party_id, created_at DESC);

-- 6. Spatial Media & Pinning
CREATE TABLE party_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES trek_parties(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_key VARCHAR(512) NOT NULL,
    thumbnail_key VARCHAR(512),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    captured_at TIMESTAMPTZ NOT NULL,
    location GEOMETRY(PointZ, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_party_media_location ON party_media USING GIST (location);
```

### 3.2 Mobile Local Offline Database (Drift / SQLite)
Local SQLite tables mirrored in `mobile/lib/db`:
- `LocalTracks`: `id`, `name`, `startedAt`, `endedAt`, `gpxBlob`, `isSynced`
- `LocalTrackPoints`: `id`, `trackId`, `latitude`, `longitude`, `elevationM`, `heartRate`, `timestamp`
- `LocalPartyMedia`: `id`, `partyId`, `localFilePath`, `sha256Hash`, `capturedAt`, `lat`, `lon`, `ele`, `isUploaded`
- `LocalMeshMessages`: `msgId`, `partyHash`, `msgType`, `senderShortId`, `payloadHex`, `receivedAt`, `hopCount`

---

## 4. API Contracts

### 4.1 Elevation Snapping
- **Route**: `POST /api/v1/elevation/snap`
- **Request Body**:
```json
{
  "points": [
    {"lat": 30.7345, "lon": 79.0673, "ele": 3520.5, "timestamp": 1731160000},
    {"lat": 30.7350, "lon": 79.0678, "ele": 3528.2, "timestamp": 1731160010}
  ],
  "source_dem": "cartodem_30m",
  "apply_smoothing": true
}
```
- **Response**:
```json
{
  "points": [
    {"lat": 30.7345, "lon": 79.0673, "ele_raw": 3520.5, "ele_snapped": 3534.2, "ele_filtered": 3534.1, "snapped_msl": 3534.1},
    {"lat": 30.7350, "lon": 79.0678, "ele_raw": 3528.2, "ele_snapped": 3539.8, "ele_filtered": 3539.6, "snapped_msl": 3539.6}
  ],
  "total_gain_m": 5.5,
  "max_elevation_m": 3539.6,
  "void_fill_count": 0
}
```

### 4.2 Automated SOI PDF Georeferencing
- **Route**: `POST /api/v1/geo/soi/georeference`
- **Request**: `multipart/form-data` with `sheet_pdf` file, `sheet_number` (e.g. `53J/3`), `corner_coords` (4 lat/lon tuples for top-left, top-right, bottom-right, bottom-left).
- **Response**:
```json
{
  "sheet_number": "53J/3",
  "mbtiles_url": "/tiles/soi_53J_3.mbtiles",
  "bounds": [78.25, 30.25, 78.50, 30.50],
  "min_zoom": 11,
  "max_zoom": 15,
  "status": "ready"
}
```

### 4.3 OSM Himalayan Overpass Harvester
- **Route**: `POST /api/v1/geo/harvest-osm`
- **Request Body**:
```json
{
  "bbox": [30.15, 78.10, 30.45, 78.60],
  "categories": ["hiking_routes", "springs", "drinking_water", "campsites", "peaks", "passes"]
}
```
- **Response**: GeoJSON FeatureCollection of harvested topographic objects ingested into PostGIS.

### 4.4 Camp Sync Delta Query
- **Route**: `POST http://192.168.43.1:8080/api/v1/camp-sync/diff`
- **Request Body**:
```json
{
  "client_id": "phone_usr_9981",
  "have_hashes": ["e3b0c44298fc1c149afbf4c8996fb924...", "a591a6d40bf420404a011733cfb7b190..."]
}
```
- **Response**:
```json
{
  "missing_from_client": [
    {"hash": "f47ac10b...", "size_bytes": 4829104, "filename": "IMG_20261109_Kedarkantha.jpg", "type": "image/jpeg", "captured_at": "2026-11-09T14:32:00Z", "lat": 31.023, "lon": 78.172, "ele": 3810.0}
  ],
  "missing_from_server": ["..."]
}
```

---

## 5. Progress Tracker & Implementation Status

- [x] Step 1: `README.md` created with monorepo tree & setup commands.
- [x] Step 1: `CONTEXT.md` created with system architecture, design tokens & DB schemas.
- [x] Step 1: `SKILL.md` created with geospatial math, BLE packet specs & anti-generic UI rules.
- [x] Step 2: Backend setup: `requirements.txt`, Pydantic v2 schemas, async SQLAlchemy & PostGIS models.
- [x] Step 3: Backend CartoDEM snapping engine, Savitzky-Golay smoothing, velocity clamping.
- [x] Step 4: Backend automated SOI PDF georeferencing pipeline (GDAL GCPs + Warp + MBTiles).
- [x] Step 5: Backend OSM Overpass Harvester & PostGIS trail loader.
- [x] Step 6: Backend Trek Party state machine, EXIF spatial pin, TUS storage, expedition poster generator.
- [x] Step 7: Flutter theme & design tokens (`field_tokens.dart`, `app_theme.dart`).
- [x] Step 8: Full UI/UX Consumer Overhaul (Explore, Record, Squads, Saved & Sync).
- [x] Step 9: 10 Seeded Iconic Indian Treks Dataset (Kedarkantha, Hampta, Dzukou, Sandakphu, Valley of Flowers, Kashmir Great Lakes, Rajmachi, Kalsubai, Kumara Parvatha, David Scott).
- [x] Step 10: Real Topographical Maps with OpenTopoMap contours, Esri Satellite, OpenStreetMap, and SOI overlay.
- [x] Step 11: Slide-to-Trigger Emergency SOS Control with 4-hop physical BLE Mesh.
- [x] Step 12: Flutter Camp Sync Shelf HTTP/WS server (port 8080) + QR badge generator + SHA-256 delta sync.
