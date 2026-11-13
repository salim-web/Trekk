# TrekIndia System Context & Architecture Record 🧭

*Document Version*: `2.0.0-EXPO`  
*Target Environments*: Mobile (React Native 0.81.5 / Expo SDK 54 / TypeScript; iOS, Android, and web) & Backend (Python 3.11+ / FastAPI; optional PostGIS/GDAL integrations)
*Architectural Objective*: Build toward offline-capable Himalayan navigation and a tactile field-instrument experience; current live-network and demo-data boundaries are documented below.

---

## 1. System State & Architectural Decisions (ADR)

### ADR-001: Hybrid Topographical Rendering (Offline Capability Is a Goal)
- **Decision**: Render the interactive map with Leaflet inside a React Native WebView. Current base layers include OpenTopoMap, Esri Satellite, and OpenStreetMap, with trail and SOI overlays.
- **Current boundary**: Base map tiles are remote sources; complete offline tile caching is not implemented or guaranteed. Saved tracks are stored locally where SQLite is available.
- **Rationale**: A WebView-based map runs across Expo targets without a custom native map build. Offline map availability and performance must be validated separately.

### ADR-002: Offline Mesh and Camp Sync (Target Architecture)
- **Decision**: Avoid relying on cellular service in the backcountry. The target design has BLE telemetry/messaging and local Wi-Fi camp synchronization.
- **Current implementation**: The mobile app contains a 31-byte BLE packet codec, message/relay simulation UI, and Camp Sync demo flow. The repository does not currently implement native BLE scanning/advertising or a phone-hosted Camp Sync HTTP/WebSocket server. The backend `/camp-sync/diff` endpoint returns a hard-coded demonstration item.
- **Rationale**: BLE and ad-hoc Wi-Fi are intended for low-connectivity use; real-device transport, throughput, battery use, and range still require implementation and field testing.

### ADR-003: CartoDEM Snapping & Velocity Clamping
- **Decision**: GPS elevation from budget phones suffers ±30-60m barometric/ephemeris jitter. Backend CartoDEM snapping ingests ISRO 30m GeoTIFFs, performs 2D bilinear interpolation, and applies a Savitzky-Golay filter (window=11, polyorder=2).
- **Invariant**: Vertical speed must be strictly clamped to $< 1500\text{ m/hr}$ (or $0.416\text{ m/s}$); any points violating this threshold indicate cliff bounce/multipath error and are smoothed along the interpolated slope.

### ADR-004: Anti-Generic Tactile Design System ("Himalayan Field-Instrument")
- **Decision**: Complete ban on Material 3 tinted purple/blue cards, floating action buttons with standard shadows, and generic web layouts.
- **Aesthetic**: Teenage Engineering physical hardware + Garmin Marq + Vintage Survey of India 1960s Topo Cartography.
- **Tokens**: Deep Pine (`#171D19`) & Obsidian Basalt (`#0F1210`), SOI Parchment (`#F4EFE6`), Rescue Orange (`#FF5500`), Contour Ochre (`#D99B26`), Glacier Cyan (`#38BDF8`), Moss Neon (`#4ADE80`).

### ADR-005: React Native (Expo SDK 54) Architecture & Multi-Format Ingestion
- **Decision**: `/mobile` uses React Native 0.81.5, Expo SDK 54, TypeScript, and Expo Router. Use `expo-document-picker` with `type: '*/*'` to avoid Android's OS-level `Unsupported filter` crash when picking fitness files (`.gpx`, `.tcx`, `.fit`).
- **Rationale**: Android system intent filters reject non-standard MIME types for fitness formats unless queried broadly as `*/*`. Subsequent validation and byte decoding are performed in TypeScript using `fast-xml-parser` and binary FIT decoding.
- **Strava Flow**: Uses `expo-auth-session` / `expo-web-browser`; the service also has a simulated sandbox-success path. A real Strava client configuration is required for live OAuth.

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

### 3.2 Mobile Local Offline Database (`expo-sqlite`)
Tables initialized by `mobile/services/DatabaseService.ts`:
- `UserImportedTrails`: `id`, `name`, `sourceFormat`, `importedAt`, `distanceKm`, `elevationGainM`, `maxAltitudeM`, `minAltitudeM`, `averageHeartRate`, `pointsJson`, `isSynced`
- `SquadMessages`: message identity, sender, type, time, optional coordinates, hops, and RSSI.
- `SquadSharedMedia`: media identity, type, SHA-256, sender, time, coordinates, local URI, and sync flag.

If SQLite cannot open (for example, web), the service uses in-memory stores, which are not durable across reloads. Imported-track insert failures propagate so an unsaved recording can be retried. Squad message/media write errors are logged and fall back to memory.
- Credentials & Tokens: Persisted via `expo-secure-store` (`strava_access_token`, `strava_athlete_name`, `strava_client_id`, `strava_client_secret`).
- File & Asset I/O: Managed via `expo-file-system/legacy` with string-literal encodings (`utf8`, `base64`).

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

### 4.2 SOI Sheet Georeferencing
- **Route**: `POST /api/v1/geo/soi/georeference`
- **Request**: `multipart/form-data` fields `sheet_number`, `tl_lat`, `tl_lon`, `tr_lat`, `tr_lon`, `br_lat`, `br_lon`, `bl_lat`, `bl_lon`, optional `min_zoom`/`max_zoom`, and required file field `sheet_file`.
- **Response**: `SoiGeoreferenceResponse` (`sheet_number`, `mbtiles_url`, `bounds_bbox`, `min_zoom`, `max_zoom`, `status`, `message`). Actual output depends on the georeferencing pipeline and available GDAL/data assets.

### 4.3 OSM Himalayan Overpass Harvester
- **Route**: `POST /api/v1/geo/harvest-osm`
- **Request Body**:
```json
{
  "bbox": [30.15, 78.10, 30.45, 78.60],
  "categories": ["hiking_routes", "springs", "drinking_water", "campsites", "peaks", "passes"]
}
```
- **Response**: `OsmHarvestResponse` containing `status`, `total_harvested`, and `features`. The route returns harvested feature data; do not assume it is automatically persisted to PostGIS.

### 4.4 Camp Sync Delta Query (Demonstration Endpoint)
- **Route**: `POST /api/v1/camp-sync/diff` on the FastAPI backend; this is not a device-hosted hotspot server.
- **Request**: `CampSyncDiffRequest`, including `have_hashes`.
- **Response**: `missing_from_client` and `missing_from_server`. The current endpoint compares against a hard-coded sample media item; it does not provide actual file transfer or durable server-side sync.

---

## 5. Progress Tracker & Implementation Status

- [x] Step 1: `README.md` created with monorepo tree & setup commands.
- [x] Step 1: `CONTEXT.md` created with system architecture, design tokens & DB schemas.
- [x] Step 1: `SKILL.md` created with geospatial math, BLE packet specs & anti-generic UI rules.
- [x] Step 2: Backend setup: `requirements.txt`, Pydantic v2 schemas, async SQLAlchemy & PostGIS models.
- [x] Step 3: Backend CartoDEM snapping engine, Savitzky-Golay smoothing, velocity clamping.
- [x] Step 4: Backend automated SOI PDF georeferencing pipeline (GDAL GCPs + Warp + MBTiles).
- [x] Step 5: Backend OSM Overpass Harvester endpoint. Automatic PostGIS ingestion is not established by the current route.
- [x] Step 6: Backend Trek Party state machine, EXIF spatial pinning, TUS storage module, and expedition poster generator. Party/member/media route state currently uses in-memory dictionaries.
- [x] Step 7: Tactile Field-Instrument design tokens (`mobile/constants/FieldTokens.ts`).
- [x] Step 8: Full UI/UX Consumer Overhaul in React Native Expo SDK 54 (Explore, Record, Squads, Saved & Sync).
- [x] Step 9: 10 Seeded Iconic Indian Treks Dataset with verified dense WGS-84 coordinates (Kedarkantha, Hampta, Dzukou, Sandakphu, Valley of Flowers, Kashmir Great Lakes, Rajmachi, Kalsubai, Kumara Parvatha, David Scott).
- [x] Step 10: Real Topographical Maps with OpenTopoMap contours, Esri Satellite, OpenStreetMap, and SOI overlay via Leaflet WebView.
- [x] Step 11: Slide-to-trigger SOS UI and BLE packet-format support. Real BLE transmission is not implemented; SOS now requires a fresh GPS fix and does not fabricate coordinates.
- [x] Step 12: Camp Sync demonstration UI and backend diff endpoint. The backend response is sample data; no peer-hosted sync server or file-transfer implementation is present.
- [x] Feature Update 1: Native on-map trail plotting with interactive markers, glowing selected state, camera bounds animation, and minimal dismissible inspection pill (bottom cards completely removed).
- [x] Feature Update 2: Multi-format track parser (GPX, TCX, FIT semicircle coordinates), document picker (`type: '*/*'`), `expo-file-system/legacy`, and SQLite track persistence. GPX track names take precedence over route names when a track exists; exported GPX text is XML-escaped.
- [x] Feature Update 3: Strava Integration with official OAuth2 `localhost` callback domain, `expo-secure-store` credentials persistence, athlete activities auditor, "Missing Map" detection & CartoDEM repair action with GPX 1.1 sharing via `expo-sharing`.
- [x] Feature Update 4: P2P Mesh Messaging & Camp Sync File Sharing:
  - 31-byte BLE packet encoder/decoder and codec tests (`[2B Len][4B ServiceUUID][4B PartyHash][4B MsgID][1B MsgType_TTL][16B Payload]`), including TTL and text-chunk handling. This is protocol logic, not native radio transport.
  - Interactive dual-mode offline hub in `app/(tabs)/squads.tsx` (`Mesh Chat`, `Camp File Sync`, `Radar & Nodes`).
  - Tactile quick-broadcast pills (`📍 GPS Pin`, `💧 Water Spring`, `⛺ Camp Pitching`, `🚨 SOS Priority Broadcast`).
  - Media-notice packet support (`0x04`) and Camp Sync UI with SHA-256/hash and transfer-progress presentation. This currently demonstrates the workflow; it does not perform BLE media transmission or actual Wi-Fi file transfer.
  - Simulation engine: `Simulate Incoming Squad Relay (2 Hops)` for multi-hop packet testing on single devices.
- [x] Feature Update 5: Survey of India (SOI) Map Upload, Georeferenced Image Overlay, & Live Topo Extraction Engine:
  - `expo-document-picker` (`*/*`) and `expo-file-system/legacy` upload flow supporting `.png`, `.jpg`, `.tif`, and `.pdf` SOI sheets.
  - Sheet Graticule Selector (`53J/1 - Sankri/Kedarkantha`, `52H/8 - Hampta/Kullu`, `78O/11 - Mawphlang`, `83K/2 - Dzukou`) with true $15' \times 15'$ bounding boxes.
  - 1-Tap Load Sample SOI Toposheet synthesizing authentic 1:50,000 vintage SVG raster sheet (20m brown contours `#8B5A2B`, red dashed footpaths `#DC2626`, blue perennial streams `#0284C7`, spot heights, triangulation markers).
  - True georeferenced raster image overlay on Leaflet via `L.imageOverlay` with extracted candidate ridgeline/valley trails (`#A855F7`), perennial water springs (`#38BDF8`), flat campsites (`#FACC15`), and triangulated spot heights (`#FF5500`).
  - Floating SOI Sheet Inspector Bar with opacity controls, feature counts, and `Save Route to My Trails` action adding candidate routes into local SQLite storage.

## 6. Current App Behavior, Recent Fixes, and Implementation Boundaries

### Mobile screens
- **Explore** (`mobile/app/(tabs)/index.tsx`): Leaflet map in a WebView; seeded trails, trail selection/inspection, multiple base layers, and SOI overlays. Region navigation is deferred until the WebView map is ready. Selected-trail camera navigation takes precedence over regional fitting; base-layer and trail state are restored on readiness.
- **Record** (`mobile/app/(tabs)/record.tsx`): Requires location permission and a fresh GPS fix before recording. Trackpoints come from the device location watcher; the app does not synthesize route points, distance, or elevation gain. Failed SQLite track saves remain available for retry. SOS also requires a fresh GPS fix and will not send fabricated coordinates. Heart-rate telemetry is currently simulated; do not treat it as sensor data.
- **Squads** (`mobile/app/(tabs)/squads.tsx`): Mesh chat, radar, SOS and Camp Sync demonstration UI. BLE packet codec behavior is testable, but native BLE transport is not implemented. Camp Sync is not a working peer-to-peer file transfer.
- **Saved** (`mobile/app/(tabs)/saved.tsx`): Imported/recorded tracks, Strava activity handling, and GPX export. GPX track names and timestamps are XML-escaped on export.

### Recent verified fixes
- GPX parsing uses the route name only when no track exists.
- GPX export escapes XML special characters in names and timestamps.
- Map region navigation waits for WebView readiness; selected tracks retain camera priority, and regional fit resumes when no track is selected.
- Recording no longer invents track points or fallback distance/elevation metrics. A failed local track insert is surfaced rather than reported as a successful save; users can retry.
- SOS requires current location data; missing coordinates are not replaced with a plausible-looking position.
- SQLite track insert errors propagate to the caller. If SQLite itself cannot open, in-memory storage remains a non-durable fallback.
- Backend media pinning preserves valid `0.0` latitude/longitude rather than replacing them with defaults.
- README declares the mobile Node.js minimum as 20.19.4+, and analysis report links are repository-relative.

### Backend and demo-data boundaries
- FastAPI registers geospatial, party/media, and Strava routers under the configured API prefix. It exposes `/health` and OpenAPI docs at `/docs`.
- Party/member/media state in `backend/app/party/routes.py` is held in process-memory dictionaries; it is not durable database-backed storage.
- `/api/v1/camp-sync/diff` compares client hashes against a hard-coded sample media item. No local hotspot server or transfer endpoints are implemented.
- `/api/v1/geo/analyze-soi-sheet` returns seeded candidate trails; its response is not evidence of computer-vision extraction from the uploaded sheet.
- Some UI telemetry and Strava sandbox flows are demonstrations. Distinguish implemented parsers/algorithms and API contracts from live hardware, cloud, or production integrations.

### Latest verification after the fixes
- `bun test`: 8 passed.
- `mobile/node_modules/.bin/tsc --noEmit --project mobile/tsconfig.json`: passed.
- `cd backend && uv run --python 3.11 --with-requirements requirements.txt pytest -q`: 11 passed.
- `git diff --check`: passed.
