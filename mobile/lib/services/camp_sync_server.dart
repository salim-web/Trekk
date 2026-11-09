import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart';
import 'package:shelf_web_socket/shelf_web_socket.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../db/database_helper.dart';

/// Embedded Ad-Hoc Camp Sync Server (Tier 2 Basecamp Hotspot)
///
/// Runs an in-memory HTTP/WebSocket daemon on port 8080 during evening camp.
/// Enables delta-syncing high-res photos and voice notes across Android/iOS devices
/// at 20-40 MB/s locally without cellular internet.
class CampSyncServer {
  static final CampSyncServer instance = CampSyncServer._init();
  CampSyncServer._init();

  HttpServer? _server;
  final List<WebSocketChannel> _activeWsClients = [];
  bool get isRunning => _server != null;

  String? currentPartyId;
  int port = 8080;

  /// Starts the embedded Shelf server
  Future<void> startServer({
    required String partyId,
    int bindPort = 8080,
  }) async {
    if (_server != null) return;
    currentPartyId = partyId;
    port = bindPort;

    final router = Router();

    // 1. WebSocket Channel for Real-Time Sync Telemetry
    router.get('/ws', webSocketHandler((WebSocketChannel webSocket) {
      _activeWsClients.add(webSocket);
      debugPrint('[CampSync Server] Peer connected to telemetry WS');

      webSocket.stream.listen(
        (message) {
          // Broadcast message to all other connected peers
          _broadcastWsMessage({'type': 'PEER_EVENT', 'data': message});
        },
        onDone: () => _activeWsClients.remove(webSocket),
        onError: (_) => _activeWsClients.remove(webSocket),
      );
    }));

    // 2. Diff SHA-256 Hashes Endpoint
    router.post('/api/v1/camp-sync/diff', (Request request) async {
      try {
        final bodyStr = await request.readAsString();
        final body = jsonDecode(bodyStr) as Map<String, dynamic>;
        final List<dynamic> clientHashes = body['have_hashes'] ?? [];
        final clientHashSet = clientHashes.map((e) => e.toString()).toSet();

        // Query our local database for our hashes
        final serverHashes = await DatabaseHelper.instance.getLocalMediaHashes(partyId);
        final serverHashSet = serverHashes.toSet();

        // Hashes the server has that the client is missing
        final missingFromClientHashes = serverHashSet.difference(clientHashSet);
        // Hashes the client has that the server wants
        final missingFromServerHashes = clientHashSet.difference(serverHashSet);

        final missingFromClientDetails = <Map<String, dynamic>>[];
        for (final hash in missingFromClientHashes) {
          final media = await DatabaseHelper.instance.getMediaByHash(hash);
          if (media != null) {
            missingFromClientDetails.add({
              'hash': hash,
              'filename': media['localFilePath'].toString().split('/').last,
              'captured_at': media['capturedAt'],
              'lat': media['lat'],
              'lon': media['lon'],
              'ele': media['ele'],
            });
          }
        }

        return Response.ok(
          jsonEncode({
            'status': 'ok',
            'missing_from_client': missingFromClientDetails,
            'missing_from_server': missingFromServerHashes.toList(),
          }),
          headers: {'content-type': 'application/json'},
        );
      } catch (e) {
        return Response.internalServerError(body: jsonEncode({'error': e.toString()}));
      }
    });

    // 3. Download Media by SHA-256 Hash
    router.get('/api/v1/camp-sync/download/<hash>', (Request request, String hash) async {
      final media = await DatabaseHelper.instance.getMediaByHash(hash);
      if (media == null) {
        return Response.notFound('Media hash not found on server');
      }

      final file = File(media['localFilePath'] as String);
      if (!await file.exists()) {
        return Response.notFound('File missing from disk');
      }

      return Response.ok(
        file.openRead(),
        headers: {
          'content-type': 'application/octet-stream',
          'content-length': (await file.length()).toString(),
          'x-sha256': hash,
        },
      );
    });

    // 4. Upload Missing Media to Server
    router.post('/api/v1/camp-sync/upload', (Request request) async {
      try {
        final bytes = await request.read().expand((b) => b).toList();
        final calculatedHash = sha256.convert(bytes).toString();

        // Save to app documents directory
        final syncDir = Directory('${Directory.systemTemp.path}/camp_sync_media');
        if (!await syncDir.exists()) {
          await syncDir.create(recursive: true);
        }

        final targetFile = File('${syncDir.path}/$calculatedHash.bin');
        await targetFile.writeAsBytes(bytes);

        // Record to DB
        await DatabaseHelper.instance.insertMedia(
          partyId: partyId,
          localFilePath: targetFile.path,
          sha256Hash: calculatedHash,
          capturedAt: DateTime.now().toUtc(),
        );

        _broadcastWsMessage({
          'type': 'MEDIA_SYNCED',
          'hash': calculatedHash,
          'size': bytes.length,
        });

        return Response.ok(
          jsonEncode({'status': 'stored', 'hash': calculatedHash}),
          headers: {'content-type': 'application/json'},
        );
      } catch (e) {
        return Response.internalServerError(body: jsonEncode({'error': e.toString()}));
      }
    });

    final handler = const Pipeline()
        .addMiddleware(logRequests())
        .addHandler(router);

    _server = await shelf_io.serve(handler, InternetAddress.anyIPv4, bindPort);
    debugPrint('[CampSync Server] Listening on http://${_server!.address.host}:${_server!.port}');
  }

  void _broadcastWsMessage(Map<String, dynamic> msg) {
    final payload = jsonEncode(msg);
    for (final client in _activeWsClients) {
      client.sink.add(payload);
    }
  }

  /// Format QR code payload string matching SKILL.md specs
  static String formatQrBadgeString({
    required String ssid,
    required String password,
    required String partyId,
    String ip = '192.168.43.1',
    int port = 8080,
  }) {
    return 'TREK:CAMP;SSID=$ssid;PASS=$password;IP=$ip;PORT=$port;PARTY=$partyId';
  }

  /// Stop server
  Future<void> stopServer() async {
    for (final client in _activeWsClients) {
      await client.sink.close();
    }
    _activeWsClients.clear();
    await _server?.close(force: true);
    _server = null;
    debugPrint('[CampSync Server] Stopped');
  }
}
