import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'data/seeded_trails.dart';
import 'screens/explore_map_screen.dart';
import 'screens/record_expedition_screen.dart';
import 'screens/saved_and_sync_screen.dart';
import 'screens/trek_squads_screen.dart';
import 'theme/app_theme.dart';
import 'theme/field_tokens.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: FieldTokens.basaltBackground,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  runApp(const TrekIndiaApp());
}

class TrekIndiaApp extends StatelessWidget {
  const TrekIndiaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TrekIndia',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkFieldInstrumentTheme,
      home: const MainNavigationShell(),
    );
  }
}

class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;
  TrailModel? _selectedTrailForRecord;

  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    _pages = [
      ExploreMapScreen(
        onSelectTrailForRecord: (trail) {
          setState(() {
            _selectedTrailForRecord = trail;
            _currentIndex = 1; // Switch to Record tab
          });
        },
      ),
      RecordExpeditionScreen(initialTrail: _selectedTrailForRecord),
      const TrekSquadsScreen(),
      const SavedAndSyncScreen(),
    ];
  }

  void _onTabTapped(int index) {
    if (_currentIndex != index) {
      HapticFeedback.selectionClick();
      setState(() => _currentIndex = index);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FieldTokens.basaltBackground,
      body: IndexedStack(
        index: _currentIndex,
        children: [
          ExploreMapScreen(
            onSelectTrailForRecord: (trail) {
              setState(() {
                _selectedTrailForRecord = trail;
                _currentIndex = 1;
              });
            },
          ),
          RecordExpeditionScreen(initialTrail: _selectedTrailForRecord),
          const TrekSquadsScreen(),
          const SavedAndSyncScreen(),
        ],
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: FieldTokens.pineSurface.withValues(alpha: 0.98),
          border: const Border(
            top: BorderSide(color: FieldTokens.pineSurfaceBorder, width: 1.0),
          ),
          boxShadow: const [
            BoxShadow(color: Colors.black54, blurRadius: 10, offset: Offset(0, -2)),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _navItem(0, Icons.explore_outlined, Icons.explore, 'Explore'),
                _navItem(1, Icons.play_circle_outline, Icons.play_circle, 'Record'),
                _navItem(2, Icons.group_outlined, Icons.group, 'Squads'),
                _navItem(3, Icons.bookmark_border_outlined, Icons.bookmark, 'Saved'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _navItem(int index, IconData outlineIcon, IconData filledIcon, String label) {
    final bool isActive = _currentIndex == index;

    return GestureDetector(
      onTap: () => _onTabTapped(index),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? FieldTokens.rescueOrange.withValues(alpha: 0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isActive ? filledIcon : outlineIcon,
              size: 22,
              color: isActive ? FieldTokens.rescueOrange : Colors.white60,
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w800 : FontWeight.w500,
                color: isActive ? FieldTokens.rescueOrange : Colors.white60,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
