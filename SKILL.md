# TrekIndia Engineering Skill & Domain Invariants 🧗‍♂️

This document serves as the permanent domain and technical specification manual for any engineer or AI assistant working within the `TrekIndia` monorepo. All rules, mathematical formulas, binary packet structures, and anti-generic UI guardrails defined here must be strictly respected.

---

## 1. Strict Anti-Generic UI/UX Design Guardrails (BAN LIST & RULES)

### 1.1 The Anti-Generic Ban List
Under **NO circumstances** may any of the following standard web/mobile UI clichés be introduced into `mobile/`:
- ❌ **NO default Material 3 dynamic color schemes** (no pastel purples, soft lavenders, tonal light-blues).
- ❌ **NO rounded white cards with fuzzy drop shadows** (`BoxShadow(blurRadius: 16, color: Colors.black12)` is banned).
- ❌ **NO generic Floating Action Buttons** (circular FAB with a plus icon in bottom right).
- ❌ **NO generic bottom navigation bars** with standard outline/fill home/search/profile icons.
- ❌ **NO smooth modern mobile sliders** for technical geospatial controls.
- ❌ **NO generic spinners/circular progress indicators** without technical calibration ticks or mechanical meter feedback.

### 1.2 The Tactile Field-Instrument Guardrails
Every screen, widget, and interaction must look and feel like a precision military or alpine surveying device:
1. **Chamfered & Knurled Surfaces**:
   - Card borders must use sharp corners or 2-4px precision micro-radii with 1px solid high-contrast borders (`#25302A` on `#0F1210`).
   - Interactive handles must display tactile serrations / knurling ticks rendered via `CustomPainter`.
2. **Tabular Monospace Telemetry**:
   - Coordinates (`30°44'04.2"N 79°04'02.3"E`), altitude (`3,820 m`), climb rate (`+320 m/h`), heart rate (`142 bpm`), and BLE RSSI (`-64 dBm`) MUST be styled with `FontFeature.tabularFigures()` using `JetBrains Mono`. Digits must never shift layout when changing.
3. **Physical Mechanical Haptics**:
   - Every 5% step on the Vernier dial, every scrubber tick on the elevation chart, and every push-button press MUST trigger `HapticFeedback.selectionClick()` or `HapticFeedback.heavyImpact()`.
4. **Survey of India (SOI) Cartographic Aesthetics**:
   - Headers and stamped index cards must emulate vintage Survey of India 1:50,000 sheets:
     - Graticule corner crosshairs (`+`) at `(0,0)`, `(w,0)`, `(0,h)`, `(w,h)`.
     - Sheet indices (e.g., `SHEET 53J/3 (GARHWAL HIMALAYAS)`).
     - Contour elevation stamps in sepia ochre (`#D99B26`) on parchment (`#F4EFE6`).

---

## 2. Geospatial Mathematics & Topographical Invariants

### 2.1 Coordinate Reference Systems (CRS)
- **Database & Storage**: `EPSG:4326` (WGS 84, Lat/Lon/Ellipsoidal or Orthometric Height in meters).
- **Map Tile Projection**: `EPSG:3857` (Web Mercator) for XYZ and MBTiles raster/vector rendering.
- **CartoDEM GeoTIFFs**: ISRO CartoDEM v3 R1 is distributed in Geographic Lat/Lon (`EPSG:4326`) with 1 arc-second (~30m) grid cell spacing.

### 2.2 2D Bilinear Interpolation
For a query point $(x, y)$ inside the 4-pixel cell $[x_1, x_2] \times [y_1, y_2]$ with corner elevation values $Q_{11}=(x_1, y_1), Q_{12}=(x_1, y_2), Q_{21}=(x_2, y_1), Q_{22}=(x_2, y_2)$:
$$f(x, y) \approx \frac{1}{(x_2 - x_1)(y_2 - y_1)} \begin{bmatrix} x_2 - x & x - x_1 \end{bmatrix} \begin{bmatrix} f(Q_{11}) & f(Q_{12}) \\ f(Q_{21}) & f(Q_{22}) \end{bmatrix} \begin{bmatrix} y_2 - y \\ y - y_1 \end{bmatrix}$$

### 2.3 Savitzky-Golay Elevation Smoothing
To eliminate step-quantization from DEM raster grids while preserving acute ridge peaks and col valleys:
- **Window length**: $N = 11$ points.
- **Polynomial order**: $p = 2$.
- **Formula**:
  $$Y_j = \sum_{i=-\frac{N-1}{2}}^{\frac{N-1}{2}} C_i \cdot y_{j+i}$$
  where $C_i$ are Savitzky-Golay convolution coefficients derived by least-squares polynomial fitting.

### 2.4 Altitude Rate of Climb (Velocity Clamping)
Himalayan mountaineers on foot climb at an absolute physical ceiling of $\approx 800 - 1000\text{ m/hour}$. Even extreme mountain runners rarely exceed $1200\text{ m/hour}$.
- **Invariant**:
  $$\left|\frac{\Delta \text{ele}}{\Delta t}\right| \le 1500\text{ m/hour} \quad \left(0.4167\text{ m/second}\right)$$
- If point $k$ exhibits $|\Delta \text{ele} / \Delta t| > 0.4167\text{ m/s}$, the altitude is flagged as an invalid multipath artifact and clamped:
  $$\text{ele}_k = \text{ele}_{k-1} + \text{sign}(\Delta \text{ele}) \cdot 0.4167 \cdot \Delta t$$

### 2.5 SOI 15' x 15' Graticule Georeferencing
Survey of India 1:50,000 Open Series Maps (OSM) cover exactly 15 minutes of latitude by 15 minutes of longitude.
- A sheet such as `53J/3` has known mathematical corner coordinates:
  - $\text{Lat}_{\min} = 30^\circ 15' \text{ N}$, $\text{Lat}_{\max} = 30^\circ 30' \text{ N}$
  - $\text{Lon}_{\min} = 78^\circ 00' \text{ E}$, $\text{Lon}_{\max} = 78^\circ 15' \text{ E}$
- In the pipeline, 4 Ground Control Points (GCPs) at the inner neatline corners map pixel coordinates $(u, v)$ to $(lon, lat)$. The warp uses **Thin Plate Spline (TPS)** interpolation with bilinear resampling and an alpha channel mask to erase map sheet collars.

---

## 3. BLE 31-Byte Mesh Packet Specification

Bluetooth Low Energy advertisements have an effective payload ceiling of 31 bytes in legacy advertising packets. To ensure 100% interoperability across iOS and Android hardware without requiring active GATT connections, every packet conforms strictly to this memory layout:

```
+-------+--------+-------------+------------+----------+--------------------+
| Bytes | Size   | Field Name  | Type       | Endian   | Description        |
+-------+--------+-------------+------------+----------+--------------------+
| 0..1  | 2 B    | PacketLen   | uint16     | Big      | Total packet size  |
| 2..5  | 4 B    | ServiceUUID | uint32     | Big      | 0x5452454B ("TREK")|
| 6..9  | 4 B    | PartyHash   | uint32     | Big      | CRC32 of Party ID  |
| 10..13| 4 B    | MessageID   | uint32     | Big      | Monotonic Sequence |
| 14    | 1 B    | MsgType/TTL | uint8      | -        | [4b Type][4b TTL]  |
| 15..30| 16 B   | Payload     | byte[16]   | -        | Sub-type payload   |
+-------+--------+-------------+------------+----------+--------------------+
```

### 3.1 Field Encodings
- **MsgType (High 4 bits of Byte 14)**:
  - `0x1`: **Location Ping** (`lat` 4B float, `lon` 4B float, `ele` 2B uint16, `battery` 1B uint8, `status` 1B uint8, `reserved` 4B).
  - `0x2`: **Short Text Message** (`16B UTF-8` truncated or compressed).
  - `0x3`: **SOS Alert** (`lat` 4B float, `lon` 4B float, `sos_code` 1B [1: Medical, 2: Lost, 3: Avalanche], `sender_short_id` 2B, `timestamp` 4B, `reserved` 1B).
  - `0x4`: **Media Queued Notice** (`sha256_prefix` 8B, `size_kb` 2B uint16, `sender_id` 4B, `type` 2B).
- **TTL (Low 4 bits of Byte 14)**:
  - Initial value: `0x4` (max 4 hops).
  - Decremented by 1 at each retransmitting peer. Discarded if $\text{TTL} \le 1$.
- **Relay & Deduplication Rules**:
  - Keep an in-memory 500-item LRU cache of recently seen `MessageID`s.
  - If `MessageID` is present in cache: **DROP IMMEDIATELY**.
  - If new: Insert into cache, process local notification, decrement TTL, and if $\text{TTL} > 0$, rebroadcast with a randomized jitter delay between $50\text{ ms}$ and $200\text{ ms}$ to avoid radio collision.
- **Duty Cycle**:
  - Active Scanning: `1500 ms`
  - Sleep Window: `8000 ms`

---

## 4. Camp Sync HTTP/WS Protocol (Basecamp Hotspot)

When party members congregate at evening camp, the Expedition Leader's device creates an ad-hoc Wi-Fi hotspot and starts an embedded `shelf` HTTP + WebSocket daemon on port `8080`.

### 4.1 Connection Sequence
1. Leader displays an ASCII/Vector **Field-Badge QR Code** containing:
   `TREK:CAMP;SSID=TrekIndia_53J3;PASS=alpine789;IP=192.168.43.1;PORT=8080;PARTY=<party_uuid>`
2. Trekkers scan the QR code -> device automatically joins the Wi-Fi hotspot.
3. Trekker issues `POST /api/v1/camp-sync/diff` with their local SQLite media SHA-256 hashes.
4. Server replies with lists of `missing_from_client` and `missing_from_server`.
5. Client downloads missing media in binary streams via `GET /api/v1/camp-sync/download/{hash}` and uploads its captured photos via `POST /api/v1/camp-sync/upload`.
6. Transfer throughput: 20-40 MB/s on 5GHz 802.11ac local hotspot without internet.

---

## 5. Wearable HR GATT (0x180D) & GPX 1.1 Specification

### 5.1 Heart Rate Measurement Characteristic (`0x2A37`)
- **Flags byte (Byte 0)**:
  - Bit 0: Heart Rate Value Format (`0` = uint8 bpm, `1` = uint16 bpm).
  - Bit 3: Energy Expended Status (`1` = 2 bytes present in bytes 2..3 or 3..4).
  - Bit 4: RR-Intervals present (`1` = 1 or more uint16 RR intervals at end).
- **Extraction Code Pattern**:
  ```dart
  int hr;
  if ((flags & 0x01) == 0) {
    hr = data[1];
  } else {
    hr = data[1] | (data[2] << 8);
  }
  ```

### 5.2 GPX 1.1 with Garmin TrackPointExtension Schema
Each recorded trackpoint MUST be formatted according to the Garmin `gpxtpx` schema extension:
```xml
<trkpt lat="30.734560" lon="79.067340">
  <ele>3534.2</ele>
  <time>2026-11-09T08:14:22Z</time>
  <extensions>
    <gpxtpx:TrackPointExtension>
      <gpxtpx:hr>142</gpxtpx:hr>
    </gpxtpx:TrackPointExtension>
  </extensions>
</trkpt>
```

---

## 6. Photo EXIF-to-GPX Spatial Interpolation Rule

When a photo is taken offline, high-altitude cold may cause the camera sensor to skip GPS locking, but the EXIF `DateTimeOriginal` timestamp is preserved:
1. Extract photo UTC timestamp $T_{\text{photo}}$.
2. Find the two adjacent recorded trackpoints $P_A (T_A, \text{lat}_A, \text{lon}_A, \text{ele}_A)$ and $P_B (T_B, \text{lat}_B, \text{lon}_B, \text{ele}_B)$ such that $T_A \le T_{\text{photo}} \le T_B$.
3. Compute interpolation ratio:
   $$\alpha = \frac{T_{\text{photo}} - T_A}{T_B - T_A}$$
4. Interpolate coordinates and elevation:
   $$\text{lat}_{\text{photo}} = \text{lat}_A + \alpha (\text{lat}_B - \text{lat}_A)$$
   $$\text{lon}_{\text{photo}} = \text{lon}_A + \alpha (\text{lon}_B - \text{lon}_A)$$
   $$\text{ele}_{\text{photo}} = \text{ele}_A + \alpha (\text{ele}_B - \text{ele}_A)$$
5. Pin the photo polaroid marker at $(\text{lat}_{\text{photo}}, \text{lon}_{\text{photo}}, \text{ele}_{\text{photo}})$ on both the 3D map and the interactive elevation scrubbing graph.

---

## 7. Multi-Format Fitness File Ingestion & Android MIME Invariants
- **Android OS DocumentPicker Rule**: Never pass extension strings (e.g. `['.gpx', '.fit', '.tcx']`) into `DocumentPicker.getDocumentAsync({ type })`. Android's Storage Access Framework (SAF) does not have standardized IANA MIME types for GPX, TCX, or FIT, and will crash immediately with `Unsupported filter: .gpx`.
- **Invariant**: Always invoke document pickers with wildcard MIME `type: '*/*'`, verify `asset.name.toLowerCase().endsWith(...)` in application logic, and gracefully notify the user if an invalid format is selected.
- **Semicircles Coordinate Invariant**: Garmin FIT binary files store coordinates as 32-bit signed integers in semicircles. Convert to standard WGS84 decimal degrees using:
  $$\text{degrees} = \text{semicircles} \times \left(\frac{180.0}{2^{31}}\right) = \text{semicircles} \times \left(\frac{180.0}{2147483648}\right)$$

---

## 8. Expo SDK 54 FileSystem & Encoding Invariants
- **Breaking Change in Expo SDK 54**: `expo-file-system` removed the legacy enum `FileSystem.EncodingType`. Calling `FileSystem.EncodingType.UTF8` or `FileSystem.EncodingType.Base64` evaluates to `undefined`, which throws `Cannot read property 'UTF8' of undefined`.
- **Mandatory Legacy Subpath**: Import from `'expo-file-system/legacy'` rather than `'expo-file-system'`:
  ```ts
  import * as FileSystem from 'expo-file-system/legacy';
  ```
- **Strict String-Literal Encoding Invariant**: Always pass lowercase string literals for encoding options:
  - Text files (.gpx, .tcx, .json): `{ encoding: 'utf8' }`
  - Binary files (.fit, images): `{ encoding: 'base64' }`
- **In-Memory Sample Bypass**: Sample generators must parse directly from in-memory string constants rather than writing to disk and reading back, guaranteeing test benches never fail due to mobile filesystem I/O constraints.

