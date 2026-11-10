import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Layers,
  Plus,
  Navigation,
  Compass,
  Mountain,
  BatteryCharging,
  X,
  Play,
  Share2,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../../constants/FieldTokens';
import { SeededTrails, SEEDED_TRAILS, TrailModel } from '../../constants/SeededTrails';
import { TopoMapView } from '../../components/TopoMapView';
import { ElevationChart } from '../../components/ElevationChart';
import { FileImportModal } from '../../components/FileImportModal';
import { SoiScanOverlay } from '../../components/SoiScanOverlay';
import { KnurledButton } from '../../components/KnurledButton';
import { DatabaseService } from '../../services/DatabaseService';
import { ParsedTrack } from '../../services/TrackParser';
import { SoiAnalysisResult, SoiCandidateTrail } from '../../services/SoiAnalysisService';

type RegionFilter = 'ALL' | 'HIMALAYAS' | 'WESTERN_GHATS' | 'NORTH_EAST' | 'IMPORTED';

// Default safe fallback trails
const DEFAULT_FALLBACK_TRAILS: TrailModel[] = Array.isArray(SEEDED_TRAILS) && SEEDED_TRAILS.length > 0
  ? SEEDED_TRAILS
  : (Array.isArray(SeededTrails) && SeededTrails.length > 0 ? SeededTrails : []);

export default function TopoMapScreen() {
  const [activeFilter, setActiveFilter] = useState<RegionFilter>('ALL');
  const [selectedTrail, setSelectedTrail] = useState<TrailModel | null>(null);
  const [importedTrails, setImportedTrails] = useState<TrailModel[]>([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [soiResult, setSoiResult] = useState<SoiAnalysisResult | null>(null);
  const [soiOverlayVisible, setSoiOverlayVisible] = useState(false);
  const [savedCandidateIds, setSavedCandidateIds] = useState<string[]>([]);
  const [scrubbedElevation, setScrubbedElevation] = useState<number | null>(null);

  // Load imported trails from SQLite on startup
  useEffect(() => {
    loadSavedTracks();
  }, []);

  const loadSavedTracks = async () => {
    try {
      const dbTracks = await DatabaseService.getImportedTracks();
      if (!Array.isArray(dbTracks)) return;

      const mappedTrails: TrailModel[] = (dbTracks ?? []).map((t) => {
        const pts = Array.isArray(t?.points) ? t.points : [];
        const startLat = pts[0]?.latitude ?? 31.0772;
        const startLon = pts[0]?.longitude ?? 78.1831;
        const endLat = pts[pts.length - 1]?.latitude ?? startLat;
        const endLon = pts[pts.length - 1]?.longitude ?? startLon;

        return {
          id: t.id ?? `track_${Date.now()}_${Math.random()}`,
          name: t.name ?? 'Imported Track',
          region: 'Imported',
          state: 'Local Storage',
          soiSheet: 'LOCAL-IMPORT',
          soiSheetNumber: 'LOCAL-IMPORT',
          difficulty: 'Moderate',
          distanceKm: t.distanceKm ?? 0,
          elevationGainM: t.elevationGainM ?? 0,
          maxAltM: t.maxAltitudeM ?? 3000,
          maxAltitudeM: t.maxAltitudeM ?? 3000,
          duration: `${Math.round(((t.distanceKm ?? 3) / 3) * 10) / 10}h`,
          estimatedDurationHours: Math.round(((t.distanceKm ?? 3) / 3) * 10) / 10,
          description: 'User imported GPS trail recorded from fitness band/device.',
          startCoord: [startLat, startLon],
          endCoord: [endLat, endLon],
          routeCoords: pts.map((p) => [p.latitude ?? 0, p.longitude ?? 0, p.elevation ?? 0] as [number, number, number]),
          isImported: true,
        };
      });

      setImportedTrails(mappedTrails);
    } catch (e) {
      console.warn('Error loading saved tracks:', e);
    }
  };

  // Safe combine seeded trails and user-imported trails
  const allAvailableTrails: TrailModel[] = [
    ...(DEFAULT_FALLBACK_TRAILS ?? []),
    ...(importedTrails ?? []),
  ].filter(Boolean);

  // Filter trails according to selected regional chip
  const displayedTrails = (allAvailableTrails ?? []).filter((trail) => {
    if (!trail) return false;
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'IMPORTED') return !!trail.isImported;
    const reg = trail.region ?? '';
    if (activeFilter === 'HIMALAYAS') {
      return (
        reg.includes('Himalaya') ||
        reg.includes('Garhwal') ||
        reg.includes('Ladakh') ||
        reg.includes('Kullu')
      );
    }
    if (activeFilter === 'WESTERN_GHATS') {
      return (
        reg.includes('Western Ghats') ||
        reg.includes('Sahyadri') ||
        reg.includes('Chikmagalur')
      );
    }
    if (activeFilter === 'NORTH_EAST') {
      return reg.includes('North-East') || reg.includes('Sikkim') || reg.includes('Meghalaya');
    }
    return true;
  });

  const handleTrackImported = (track: ParsedTrack) => {
    if (!track) return;
    const pts = Array.isArray(track.points) ? track.points : [];
    const startLat = pts[0]?.latitude ?? 31.0772;
    const startLon = pts[0]?.longitude ?? 78.1831;
    const endLat = pts[pts.length - 1]?.latitude ?? startLat;
    const endLon = pts[pts.length - 1]?.longitude ?? startLon;

    const newTrail: TrailModel = {
      id: track.id ?? `imported_${Date.now()}`,
      name: track.name ?? 'Custom Track',
      region: 'Imported',
      state: 'Local Track',
      soiSheet: 'CUSTOM-GPS',
      soiSheetNumber: 'CUSTOM-GPS',
      difficulty: 'Moderate',
      distanceKm: track.distanceKm ?? 0,
      elevationGainM: track.elevationGainM ?? 0,
      maxAltM: track.maxAltitudeM ?? 3000,
      maxAltitudeM: track.maxAltitudeM ?? 3000,
      duration: `${Math.round(((track.distanceKm ?? 3) / 3) * 10) / 10}h`,
      estimatedDurationHours: Math.round(((track.distanceKm ?? 3) / 3) * 10) / 10,
      startCoord: [startLat, startLon],
      endCoord: [endLat, endLon],
      routeCoords: pts.map((p) => [p.latitude ?? 0, p.longitude ?? 0, p.elevation ?? 0] as [number, number, number]),
      isImported: true,
    };

    setImportedTrails((prev) => [newTrail, ...(prev ?? [])]);
    setSelectedTrail(newTrail);
    setActiveFilter('IMPORTED');
  };

  const handleSoiAnalyzed = (result: SoiAnalysisResult) => {
    if (!result) return;
    setSoiResult(result);
    setSoiOverlayVisible(true);
  };

  const handleSaveCandidateAsTrail = async (candidate: SoiCandidateTrail) => {
    try {
      if (!candidate) return;
      const pts = Array.isArray(candidate.points) ? candidate.points : [];
      const parsedTrack: ParsedTrack = {
        name: candidate.name ?? 'SOI Candidate Trail',
        sourceFormat: 'gpx',
        points: pts.map((p) => ({
          latitude: p.latitude ?? 0,
          longitude: p.longitude ?? 0,
          elevation: p.elevation ?? 0,
        })),
        distanceKm: candidate.distanceKm ?? candidate.distance_km ?? 0,
        elevationGainM: candidate.elevationGainM ?? candidate.elevation_gain_m ?? 0,
        maxAltitudeM: Math.max(...pts.map((p) => p.elevation ?? 0), 2000),
        minAltitudeM: Math.min(...pts.map((p) => p.elevation ?? 0), 1000),
      };

      const saved = await DatabaseService.saveImportedTrack(parsedTrack);
      setSavedCandidateIds((prev) => [...(prev ?? []), candidate.id]);
      handleTrackImported(saved);
      Alert.alert('Trail Saved', `"${candidate.name}" has been permanently added to your offline topo trails!`);
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not save candidate trail.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Field Telemetry Bar */}
      <View style={styles.topTelemetryBar}>
        <View style={styles.telemetryGroup}>
          <View style={styles.gpsFixDot} />
          <Text style={styles.coordText}>31.0772°N 78.1831°E</Text>
          <Text style={styles.elevationBadge}>3,812m</Text>
        </View>

        <View style={styles.topRightControls}>
          <View style={styles.batteryPill}>
            <BatteryCharging size={13} color={FieldColors.mossNeon} />
            <Text style={styles.batteryText}>88%</Text>
          </View>

          <KnurledButton
            label="+ IMPORT"
            variant="primary"
            size="sm"
            icon={<Plus size={13} color="#0F1210" />}
            onPress={() => setImportModalVisible(true)}
          />
        </View>
      </View>

      {/* Regional Filter Chips Bar */}
      <View style={styles.chipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'ALL' && styles.filterChipActive].filter(Boolean)}
            onPress={() => setActiveFilter('ALL')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'ALL' && styles.filterChipTextActive].filter(Boolean)}>
              ALL TRAILS ({allAvailableTrails.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'HIMALAYAS' && styles.filterChipActive].filter(Boolean)}
            onPress={() => setActiveFilter('HIMALAYAS')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'HIMALAYAS' && styles.filterChipTextActive].filter(Boolean)}>
              HIMALAYAS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'WESTERN_GHATS' && styles.filterChipActive].filter(Boolean)}
            onPress={() => setActiveFilter('WESTERN_GHATS')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'WESTERN_GHATS' && styles.filterChipTextActive].filter(Boolean)}>
              WESTERN GHATS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'NORTH_EAST' && styles.filterChipActive].filter(Boolean)}
            onPress={() => setActiveFilter('NORTH_EAST')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'NORTH_EAST' && styles.filterChipTextActive].filter(Boolean)}>
              NORTH-EAST
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, activeFilter === 'IMPORTED' && styles.filterChipActive].filter(Boolean)}
            onPress={() => setActiveFilter('IMPORTED')}
          >
            <Text style={[styles.filterChipText, activeFilter === 'IMPORTED' && styles.filterChipTextActive].filter(Boolean)}>
              USER IMPORTED ({importedTrails.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Map Canvas */}
      <View style={styles.mapArea}>
        <TopoMapView
          trails={displayedTrails}
          selectedTrail={selectedTrail}
          soiCandidateTrails={soiResult?.candidateTrails ?? []}
          onSelectTrail={(t) => setSelectedTrail(t)}
          onDeselect={() => setSelectedTrail(null)}
          regionFocus={activeFilter}
        />

        {/* SOI Scan Floating Pill if sheets detected */}
        {soiResult && (
          <TouchableOpacity
            style={styles.soiFloatingPill}
            onPress={() => setSoiOverlayVisible(true)}
            activeOpacity={0.8}
          >
            <Layers size={14} color="#D8B4FE" />
            <Text style={styles.soiFloatingText}>
              SOI {soiResult.sheetNumber ?? 'MAP'} ({(soiResult.candidateTrails ?? []).length} TRAILS DETECTED)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dismissible Bottom Trail Inspection Card */}
      {selectedTrail && (
        <View style={styles.inspectionCard}>
          {/* Card Header */}
          <View style={styles.inspectionHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.tagBadge,
                    {
                      backgroundColor: selectedTrail.isImported ? '#0C2836' : '#2D1B0A',
                      borderColor: selectedTrail.isImported ? FieldColors.glacierCyan : FieldColors.rescueOrange,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tagBadgeText,
                      { color: selectedTrail.isImported ? FieldColors.glacierCyan : FieldColors.rescueOrange },
                    ]}
                  >
                    {selectedTrail.isImported
                      ? 'USER TRACK'
                      : `SOI SHEET ${selectedTrail.soiSheetNumber ?? selectedTrail.soiSheet ?? 'N/A'}`}
                  </Text>
                </View>
                <Text style={styles.difficultyTag}>{selectedTrail.difficulty ?? 'Moderate'}</Text>
              </View>
              <Text style={styles.inspectionTrailName} numberOfLines={1}>
                {selectedTrail.name ?? 'Himalayan Trail'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setSelectedTrail(null)}
              style={styles.inspectionCloseBtn}
            >
              <X size={18} color={FieldColors.parchment} />
            </TouchableOpacity>
          </View>

          {/* Key Metrics Monospace Bar */}
          <View style={styles.metricsBar}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>DISTANCE</Text>
              <Text style={styles.metricVal}>{(selectedTrail.distanceKm ?? 0).toFixed(1)} km</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>ELEV GAIN</Text>
              <Text style={styles.metricVal}>
                +{Math.round(selectedTrail.elevationGainM ?? 0)}m
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>MAX ALT</Text>
              <Text style={styles.metricVal}>
                {Math.round(selectedTrail.maxAltitudeM ?? selectedTrail.maxAltM ?? 0)}m
              </Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>EST. TIME</Text>
              <Text style={styles.metricVal}>
                {selectedTrail.estimatedDurationHours ?? selectedTrail.duration ?? '1 Day'}
              </Text>
            </View>
          </View>

          {/* Interactive Touch-Scrubbing Elevation Graph */}
          {Array.isArray(selectedTrail.routeCoords) && selectedTrail.routeCoords.length > 2 && (
            <View style={styles.chartWrapper}>
              <ElevationChart
                routeCoords={selectedTrail.routeCoords}
                onScrubAltitude={(alt) => setScrubbedElevation(alt)}
              />
            </View>
          )}

          {/* Quick Action Button */}
          <View style={styles.actionRow}>
            <KnurledButton
              label="START EXPEDITION TRACKING"
              variant="primary"
              size="md"
              icon={<Play size={16} color="#0F1210" />}
              onPress={() => {
                Alert.alert(
                  'Expedition Started',
                  `Live tracking engaged for "${selectedTrail.name}". GPS sensors and BLE telemetry logging active.`
                );
              }}
            />
          </View>
        </View>
      )}

      {/* File Import Modal */}
      <FileImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onTrackImported={handleTrackImported}
        onSoiAnalyzed={handleSoiAnalyzed}
      />

      {/* SOI Topo Sheet Overlay */}
      <SoiScanOverlay
        visible={soiOverlayVisible}
        result={soiResult}
        onClose={() => setSoiOverlayVisible(false)}
        onSaveCandidateAsTrail={handleSaveCandidateAsTrail}
        savedCandidateIds={savedCandidateIds}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FieldColors.obsidianBasalt,
  },
  topTelemetryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#121714',
    borderBottomWidth: 1.5,
    borderBottomColor: '#232D27',
  },
  telemetryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsFixDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FieldColors.mossNeon,
  },
  coordText: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  elevationBadge: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    backgroundColor: '#262013',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16231C',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#243A2F',
  },
  batteryText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.mossNeon,
  },
  chipsContainer: {
    backgroundColor: '#151C18',
    borderBottomWidth: 1,
    borderBottomColor: '#242F28',
    paddingVertical: 6,
  },
  chipsScroll: {
    paddingHorizontal: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: '#1E2721',
    borderWidth: 1,
    borderColor: '#2C3A31',
  },
  filterChipActive: {
    backgroundColor: FieldColors.rescueOrange,
    borderColor: '#FF7733',
  },
  filterChipText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#8A9991',
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: '#0F1210',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  soiFloatingPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 22, 40, 0.95)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#A855F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  soiFloatingText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10.5,
    fontWeight: '900',
    color: '#E9D5FF',
    letterSpacing: 0.5,
  },
  inspectionCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: FieldColors.obsidianBasalt,
    borderTopWidth: 2,
    borderTopColor: FieldColors.contourOchre,
    padding: 14,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  tagBadgeText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  difficultyTag: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#9EAEA5',
  },
  inspectionTrailName: {
    fontFamily: FieldTypography.mono,
    fontSize: 15,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  inspectionCloseBtn: {
    padding: 4,
    backgroundColor: FieldColors.deepPine,
    borderRadius: 4,
  },
  metricsBar: {
    flexDirection: 'row',
    backgroundColor: FieldColors.deepPine,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#29352E',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#7C8C83',
    fontWeight: '700',
  },
  metricVal: {
    fontFamily: FieldTypography.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: FieldColors.parchment,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#29352E',
  },
  chartWrapper: {
    marginBottom: 10,
  },
  actionRow: {
    marginTop: 4,
  },
});
