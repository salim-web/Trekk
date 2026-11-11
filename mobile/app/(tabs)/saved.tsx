import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  Bookmark,
  Activity,
  HardDrive,
  Trash2,
  Share2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Layers,
  Zap,
  LogOut,
  ShieldCheck,
  MapPin,
  Download,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../../constants/FieldTokens';
import { DatabaseService } from '../../services/DatabaseService';
import { ParsedTrack } from '../../services/TrackParser';
import { StravaService } from '../../services/StravaService';
import { StravaConnectModal } from '../../components/StravaConnectModal';
import { KnurledButton } from '../../components/KnurledButton';

export default function SavedScreen() {
  const router = useRouter();
  const [tracks, setTracks] = useState<ParsedTrack[]>([]);
  const [stravaToken, setStravaToken] = useState<string | null>(null);
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [stravaModalVisible, setStravaModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    setLoading(true);
    const savedTracks = await DatabaseService.getImportedTracks();
    setTracks(savedTracks);

    const token = await StravaService.getStoredToken();
    const athlete = await StravaService.getStoredAthlete();
    setStravaToken(token);
    setAthleteName(athlete);
    setLoading(false);
  };

  const handleViewOnMap = (track: ParsedTrack) => {
    router.push({
      pathname: '/(tabs)/',
      params: { focusTrackId: track.id, trackName: track.name },
    });
  };

  const handleExportGpx = async (track: ParsedTrack) => {
    try {
      const gpxLines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="TrekIndia Tactical Field-Instrument"',
        '  xmlns="http://www.topografix.com/GPX/1/1"',
        '  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">',
        '  <metadata>',
        `    <name>${track.name}</name>`,
        '  </metadata>',
        '  <trk>',
        `    <name>${track.name}</name>`,
        '    <type>hiking</type>',
        '    <trkseg>',
      ];

      for (const pt of track.points) {
        gpxLines.push(`      <trkpt lat="${pt.latitude.toFixed(6)}" lon="${pt.longitude.toFixed(6)}">`);
        gpxLines.push(`        <ele>${pt.elevation.toFixed(1)}</ele>`);
        if (pt.timestamp) gpxLines.push(`        <time>${pt.timestamp}</time>`);
        if (pt.heartRate) {
          gpxLines.push('        <extensions>');
          gpxLines.push('          <gpxtpx:TrackPointExtension>');
          gpxLines.push(`            <gpxtpx:hr>${pt.heartRate}</gpxtpx:hr>`);
          gpxLines.push('          </gpxtpx:TrackPointExtension>');
          gpxLines.push('        </extensions>');
        }
        gpxLines.push('      </trkpt>');
      }

      gpxLines.push('    </trkseg>');
      gpxLines.push('  </trk>');
      gpxLines.push('</gpx>');

      const gpxString = gpxLines.join('\n');
      const safeName = (track.name || 'trail').replace(/[^a-zA-Z0-9]/g, '_');
      const targetPath = `${FileSystem.cacheDirectory || ''}TrekIndia_${safeName}.gpx`;

      await FileSystem.writeAsStringAsync(targetPath, gpxString, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetPath, {
          mimeType: 'application/gpx+xml',
          dialogTitle: `Share GPX Trail: ${track.name}`,
          UTI: 'com.topografix.gpx',
        });
      } else {
        Alert.alert('GPX Exported', `Saved to ${targetPath}`);
      }
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Could not export GPX file');
    }
  };

  const handleDeleteTrack = async (id?: string) => {
    if (!id) return;
    Alert.alert('Delete Track', 'Remove this track from local offline storage?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DELETE',
        style: 'destructive',
        onPress: async () => {
          await DatabaseService.deleteTrack(id);
          setTracks((prev) => prev.filter((t) => t.id !== id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.titleGroup}>
              <Bookmark size={15} color={FieldColors.contourOchre} />
              <Text style={styles.titleText}>SAVED TRAILS & STRAVA SYNC</Text>
            </View>
            <TouchableOpacity onPress={loadSavedData}>
              <RefreshCw size={14} color={FieldColors.parchment} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerSub}>OFFLINE EXPEDITIONS & STRAVA MAP REPAIR STATION</Text>
        </View>

        {/* Strava Bridge Card */}
        <View style={styles.stravaCard}>
          <View style={styles.stravaTopRow}>
            <View style={styles.stravaBrand}>
              <View style={styles.stravaBadge}>
                <Text style={styles.stravaBadgeText}>STRAVA</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stravaStatus} numberOfLines={1} ellipsizeMode="tail">
                  {stravaToken ? `CONNECTED: ${athleteName || 'ATHLETE'}` : 'DISCONNECTED'}
                </Text>
                {stravaToken && (
                  <Text style={styles.stravaModeSub} numberOfLines={1}>
                    {stravaToken === 'demo_token' ? 'MODE: LOCAL SANDBOX SIMULATOR' : 'MODE: LIVE STRAVA OAUTH'}
                  </Text>
                )}
              </View>
            </View>

            {!stravaToken && (
              <View style={styles.disconnectedTag}>
                <Text style={styles.disconnectedText}>NOT LINKED</Text>
              </View>
            )}
          </View>

          {stravaToken && (
            <View style={styles.connectedButtonsRow}>
              <View style={styles.liveTag}>
                <CheckCircle2 size={12} color={FieldColors.mossNeon} />
                <Text style={styles.liveTagText}>
                  {stravaToken === 'demo_token' ? 'SANDBOX ACTIVE' : 'LIVE OAUTH'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.cardDisconnectBtn}
                onPress={async () => {
                  await StravaService.disconnect();
                  setStravaToken(null);
                  setAthleteName(null);
                  Alert.alert('Strava Disconnected', 'Logged out of Strava. You can now connect a live account or re-enter sandbox mode.');
                }}
              >
                <LogOut size={12} color="#EF4444" />
                <Text style={styles.cardDisconnectBtnText}>DISCONNECT / SWITCH</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.stravaDesc}>
            Repair smartband missing GPS polylines with 30m CartoDEM elevation and push verified activities to Strava.
          </Text>

          {stravaToken ? (
            <View style={styles.stravaActionsRow}>
              <KnurledButton
                label="OPEN STRAVA MAP REPAIR HUB"
                variant="primary"
                size="md"
                icon={<Activity size={16} color="#0F1210" />}
                onPress={() => setStravaModalVisible(true)}
              />
            </View>
          ) : (
            <View style={styles.disconnectedActions}>
              <TouchableOpacity
                style={styles.connectLiveBtn}
                onPress={() => setStravaModalVisible(true)}
                activeOpacity={0.85}
              >
                <Activity size={16} color="#FFFFFF" />
                <Text style={styles.connectLiveBtnText}>🔗 CONNECT WITH STRAVA (LIVE OAUTH)</Text>
              </TouchableOpacity>

              <KnurledButton
                label="🧪 TRY SANDBOX DEMO MODE"
                variant="secondary"
                size="sm"
                icon={<ShieldCheck size={14} color={FieldColors.contourOchre} />}
                onPress={async () => {
                  await StravaService.saveAuth('demo_token', 'Devendra Singh (Himalayan Guide)');
                  setStravaToken('demo_token');
                  setAthleteName('Devendra Singh (Himalayan Guide)');
                  Alert.alert('Sandbox Active', 'Connected in Local Sandbox Mode with sample Smart Band activities.');
                }}
              />
            </View>
          )}
        </View>

        {/* User Imported Tracks List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            OFFLINE IMPORTED TRACKS ({tracks.length})
          </Text>
        </View>

        {tracks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>NO LOCAL TRACKS SAVED</Text>
            <Text style={styles.emptyDesc}>
              Tap "+ IMPORT" on the Topo Map tab to load .GPX, .TCX, or .FIT activity tracks from your device or smartband.
            </Text>
          </View>
        ) : (
          <View style={styles.tracksList}>
            {tracks.map((track) => (
              <View key={track.id} style={styles.trackCard}>
                <View style={styles.trackHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.formatRow}>
                      <View style={styles.formatBadge}>
                        <Text style={styles.formatText}>.{track.sourceFormat.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.pointsCount}>{track.points.length} points</Text>
                    </View>
                    <Text style={styles.trackName} numberOfLines={1}>
                      {track.name}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteTrack(track.id)}
                    style={styles.deleteBtn}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                {/* Specs */}
                <View style={styles.specsGrid}>
                  <View style={styles.specCell}>
                    <Text style={styles.specKey}>DIST</Text>
                    <Text style={styles.specVal}>{track.distanceKm.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.specCell}>
                    <Text style={styles.specKey}>GAIN</Text>
                    <Text style={styles.specVal}>+{Math.round(track.elevationGainM)}m</Text>
                  </View>
                  <View style={styles.specCell}>
                    <Text style={styles.specKey}>MAX ALT</Text>
                    <Text style={styles.specVal}>{Math.round(track.maxAltitudeM)}m</Text>
                  </View>
                  {track.averageHeartRate ? (
                    <View style={styles.specCell}>
                      <Text style={styles.specKey}>AVG HR</Text>
                      <Text style={[styles.specVal, { color: '#EF4444' }]}>
                        {track.averageHeartRate} bpm
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Actions: View on Topo Map & Share GPX */}
                <View style={styles.trackActionsRow}>
                  <TouchableOpacity
                    style={styles.viewOnMapBtn}
                    onPress={() => handleViewOnMap(track)}
                    activeOpacity={0.8}
                  >
                    <MapPin size={13} color="#0F1210" />
                    <Text style={styles.viewOnMapText}>VIEW ON TOPO MAP</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.exportGpxBtn}
                    onPress={() => handleExportGpx(track)}
                    activeOpacity={0.8}
                  >
                    <Share2 size={13} color={FieldColors.contourOchre} />
                    <Text style={styles.exportGpxText}>SHARE GPX</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Offline Cache Storage Manager */}
        <View style={styles.cacheCard}>
          <View style={styles.cacheHeader}>
            <HardDrive size={16} color={FieldColors.contourOchre} />
            <Text style={styles.cacheTitle}>OFFLINE TOPO & DEM CACHE STORAGE</Text>
          </View>

          <View style={styles.storageBarContainer}>
            <View style={styles.storageBarFill} />
          </View>
          <View style={styles.storageLabels}>
            <Text style={styles.storageText}>142 MB USED (SRTM + OPEN TOPO TILES)</Text>
            <Text style={styles.storageText}>2.0 GB MAX</Text>
          </View>

          <View style={styles.cachedSheetsList}>
            <View style={styles.cachedSheetRow}>
              <Layers size={13} color={FieldColors.parchment} />
              <Text style={styles.sheetName}>SOI 53J/15 (Kedarkantha & Har Ki Dun)</Text>
              <Text style={styles.sheetSize}>68 MB</Text>
            </View>
            <View style={styles.cachedSheetRow}>
              <Layers size={13} color={FieldColors.parchment} />
              <Text style={styles.sheetName}>SOI 43N/08 (Kang Yatse & Markha Valley)</Text>
              <Text style={styles.sheetSize}>74 MB</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Strava Modal */}
      <StravaConnectModal
        visible={stravaModalVisible}
        onClose={() => {
          setStravaModalVisible(false);
          loadSavedData();
        }}
        onActivityRepaired={() => {
          loadSavedData();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FieldColors.obsidianBasalt,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  header: {
    backgroundColor: '#121714',
    borderWidth: 1.5,
    borderColor: '#232D27',
    borderRadius: 8,
    padding: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 0.8,
  },
  headerSub: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#6E7E75',
    letterSpacing: 0.5,
  },
  stravaCard: {
    backgroundColor: '#1C1512',
    borderWidth: 1.5,
    borderColor: '#602B13',
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  stravaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stravaBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stravaBadge: {
    backgroundColor: '#FC4C02',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  stravaBadgeText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  stravaStatus: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  stravaModeSub: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    color: FieldColors.contourOchre,
    marginTop: 1,
  },
  connectedRightGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cardDisconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#301818',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#7F2A2A',
  },
  cardDisconnectBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    fontWeight: '800',
    color: '#EF4444',
  },
  stravaActionsRow: {
    marginTop: 2,
  },
  disconnectedActions: {
    gap: 8,
    marginTop: 2,
  },
  connectLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FC4C02',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderBottomWidth: 3,
    borderBottomColor: '#B03600',
  },
  connectLiveBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  connectedButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#103018',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveTagText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: FieldColors.mossNeon,
  },
  disconnectedTag: {
    backgroundColor: '#262A27',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  disconnectedText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: '#77887F',
  },
  stravaDesc: {
    fontFamily: FieldTypography.body,
    fontSize: 11,
    color: '#D4B09E',
    lineHeight: 15,
  },
  sectionHeader: {
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    letterSpacing: 0.6,
  },
  emptyCard: {
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#26332A',
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: FieldColors.parchment,
    marginBottom: 4,
  },
  emptyDesc: {
    fontFamily: FieldTypography.body,
    fontSize: 11,
    color: '#7B8C82',
    textAlign: 'center',
    lineHeight: 15,
  },
  tracksList: {
    gap: 10,
  },
  trackCard: {
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2A372E',
    borderRadius: 8,
    padding: 12,
  },
  trackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  formatBadge: {
    backgroundColor: '#0F2633',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: FieldColors.glacierCyan,
  },
  formatText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: FieldColors.glacierCyan,
  },
  pointsCount: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#7B8C82',
  },
  trackName: {
    fontFamily: FieldTypography.mono,
    fontSize: 12.5,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  deleteBtn: {
    padding: 6,
    backgroundColor: '#2A1717',
    borderRadius: 4,
  },
  specsGrid: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#111713',
    padding: 8,
    borderRadius: 6,
  },
  specCell: {
    flex: 1,
  },
  specKey: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#6B7A71',
    fontWeight: '700',
  },
  specVal: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: FieldColors.parchment,
    marginTop: 1,
  },
  trackActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  viewOnMapBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: FieldColors.glacierCyan,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  viewOnMapText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0F1210',
    letterSpacing: 0.5,
  },
  exportGpxBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1E2822',
    borderWidth: 1,
    borderColor: '#35473C',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  exportGpxText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    letterSpacing: 0.5,
  },
  cacheCard: {
    backgroundColor: '#131A15',
    borderWidth: 1.5,
    borderColor: '#233027',
    borderRadius: 8,
    padding: 14,
    gap: 8,
    marginTop: 6,
  },
  cacheHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cacheTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    letterSpacing: 0.6,
  },
  storageBarContainer: {
    height: 6,
    backgroundColor: '#0F1411',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 4,
  },
  storageBarFill: {
    width: '12%',
    height: '100%',
    backgroundColor: FieldColors.mossNeon,
  },
  storageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  storageText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#7B8C82',
  },
  cachedSheetsList: {
    gap: 6,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#1E2922',
    paddingTop: 8,
  },
  cachedSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetName: {
    flex: 1,
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    color: FieldColors.parchment,
  },
  sheetSize: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    color: FieldColors.contourOchre,
    fontWeight: '700',
  },
});
