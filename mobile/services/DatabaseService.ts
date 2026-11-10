import * as SQLite from 'expo-sqlite';
import { ParsedTrack } from './TrackParser';

export class DatabaseService {
  private static db: SQLite.SQLiteDatabase | null = null;
  private static memoryTracks: ParsedTrack[] = [];

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
    `);
  }

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
      this.memoryTracks.unshift(trackWithId);
      return trackWithId;
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
}
