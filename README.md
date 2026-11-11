# TrekIndia: Offline-First Indian Trekking Platform 🏔️
### Tactical Field-Instrument Topographical Engine & P2P Expedition Mesh

[![Python](https://img.shields.io/badge/Python-3.11+-171D19?style=for-the-badge&logo=python&logoColor=4ADE80)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-171D19?style=for-the-badge&logo=fastapi&logoColor=38BDF8)](https://fastapi.tiangolo.com)
[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_54-171D19?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9+-171D19?style=for-the-badge&logo=typescript&logoColor=3178C6)](https://typescriptlang.org)
[![Bun](https://img.shields.io/badge/Bun-1.4+-171D19?style=for-the-badge&logo=bun&logoColor=F4EFE6)](https://bun.sh)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.4+-171D19?style=for-the-badge&logo=postgresql&logoColor=D99B26)](https://postgis.net)
[![GDAL](https://img.shields.io/badge/GDAL-3.8+-171D19?style=for-the-badge&logo=osgeo&logoColor=F4EFE6)](https://gdal.org)

---

## 1. Executive Summary & Design Ethos

**TrekIndia** is a production-grade, offline-first tactical navigation and expedition telemetry platform engineered specifically for the unforgiving conditions of the Indian Himalayas (Pir Panjal, Zanskar, Garhwal, Kumaon, and Eastern Himalayas), Western Ghats, and North Eastern mountain ranges.

Unlike generic fitness apps that depend on continuous cellular connectivity and deploy soft pastel interfaces illegible under high-altitude alpine sunlight, **TrekIndia** is constructed around two uncompromising principles:

1. **Total Zero-Signal Autonomy**: Full topographical mapping, peer-to-peer telemetry, health metrics aggregation, and delta media synchronization operate with zero cellular connectivity via BLE advertisement mesh (31-byte binary packets) and ad-hoc local Wi-Fi ("Camp Sync").
2. **Tactile Himalayan Field-Instrument UI**: Inspired by **Vintage Survey of India (SOI) Cartography (1:50,000 Open Series Maps)** and rugged tactile outdoor instruments (**Garmin Marq**, **Teenage Engineering OP-1/TX-6**). Built with zero standard Material 3 purple buttons or soft-shadow white cards; every component uses high-contrast OLED basalt backgrounds (`#0F1210`), knurled thumb-wheel vernier scales, mechanical toggles, graticule corner stamps (`+`), and tabular monospace telemetry.

---

## 2. Monorepo Architecture Directory Tree

```
trekindia/
├── README.md                      # Comprehensive setup, architecture, and run instructions
├── CONTEXT.md                     # System state, DB schemas, design tokens, progress tracker
├── PROJECT_ANALYSIS_REPORT.md     # In-depth system audit, verification results & scorecard
├── SKILL.md                       # Domain invariants, geospatial math, BLE packet specs, UI rules
├── backend/                       # Python 3.11+ FastAPI Geospatial & Telemetry Service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # FastAPI lifecycle, middleware, route registration
│   │   ├── config.py              # Pydantic v2 Settings (PostGIS, R2/S3, Strava, JWT, dynamic data dirs)
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── database.py        # Async SQLAlchemy engine & session maker
│   │   │   └── models.py          # PostGIS Declarative models (Geometry LinestringZ, PointZ)
│   │   ├── geo/
│   │   │   ├── __init__.py
│   │   │   ├── cartodem.py        # ISRO CartoDEM Bilinear interpolation & Savitzky-Golay filter
│   │   │   ├── soi_pipeline.py    # SOI 1:50k PDF 4-corner GCP georeferencer & MBTiles exporter
│   │   │   ├── overpass_harvester.py # OSM Overpass QL harvester for Himalayan trails & huts
│   │   │   ├── track_parser.py    # Backend GPX 1.1 & TCX parser with CartoDEM snapping
│   │   │   └── routes.py          # /api/v1/elevation/snap, /api/v1/geo/soi, /api/v1/geo/analyze-soi-sheet
│   │   ├── party/
│   │   │   ├── __init__.py
│   │   │   ├── state_machine.py   # TrekParty state machine (planning->active->sync->archived)
│   │   │   ├── exif_spatial.py    # Photo EXIF DateTimeOriginal to GPX timestamp interpolation
│   │   │   ├── tus_storage.py     # Cloudflare R2 / S3 TUS resumable chunked protocol
│   │   │   ├── poster_generator.py # 3D Topographic Expedition Poster raster/SVG generator
│   │   │   └── routes.py          # /api/v1/party CRUD, media sync, poster download
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── geo_schemas.py     # Pydantic v2 schemas for elevation snapping & georeferencing
│   │   │   └── party_schemas.py   # Pydantic v2 schemas for parties, members, media, and P2P pings
│   │   └── strava/
│   │       ├── __init__.py
│   │       └── routes.py          # /api/v1/tracks/import, /api/v1/strava/oauth, /api/v1/strava/repair
│   ├── pytest.ini                 # Pytest configuration with pythonpath and asyncio scopes
│   ├── tests/
│   │   ├── test_api_endpoints.py  # Integration tests for FastAPI endpoints (health, snap, party, SOI)
│   │   ├── test_cartodem.py       # Bilinear DEM sampling & velocity clamping unit tests
│   │   ├── test_party.py          # State machine transitions & EXIF interpolation
│   │   └── test_track_parser.py   # GPX and TCX backend parsing unit tests
│   └── requirements.txt
└── mobile/                        # React Native + Expo SDK 54 (TypeScript + Bun)
    ├── package.json
    ├── app.json
    ├── tsconfig.json
    ├── app/                       # Expo Router File-Based Navigation
    │   ├── _layout.tsx            # Root layout & dark basalt field theme
    │   ├── (tabs)/                # 4-Tab Field Instrument Navigation
    │   │   ├── _layout.tsx        # Bottom tactile tab bar
    │   │   ├── index.tsx          # Topo Map: Multi-source tiles, SOI overlay & trail spotlights
    │   │   ├── record.tsx         # Record: Hardware GPS + Compass Azimuth + Live Elevation Sparkline
    │   │   ├── squads.tsx         # Squads: 31-byte BLE Mesh Chat, Radar & Camp Sync
    │   │   └── saved.tsx          # Saved: Offline tracks, Strava Map Repair & GPX Export
    │   └── _layout.tsx
    ├── components/                # Tactile Himalayan Field Instrument UI Kit
    │   ├── TopoMapView.tsx        # Leaflet WebView with 4 Base Layers & SVG fallback
    │   ├── ElevationChart.tsx     # Interactive SVG Elevation Profile Scrubbing Chart
    │   ├── FileImportModal.tsx    # DocumentPicker (*/*) + GPX/TCX/FIT Sniffer
    │   ├── StravaConnectModal.tsx # OAuth2 WebBrowser / Demo Sandbox Sync Modal
    │   ├── SoiScanOverlay.tsx     # SOI Toposheet Analyzer & AI Ridgeline Overlay
    │   └── KnurledButton.tsx      # Tactile Mechanical Push-Button
    ├── services/                  # Business Logic & Native Bridges
    │   ├── TrackParser.ts         # Fast-XML GPX/TCX + Binary FIT Parser with HR
    │   ├── DatabaseService.ts     # Expo-SQLite Offline Storage with Web Fallback
    │   ├── meshService.ts         # 31-byte BLE advertisement packet encoder/decoder & Web Crypto SHA-256
    │   ├── StravaService.ts       # OAuth2 Flow, Activity Auditor & GPX 1.1 Upload
    │   ├── SoiAnalysisService.ts  # Backend Bridge with 2.5s AbortController timeout
    │   └── soiAnalyzerService.ts  # 810-line client-side degree-sheet graticule & ridge extractor
    ├── constants/
    │   ├── FieldTokens.ts         # High-Sunlight & Basalt OLED Tokens
    │   └── SeededTrails.ts        # 10 Iconic Seeded Indian Himalayan & Ghats Treks
    └── __tests__/                 # Mobile Automated Unit Test Suite (bun test)
        ├── trackParser.test.ts    # GPX 1.1, TCX with heart rate, and route tests
        └── meshCodec.test.ts      # 31-byte binary BLE packet encoding, TTL, and chunking
```

---

## 3. Environment Variables

### Backend (`/backend/.env`)
```bash
# Database & PostGIS
DATABASE_URL=postgresql+asyncpg://trekindia:alpine_pass_2026@localhost:5432/trekindia_db
POSTGRES_DB=trekindia_db
POSTGRES_USER=trekindia
POSTGRES_PASSWORD=alpine_pass_2026
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# Topographical & GDAL Storage (defaults to ./data relative to repo)
TREKINDIA_DATA_DIR=./data
CARTODEM_VRT_PATH=./data/cartodem/cartodem_himalayas.vrt
SOI_STORAGE_DIR=./data/soi_sheets
TILE_OUTPUT_DIR=./data/tiles

# Cloudflare R2 / S3 Resumable Storage
S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=cf_r2_access_key_here
S3_SECRET_ACCESS_KEY=cf_r2_secret_key_here
S3_BUCKET_NAME=trekindia-media
S3_PUBLIC_DOMAIN=https://media.trekindia.org

# Strava API Partner Integration
STRAVA_CLIENT_ID=109284
STRAVA_CLIENT_SECRET=strava_client_secret_here
STRAVA_REDIRECT_URI=https://api.trekindia.org/api/v1/auth/strava/callback

# Security & CORS
JWT_SECRET=super_secret_basalt_hmac_sha256_key_at_least_64_bytes_long_himalayan
CORS_ORIGINS=["*"]
```

---

## 4. Setup & Running Instructions

### 4.1 Backend Setup & Execution
Requirements: Python 3.11+ and `uv` (recommended) or standard `pip`.

```bash
cd backend

# Option A: Fast runner with uv (recommended)
uv run --python 3.11 --with-requirements requirements.txt uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Option B: Standard virtualenv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive OpenAPI documentation is live at: `http://localhost:8000/docs`.

### 4.2 Mobile Client Setup (React Native Expo SDK 54)
Requirements: Node.js 18+ and `bun` or `npm`.

```bash
cd mobile

# Install dependencies
bun install   # or: npm install

# Start Expo development server
bun run start # or: npx expo start
```
Scan the displayed QR code with the **Expo Go** app on Android or iOS.

---

## 5. Automated Verification & Testing

### 5.1 Backend Test Suite (11 / 11 Passed)
Runs all unit and integration tests (CartoDEM snapping, velocity clamping, party lifecycle, EXIF spatial interpolation, and API endpoints):
```bash
cd backend
uv run --python 3.11 --with-requirements requirements.txt pytest -v
```

### 5.2 Mobile Unit Test Suite (7 / 7 Passed)
Runs pure TypeScript unit tests for multi-format track parsing (.gpx, .tcx) and 31-byte BLE packet encoding/decoding:
```bash
cd mobile
bun test
```

### 5.3 Mobile Type Checking
Verifies that all TypeScript types compile without errors:
```bash
cd mobile
bun x tsc --noEmit
```

---

## 6. Key Features & Engineering Highlights

- **Live Hardware GPS Telemetry & Compass**: The `RECORD` tab streams real-time coordinates using `expo-location` (`watchPositionAsync`), calculates distances via the Haversine formula, monitors climbing velocity, displays compass azimuth (`watchHeadingAsync`), draws a live elevation sparkline bar chart, and automatically persists completed tracks into local SQLite storage.
- **Multi-Source Topo Base Layer Switcher**: The `TOPO MAP` tab features an instant tactile base layer selector:
  - `TOPO`: OpenTopoMap 20m/100m elevation contours.
  - `SAT`: High-resolution Esri World Satellite Imagery for scouting terrain.
  - `BASALT`: CartoDB Dark Matter for high-contrast OLED night mode.
  - `OSM`: OpenStreetMap Standard.
  - Injected SVG offline fallback tiles so maps never display broken icons in dead zones.
- **Survey of India (SOI) Toposheet Synthesis**: Client-side mathematical engine converts 1:50,000 degree sheets (e.g. `53J/1`, `78O/5`, skipping 'I') into authentic SVG raster sheets with 20m contours, streams, and automatically extracts candidate ridgeline and valley trails.
- **One-Tap GPX 1.1 Export & Sharing**: Club members can inspect any imported or recorded trail and share it as a GPX 1.1 file (with Garmin `<gpxtpx:hr>` extensions) via `expo-sharing` directly to WhatsApp, Strava, or Garmin Connect.
- **P2P BLE Mesh Codec**: Implements 31-byte binary BLE advertising packets (`[2B Length][4B UUID][4B Party][4B MsgID][1B Type_TTL][16B Payload]`) with 500-entry LRU deduplication, multi-hop relay, and chunking.
- **CartoDEM Elevation Snapping**: Backend engine limits vertical speed to $< 1500\text{ m/hr}$ ($0.4167\text{ m/s}$), preventing multi-path GPS cliff errors, and applies Savitzky-Golay filtering.
