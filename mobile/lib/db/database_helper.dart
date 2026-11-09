import 'dart:async';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

/// Offline SQLite Database Manager for TrekIndia
///
/// Manages high-frequency offline track logging, local media cache with SHA-256 hashes,
/// and BLE 31-byte mesh packets for multi-hop flood-fill relay.
class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('trekindia_offline.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    final docsDir = await getApplicationDocumentsDirectory();
    final path = p.join(docsDir.path, filePath);

    return await openDatabase(
      path,
      version: 1,
      onCreate: _createDB,
    );
  }

  Future<void> _createDB(Database db, int version) async {
    // 1. Local Tracks Table
    await db.execute('''
      CREATE TABLE LocalTracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        gpxBlob TEXT,
        isSynced INTEGER NOT NULL DEFAULT 0
      )
    ''');

    // 2. High-Frequency GNSS & Wearable HR Track Points
    await db.execute('''
      CREATE TABLE LocalTrackPoints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trackId INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        elevationM REAL NOT NULL,
        heartRate INTEGER,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (trackId) REFERENCES LocalTracks (id) ON DELETE CASCADE
      )
    ''');

    await db.execute('CREATE INDEX idx_track_points_track ON LocalTrackPoints (trackId)');

    // 3. Spatial Expedition Media
    await db.execute('''
      CREATE TABLE LocalPartyMedia (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partyId TEXT NOT NULL,
        localFilePath TEXT NOT NULL,
        sha256Hash TEXT NOT NULL UNIQUE,
        capturedAt TEXT NOT NULL,
        lat REAL,
        lon REAL,
        ele REAL,
        isUploaded INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('CREATE INDEX idx_media_party ON LocalPartyMedia (partyId)');
    await db.execute('CREATE INDEX idx_media_hash ON LocalPartyMedia (sha256Hash)');

    // 4. Physical BLE Mesh Messages & Multi-Hop Telemetry
    await db.execute('''
      CREATE TABLE LocalMeshMessages (
        msgId INTEGER PRIMARY KEY,
        partyHash INTEGER NOT NULL,
        msgType INTEGER NOT NULL,
        senderShortId INTEGER NOT NULL,
        payloadHex TEXT NOT NULL,
        receivedAt TEXT NOT NULL,
        hopCount INTEGER NOT NULL
      )
    ''');

    await db.execute('CREATE INDEX idx_mesh_time ON LocalMeshMessages (receivedAt DESC)');
  }

  // Track Logging Operations
  Future<int> startNewTrack(String name) async {
    final db = await database;
    return await db.insert('LocalTracks', {
      'name': name,
      'startedAt': DateTime.now().toUtc().toIso8601String(),
      'isSynced': 0,
    });
  }

  Future<void> insertTrackPoint({
    required int trackId,
    required double lat,
    required double lon,
    required double ele,
    int? heartRate,
    DateTime? timestamp,
  }) async {
    final db = await database;
    await db.insert('LocalTrackPoints', {
      'trackId': trackId,
      'latitude': lat,
      'longitude': lon,
      'elevationM': ele,
      'heartRate': heartRate,
      'timestamp': (timestamp ?? DateTime.now().toUtc()).toIso8601String(),
    });
  }

  Future<List<Map<String, dynamic>>> getTrackPoints(int trackId) async {
    final db = await database;
    return await db.query(
      'LocalTrackPoints',
      where: 'trackId = ?',
      whereArgs: [trackId],
      orderBy: 'timestamp ASC',
    );
  }

  Future<void> endTrack(int trackId, String gpxBlob) async {
    final db = await database;
    await db.update(
      'LocalTracks',
      {
        'endedAt': DateTime.now().toUtc().toIso8601String(),
        'gpxBlob': gpxBlob,
      },
      where: 'id = ?',
      whereArgs: [trackId],
    );
  }

  // Media Operations for Camp Sync
  Future<void> insertMedia({
    required String partyId,
    required String localFilePath,
    required String sha256Hash,
    required DateTime capturedAt,
    double? lat,
    double? lon,
    double? ele,
  }) async {
    final db = await database;
    await db.insert(
      'LocalPartyMedia',
      {
        'partyId': partyId,
        'localFilePath': localFilePath,
        'sha256Hash': sha256Hash,
        'capturedAt': capturedAt.toIso8601String(),
        'lat': lat,
        'lon': lon,
        'ele': ele,
        'isUploaded': 0,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<String>> getLocalMediaHashes(String partyId) async {
    final db = await database;
    final results = await db.query(
      'LocalPartyMedia',
      columns: ['sha256Hash'],
      where: 'partyId = ?',
      whereArgs: [partyId],
    );
    return results.map((row) => row['sha256Hash'] as String).toList();
  }

  Future<Map<String, dynamic>?> getMediaByHash(String sha256Hash) async {
    final db = await database;
    final results = await db.query(
      'LocalPartyMedia',
      where: 'sha256Hash = ?',
      whereArgs: [sha256Hash],
      limit: 1,
    );
    if (results.isEmpty) return null;
    return results.first;
  }

  // Mesh Message Operations
  Future<bool> recordMeshMessage({
    required int msgId,
    required int partyHash,
    required int msgType,
    required int senderShortId,
    required String payloadHex,
    required int hopCount,
  }) async {
    final db = await database;
    try {
      await db.insert('LocalMeshMessages', {
        'msgId': msgId,
        'partyHash': partyHash,
        'msgType': msgType,
        'senderShortId': senderShortId,
        'payloadHex': payloadHex,
        'receivedAt': DateTime.now().toUtc().toIso8601String(),
        'hopCount': hopCount,
      });
      return true;
    } catch (_) {
      // Duplicate message dropped
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getRecentMeshMessages({int limit = 50}) async {
    final db = await database;
    return await db.query(
      'LocalMeshMessages',
      orderBy: 'receivedAt DESC',
      limit: limit,
    );
  }

  Future<void> close() async {
    final db = await database;
    await db.close();
  }
}
