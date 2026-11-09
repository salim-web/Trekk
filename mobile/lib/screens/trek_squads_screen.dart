import 'package:flutter/material.dart';
import '../data/seeded_trails.dart';
import '../services/ble_mesh_service.dart';
import '../theme/field_tokens.dart';
import '../widgets/field_instruments/campfire_mesh_radar.dart';
import '../widgets/field_instruments/knurled_hardware_button.dart';
import 'camp_sync_screen.dart';

class TrekSquadsScreen extends StatefulWidget {
  const TrekSquadsScreen({super.key});

  @override
  State<TrekSquadsScreen> createState() => _TrekSquadsScreenState();
}

class _TrekSquadsScreenState extends State<TrekSquadsScreen> {
  final List<MeshPeerNode> _peers = [
    MeshPeerNode(
      peerId: 'usr_02',
      callsign: 'KEDAR-LEADER',
      rssi: -58,
      bearingDegrees: 45.0,
      batteryPercent: 88,
      hopCount: 1,
      lastSeen: DateTime.now().subtract(const Duration(seconds: 4)),
    ),
    MeshPeerNode(
      peerId: 'usr_03',
      callsign: 'SWEEPER-GUIDE',
      rssi: -76,
      bearingDegrees: 195.0,
      batteryPercent: 64,
      hopCount: 2,
      lastSeen: DateTime.now().subtract(const Duration(seconds: 14)),
    ),
    MeshPeerNode(
      peerId: 'usr_04',
      callsign: 'ROVER-CLIMBER',
      rssi: -88,
      bearingDegrees: 310.0,
      batteryPercent: 42,
      hopCount: 2,
      lastSeen: DateTime.now().subtract(const Duration(seconds: 35)),
    ),
  ];

  final List<Map<String, dynamic>> _squadMessages = [
    {
      'sender': 'KEDAR-LEADER',
      'type': 'text',
      'text': 'Basecamp reached at Juda Ka Talab. Water source is clear.',
      'time': '10m ago',
      'isSelf': false,
    },
    {
      'sender': 'SWEEPER-GUIDE',
      'type': 'text',
      'text': 'Rear party crossing the frozen stream safely.',
      'time': '6m ago',
      'isSelf': false,
    },
    {
      'sender': 'YOU',
      'type': 'text',
      'text': 'Beacon received. Moving towards campsite.',
      'time': '2m ago',
      'isSelf': true,
    },
  ];

  final TextEditingController _msgInputController = TextEditingController();

  @override
  void dispose() {
    _msgInputController.dispose();
    super.dispose();
  }

  void _sendMeshMessage() {
    final text = _msgInputController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _squadMessages.add({
        'sender': 'YOU',
        'type': 'text',
        'text': text,
        'time': 'Just now',
        'isSelf': true,
      });
      _msgInputController.clear();
    });

    BleMeshService.instance.sendLocationPing(
      lat: 31.0234,
      lon: 78.1723,
      elevationM: 3810,
      batteryPercent: 90,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FieldTokens.basaltBackground,
      appBar: AppBar(
        title: Text(
          'TREK SQUAD & MESH',
          style: FieldTokens.technicalMonospace(fontSize: 14, fontWeight: FontWeight.w800),
        ),
        actions: [
          // Basecamp Camp Sync Shortcut Button
          TextButton.icon(
            icon: const Icon(Icons.wifi_tethering, size: 16, color: FieldTokens.contourOchre),
            label: Text(
              'CAMP SYNC',
              style: FieldTokens.technicalMonospace(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: FieldTokens.contourOchre,
              ),
            ),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CampSyncScreen()),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Collapsible Radar Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: FieldTokens.pineSurface,
              border: Border(bottom: BorderSide(color: FieldTokens.pineSurfaceBorder)),
            ),
            child: Row(
              children: [
                CampfireMeshRadar(
                  peers: _peers,
                  size: 90,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'KEDARKANTHA SQUAD',
                            style: FieldTokens.technicalMonospace(
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: FieldTokens.mossNeon.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: FieldTokens.mossNeon, width: 0.8),
                            ),
                            child: Text(
                              '3 NODES ONLINE',
                              style: FieldTokens.technicalMonospace(
                                fontSize: 8.5,
                                fontWeight: FontWeight.w800,
                                color: FieldTokens.mossNeon,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'P2P 31-byte BLE Mesh (Zero Cellular / Zero Internet)',
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 9.5,
                          color: FieldTokens.soiGridBorder.withValues(alpha: 0.9),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Leader: KEDAR-LEAD (-58 dBm, 1 Hop)',
                        style: FieldTokens.technicalMonospace(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: FieldTokens.contourOchre,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Message & Spatial Pin Stream
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _squadMessages.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final msg = _squadMessages[index];
                final isSelf = msg['isSelf'] == true;

                return Align(
                  alignment: isSelf ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isSelf ? const Color(0xFF222B25) : FieldTokens.pineSurface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isSelf ? FieldTokens.rescueOrange.withValues(alpha: 0.4) : FieldTokens.pineSurfaceBorder,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: isSelf ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              msg['sender'] as String,
                              style: FieldTokens.technicalMonospace(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: isSelf ? FieldTokens.rescueOrange : FieldTokens.contourOchre,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              msg['time'] as String,
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 8.5,
                                color: FieldTokens.soiGridBorder.withValues(alpha: 0.7),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          msg['text'] as String,
                          style: const TextStyle(fontSize: 12.5, color: Colors.white, height: 1.3),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // Offline P2P Broadcast Composer
          Container(
            padding: const EdgeInsets.all(12),
            decoration: const BoxDecoration(
              color: FieldTokens.pineSurface,
              border: Border(top: BorderSide(color: FieldTokens.pineSurfaceBorder)),
            ),
            child: SafeArea(
              top: false,
              child: Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF131715),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: FieldTokens.pineSurfaceBorder),
                      ),
                      child: TextField(
                        controller: _msgInputController,
                        style: const TextStyle(fontSize: 13, color: Colors.white),
                        decoration: const InputDecoration(
                          hintText: 'Transmit offline mesh message...',
                          hintStyle: TextStyle(fontSize: 12, color: Colors.white38),
                          border: InputBorder.none,
                          isDense: true,
                        ),
                        onSubmitted: (_) => _sendMeshMessage(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: const Icon(Icons.send_rounded, color: FieldTokens.rescueOrange),
                    onPressed: _sendMeshMessage,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
