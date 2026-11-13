import * as SQLite from 'expo-sqlite';
import { ParsedTrack } from './TrackParser';

export interface SquadMessageRecord {
  id: string;
  senderName: string;
  senderRole?: string;
  text: string;
  timestamp: string;
  type: 'text' | 'gps' | 'alert' | 'sos' | 'media_notice';
  lat?: number;
  lon?: number;
  ele?: number;
  hops: number;
  rssiDbm?: number;
}

export interface SquadMediaRecord {
  id: string;
  name: string;
  type: 'photo' | 'gpx' | 'voice' | 'doc';
  sizeBytes: number;
  sha256: string;
  senderName: string;
  timestamp: string;
  lat: number;
  lon: number;
  ele: number;
  localUri?: string;
  isSynced: boolean;
}

export class DatabaseService {
  private static db: SQLite.SQLiteDatabase | null = null;
  private static memoryTracks: ParsedTrack[] = [];
  private static memoryMessages: SquadMessageRecord[] = [];
  private static memoryMedia: SquadMediaRecord[] = [];

  static async getDb(): Promise<SQLite.SQLiteDatabase | null> {
    if (this.db) return this.db;
    try {
      this.db = await SQLite.openDatabaseAsync('trekindia_expo.db');
      await this.initTables(this.db);
      return this.db;
    } catch (e) {
      console.warn('SQLite native storage not available (web or fallback), using memory store:', e);
      return null;
    }
  }

  private static async initTables(db: SQLite.SQLiteDatabase) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS UserImportedTrails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sourceFormat TEXT NOT NULL,
        importedAt TEXT NOT NULL,
        distanceKm REAL NOT NULL,
        elevationGainM REAL NOT NULL,
        maxAltitudeM REAL NOT NULL,
        minAltitudeM REAL NOT NULL,
        averageHeartRate INTEGER,
        pointsJson TEXT NOT NULL,
        isSynced INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS SquadMessages (
        id TEXT PRIMARY KEY,
        senderName TEXT NOT NULL,
        senderRole TEXT,
        text TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        lat REAL,
        lon REAL,
        ele REAL,
        hops INTEGER NOT NULL DEFAULT 1,
        rssiDbm INTEGER DEFAULT -65
      );

      CREATE TABLE IF NOT EXISTS SquadSharedMedia (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        sizeBytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        senderName TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        lat REAL NOT NULL,
        lon REAL NOT NULL,
        ele REAL NOT NULL,
        localUri TEXT,
        isSynced INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  // --- TRAILS ---
  static async saveImportedTrack(track: ParsedTrack): Promise<ParsedTrack> {
    const db = await this.getDb();
    const idStr = `imported_${Date.now()}`;
    const trackWithId = { ...track, id: idStr };

    if (!db) {
      this.memoryTracks.unshift(trackWithId);
      return trackWithId;
    }

    try {
      const pointsJson = JSON.stringify(track.points);
      const res = await db.runAsync(
        `INSERT INTO UserImportedTrails 
         (name, sourceFormat, importedAt, distanceKm, elevationGainM, maxAltitudeM, minAltitudeM, averageHeartRate, pointsJson, isSynced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          track.name,
          track.sourceFormat,
          new Date().toISOString(),
          track.distanceKm,
          track.elevationGainM,
          track.maxAltitudeM,
          track.minAltitudeM,
          track.averageHeartRate ?? null,
          pointsJson,
        ]
      );
      trackWithId.id = `imported_${res.lastInsertRowId}`;
      return trackWithId;
    } catch (e) {
      console.error('Error saving track to SQLite:', e);
      throw e;
    }
  }

  static async getImportedTracks(): Promise<ParsedTrack[]> {
    const db = await this.getDb();
    if (!db) return [...this.memoryTracks];

    try {
      const rows = await db.getAllAsync<any>('SELECT * FROM UserImportedTrails ORDER BY id DESC');
      return rows.map((r) => {
        let points = [];
        try {
          points = JSON.parse(r.pointsJson);
        } catch (_) {}
        return {
          id: `imported_${r.id}`,
          name: r.name,
          sourceFormat: r.sourceFormat,
          distanceKm: r.distanceKm,
          elevationGainM: r.elevationGainM,
          maxAltitudeM: r.maxAltitudeM,
          minAltitudeM: r.minAltitudeM,
          averageHeartRate: r.averageHeartRate,
          points,
        };
      });
    } catch (e) {
      console.error('Error fetching tracks from SQLite:', e);
      return [...this.memoryTracks];
    }
  }

  static async deleteImportedTrack(id: string): Promise<void> {
    const db = await this.getDb();
    const numericId = parseInt(id.replace('imported_', ''), 10);

    this.memoryTracks = this.memoryTracks.filter((t) => t.id !== id);

    if (db && !isNaN(numericId)) {
      try {
        await db.runAsync('DELETE FROM UserImportedTrails WHERE id = ?', [numericId]);
      } catch (e) {
        console.error('Error deleting track from SQLite:', e);
      }
    }
  }

  static async deleteTrack(id: string): Promise<void> {
    return this.deleteImportedTrack(id);
  }

  // --- SQUAD MESSAGES ---
  static async saveSquadMessage(msg: SquadMessageRecord): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      this.memoryMessages.unshift(msg);
      return;
    }
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO SquadMessages 
         (id, senderName, senderRole, text, timestamp, type, lat, lon, ele, hops, rssiDbm)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          msg.id,
          msg.senderName,
          msg.senderRole ?? '',
          msg.text,
          msg.timestamp,
          msg.type,
          msg.lat ?? null,
          msg.lon ?? null,
          msg.ele ?? null,
          msg.hops,
          msg.rssiDbm ?? -65,
        ]
      );
    } catch (e) {
      console.error('Error saving squad message:', e);
      this.memoryMessages.unshift(msg);
    }
  }

  static async getSquadMessages(): Promise<SquadMessageRecord[]> {
    const db = await this.getDb();
    if (!db) return [...this.memoryMessages];
    try {
      return await db.getAllAsync<SquadMessageRecord>('SELECT * FROM SquadMessages ORDER BY timestamp ASC');
    } catch (e) {
      console.error('Error fetching squad messages:', e);
      return [...this.memoryMessages];
    }
  }

  // --- SQUAD SHARED MEDIA ---
  static async saveSquadMedia(media: SquadMediaRecord): Promise<void> {
    const db = await this.getDb();
    if (!db) {
      const idx = this.memoryMedia.findIndex((m) => m.id === media.id);
      if (idx >= 0) this.memoryMedia[idx] = media;
      else this.memoryMedia.push(media);
      return;
    }
    try {
      await db.runAsync(
        `INSERT OR REPLACE INTO SquadSharedMedia
         (id, name, type, sizeBytes, sha256, senderName, timestamp, lat, lon, ele, localUri, isSynced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          media.id,
          media.name,
          media.type,
          media.sizeBytes,
          media.sha256,
          media.senderName,
          media.timestamp,
          media.lat,
          media.lon,
          media.ele,
          media.localUri ?? null,
          media.isSynced ? 1 : 0,
        ]
      );
    } catch (e) {
      console.error('Error saving squad media:', e);
      const idx = this.memoryMedia.findIndex((m) => m.id === media.id);
      if (idx >= 0) this.memoryMedia[idx] = media;
      else this.memoryMedia.push(media);
    }
  }

  static async getSquadMedia(): Promise<SquadMediaRecord[]> {
    const db = await this.getDb();
    if (!db) return [...this.memoryMedia];
    try {
      const rows = await db.getAllAsync<any>('SELECT * FROM SquadSharedMedia ORDER BY timestamp DESC');
      return rows.map((r) => ({
        ...r,
        isSynced: !!r.isSynced,
      }));
    } catch (e) {
      console.error('Error fetching squad media:', e);
      return [...this.memoryMedia];
    }
  }

  static async markMediaSynced(id: string): Promise<void> {
    const db = await this.getDb();
    const item = this.memoryMedia.find((m) => m.id === id);
    if (item) item.isSynced = true;

    if (db) {
      try {
        await db.runAsync('UPDATE SquadSharedMedia SET isSynced = 1 WHERE id = ?', [id]);
      } catch (e) {
        console.error('Error updating media synced status:', e);
      }
    }
  }
}
