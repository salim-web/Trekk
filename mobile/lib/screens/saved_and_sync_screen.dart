import 'package:flutter/material.dart';
import '../data/seeded_trails.dart';
import '../theme/field_tokens.dart';
import '../widgets/field_instruments/knurled_hardware_button.dart';
import 'camp_sync_screen.dart';

class SavedAndSyncScreen extends StatefulWidget {
  const SavedAndSyncScreen({super.key});

  @override
  State<SavedAndSyncScreen> createState() => _SavedAndSyncScreenState();
}

class _SavedAndSyncScreenState extends State<SavedAndSyncScreen> {
  final List<Map<String, dynamic>> _offlinePacks = [
    {
      'name': 'Garhwal Alps Topo Pack (53J/1, 53J/3)',
      'size': '184 MB',
      'isDownloaded': true,
      'trailsCount': 2,
    },
    {
      'name': 'Kullu & Spiti High Pass Pack (52H/8)',
      'size': '240 MB',
      'isDownloaded': true,
      'trailsCount': 1,
    },
    {
      'name': 'Western Ghats Sahyadri Pack (47F/5, 47E/10)',
      'size': '128 MB',
      'isDownloaded': false,
      'trailsCount': 3,
    },
  ];

  final List<Map<String, dynamic>> _badges = [
    {'title': 'Kedarkantha Summit', 'alt': '3,810m', 'date': 'Winter 2026', 'icon': Icons.terrain},
    {'title': 'Hampta Pass Crosser', 'alt': '4,270m', 'date': 'Autumn 2026', 'icon': Icons.landscape},
    {'title': 'Mesh Sentinel (100+ Pings)', 'alt': '0 Hops', 'date': 'Active', 'icon': Icons.radar},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FieldTokens.basaltBackground,
      appBar: AppBar(
        title: Text(
          'SAVED & EXPEDITION SYNC',
          style: FieldTokens.technicalMonospace(fontSize: 14, fontWeight: FontWeight.w800),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Strava "Missing Map" Repair Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: FieldTokens.pineSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: FieldTokens.pineSurfaceBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFC5200).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.sync_alt, color: Color(0xFFFC5200), size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'STRAVA "MISSING MAP" REPAIR',
                              style: FieldTokens.technicalMonospace(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Auto-inject high-res SOI & OpenTopo contours into Strava activities.',
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 9.5,
                                color: FieldTokens.soiGridBorder.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  KnurledHardwareButton(
                    label: 'CONNECT STRAVA & SYNC GPX',
                    icon: Icons.cloud_upload_outlined,
                    accentColor: const Color(0xFFFC5200),
                    height: 44,
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('STRAVA SYNC ENGINE ACTIVE - GPX EXPORT READY'),
                          backgroundColor: Color(0xFFFC5200),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Offline MBTiles Map Packs
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'OFFLINE TOPO PACKS (.MBTILES)',
                  style: FieldTokens.technicalMonospace(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: FieldTokens.contourOchre,
                  ),
                ),
                Text(
                  '424 MB USED',
                  style: FieldTokens.technicalMonospace(fontSize: 10, color: Colors.white54),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _offlinePacks.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, i) {
                final pack = _offlinePacks[i];
                final isDone = pack['isDownloaded'] == true;

                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: FieldTokens.pineSurface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: FieldTokens.pineSurfaceBorder),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isDone ? Icons.offline_pin : Icons.download_for_offline_outlined,
                        color: isDone ? FieldTokens.mossNeon : FieldTokens.contourOchre,
                        size: 24,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              pack['name'] as String,
                              style: FieldTokens.technicalMonospace(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              '${pack['size']} • ${pack['trailsCount']} Seeded Treks',
                              style: TextStyle(
                                fontFamily: 'monospace',
                                fontSize: 9.5,
                                color: FieldTokens.soiGridBorder.withValues(alpha: 0.8),
                              ),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          setState(() {
                            pack['isDownloaded'] = !isDone;
                          });
                        },
                        child: Text(
                          isDone ? 'REMOVE' : 'DOWNLOAD',
                          style: FieldTokens.technicalMonospace(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: isDone ? Colors.white38 : FieldTokens.rescueOrange,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 24),

            // Expedition Badges
            Text(
              'EXPEDITION ACHIEVEMENTS & BENCHMARKS',
              style: FieldTokens.technicalMonospace(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: FieldTokens.contourOchre,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: _badges.map((b) {
                return Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
                    decoration: BoxDecoration(
                      color: FieldTokens.pineSurface,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: FieldTokens.pineSurfaceBorder),
                    ),
                    child: Column(
                      children: [
                        Icon(b['icon'] as IconData, size: 28, color: FieldTokens.contourOchre),
                        const SizedBox(height: 8),
                        Text(
                          b['title'] as String,
                          textAlign: TextAlign.center,
                          style: FieldTokens.technicalMonospace(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          b['alt'] as String,
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 8.5,
                            color: FieldTokens.rescueOrange,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
