import 'dart:async';
import 'package:flutter/material.dart';
import '../services/ble_mesh_service.dart';
import '../theme/field_tokens.dart';
import '../widgets/field_instruments/campfire_mesh_radar.dart';
import '../widgets/field_instruments/knurled_hardware_button.dart';

/// Campfire Mesh Radar Screen: Polar node visualization + Party Mesh Roster
class CampfireRadarScreen extends StatefulWidget {
  const CampfireRadarScreen({super.key});

  @override
  State<CampfireRadarScreen> createState() => _CampfireRadarScreenState();
}

class _CampfireRadarScreenState extends State<CampfireRadarScreen> {
  StreamSubscription<TrekMeshPacket>? _meshSubscription;

  // Mock initial party peers on the physical BLE mesh
  final List<MeshPeerNode> _peers = [
    MeshPeerNode(
      peerId: 'usr_02',
      callsign: 'KEDAR-LEAD',
      rssi: -58,
      bearingDegrees: 45.0,
      batteryPercent: 88,
      hopCount: 1,
      lastSeen: DateTime.now().subtract(const Duration(seconds: 4)),
    ),
    MeshPeerNode(
      peerId: 'usr_03',
      callsign: 'GUIDE-SWEEP',
      rssi: -78,
      bearingDegrees: 195.0,
      batteryPercent: 64,
      hopCount: 2,
      lastSeen: DateTime.now().subtract(const Duration(seconds: 12)),
    ),
    MeshPeerNode(
      peerId: 'usr_04',
      callsign: 'TREK-ROVER',
      rssi: -89,
      bearingDegrees: 310.0,
      batteryPercent: 42,
      hopCount: 2,
      lastSeen: DateTime.now().subtract(const Duration(seconds: 28)),
    ),
  ];

  @override
  void initState() {
    super.initState();
    BleMeshService.instance.start();
    _meshSubscription = BleMeshService.instance.onPacketReceived.listen(_handlePacket);
  }

  @override
  void dispose() {
    _meshSubscription?.cancel();
    super.dispose();
  }

  void _handlePacket(TrekMeshPacket packet) {
    if (packet.msgType == 0x3) {
      // SOS Alert
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('EMERGENCY SOS RECEIVED FROM SHORT-ID ${packet.messageId & 0xFFFF}!'),
          backgroundColor: FieldTokens.rescueOrange,
        ),
      );
    }
  }

  void _sendPing() {
    BleMeshService.instance.sendLocationPing(
      lat: 30.73456,
      lon: 79.06734,
      elevationM: 3534.0,
      batteryPercent: 92,
    );
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('BROADCASTED 31-BYTE PING PACKET OVER BLE MESH'),
        backgroundColor: FieldTokens.mossNeon,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FieldTokens.basaltBackground,
      appBar: AppBar(
        title: Text(
          'CAMPFIRE MESH RADAR',
          style: FieldTokens.technicalMonospace(fontSize: 14, fontWeight: FontWeight.w800),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 14),
            alignment: Alignment.center,
            child: Row(
              children: [
                const Icon(Icons.bluetooth_audio, size: 14, color: FieldTokens.mossNeon),
                const SizedBox(width: 4),
                Text(
                  'DUTY: 1.5s/8s',
                  style: FieldTokens.technicalMonospace(fontSize: 9, color: FieldTokens.mossNeon),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 16),
            // Polar Radar Display
            Center(
              child: CampfireMeshRadar(
                peers: _peers,
                size: 280,
                onNodeSelected: (peer) {
                  // Inspect peer telemetry
                },
              ),
            ),
            const SizedBox(height: 16),

            // Controls Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Row(
                children: [
                  Expanded(
                    child: KnurledHardwareButton(
                      label: 'PING MESH ROSTER',
                      icon: Icons.radar,
                      accentColor: FieldTokens.mossNeon,
                      onPressed: _sendPing,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Peer Nodes Roster
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'ACTIVE BACKCOUNTRY PEERS (${_peers.length})',
                  style: FieldTokens.technicalMonospace(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: FieldTokens.contourOchre,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),

            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4),
              itemCount: _peers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final p = _peers[index];
                return _buildPeerTile(p);
              },
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildPeerTile(MeshPeerNode peer) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: FieldTokens.pineSurface,
        borderRadius: BorderRadius.circular(FieldTokens.borderChamferRadius),
        border: Border.all(
          color: FieldTokens.pineSurfaceBorder,
          width: FieldTokens.instrumentBorderWidth,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFF131715),
              borderRadius: BorderRadius.circular(3),
              border: Border.all(color: FieldTokens.pineSurfaceBorder),
            ),
            alignment: Alignment.center,
            child: Text(
              '${peer.bearingDegrees.toInt()}°',
              style: FieldTokens.technicalMonospace(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: FieldTokens.contourOchre,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  peer.callsign,
                  style: FieldTokens.technicalMonospace(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  'RELAY: ${peer.hopCount} HOP • BATTERY: ${peer.batteryPercent}%',
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 9,
                    color: FieldTokens.soiGridBorder.withOpacity(0.8),
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${peer.rssi} dBm',
                style: FieldTokens.technicalMonospace(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: peer.rssi > -70 ? FieldTokens.mossNeon : FieldTokens.hazardYellow,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                '${DateTime.now().difference(peer.lastSeen).inSeconds}s AGO',
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 8,
                  color: FieldTokens.soiGridBorder.withOpacity(0.7),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
