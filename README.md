# TrekIndia: Offline-First Indian Trekking Platform 🏔️
### Tactical Field-Instrument Topographical Engine & P2P Expedition Mesh

[![Python](https://img.shields.io/badge/Python-3.11+-171D19?style=for-the-badge&logo=python&logoColor=4ADE80)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-171D19?style=for-the-badge&logo=fastapi&logoColor=38BDF8)](https://fastapi.tiangolo.com)
[![Flutter](https://img.shields.io/badge/Flutter-3.22+-171D19?style=for-the-badge&logo=flutter&logoColor=FF5500)](https://flutter.dev)
[![PostGIS](https://img.shields.io/badge/PostGIS-3.4+-171D19?style=for-the-badge&logo=postgresql&logoColor=D99B26)](https://postgis.net)
[![GDAL](https://img.shields.io/badge/GDAL-3.8+-171D19?style=for-the-badge&logo=osgeo&logoColor=F4EFE6)](https://gdal.org)

---

## 1. Executive Summary & Design Ethos

**TrekIndia** is a production-grade, offline-first tactical navigation and expedition telemetry platform engineered specifically for the unforgiving conditions of the Indian Himalayas (Pir Panjal, Zanskar, Garhwal, Kumaon, and Eastern Himalayas).

Unlike generic SaaS fitness apps that depend on continuous 4G/5G connectivity and deploy pastel Material 3 interfaces illegible under high-altitude alpine sunlight, **TrekIndia** is constructed around two uncompromising principles:
1. **Total Zero-Signal Autonomy**: Full topographical mapping, peer-to-peer telemetry, health metrics aggregation, and delta media synchronization operate with zero cellular connectivity via BLE advertisement mesh and ad-hoc local Wi-Fi ("Camp Sync").
2. **Tactile Himalayan Field-Instrument UI**: Inspired by **Vintage Survey of India (SOI) Cartography (1:50,000 Open Series Maps)** and rugged tactile outdoor instruments (**Garmin Marq**, **Teenage Engineering OP-1/TX-6**). Built with zero standard Material 3 purple buttons or soft-shadow white cards; every component uses high-contrast OLED basalt backgrounds, knurled thumb-wheel vernier scales, mechanical toggles, graticule corner stamps (`+`), and tabular monospace telemetry.

---

## 2. Monorepo Architecture Directory Tree

```
trekindia/
├── README.md                      # Comprehensive setup, architecture, and run instructions
├── CONTEXT.md                     # System state, DB schemas, design tokens, progress tracker
├── SKILL.md                       # Domain invariants, geospatial math, BLE packet specs, UI rules
├── backend/                       # Python 3.11+ FastAPI Geospatial & Telemetry Service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # FastAPI lifecycle, middleware, route registration
│   │   ├── config.py              # Pydantic v2 Settings (PostGIS, R2/S3, Strava, JWT)
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── database.py        # Async SQLAlchemy engine & session maker
│   │   │   ├── models.py          # PostGIS Declarative models (Geometry LinestringZ, PointZ)
│   │   │   └── migrations/        # Alembic / SQL migration scripts
│   │   ├── geo/
│   │   │   ├── __init__.py
│   │   │   ├── cartodem.py        # ISRO CartoDEM Bilinear interpolation & Savitzky-Golay filter
│   │   │   ├── soi_pipeline.py    # SOI 1:50k PDF 4-corner GCP georeferencer & MBTiles exporter
│   │   │   ├── overpass_harvester.py # OSM Overpass QL harvester for Himalayan trails & huts
│   │   │   └── routes.py          # /api/v1/elevation/snap, /api/v1/geo/soi, /api/v1/geo/harvest
│   │   ├── party/
│   │   │   ├── __init__.py
│   │   │   ├── state_machine.py   # TrekParty state machine (planning->active->sync->archived)
│   │   │   ├── exif_spatial.py    # Photo EXIF DateTimeOriginal to GPX timestamp interpolation
│   │   │   ├── tus_storage.py     # Cloudflare R2 / S3 TUS resumable chunked protocol
│   │   │   ├── poster_generator.py # 3D Topographic Expedition Poster raster/SVG generator
│   │   │   └── routes.py          # /api/v1/party CRUD, media sync, poster download
│   │   └── schemas/
│   │       ├── __init__.py
│   │       ├── geo_schemas.py     # Pydantic v2 schemas for elevation snapping & georeferencing
│   │       └── party_schemas.py   # Pydantic v2 schemas for parties, members, media, and P2P pings
│   ├── tests/
│   │   ├── test_cartodem.py
│   │   ├── test_soi_pipeline.py
│   │   └── test_party.py
│   ├── Dockerfile
│   └── requirements.txt
└── mobile/                        # Flutter High-Performance Mobile Client
    ├── pubspec.yaml
    ├── lib/
    │   ├── main.dart              # Entrypoint, orientation lock, theme bootstrapping
    │   ├── theme/
    │   │   ├── field_tokens.dart  # Bespoke color palette, typography & tactile dimensions
    │   │   └── app_theme.dart     # Dark basalt theme definition, graticule decorations
    │   ├── widgets/
    │   │   └── field_instruments/
    │   │       ├── vernier_opacity_dial.dart      # CustomPainter knurled thumb-wheel with haptics
    │   │       ├── elevation_scrubbing_graph.dart # Spline area graph with altitude polaroids
    │   │       ├── campfire_mesh_radar.dart       # Sonar radar with RSSI nodes & audio cassette
    │   │       ├── soi_grid_stamp_card.dart       # Vintage SOI index card with graticule ticks
    │   │       └── knurled_hardware_button.dart   # Tactile hardware push-button / rocker switch
    │   ├── map/
    │   │   ├── map_screen.dart    # MapLibre 2D/3D vector contours + SOI raster overlay
    │   │   └── offline_tile_cache.dart # Offline vector & raster tile manager
    │   ├── tracker/
    │   │   ├── unified_collector.dart # Phone GNSS + BLE Heart Rate GATT (0x180D/0x2A37)
    │   │   ├── health_bridge.dart     # Health Connect / HealthKit ExerciseRoute reconstructor
    │   │   ├── gpx_compiler.dart      # GPX 1.1 serializer with Garmin gpxtpx:TrackPointExtension
    │   │   └── strava_uploader.dart   # Resilient Strava API v3 multipart uploader
    │   ├── p2p/
    │   │   ├── ble_mesh_protocol.dart # 31-byte binary packet, LRU cache, jitter relay
    │   │   └── camp_sync_server.dart  # Embedded Shelf HTTP/WS server (port 8080) & QR badge
    │   ├── party/
    │   │   ├── party_manager.dart     # Party state machine, EXIF spatial pin, local queue
    │   │   └── tus_uploader_client.dart # Resumable chunked upload client
    │   └── screens/
    │       ├── dashboard_screen.dart  # Instrument dashboard with altimeter & SOS
    │       └── radar_screen.dart      # Campfire mesh radar & voice memo recorder
    └── assets/
        ├── fonts/
        └── topo/
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

# GDAL & Topographical Data
CARTODEM_VRT_PATH=/var/data/cartodem/cartodem_himalayas.vrt
SOI_STORAGE_DIR=/var/data/soi_sheets
TILE_OUTPUT_DIR=/var/data/tiles

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

## 4. System Prerequisites & Installation

### 4.1 System GDAL & PostGIS (Ubuntu / Debian)
```bash
sudo apt-get update
sudo apt-get install -y \
    gdal-bin \
    libgdal-dev \
    python3-gdal \
    postgresql-16 \
    postgresql-16-postgis-3 \
    libspatialindex-dev

# Initialize PostGIS Extension
sudo -u postgres psql -c "CREATE USER trekindia WITH PASSWORD 'alpine_pass_2026';"
sudo -u postgres psql -c "CREATE DATABASE trekindia_db OWNER trekindia;"
sudo -u postgres psql -d trekindia_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
sudo -u postgres psql -d trekindia_db -c "CREATE EXTENSION IF NOT EXISTS postgis_topology;"
```

### 4.2 Backend Setup & Execution
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run Database Migrations
alembic upgrade head

# Start FastAPI Geospatial Engine
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be accessible at: `http://localhost:8000/docs`.

### 4.3 Mobile Client Setup (Flutter)
```bash
cd mobile

# Install Flutter dependencies
flutter pub get

# Platform-specific permissions:
# - Android: android.permission.ACCESS_FINE_LOCATION, BLUETOOTH_SCAN, BLUETOOTH_ADVERTISE, CHANGE_WIFI_MULTICAST_STATE
# - iOS: NSBluetoothAlwaysUsageDescription, NSLocationAlwaysAndWhenInUseUsageDescription

# Run on Physical Device (recommended for BLE Mesh and Shelf Hotspot testing)
flutter run -d <device_id>
```

---

## 5. Automated Verification & Testing

To execute the backend geospatial validation suite (CartoDEM interpolation, Savitzky-Golay smoothing, SOI georeferencing, P2P packet serialization):
```bash
cd backend
pytest tests/ -v
```

---

## 6. Architecture Highlights & Engineering Guarantees
- **No Data Void Altitude Errors**: If a CartoDEM tile contains missing values or satellite ocean masks, the snapping engine gracefully falls back to barometric altitude readings and limits climb speeds to `< 1500 m/hr`.
- **Zero Cloud Strava Map Recovery**: When smartwatches sync without GPS trackpoints, TrekIndia's unified Health Connect bridge matches high-resolution phone GPS with wearable HR samples to rebuild pristine GPX 1.1 files with Garmin `<gpxtpx:hr>` extensions.
- **Mesh Duty Cycle**: BLE background scanning uses 1.5s active / 8s sleep cycles, preserving battery over 14-hour Himalayan alpine push days.
- **Camp Sync Hotspot Bandwidth**: Local P2P Wi-Fi delta sync transfers uncompressed RAW photos and Opus audio files between squad members at 20-40 MB/s completely off-grid.
