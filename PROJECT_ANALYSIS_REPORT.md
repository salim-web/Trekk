# 🧭 TrekIndia Architecture & System Audit Report

**Date**: November 11, 2026  
**Auditor**: Antigravity Engineering System Audit  
**Codebase**: `TrekIndia` (Mobile: React Native Expo SDK 54 / Backend: FastAPI 0.111 + Python 3.11 + PostGIS + CartoDEM)  
**Reference Document**: [`CONTEXT.md`](file:///home/sumeet/git/Trekk/CONTEXT.md)

---

## Executive Summary

TrekIndia is designed as an **offline-first Himalayan navigation platform and tactile field-instrument monorepo**. Its architectural goals center on:
1. Low-altitude & high-altitude topographic cartography (OpenTopoMap, Survey of India 1:50,000 sheets).
2. Off-grid expedition communications (dual-tier physical BLE mesh and local Wi-Fi Camp Sync).
3. Geospatial elevation snapping & velocity clamping against ISRO CartoDEM 30m rasters.
4. An anti-generic "Himalayan Field-Instrument" tactile design language.

This audit analyzed all backend modules (`backend/app/*`), mobile modules (`mobile/*`), unit test suites, database schemas, and integration contracts to determine:
- **What is working** and verified with running code.
- **What is simulated, mock, or broken**.
- **What needs architectural improvements**.
- **What to remove and what to add**.

---

## 1. System Inventory & Component Status

| Component | Target Architecture | Implementation Reality | Functional Status |
|---|---|---|---|
| **CartoDEM Elevation Snapping** | ISRO 30m GeoTIFF + Bilinear Interp + Savitzky-Golay + Velocity Clamping | Implemented in [`backend/app/geo/cartodem.py`](file:///home/sumeet/git/Trekk/backend/app/geo/cartodem.py) with synthetic Himalayan ridge fallback. Unit tests pass (6/6). | 🟢 **WORKING (Core Math & Fallback)** |
| **Track File Parser (Backend)** | Multi-format GPX 1.1 & TCX parser with HR extensions | Implemented in [`backend/app/geo/track_parser.py`](file:///home/sumeet/git/Trekk/backend/app/geo/track_parser.py). Unit tests pass. | 🟢 **WORKING** |
| **Party State Machine & Spatial EXIF** | 4-state lifecycle (`planning` $\rightarrow$ `active` $\rightarrow$ `sync_window` $\rightarrow$ `archived`) + time-based GPS photo interpolation | Implemented in [`backend/app/party/state_machine.py`](file:///home/sumeet/git/Trekk/backend/app/party/state_machine.py) and [`backend/app/party/exif_spatial.py`](file:///home/sumeet/git/Trekk/backend/app/party/exif_spatial.py). Unit tests pass. | 🟢 **WORKING (Logic layer)** |
| **Backend Database Persistence** | PostgreSQL 16 + PostGIS 3.4 async SQLAlchemy models | Models defined in [`backend/app/db/models.py`](file:///home/sumeet/git/Trekk/backend/app/db/models.py), but completely disconnected from routes. In-memory dicts used instead. | 🟡 **DISCONNECTED** |
| **Backend SOI Georeferencing Pipeline** | GDAL GCP Thin Plate Spline (TPS) warping to EPSG:3857 MBTiles | Implemented in [`backend/app/geo/soi_pipeline.py`](file:///home/sumeet/git/Trekk/backend/app/geo/soi_pipeline.py), but crashes at import due to default `/var/data` directory permissions. Missing fallback when GDAL native binary is absent. | 🔴 **CRASHES AT IMPORT** |
| **Mobile Multi-Format Parser** | GPX 1.1, TCX, binary FIT decoding with semicircles & Garmin HR | Implemented in [`mobile/services/TrackParser.ts`](file:///home/sumeet/git/Trekk/mobile/services/TrackParser.ts). Complete pure TypeScript implementation. | 🟢 **WORKING** |
| **Mobile SQLite Offline Storage** | `expo-sqlite` tables with in-memory web fallback | Implemented in [`mobile/services/DatabaseService.ts`](file:///home/sumeet/git/Trekk/mobile/services/DatabaseService.ts) for imported tracks, squad messages, and media. | 🟢 **WORKING** |
| **Seeded Iconic Treks Dataset** | 10 iconic Indian trails with verified WGS-84 dense coordinates | Implemented in [`mobile/constants/SeededTrails.ts`](file:///home/sumeet/git/Trekk/mobile/constants/SeededTrails.ts). | 🟢 **WORKING** |
| **Tactile Field-Instrument UI** | Basalt/Pine/Rescue Orange tactile tokens & KnurledButtons | Implemented in [`mobile/constants/FieldTokens.ts`](file:///home/sumeet/git/Trekk/mobile/constants/FieldTokens.ts) and [`mobile/components/KnurledButton.tsx`](file:///home/sumeet/git/Trekk/mobile/components/KnurledButton.tsx). | 🟢 **WORKING** |
| **Client-Side SOI Topo Synthesis & Extraction** | Synthesize 1:50,000 vintage SVG rasters & extract ridge/valley routes | 810 lines of mathematical graticule and contour modeling in [`mobile/services/soiAnalyzerService.ts`](file:///home/sumeet/git/Trekk/mobile/services/soiAnalyzerService.ts). | 🟢 **WORKING (Client-side engine)** |
| **Interactive Topo Leaflet Map** | Leaflet WebView + OpenTopoMap tiles + SOI raster overlay + elevation chart | Implemented in [`mobile/components/TopoMapView.tsx`](file:///home/sumeet/git/Trekk/mobile/components/TopoMapView.tsx). | 🟡 **PARTIALLY WORKING (Requires internet on boot)** |
| **Physical BLE Mesh (31-byte packets)** | Hardware BLE advertisement broadcast / scan with 4-hop relay | Packet encoder/decoder & chunker implemented in [`mobile/services/meshService.ts`](file:///home/sumeet/git/Trekk/mobile/services/meshService.ts). No native BLE library installed. | 🟡 **SIMULATED (No BLE Hardware Driver)** |
| **Local Wi-Fi Camp Sync** | Embedded HTTP/WebSocket server running on leader's phone | UI in [`mobile/app/(tabs)/squads.tsx`](file:///home/sumeet/git/Trekk/mobile/app/(tabs)/squads.tsx) simulates data transfer with timer loops. No actual server running. | 🟡 **SIMULATED** |
| **Trail Recording Tab** | Live GPS track recording with altitude, grade, and auto-save | [`mobile/app/(tabs)/record.tsx`](file:///home/sumeet/git/Trekk/mobile/app/(tabs)/record.tsx) uses a simulated timer with random jitter; no `expo-location` sensor connected. Does not save to DB on stop. | 🔴 **SIMULATED / NON-FUNCTIONAL** |
| **Strava Partner OAuth2 & Map Repair** | Strava OAuth2 exchange + missing map detection + CartoDEM repair GPX push | Implemented in [`mobile/services/StravaService.ts`](file:///home/sumeet/git/Trekk/mobile/services/StravaService.ts) and [`backend/app/strava/routes.py`](file:///home/sumeet/git/Trekk/backend/app/strava/routes.py). Working flow with simulated sandbox fallback. | 🟢 **WORKING (Sandbox mode)** |

---

## 2. In-Depth Breakdown: What is Working

### 2.1 Backend Algorithms & Geospatial Logic
1. **CartoDEM Elevation Snapping & Smoothing Engine** ([`backend/app/geo/cartodem.py`](file:///home/sumeet/git/Trekk/backend/app/geo/cartodem.py)):
   - Correctly enforces the human climbing speed invariant $< 1500\text{ m/hr}$ ($0.4167\text{ m/s}$), preventing multi-path GPS cliff jumps.
   - Bilinear interpolation window reading via `rasterio` or graceful fallback to a high-fidelity synthetic Himalayan ridge function based on real Garhwal coordinates ($\sim 3200\text{ m}$ base altitude).
   - Savitzky-Golay filtering ($window=11, polyorder=2$) produces smooth orthometric height profiles.
   - Verified via unit test suite: `tests/test_cartodem.py` passes 100%.

2. **Backend Multi-Format Track Parser** ([`backend/app/geo/track_parser.py`](file:///home/sumeet/git/Trekk/backend/app/geo/track_parser.py)):
   - GPX parsing extracts track segments, timestamps, and calculates distance via the Haversine formula.
   - TCX parsing extracts `Trackpoint` blocks and heart rate data (`HeartRateBpm`).
   - Verified via unit test suite: `tests/test_track_parser.py` passes 100%.

3. **Party Lifecycle & Spatial EXIF Photo Pinning** ([`backend/app/party/`](file:///home/sumeet/git/Trekk/backend/app/party/)):
   - State machine properly governs party transition: `planning` $\rightarrow$ `active` $\rightarrow$ `sync_window` $\rightarrow$ `archived`.
   - Linear temporal interpolation matches photo timestamps to nearest GPS trackpoints to pin photos accurately in 3D space ($lat, lon, ele$).
   - Verified via unit test suite: `tests/test_party.py` passes 100%.

4. **Expedition Poster Generator** ([`backend/app/party/poster_generator.py`](file:///home/sumeet/git/Trekk/backend/app/party/poster_generator.py)):
   - Generates vector SVG commemorative expedition posters with vintage Survey of India typography, elevation profile curves, and participant rosters.

### 2.2 Mobile Frontend & Offline Infrastructure
1. **Mobile File Ingestion Engine** ([`mobile/services/TrackParser.ts`](file:///home/sumeet/git/Trekk/mobile/services/TrackParser.ts)):
   - Pure TypeScript parser supporting `.gpx`, `.tcx`, and binary `.fit` formats.
   - Binary FIT parser converts raw 32-bit semicircles to degrees ($deg = semicircles \times \frac{180}{2^{31}}$), decodes little-endian timestamps (offset from Dec 31, 1989), and extracts heart rate.
   - Uses `fast-xml-parser` with attributes enabled for robust XML traversal.

2. **Offline Local SQLite Persistence** ([`mobile/services/DatabaseService.ts`](file:///home/sumeet/git/Trekk/mobile/services/DatabaseService.ts)):
   - Manages tables `UserImportedTrails`, `SquadMessages`, and `SquadSharedMedia` via `expo-sqlite`.
   - Includes automatic memory fallback for web and unsupported environments.

3. **Seeded Iconic Indian Treks Dataset** ([`mobile/constants/SeededTrails.ts`](file:///home/sumeet/git/Trekk/mobile/constants/SeededTrails.ts)):
   - Dense coordinates for 10 premier trails across the Himalayas, Western Ghats, and North East:
     - Kedarkantha Summit (Uttarakhand)
     - Hampta Pass (Himachal Pradesh)
     - Dzukou Valley (Nagaland/Manipur)
     - Sandakphu Ridge (West Bengal)
     - Valley of Flowers (Uttarakhand)
     - Kashmir Great Lakes (Jammu & Kashmir)
     - Rajmachi Fort (Maharashtra)
     - Kalsubai Peak (Maharashtra)
     - Kumara Parvatha (Karnataka)
     - David Scott Trail (Meghalaya)

4. **Client-Side SOI Topo Analyzer & Synthesizer** ([`mobile/services/soiAnalyzerService.ts`](file:///home/sumeet/git/Trekk/mobile/services/soiAnalyzerService.ts)):
   - Synthesizes realistic 1:50,000 SOI topographical raster sheets (SVG data URIs) with 20m contour lines, perennial streams, footpaths, and spot heights.
   - Accurately converts Survey of India degree-sheet numbers (e.g., `53J/1`, `78O/5`, skipping 'I') to 15' $\times$ 15' geographic bounding boxes.
   - Detects ridgeline trails, valley traverses, water springs, campsites, and peaks without requiring an active backend connection.

5. **Tactile Field-Instrument Aesthetic** ([`mobile/constants/FieldTokens.ts`](file:///home/sumeet/git/Trekk/mobile/constants/FieldTokens.ts)):
   - Custom tokens (`basaltBackground #0F1210`, `pineSurface #171D19`, `rescueOrange #FF5500`, `contourOchre #D99B26`, `glacierCyan #38BDF8`, `mossNeon #4ADE80`).
   - Tactile `KnurledButton` with chamfered borders, embossed indicators, and haptic feedback.

---

## 3. What is NOT Working or Incomplete

### 3.1 Critical Backend Defects
1. **Module Import Crash on Standard Environments** ([`backend/app/geo/soi_pipeline.py#L30`](file:///home/sumeet/git/Trekk/backend/app/geo/soi_pipeline.py#L30)):
   - At top-level module import time, `soi_pipeline = SoiPipeline()` executes:
     ```python
     self.output_dir = output_dir or settings.TILE_OUTPUT_DIR
     os.makedirs(self.output_dir, exist_ok=True)
     ```
   - In [`backend/app/config.py`](file:///home/sumeet/git/Trekk/backend/app/config.py), `TILE_OUTPUT_DIR` defaults to `/var/data/tiles`.
   - On standard developer machines, Docker containers, or non-root environments without `/var/data`, importing `app.main` crashes immediately with:
     ```
     PermissionError: [Errno 13] Permission denied: '/var/data'
     ```
   - **Fix Required**: Default paths to relative or temporary directories (e.g. `./data/tiles` or `tempfile.gettempdir()`), and avoid eager `os.makedirs` at module import time.

2. **Database Models are Completely Disconnected from API Routes**:
   - [`backend/app/db/models.py`](file:///home/sumeet/git/Trekk/backend/app/db/models.py) defines full PostGIS tables (`User`, `Trail`, `TrekParty`, `TrekPartyMember`, `PartyMessage`, `PartyMedia`).
   - However, in [`backend/app/party/routes.py`](file:///home/sumeet/git/Trekk/backend/app/party/routes.py), ephemeral in-memory dictionaries are used:
     ```python
     PARTIES_DB = {}
     MEMBERS_DB = {}
     MEDIA_DB = {}
     ```
   - `get_db` is never injected into route handlers. Any data created via `/party` or `/media/pin` disappears whenever the server restarts.

3. **External Dependencies Not Bundled**:
   - `CARTODEM_VRT_PATH` defaults to `/var/data/cartodem/cartodem_himalayas.vrt`, which does not exist in the repo.
   - GDAL (`osgeo.gdal`) is not installed by default in pure Python wheels without external C++ system libraries (`libgdal-dev`). While fallback exists in `cartodem.py`, `soi_pipeline.py` fails if GDAL is absent.

### 3.2 Mobile Defects & Simulations
1. **Trail Recording is 100% Simulated** ([`mobile/app/(tabs)/record.tsx`](file:///home/sumeet/git/Trekk/mobile/app/(tabs)/record.tsx)):
   - The recording tab does not use `expo-location` or device sensors. It runs a `setInterval` adding fake distance and random altitude jitter.
   - When tapping "STOP RECORDING", it displays an alert but **never persists the recorded track** to `DatabaseService` or SQLite. The data is instantly lost.

2. **Offline Leaflet CDN Dependency in WebView** ([`mobile/components/TopoMapView.tsx#L58-L59`](file:///home/sumeet/git/Trekk/mobile/components/TopoMapView.tsx#L58-L59)):
   - The HTML string injected into `WebView` loads:
     ```html
     <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
     <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
     ```
   - If the user boots the app in the backcountry without an active internet connection, the CDN will fail to load, resulting in a **completely blank map screen**.
   - Map tiles are also fetched live from `https://tile.opentopomap.org/{z}/{x}/{y}.png` with no local tile caching mechanism.

3. **BLE Mesh is a Codec Simulation, Not Physical Radio**:
   - ADR-002 specifies raw BLE non-connectable advertisements carrying 31-byte binary packets.
   - [`mobile/services/meshService.ts`](file:///home/sumeet/git/Trekk/mobile/services/meshService.ts) correctly implements the 31-byte packet structure (`[2B Len][4B UUID][4B Party][4B MsgID][1B Type_TTL][16B Payload]`), but **no native BLE radio driver** (e.g. `react-native-ble-plx` or Android `BluetoothLeAdvertiser`) is integrated.
   - Packets are neither broadcast over the air nor scanned from ambient devices. Relay is triggered via a UI simulation button.

4. **Wi-Fi Camp Sync Server is Simulated**:
   - ADR-002 specifies an embedded HTTP/WebSocket server running on the leader's phone at `http://192.168.43.1:8080`.
   - In [`mobile/app/(tabs)/squads.tsx`](file:///home/sumeet/git/Trekk/mobile/app/(tabs)/squads.tsx), "Camp Sync" merely runs a client-side timer loop (`for (let p = 20; p <= 100; p += 20)`) that marks items as synced after small delays. No actual socket connection or HTTP transfer occurs.

5. **Duplicate SOI Analysis Services**:
   - Two services exist simultaneously:
     - [`mobile/services/SoiAnalysisService.ts`](file:///home/sumeet/git/Trekk/mobile/services/SoiAnalysisService.ts) (165 lines): Wraps a call to `http://localhost:8000/api/v1/geo/analyze-soi-sheet`.
     - [`mobile/services/soiAnalyzerService.ts`](file:///home/sumeet/git/Trekk/mobile/services/soiAnalyzerService.ts) (810 lines): Full offline client-side graticule and ridge extractor.
   - `SoiAnalysisService.ts` hardcodes `http://localhost:8000`, which fails on physical Android/iOS devices because `localhost` refers to the mobile device itself.

---

## 4. What Needs Improvement

1. **Configurable Environment & Storage Paths**:
   - Replace absolute `/var/data/...` paths in `config.py` with relative paths (`./data/cartodem`, `./data/tiles`) or platform-agnostic temporary directories with lazy creation on demand.

2. **Wire Backend Database to SQLAlchemy Async Engine**:
   - Replace `PARTIES_DB = {}` in `backend/app/party/routes.py` with `session: AsyncSession = Depends(get_db)`.
   - Persist parties, members, messages, and spatial media into PostgreSQL/PostGIS.
   - Provide an Alembic migration suite (`alembic init`) to automatically create PostGIS tables and spatial indices.

3. **Bundle Leaflet Assets for 100% True Offline Use**:
   - Download `leaflet.js` and `leaflet.css` into `mobile/assets/leaflet/` and inline them directly into the HTML string, or load them via `expo-file-system/legacy`.
   - Implement an offline tile cache using SQLite or local file system storage for downloaded OpenTopoMap or SOI MBTiles regions.

4. **Connect Real GPS Location to Trail Recording**:
   - Update `mobile/app/(tabs)/record.tsx` to request foreground/background permissions using `expo-location`.
   - Stream real GPS coordinates (`watchPositionAsync`), compute live distance using the Haversine formula, and on stop, save the recorded `ParsedTrack` into `DatabaseService.saveImportedTrack`.

5. **Consolidate SOI Services**:
   - Merge `SoiAnalysisService.ts` into `soiAnalyzerService.ts` to eliminate duplicate types (`SoiCandidateTrail` vs `ExtractedTrail`).
   - Use dynamic backend URLs (e.g. from an `.env` or settings modal) rather than hardcoded `http://localhost:8000`.

---

## 5. What to Remove and What to Add

### 5.1 What to Remove
| Item to Remove | File Location | Rationale |
|---|---|---|
| **Eager `os.makedirs` at module top-level** | [`backend/app/geo/soi_pipeline.py#L30`](file:///home/sumeet/git/Trekk/backend/app/geo/soi_pipeline.py#L30) | Causes `PermissionError` crash on standard developer setups during module import. |
| **In-Memory Dictionaries** | [`backend/app/party/routes.py#L25-L27`](file:///home/sumeet/git/Trekk/backend/app/party/routes.py#L25-L27) | `PARTIES_DB`, `MEMBERS_DB`, `MEDIA_DB` bypass PostgreSQL/PostGIS models completely. |
| **Duplicate `SoiAnalysisService.ts`** | [`mobile/services/SoiAnalysisService.ts`](file:///home/sumeet/git/Trekk/mobile/services/SoiAnalysisService.ts) | Redundant with `soiAnalyzerService.ts`; contains fragile `localhost:8000` fetch. |
| **Simulated Jitter Timer in Record** | [`mobile/app/(tabs)/record.tsx#L42-L49`](file:///home/sumeet/git/Trekk/mobile/app/(tabs)/record.tsx#L42-L49) | Fake random data generation should be replaced with real GPS telemetry. |

### 5.2 What to Add
| Item to Add | Target Location | Purpose |
|---|---|---|
| **Alembic Migration Suite** | `backend/alembic/` | Standard database migration system for PostgreSQL 16 + PostGIS 3.4. |
| **Docker Compose Dev Stack** | `docker-compose.yml` | One-command orchestration for PostGIS database and MinIO/S3 local emulator. |
| **Bundled Offline Leaflet Assets** | `mobile/assets/leaflet/` | Inline `leaflet.js` and `leaflet.css` to guarantee offline map boot without CDN. |
| **Real GPS Tracking with `expo-location`** | `mobile/app/(tabs)/record.tsx` | Genuine trail recording with live trackpoint polyline rendering and SQLite saving. |
| **Offline Map Tile Pack Downloader** | `mobile/services/TileCacheService.ts` | Allows downloading an area's OpenTopoMap tiles to local storage for offline treks. |
| **Mobile Automated Test Suite** | `mobile/__tests__/` | Jest unit tests for `TrackParser` (.gpx, .tcx, .fit), `MeshService` binary codec, and `DatabaseService`. |
| **Native BLE / Wi-Fi Direct Config Plugin** | `mobile/plugins/` (or Expo Prebuild) | Real RF transmission using `react-native-ble-plx` or Android Nearby Connections for actual off-grid mesh. |

---

## 6. Summary Scorecard

| Area | Grade | Remarks |
|---|:---:|---|
| **Geospatial Math & CartoDEM Snapping** | **A** | Excellent mathematical implementation of velocity clamping, Savitzky-Golay filtering, and bilinear sampling. All unit tests pass. |
| **File Parsing (.gpx, .tcx, .fit)** | **A** | Complete implementation both in backend Python and mobile TypeScript. Handles binary FIT records cleanly. |
| **Tactile UI / Field-Instrument Design** | **A-** | High-fidelity bespoke aesthetic, custom knurled controls, clean dark palette, and accurate cartographic iconography. |
| **SOI Toposheet Synthesis & Extraction** | **A-** | Deep 810-line client-side engine calculating degree-sheet graticules and extracting topological routes. |
| **Backend Integration & Persistence** | **C** | Models exist but are unused by routes; hardcoded `/var/data` paths crash on import without root permissions. |
| **Offline Architecture Integrity** | **C+** | Relies on CDN for Leaflet JS/CSS; BLE Mesh and Camp Sync Wi-Fi server are simulated; live recorder is simulated. |

---

*Report generated and archived locally at `PROJECT_ANALYSIS_REPORT.md`.*
