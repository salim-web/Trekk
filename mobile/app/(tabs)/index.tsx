import React, { useState, useEffect, useRef } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
  Sliders,
  Check,
  Eye,
  Camera,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../../constants/FieldTokens';
import { SeededTrails, SEEDED_TRAILS, TrailModel } from '../../constants/SeededTrails';
import { TopoMapView, TopoMapViewHandle } from '../../components/TopoMapView';
import { ElevationChart } from '../../components/ElevationChart';
import { FileImportModal } from '../../components/FileImportModal';
import { SoiScanOverlay } from '../../components/SoiScanOverlay';
import { KnurledButton } from '../../components/KnurledButton';
import { DatabaseService, SquadMediaRecord } from '../../services/DatabaseService';
import { ParsedTrack } from '../../services/TrackParser';
import { SoiAnalysisResult, SoiCandidateTrail } from '../../services/SoiAnalysisService';
import {
  SoiExtractionResult,
  ExtractedTrail,
  SoiAnalyzerService,
} from '../../services/soiAnalyzerService';

type RegionFilter = 'ALL' | 'HIMALAYAS' | 'WESTERN_GHATS' | 'NORTH_EAST' | 'IMPORTED';

// Default safe fallback trails
const DEFAULT_FALLBACK_TRAILS: TrailModel[] =
  Array.isArray(SEEDED_TRAILS) && SEEDED_TRAILS.length > 0
    ? SEEDED_TRAILS
    : Array.isArray(SeededTrails) && SeededTrails.length > 0
    ? SeededTrails
    : [];

export default function TopoMapScreen() {
  const topoMapRef = useRef<TopoMapViewHandle>(null);
  const [activeFilter, setActiveFilter] = useState<RegionFilter>('ALL');
  const [selectedTrail, setSelectedTrail] = useState<TrailModel | null>(null);
  const [importedTrails, setImportedTrails] = useState<TrailModel[]>([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [soiResult, setSoiResult] = useState<SoiAnalysisResult | null>(null);
  const [soiOverlayVisible, setSoiOverlayVisible] = useState(false);
  const [savedCandidateIds, setSavedCandidateIds] = useState<string[]>([]);
  const [scrubbedElevation, setScrubbedElevation] = useState<number | null>(null);

  // FEATURE 2: SOI Raster Overlay & Inspector State
  const [soiOverlayData, setSoiOverlayData] = useState<SoiExtractionResult | null>(null);
  const [soiOpacity, setSoiOpacity] = useState<number>(0.72);
  const [layerVisibility, setLayerVisibility] = useState({
    raw: true,
    footpaths: true,
    water: true,
    camps: true,
  });

  // Synced Squad Photos from Camp Sync
  const [squadPhotos, setSquadPhotos] = useState<SquadMediaRecord[]>([]);

  // Load imported trails and synced squad photos on startup
  useEffect(() => {
    loadSavedTracks();
    loadSquadPhotos();
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

  const loadSquadPhotos = async () => {
    try {
      const media = await DatabaseService.getSquadMedia();
      const photos = media.filter((m) => m.type === 'photo' && m.isSynced);
      setSquadPhotos(photos);
    } catch (e) {
      console.warn('Error loading squad photos:', e);
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

  const handleSoiSheetOverlaid = (result: SoiExtractionResult) => {
    setSoiOverlayData(result);
  };

  const handleSoiAnalyzed = (result: SoiAnalysisResult) => {
    if (!result) return;
    setSoiResult(result);
  };

  const handleSaveCandidateAsTrail = async (candidate: SoiCandidateTrail | ExtractedTrail) => {
    try {
      if (!candidate) return;
      const coords = (candidate as any).coords || (candidate as any).coordinates || [];
      const pts = (candidate as any).points || coords.map((c: any) => ({
        latitude: c[0] ?? 0,
        longitude: c[1] ?? 0,
        elevation: c[2] ?? 2000,
      }));

      const parsedTrack: ParsedTrack = {
        name: candidate.name ?? 'SOI Extracted Route',
        sourceFormat: 'soi',
        points: pts.map((p: any) => ({
          latitude: p.latitude ?? 0,
          longitude: p.longitude ?? 0,
          elevation: p.elevation ?? 0,
        })),
        distanceKm: (candidate as any).distanceKm ?? (candidate as any).distance_km ?? 10.0,
        elevationGainM: (candidate as any).elevationGainM ?? (candidate as any).elevation_gain_m ?? (candidate as any).gain ?? 1200,
        maxAltitudeM: Math.max(...pts.map((p: any) => p.elevation ?? 0), 2500),
        minAltitudeM: Math.min(...pts.map((p: any) => p.elevation ?? 0), 1500),
      };

      const saved = await DatabaseService.saveImportedTrack(parsedTrack);
      setSavedCandidateIds((prev) => [...(prev ?? []), candidate.id]);
      handleTrackImported(saved);
      Alert.alert(
        'Trail Saved to Library',
        `"${candidate.name}" has been permanently added to your offline Topo Library!`
      );
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not save candidate trail.');
    }
  };

  const handleFocusSoiRoute = (route: ExtractedTrail) => {
    const coords: [number, number][] = (route.coords || []).map((c) => [c[0], c[1]]);
    if (topoMapRef.current) {
      topoMapRef.current.focusSoiTrail(route.id, coords);
    }
  };

  const handleExportGpx = async (route: ExtractedTrail) => {
    try {
      const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailApp-SOI" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${(route.name || 'SOI Trek').replace(/&/g, '&amp;')}</name>
  </metadata>
  <trk>
    <name>${(route.name || 'SOI Trek').replace(/&/g, '&amp;')}</name>
    <desc>${(route.guideSummary || '').replace(/&/g, '&amp;')}</desc>
    <trkseg>
${(route.coords || []).map((c) => `      <trkpt lat="${c[0]}" lon="${c[1]}"><ele>${c[2] || 0}</ele></trkpt>`).join('\n')}
    </trkseg>
  </trk>
</gpx>`;

      const sanitizeName = (route.name || 'soi_trail').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileUri = `${FileSystem.cacheDirectory}${sanitizeName}.gpx`;
      await FileSystem.writeAsStringAsync(fileUri, gpxContent, { encoding: 'utf8' });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/gpx+xml',
          dialogTitle: `Export ${route.name} GPX`,
          UTI: 'com.topografix.gpx',
        });
      } else {
        Alert.alert('Export GPX', `GPX file saved to:\n${fileUri}`);
      }
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || 'Could not export GPX file.');
    }
  };

  const handleSelectSoiExtractedTrail = (trail: ExtractedTrail) => {
    handleFocusSoiRoute(trail);
    Alert.alert(
      `🗺 ${trail.name}`,
      `• Match: ${trail.confidence}%\n• Distance: ${trail.distanceKm.toFixed(1)} km\n• Elev Gain: +${trail.gain}m\n• Duration: ~${trail.durationHours}h\n• Difficulty: ${trail.difficulty}\n• Water Springs: ${trail.waterCount} | Camps: ${trail.campCount ?? 1}\n\n${trail.guideSummary}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: '⬇ Export GPX', onPress: () => handleExportGpx(trail) },
        {
          text: savedCandidateIds.includes(trail.id) ? '✓ Saved' : '+ Save to My Trails',
          onPress: () => handleSaveCandidateAsTrail(trail),
        },
      ]
    );
  };

  const adjustOpacity = (delta: number) => {
    setSoiOpacity((prev) => {
      const next = Math.min(1.0, Math.max(0.0, Math.round((prev + delta) * 100) / 100));
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Row 1: 2-Element Header (GPS Pill + Compact Controls) */}
      <View style={styles.topTelemetryBar}>
        <View style={styles.telemetryGroup}>
          <View style={styles.gpsFixDot} />
          <Text style={styles.coordText} numberOfLines={1} ellipsizeMode="tail">
            {selectedTrail && selectedTrail.startCoord
              ? `${selectedTrail.startCoord[0].toFixed(2)}°N ${selectedTrail.startCoord[1].toFixed(2)}°E • ${Math.round(selectedTrail.maxAltitudeM || selectedTrail.maxAltM || 1040)}m`
              : '25.87°N 91.87°E • 1,040m'}
          </Text>
        </View>

        <View style={styles.topRightControls}>
          {squadPhotos.length > 0 && (
            <View style={styles.photoCountBadge}>
              <Camera size={11} color={FieldColors.glacierCyan} />
              <Text style={styles.photoCountText}>SQUAD ({squadPhotos.length})</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.importBtn}
            onPress={() => setImportModalVisible(true)}
            activeOpacity={0.85}
          >
            <Plus size={13} color="#0F1210" />
            <Text style={styles.importBtnText}>IMPORT</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 2: Regional Filter Chips Bar */}
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

          {soiOverlayData && (
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: '#3B1D52', borderColor: '#A855F7' }]}
              onPress={() => setImportModalVisible(true)}
            >
              <Text style={[styles.filterChipText, { color: '#D8B4FE' }]}>
                SOI: {soiOverlayData.sheetNumber}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Main Map Canvas */}
      <View style={styles.mapArea}>
        <TopoMapView
          ref={topoMapRef}
          trails={displayedTrails}
          selectedTrail={selectedTrail}
          soiCandidateTrails={soiResult?.candidateTrails ?? []}
          soiOverlayData={soiOverlayData}
          soiOpacity={soiOpacity}
          layerVisibility={layerVisibility}
          squadPhotos={squadPhotos}
          onSelectTrail={(t) => setSelectedTrail(t)}
          onSelectSoiTrail={handleSelectSoiExtractedTrail}
          onDeselect={() => setSelectedTrail(null)}
          regionFocus={activeFilter}
        />

        {/* FEATURE 2: Floating SOI Sheet Inspector Bar */}
        {soiOverlayData && (
          <View style={styles.soiInspectorBar}>
            {/* Inspector Top Row: Sheet info & Close */}
            <View style={styles.soiInspectorHeader}>
              <View style={styles.soiSheetPill}>
                <Layers size={13} color={FieldColors.contourOchre} />
                <Text style={styles.soiSheetPillText} numberOfLines={1}>
                  SOI SHEET {soiOverlayData.sheetNumber} ({soiOverlayData.sheetName})
                </Text>
              </View>

              <TouchableOpacity
                style={styles.soiCloseBtn}
                onPress={() => setSoiOverlayData(null)}
              >
                <X size={15} color={FieldColors.parchment} />
              </TouchableOpacity>
            </View>

            {/* Tactile Opacity Stepper & Direct Presets */}
            <View style={styles.opacityControlRow}>
              <View style={styles.opacityStepperGroup}>
                <Text style={styles.opacityLabel}>OPACITY:</Text>
                <TouchableOpacity
                  style={styles.opacityStepBtn}
                  onPress={() => adjustOpacity(-0.10)}
                >
                  <Text style={styles.opacityStepText}>-10%</Text>
                </TouchableOpacity>

                <View style={styles.opacityValuePill}>
                  <Sliders size={11} color={FieldColors.mossNeon} />
                  <Text style={styles.opacityValueText}>{Math.round(soiOpacity * 100)}%</Text>
                </View>

                <TouchableOpacity
                  style={styles.opacityStepBtn}
                  onPress={() => adjustOpacity(0.10)}
                >
                  <Text style={styles.opacityStepText}>+10%</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Presets (0% to 100%) */}
              <View style={styles.presetButtons}>
                {[0.0, 0.25, 0.5, 0.75, 1.0].map((presetVal) => (
                  <TouchableOpacity
                    key={presetVal}
                    style={[
                      styles.presetPill,
                      Math.abs(soiOpacity - presetVal) < 0.05 && styles.presetPillActive,
                    ].filter(Boolean)}
                    onPress={() => setSoiOpacity(presetVal)}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        Math.abs(soiOpacity - presetVal) < 0.05 && styles.presetTextActive,
                      ].filter(Boolean)}
                    >
                      {Math.round(presetVal * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Interactive Layer Toggle Pills: Raw Sheet, Footpaths, Water & Springs, Camp Grounds */}
            <View style={styles.layerTogglesRow}>
              {/* Toggle 1: Raw SOI Sheet */}
              <TouchableOpacity
                style={[styles.layerTogglePill, layerVisibility.raw && styles.layerTogglePillActive]}
                onPress={() => setLayerVisibility((prev) => ({ ...prev, raw: !prev.raw }))}
              >
                <Text style={[styles.layerTogglePillText, layerVisibility.raw && styles.layerTogglePillTextActive]}>
                  {layerVisibility.raw ? '☒' : '☐'} Raw Sheet
                </Text>
              </TouchableOpacity>

              {/* Toggle 2: Extracted Footpaths */}
              <TouchableOpacity
                style={[
                  styles.layerTogglePill,
                  layerVisibility.footpaths && { backgroundColor: '#3B1D52', borderColor: '#A855F7' },
                ]}
                onPress={() => setLayerVisibility((prev) => ({ ...prev, footpaths: !prev.footpaths }))}
              >
                <Text
                  style={[
                    styles.layerTogglePillText,
                    layerVisibility.footpaths ? { color: '#D8B4FE' } : { color: '#777' },
                  ]}
                >
                  {layerVisibility.footpaths ? '☒' : '☐'} Footpaths ({soiOverlayData.trails.length})
                </Text>
              </TouchableOpacity>

              {/* Toggle 3: Water & Springs */}
              <TouchableOpacity
                style={[
                  styles.layerTogglePill,
                  layerVisibility.water && { backgroundColor: '#0D2A3A', borderColor: '#38BDF8' },
                ]}
                onPress={() => setLayerVisibility((prev) => ({ ...prev, water: !prev.water }))}
              >
                <Text
                  style={[
                    styles.layerTogglePillText,
                    layerVisibility.water ? { color: '#7DD3FC' } : { color: '#777' },
                  ]}
                >
                  {layerVisibility.water ? '☒' : '☐'} Water ({soiOverlayData.pois.filter((p) => p.type === 'water').length})
                </Text>
              </TouchableOpacity>

              {/* Toggle 4: Camp Grounds */}
              <TouchableOpacity
                style={[
                  styles.layerTogglePill,
                  layerVisibility.camps && { backgroundColor: '#33270A', borderColor: '#FACC15' },
                ]}
                onPress={() => setLayerVisibility((prev) => ({ ...prev, camps: !prev.camps }))}
              >
                <Text
                  style={[
                    styles.layerTogglePillText,
                    layerVisibility.camps ? { color: '#FDE047' } : { color: '#777' },
                  ]}
                >
                  {layerVisibility.camps ? '☒' : '☐'} Camps ({soiOverlayData.pois.filter((p) => p.type === 'camp').length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* AI Trek Suggestions Carousel (3 Routes Found from SOI Topo Sheet) */}
            {soiOverlayData.trails && soiOverlayData.trails.length > 0 && (
              <View style={styles.soiSuggestionsContainer}>
                <View style={styles.soiSuggestionsHeader}>
                  <Compass size={13} color={FieldColors.contourOchre} />
                  <Text style={styles.soiSuggestionsTitle}>
                    AI TREK SUGGESTIONS ({soiOverlayData.trails.length} ROUTES FOUND)
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.soiSuggestionsScroll}
                >
                  {soiOverlayData.trails.map((route, idx) => {
                    const isSaved = savedCandidateIds.includes(route.id);
                    return (
                      <View key={route.id || idx} style={styles.soiRouteCard}>
                        {/* Header: Title & Match Confidence */}
                        <View style={styles.soiRouteHeader}>
                          <Text style={styles.soiRouteTitle} numberOfLines={1}>
                            {idx + 1}. {route.name}
                          </Text>
                          <View style={styles.confidencePill}>
                            <Text style={styles.confidenceText}>{route.confidence}% MATCH</Text>
                          </View>
                        </View>

                        {/* Metrics Badges Row */}
                        <View style={styles.soiRouteMetricsRow}>
                          <Text style={styles.soiRouteMetric}>{route.distanceKm.toFixed(1)} km</Text>
                          <Text style={styles.soiRouteMetricDot}>•</Text>
                          <Text style={styles.soiRouteMetric}>+{route.gain}m</Text>
                          <Text style={styles.soiRouteMetricDot}>•</Text>
                          <Text style={styles.soiRouteMetric}>~{route.durationHours}h</Text>
                          <Text style={styles.soiRouteMetricDot}>•</Text>
                          <Text style={[styles.soiRouteMetric, { color: FieldColors.contourOchre }]}>
                            {route.difficulty}
                          </Text>
                          <Text style={styles.soiRouteMetricDot}>•</Text>
                          <Text style={styles.soiRouteMetric}>💧 {route.waterCount}</Text>
                          <Text style={styles.soiRouteMetricDot}>•</Text>
                          <Text style={styles.soiRouteMetric}>⛺ {route.campCount ?? 1}</Text>
                        </View>

                        {/* Terrain & Trail Guide Summary */}
                        <Text style={styles.soiRouteGuideText} numberOfLines={2}>
                          {route.guideSummary}
                        </Text>

                        {/* 3 Interactive Action Buttons */}
                        <View style={styles.soiRouteActionsRow}>
                          {/* 1. Focus on Map */}
                          <TouchableOpacity
                            style={styles.soiRouteActionBtn}
                            onPress={() => handleFocusSoiRoute(route)}
                          >
                            <Eye size={11} color={FieldColors.parchment} />
                            <Text style={styles.soiRouteActionBtnText}>Focus</Text>
                          </TouchableOpacity>

                          {/* 2. Save to My Trails */}
                          <TouchableOpacity
                            style={[
                              styles.soiRouteActionBtn,
                              isSaved ? styles.soiRouteActionBtnSaved : styles.soiRouteActionBtnSave,
                            ]}
                            onPress={() => handleSaveCandidateAsTrail(route)}
                            disabled={isSaved}
                          >
                            <Plus size={11} color={isSaved ? '#4ADE80' : '#0F1210'} />
                            <Text
                              style={[
                                styles.soiRouteActionBtnText,
                                { color: isSaved ? '#4ADE80' : '#0F1210', fontWeight: '900' },
                              ]}
                            >
                              {isSaved ? 'Saved' : 'Save'}
                            </Text>
                          </TouchableOpacity>

                          {/* 3. Export GPX */}
                          <TouchableOpacity
                            style={styles.soiRouteActionBtn}
                            onPress={() => handleExportGpx(route)}
                          >
                            <Share2 size={11} color={FieldColors.parchment} />
                            <Text style={styles.soiRouteActionBtnText}>Export GPX</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
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
        onSoiSheetOverlaid={handleSoiSheetOverlaid}
      />

      {/* Legacy SOI Topo Sheet Overlay Modal */}
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
    paddingVertical: 6,
    backgroundColor: '#121714',
    borderBottomWidth: 1.5,
    borderBottomColor: '#232D27',
  },
  telemetryGroup: {
    flex: 1,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    flex: 1,
  },
  elevationBadge: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    color: FieldColors.contourOchre,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: FieldColors.rescueOrange,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
  },
  importBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: '#0F1210',
    letterSpacing: 0.5,
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0C2836',
    borderColor: FieldColors.glacierCyan,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  photoCountText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.glacierCyan,
  },
  batteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1C2620',
    borderColor: '#2A3A30',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  batteryText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.mossNeon,
  },
  chipsContainer: {
    backgroundColor: '#141A16',
    borderBottomWidth: 1.5,
    borderBottomColor: '#232D27',
    paddingVertical: 6,
  },
  chipsScroll: {
    paddingHorizontal: 10,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2D3A32',
    backgroundColor: '#19221C',
  },
  filterChipActive: {
    backgroundColor: FieldColors.rescueOrange,
    borderColor: FieldColors.rescueOrange,
  },
  filterChipText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#8E9E94',
    letterSpacing: 0.5,
  },
  filterChipTextActive: {
    color: '#0F1210',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  soiInspectorBar: {
    position: 'absolute',
    bottom: 12,
    left: 10,
    right: 10,
    backgroundColor: '#121714F5',
    borderColor: FieldColors.contourOchre,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 10,
    gap: 8,
    maxHeight: 380,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  soiInspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soiSheetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  soiSheetPillText: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: FieldColors.contourOchre,
    letterSpacing: 0.5,
  },
  soiCloseBtn: {
    padding: 4,
  },
  opacityControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  opacityStepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  opacityLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  opacityStepBtn: {
    backgroundColor: '#1F2922',
    borderColor: '#36483C',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  opacityStepText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  opacityValuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#17221A',
    borderColor: FieldColors.mossNeon,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  opacityValueText: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: FieldColors.mossNeon,
  },
  presetButtons: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 'auto',
  },
  presetPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    backgroundColor: '#1E2822',
  },
  presetPillActive: {
    backgroundColor: FieldColors.contourOchre,
  },
  presetText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#888',
  },
  presetTextActive: {
    color: '#0F1210',
  },
  layerTogglesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 2,
  },
  layerTogglePill: {
    backgroundColor: '#19221C',
    borderColor: '#29382E',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  layerTogglePillActive: {
    backgroundColor: '#172B1E',
    borderColor: FieldColors.mossNeon,
  },
  layerTogglePillText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#888',
  },
  layerTogglePillTextActive: {
    color: FieldColors.mossNeon,
  },
  soiNoticeText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#9CA3AF',
    flex: 1,
  },
  soiMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#202A24',
    paddingTop: 6,
    gap: 8,
  },
  featureBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  featBadge: {
    backgroundColor: '#18221B',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  featText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
  },
  saveRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: FieldColors.mossNeon,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  saveRouteBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: '#0F1210',
  },
  soiSuggestionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#202A24',
    paddingTop: 8,
    gap: 6,
  },
  soiSuggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  soiSuggestionsTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: FieldColors.contourOchre,
    letterSpacing: 0.5,
  },
  soiSuggestionsScroll: {
    gap: 10,
    paddingVertical: 2,
  },
  soiRouteCard: {
    width: 290,
    backgroundColor: '#161D18',
    borderColor: '#2D3E32',
    borderWidth: 1.2,
    borderRadius: 6,
    padding: 10,
    gap: 6,
  },
  soiRouteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  soiRouteTitle: {
    flex: 1,
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: FieldColors.parchment,
  },
  confidencePill: {
    backgroundColor: '#1E2D23',
    borderColor: '#4ADE80',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  confidenceText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: '#4ADE80',
  },
  soiRouteMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  soiRouteMetric: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  soiRouteMetricDot: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#555',
  },
  soiRouteGuideText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    lineHeight: 13,
    color: '#D1D5DB',
  },
  soiRouteActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  soiRouteActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: '#202A24',
    borderColor: '#36483C',
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  soiRouteActionBtnSave: {
    backgroundColor: FieldColors.mossNeon,
    borderColor: FieldColors.mossNeon,
  },
  soiRouteActionBtnSaved: {
    backgroundColor: '#172B1E',
    borderColor: '#4ADE80',
  },
  soiRouteActionBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  inspectionCard: {
    backgroundColor: '#131915',
    borderTopWidth: 2,
    borderTopColor: FieldColors.rescueOrange,
    padding: 12,
    gap: 10,
    maxHeight: 280,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tagBadge: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
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
    fontWeight: '800',
    color: FieldColors.contourOchre,
  },
  inspectionTrailName: {
    fontFamily: FieldTypography.mono,
    fontSize: 14,
    fontWeight: '900',
    color: FieldColors.parchment,
  },
  inspectionCloseBtn: {
    padding: 4,
  },
  metricsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18201B',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    color: '#7E9185',
    letterSpacing: 0.5,
  },
  metricVal: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: FieldColors.parchment,
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#2A362E',
  },
  chartWrapper: {
    marginTop: 2,
  },
  actionRow: {
    marginTop: 4,
  },
});
