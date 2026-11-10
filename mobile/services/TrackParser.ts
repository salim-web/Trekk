import { XMLParser } from 'fast-xml-parser';

export interface ParsedTrackpoint {
  latitude: number;
  longitude: number;
  elevation: number;
  timestamp?: string;
  heartRate?: number;
}

export interface ParsedTrack {
  id?: string;
  name: string;
  sourceFormat: 'gpx' | 'tcx' | 'fit';
  points: ParsedTrackpoint[];
  distanceKm: number;
  elevationGainM: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  averageHeartRate?: number;
  startTime?: string;
  endTime?: string;
}

export class TrackParserService {
  /**
   * Parses .gpx, .tcx or binary .fit file data.
   */
  static parseTrack(fileName: string, contentStrOrBytes: string | Uint8Array): ParsedTrack {
    const lower = fileName.toLowerCase();

    if (lower.endsWith('.gpx') || (typeof contentStrOrBytes === 'string' && contentStrOrBytes.includes('<gpx'))) {
      return this.parseGpx(typeof contentStrOrBytes === 'string' ? contentStrOrBytes : new TextDecoder().decode(contentStrOrBytes), fileName);
    } else if (lower.endsWith('.tcx') || (typeof contentStrOrBytes === 'string' && contentStrOrBytes.includes('<TrainingCenterDatabase'))) {
      return this.parseTcx(typeof contentStrOrBytes === 'string' ? contentStrOrBytes : new TextDecoder().decode(contentStrOrBytes), fileName);
    } else if (lower.endsWith('.fit') || contentStrOrBytes instanceof Uint8Array) {
      return this.parseFit(typeof contentStrOrBytes === 'string' ? new TextEncoder().encode(contentStrOrBytes) : contentStrOrBytes, fileName);
    } else {
      // Default to GPX attempt
      return this.parseGpx(typeof contentStrOrBytes === 'string' ? contentStrOrBytes : new TextDecoder().decode(contentStrOrBytes), fileName);
    }
  }

  static parseGpx(xmlString: string, defaultName = 'Imported Track'): ParsedTrack {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
    });

    const parsed = parser.parse(xmlString);
    const points: ParsedTrackpoint[] = [];

    let trackName = defaultName.replace(/\.[^/.]+$/, '');
    const gpx = parsed.gpx || parsed;

    if (gpx.trk?.name) {
      trackName = String(gpx.trk.name);
    } else if (gpx.metadata?.name) {
      trackName = String(gpx.metadata.name);
    }

    // Traverse trk -> trkseg -> trkpt
    let trkpts: any[] = [];
    if (gpx.trk) {
      const trkArray = Array.isArray(gpx.trk) ? gpx.trk : [gpx.trk];
      for (const t of trkArray) {
        if (!t) continue;
        if (t.trkseg) {
          const trksegArray = Array.isArray(t.trkseg) ? t.trkseg : [t.trkseg];
          for (const seg of trksegArray) {
            if (!seg) continue;
            if (seg.trkpt) {
              const pts = Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt];
              trkpts.push(...pts);
            }
          }
        } else if (t.trkpt) {
          // Direct trkpt under trk without trkseg
          const pts = Array.isArray(t.trkpt) ? t.trkpt : [t.trkpt];
          trkpts.push(...pts);
        }
      }
    } else if (gpx.rte?.rtept) {
      trkpts = Array.isArray(gpx.rte.rtept) ? gpx.rte.rtept : [gpx.rte.rtept];
    } else if (gpx.wpt) {
      trkpts = Array.isArray(gpx.wpt) ? gpx.wpt : [gpx.wpt];
    }

    for (const pt of trkpts) {
      if (!pt) continue;
      const rawLat = pt['@_lat'] ?? pt['@_latitude'] ?? pt.lat ?? pt.latitude;
      const rawLon = pt['@_lon'] ?? pt['@_longitude'] ?? pt.lon ?? pt.longitude;
      const lat = parseFloat(rawLat);
      const lon = parseFloat(rawLon);
      if (isNaN(lat) || isNaN(lon)) continue;

      const rawEle = pt.ele ?? pt.elevation ?? pt['@_ele'];
      const ele = rawEle !== undefined ? parseFloat(String(rawEle)) : 0;
      const time = pt.time ? String(pt.time) : undefined;

      // Extract HR from <gpxtpx:TrackPointExtension><gpxtpx:hr> or <ns3:hr> or <hr>
      let hr: number | undefined;
      if (pt.extensions) {
        const ext = pt.extensions;
        const tpx = ext['gpxtpx:TrackPointExtension'] ?? ext['ns3:TrackPointExtension'] ?? ext.TrackPointExtension ?? ext;
        const hrVal = tpx['gpxtpx:hr'] ?? tpx['ns3:hr'] ?? tpx.hr ?? ext.hr ?? ext['@_hr'];
        if (hrVal !== undefined) {
          const parsedHr = parseInt(String(hrVal), 10);
          if (!isNaN(parsedHr)) hr = parsedHr;
        }
      }

      points.push({
        latitude: lat,
        longitude: lon,
        elevation: isNaN(ele) ? 0 : ele,
        timestamp: time,
        heartRate: hr,
      });
    }

    return this.calculateMetrics(points, trackName, 'gpx');
  }

  static parseTcx(xmlString: string, defaultName = 'Imported Activity'): ParsedTrack {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
    });

    const parsed = parser.parse(xmlString);
    const points: ParsedTrackpoint[] = [];
    let trackName = defaultName.replace(/\.[^/.]+$/, '');

    const root = parsed.TrainingCenterDatabase || parsed;
    const activities = root.Activities?.Activity;
    const activityArray = Array.isArray(activities) ? activities : activities ? [activities] : [];

    for (const act of activityArray) {
      if (act.Id) trackName = `Trek ${act['@_Sport'] || 'Hike'} (${act.Id})`;

      const laps = Array.isArray(act.Lap) ? act.Lap : act.Lap ? [act.Lap] : [];
      for (const lap of laps) {
        const track = lap.Track;
        const tps = Array.isArray(track?.Trackpoint) ? track.Trackpoint : track?.Trackpoint ? [track.Trackpoint] : [];

        for (const tp of tps) {
          const pos = tp.Position;
          if (!pos) continue;

          const lat = parseFloat(pos.LatitudeDegrees);
          const lon = parseFloat(pos.LongitudeDegrees);
          if (isNaN(lat) || isNaN(lon)) continue;

          const ele = tp.AltitudeMeters ? parseFloat(tp.AltitudeMeters) : 0;
          const time = tp.Time ? String(tp.Time) : undefined;
          const hrVal = tp.HeartRateBpm?.Value;
          const hr = hrVal ? parseInt(String(hrVal), 10) : undefined;

          points.push({
            latitude: lat,
            longitude: lon,
            elevation: isNaN(ele) ? 0 : ele,
            timestamp: time,
            heartRate: isNaN(hr as number) ? undefined : hr,
          });
        }
      }
    }

    return this.calculateMetrics(points, trackName, 'tcx');
  }

  static parseFit(bytes: Uint8Array, defaultName = 'Garmin FIT Track'): ParsedTrack {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const points: ParsedTrackpoint[] = [];
    const trackName = defaultName.replace(/\.[^/.]+$/, '');

    if (bytes.length < 14) {
      return this.calculateMetrics([], trackName, 'fit');
    }

    const headerSize = view.getUint8(0);
    const dataSize = view.getUint32(4, true);
    const semicirclesToDegrees = 180.0 / 2147483648.0;
    const fitEpochOffsetSeconds = 631065600; // Dec 31 1989 UTC

    let offset = headerSize;
    const end = Math.min(bytes.length, headerSize + dataSize);
    const localDefs: Record<number, { globalMsgNum: number; littleEndian: boolean; fields: { fieldNum: number; size: number }[]; totalSize: number }> = {};

    while (offset < end - 1) {
      const headerByte = view.getUint8(offset++);
      const isDef = (headerByte & 0x40) !== 0;
      const localType = headerByte & 0x0f;

      if (isDef) {
        if (offset + 5 > bytes.length) break;
        const littleEndian = view.getUint8(offset + 1) === 0;
        const globalNum = view.getUint16(offset + 2, littleEndian);
        const numFields = view.getUint8(offset + 4);
        offset += 5;

        const fields: { fieldNum: number; size: number }[] = [];
        let totalSize = 0;
        for (let i = 0; i < numFields; i++) {
          if (offset + 3 > bytes.length) break;
          const fNum = view.getUint8(offset);
          const fSize = view.getUint8(offset + 1);
          offset += 3;
          fields.push({ fieldNum: fNum, size: fSize });
          totalSize += fSize;
        }

        localDefs[localType] = { globalMsgNum: globalNum, littleEndian, fields, totalSize };
      } else {
        const def = localDefs[localType];
        if (!def) break;
        if (offset + def.totalSize > bytes.length) break;

        if (def.globalMsgNum === 20) {
          // Record message
          let lat: number | undefined;
          let lon: number | undefined;
          let ele = 0;
          let hr: number | undefined;
          let timestamp: string | undefined;

          let fOffset = offset;
          for (const f of def.fields) {
            if (f.fieldNum === 0 && f.size === 4) {
              const raw = view.getInt32(fOffset, def.littleEndian);
              if (raw !== 0x7fffffff) lat = raw * semicirclesToDegrees;
            } else if (f.fieldNum === 1 && f.size === 4) {
              const raw = view.getInt32(fOffset, def.littleEndian);
              if (raw !== 0x7fffffff) lon = raw * semicirclesToDegrees;
            } else if (f.fieldNum === 2 && f.size === 2) {
              const raw = view.getUint16(fOffset, def.littleEndian);
              if (raw !== 0xffff) ele = raw / 5.0 - 500.0;
            } else if (f.fieldNum === 3 && f.size === 1) {
              const raw = view.getUint8(fOffset);
              if (raw !== 0xff && raw > 30 && raw < 250) hr = raw;
            } else if (f.fieldNum === 253 && f.size === 4) {
              const raw = view.getUint32(fOffset, def.littleEndian);
              if (raw !== 0xffffffff) {
                timestamp = new Date((raw + fitEpochOffsetSeconds) * 1000).toISOString();
              }
            }
            fOffset += f.size;
          }

          if (lat !== undefined && lon !== undefined && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            points.push({ latitude: lat, longitude: lon, elevation: ele, heartRate: hr, timestamp });
          }
        }
        offset += def.totalSize;
      }
    }

    return this.calculateMetrics(points, trackName, 'fit');
  }

  /**
   * Generates a realistic multi-point GPX 1.1 XML string for testing without I/O.
   */
  static generateSampleXiaomiBandGpx(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Xiaomi Smart Band 9 - Mi Fitness" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata>
    <name>Kedarkantha Alpine Push (Xiaomi Smart Band 9)</name>
    <time>2026-11-10T06:00:00Z</time>
  </metadata>
  <trk>
    <name>Kedarkantha Alpine Push (Xiaomi Smart Band 9)</name>
    <type>hiking</type>
    <trkseg>
      <trkpt lat="31.0772" lon="78.1831"><ele>1950.0</ele><time>2026-11-10T06:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>112</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="31.0735" lon="78.1895"><ele>2240.0</ele><time>2026-11-10T06:30:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>128</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="31.0698" lon="78.1942"><ele>2510.0</ele><time>2026-11-10T07:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>139</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="31.0665" lon="78.1982"><ele>2770.0</ele><time>2026-11-10T07:30:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>146</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="31.0590" lon="78.2020"><ele>3050.0</ele><time>2026-11-10T08:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>154</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="31.0520" lon="78.2055"><ele>3260.0</ele><time>2026-11-10T08:30:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>160</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="31.0460" lon="78.2045"><ele>3430.0</ele><time>2026-11-10T09:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>164</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="31.0385" lon="78.1950"><ele>3590.0</ele><time>2026-11-10T09:30:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>169</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="31.0310" lon="78.1840"><ele>3710.0</ele><time>2026-11-10T10:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>173</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="31.0238" lon="78.1722"><ele>3810.0</ele><time>2026-11-10T10:30:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>178</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
    </trkseg>
  </trk>
</gpx>`;
  }

  /**
   * Generates a sample Xiaomi Smart Band GPX file so users can test immediately.
   */
  static getSampleXiaomiBandGpx(): ParsedTrack {
    const samplePoints: ParsedTrackpoint[] = [
      { latitude: 31.0772, longitude: 78.1831, elevation: 1950.0, heartRate: 112, timestamp: '2026-11-10T06:00:00Z' },
      { latitude: 31.0710, longitude: 78.1910, elevation: 2310.0, heartRate: 138, timestamp: '2026-11-10T06:45:00Z' },
      { latitude: 31.0665, longitude: 78.1982, elevation: 2770.0, heartRate: 145, timestamp: '2026-11-10T07:30:00Z' },
      { latitude: 31.0550, longitude: 78.2015, elevation: 3150.0, heartRate: 156, timestamp: '2026-11-10T08:15:00Z' },
      { latitude: 31.0460, longitude: 78.2045, elevation: 3430.0, heartRate: 162, timestamp: '2026-11-10T09:00:00Z' },
      { latitude: 31.0340, longitude: 78.1890, elevation: 3620.0, heartRate: 168, timestamp: '2026-11-10T09:45:00Z' },
      { latitude: 31.0238, longitude: 78.1722, elevation: 3810.0, heartRate: 174, timestamp: '2026-11-10T10:30:00Z' },
    ];

    return this.calculateMetrics(samplePoints, 'Kedarkantha Alpine Push (Xiaomi Smart Band 9)', 'gpx');
  }

  private static calculateMetrics(points: ParsedTrackpoint[], name: string, format: 'gpx' | 'tcx' | 'fit'): ParsedTrack {
    if (points.length === 0) {
      return {
        name,
        sourceFormat: format,
        points: [],
        distanceKm: 0,
        elevationGainM: 0,
        maxAltitudeM: 0,
        minAltitudeM: 0,
      };
    }

    let distKm = 0;
    let gainM = 0;
    let maxAlt = points[0].elevation;
    let minAlt = points[0].elevation;
    let hrSum = 0;
    let hrCount = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.elevation > maxAlt) maxAlt = p.elevation;
      if (p.elevation < minAlt) minAlt = p.elevation;

      if (p.heartRate) {
        hrSum += p.heartRate;
        hrCount += 1;
      }

      if (i > 0) {
        const prev = points[i - 1];
        distKm += this.haversine(prev.latitude, prev.longitude, p.latitude, p.longitude);
        const dEle = p.elevation - prev.elevation;
        if (dEle > 0) gainM += dEle;
      }
    }

    return {
      name,
      sourceFormat: format,
      points,
      distanceKm: parseFloat(distKm.toFixed(2)),
      elevationGainM: Math.round(gainM),
      maxAltitudeM: Math.round(maxAlt),
      minAltitudeM: Math.round(minAlt),
      averageHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : undefined,
      startTime: points[0].timestamp,
      endTime: points[points.length - 1].timestamp,
    };
  }

  private static haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
