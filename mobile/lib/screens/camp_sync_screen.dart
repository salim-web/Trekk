import 'dart:async';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../services/camp_sync_client.dart';
import '../services/camp_sync_server.dart';
import '../theme/field_tokens.dart';
import '../widgets/field_instruments/knurled_hardware_button.dart';

/// Camp Sync Screen: Ad-Hoc Basecamp Wi-Fi Delta Sync (Tier 2 Mesh)
class CampSyncScreen extends StatefulWidget {
  const CampSyncScreen({super.key});

  @override
  State<CampSyncScreen> createState() => _CampSyncScreenState();
}

class _CampSyncScreenState extends State<CampSyncScreen> {
  bool _isLeaderMode = true;
  bool _isServerActive = false;
  bool _isSyncing = false;

  SyncProgress _syncProgress = const SyncProgress(
    totalItems: 0,
    completedItems: 0,
    speedMbps: 0,
    currentAction: 'IDLE - READY FOR CAMP CONGREGATION',
  );

  StreamSubscription<SyncProgress>? _progressSub;

  final String _ssid = 'TrekIndia_53J3';
  final String _pass = 'alpine789';
  final String _partyId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  @override
  void initState() {
    super.initState();
    _progressSub = CampSyncClient.instance.onSyncProgress.listen((p) {
      setState(() {
        _syncProgress = p;
        if (p.completedItems >= p.totalItems && p.totalItems > 0) {
          _isSyncing = false;
        }
      });
    });
  }

  @override
  void dispose() {
    _progressSub?.cancel();
    super.dispose();
  }

  void _toggleLeaderServer() async {
    if (_isServerActive) {
      await CampSyncServer.instance.stopServer();
      setState(() => _isServerActive = false);
    } else {
      await CampSyncServer.instance.startServer(partyId: _partyId, bindPort: 8080);
      setState(() => _isServerActive = true);
    }
  }

  void _startClientSync() async {
    setState(() => _isSyncing = true);
    final config = CampConnectionConfig(
      ssid: _ssid,
      password: _pass,
      ip: '127.0.0.1', // Local testing IP or 192.168.43.1 in field
      port: 8080,
      partyId: _partyId,
    );
    await CampSyncClient.instance.runDeltaSync(config);
  }

  @override
  Widget build(BuildContext context) {
    final qrData = CampSyncServer.formatQrBadgeString(
      ssid: _ssid,
      password: _pass,
      partyId: _partyId,
      ip: '192.168.43.1',
      port: 8080,
    );

    return Scaffold(
      backgroundColor: FieldTokens.basaltBackground,
      appBar: AppBar(
        title: Text(
          'CAMP SYNC (BASECAMP P2P)',
          style: FieldTokens.technicalMonospace(fontSize: 14, fontWeight: FontWeight.w800),
        ),
        actions: [
          // Mode Toggle Switch
          TextButton(
            onPressed: () {
              setState(() => _isLeaderMode = !_isLeaderMode);
            },
            child: Text(
              _isLeaderMode ? 'MODE: LEADER' : 'MODE: PEER',
              style: FieldTokens.technicalMonospace(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: FieldTokens.contourOchre,
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Mode Banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: FieldTokens.pineSurface,
                borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
                border: Border.all(color: FieldTokens.pineSurfaceBorder),
              ),
              child: Row(
                children: [
                  Icon(
                    _isLeaderMode ? Icons.wifi_tethering : Icons.wifi,
                    size: 16,
                    color: _isLeaderMode ? FieldTokens.rescueOrange : FieldTokens.mossNeon,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _isLeaderMode
                        ? 'TIER 2 BASECAMP HOTSPOT & SHELF PORT 8080'
                        : 'AD-HOC LOCAL WI-FI HIGH-SPEED CLIENT',
                      style: FieldTokens.technicalMonospace(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: Colors.white70,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (_isLeaderMode) ...[
              // Leader: QR Code Badge Display
              Center(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(4.0),
                    border: Border.all(color: FieldTokens.tactileSteel, width: 2.0),
                  ),
                  child: QrImageView(
                    data: qrData,
                    version: QrVersions.auto,
                    size: 200.0,
                    backgroundColor: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  'SSID: $_ssid | PASS: $_pass',
                  style: FieldTokens.technicalMonospace(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: FieldTokens.contourOchre,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              KnurledHardwareButton(
                label: _isServerActive ? 'HALT SHELF SYNC SERVER' : 'START EMBEDDED SYNC DAEMON',
                icon: _isServerActive ? Icons.stop : Icons.power_settings_new,
                accentColor: _isServerActive ? FieldTokens.rescueOrange : FieldTokens.mossNeon,
                onPressed: _toggleLeaderServer,
              ),
            ] else ...[
              // Peer Client Mode
              Center(
                child: Container(
                  height: 180,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: FieldTokens.pineSurface,
                    borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
                    border: Border.all(color: FieldTokens.pineSurfaceBorder),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.qr_code_scanner, size: 48, color: FieldTokens.glacierCyan),
                      const SizedBox(height: 8),
                      Text(
                        'SCAN EXPEDITION LEADER BADGE',
                        style: FieldTokens.technicalMonospace(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              KnurledHardwareButton(
                label: _isSyncing ? 'SYNCING MEDIA...' : 'TRIGGER SHA-256 DELTA SYNC',
                icon: Icons.sync,
                isLoading: _isSyncing,
                accentColor: FieldTokens.mossNeon,
                onPressed: _startClientSync,
              ),
            ],

            const SizedBox(height: 24),
            // Sync Telemetry & Progress Meter
            Text(
              'DELTA SYNC TELEMETRY',
              style: FieldTokens.technicalMonospace(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: FieldTokens.contourOchre,
              ),
            ),
            const SizedBox(height: 8),

            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: FieldTokens.pineSurface,
                borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
                border: Border.all(color: FieldTokens.pineSurfaceBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _syncProgress.currentAction.toUpperCase(),
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        '${(_syncProgress.fraction * 100).toInt()}%',
                        style: FieldTokens.technicalMonospace(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: FieldTokens.contourOchre,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),

                  // Progress Bar
                  ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: _syncProgress.fraction,
                      minHeight: 6,
                      backgroundColor: const Color(0xFF131715),
                      valueColor: const AlwaysStoppedAnimation<Color>(FieldTokens.contourOchre),
                    ),
                  ),
                  const SizedBox(height: 8),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'ITEMS: ${_syncProgress.completedItems} / ${_syncProgress.totalItems}',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 9,
                          color: FieldTokens.soiGridBorder.withOpacity(0.8),
                        ),
                      ),
                      Text(
                        'THROUGHPUT: ${_syncProgress.speedMbps.toStringAsFixed(1)} MB/S',
                        style: FieldTokens.technicalMonospace(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: FieldTokens.mossNeon,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
