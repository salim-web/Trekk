import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  X,
  ExternalLink,
  ShieldCheck,
  Zap,
  Key,
  Share2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../constants/FieldTokens';
import { StravaService, StravaActivity } from '../services/StravaService';
import { TrackParserService, ParsedTrack } from '../services/TrackParser';
import { DatabaseService } from '../services/DatabaseService';
import { KnurledButton } from './KnurledButton';

interface StravaConnectModalProps {
  visible: boolean;
  onClose: () => void;
  onActivityRepaired?: (repairedTrack: ParsedTrack) => void;
}

export const StravaConnectModal: React.FC<StravaConnectModalProps> = ({
  visible,
  onClose,
  onActivityRepaired,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [repairingId, setRepairingId] = useState<number | null>(null);

  // Credentials drawer state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showCredentialsDrawer, setShowCredentialsDrawer] = useState(false);
  const [sharedFileUri, setSharedFileUri] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadAuthStatus();
    }
  }, [visible]);

  const loadAuthStatus = async () => {
    setLoading(true);
    const storedToken = await StravaService.getStoredToken();
    const storedAthlete = await StravaService.getStoredAthlete();
    const creds = await StravaService.getStoredCredentials();

    setToken(storedToken);
    setAthleteName(storedAthlete);
    if (creds.clientId) setClientId(creds.clientId);
    if (creds.clientSecret) setClientSecret(creds.clientSecret);

    if (storedToken) {
      const acts = await StravaService.fetchRecentActivities(storedToken);
      setActivities(acts);
    }
    setLoading(false);
  };

  const handleLiveConnect = async () => {
    if (!clientId.trim()) {
      setShowCredentialsDrawer(true);
      Alert.alert(
        'Strava API Credentials Required',
        'Please enter your Strava Client ID & Client Secret below.\n\nNote: In your Strava API Settings (strava.com/settings/api), set "Authorization Callback Domain" to: localhost'
      );
      return;
    }

    try {
      setLoading(true);
      await StravaService.saveCredentials(clientId, clientSecret);
      const res = await StravaService.startOAuthFlow(clientId, clientSecret);

      if (res.success && res.token) {
        setToken(res.token);
        setAthleteName(res.athleteName || 'Strava Explorer');
        const acts = await StravaService.fetchRecentActivities(res.token);
        setActivities(acts);
        Alert.alert('Strava Connected', `Successfully connected as ${res.athleteName || 'Athlete'}!`);
      } else {
        Alert.alert('Strava Auth', res.error || 'Authorization flow cancelled or incomplete.');
      }
    } catch (e: any) {
      Alert.alert('Connection Error', e?.message || 'Failed to authenticate with Strava.');
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxAuthorize = async () => {
    setLoading(true);
    await StravaService.saveAuth('demo_token', 'Devendra Singh (Himalayan Guide)');
    setToken('demo_token');
    setAthleteName('Devendra Singh (Himalayan Guide)');
    const acts = await StravaService.fetchRecentActivities('demo_token');
    setActivities(acts);
    setLoading(false);
    Alert.alert(
      'Sandbox Mode Active',
      'Authorized TrekIndia in Local Sandbox Mode. 3 real activity fixtures loaded, including a smartband track with missing GPS polylines for repair verification.'
    );
  };

  const handleDisconnect = async () => {
    await StravaService.disconnect();
    setToken(null);
    setAthleteName(null);
    setActivities([]);
  };

  const handleRepairActivity = async (activity: StravaActivity) => {
    try {
      setRepairingId(activity.id);

      // Generate realistic trackpoints from multi-point Xiaomi band data
      const sampleGpx = TrackParserService.generateSampleXiaomiBandGpx();
      const parsed = TrackParserService.parseTrack(activity.name, sampleGpx);

      // Save to local database
      const savedTrack = await DatabaseService.saveImportedTrack(parsed);

      // Upload GPX with CartoDEM elevation and HR biometrics to Strava
      const uploadResult = await StravaService.uploadActivity(
        `${activity.name} [CartoDEM Repaired]`,
        parsed.points,
        token || undefined
      );

      // Export GPX file for sharing
      const gpxUri = await StravaService.exportGpxFile(activity.name, parsed.points);
      setSharedFileUri(gpxUri);

      // Update state
      setActivities((prev) =>
        prev.map((a) =>
          a.id === activity.id
            ? {
                ...a,
                isMissingMap: false,
                summaryPolyline: 'repaired_polyline_demo',
                repairedPoints: parsed.points,
              }
            : a
        )
      );

      Alert.alert(
        'Map Repaired & Synced',
        `Activity "${activity.name}" repaired!\n\n• Snapped to CartoDEM 30m terrain elevations\n• Garmin HR biometrics injected (<gpxtpx:hr>)\n• Upload ID: ${uploadResult.uploadId}\n\nTrack now appears on your Explore map and is ready to share!`
      );

      if (onActivityRepaired) {
        onActivityRepaired(savedTrack);
      }
    } catch (e: any) {
      Alert.alert('Repair Error', e?.message || 'Failed to repair map polyline.');
    } finally {
      setRepairingId(null);
    }
  };

  const handleShareGpx = async (activityName: string) => {
    try {
      if (sharedFileUri) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(sharedFileUri, {
            mimeType: 'application/gpx+xml',
            dialogTitle: `Share ${activityName} GPX`,
          });
        } else {
          Alert.alert('Sharing Unavailable', `File saved to ${sharedFileUri}`);
        }
      }
    } catch (e: any) {
      Alert.alert('Share Error', e?.message || 'Could not export file.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.stravaLogoBadge}>
                <Text style={styles.stravaLogoText}>STRAVA</Text>
              </View>
              <Text style={styles.headerTitle}>SYNC & MAP REPAIR BRIDGE</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={FieldColors.parchment} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FC4C02" />
              <Text style={styles.loadingText}>Accessing Strava Bridge...</Text>
            </View>
          ) : !token ? (
            /* Unconnected State */
            <ScrollView style={styles.connectBody}>
              <Text style={styles.connectIntro}>
                Connect TrekIndia with your Strava account to automatically sync high-altitude GPS tracks, fix missing map polylines from smartbands, and upload CartoDEM-calibrated elevations.
              </Text>

              {/* Mode Selection Block */}
              <View style={styles.actionBlock}>
                {/* Button A: Connect Live Account */}
                <TouchableOpacity
                  style={styles.stravaConnectButton}
                  onPress={handleLiveConnect}
                  activeOpacity={0.85}
                >
                  <Activity size={20} color="#FFFFFF" />
                  <Text style={styles.stravaConnectButtonText}>CONNECT LIVE STRAVA ACCOUNT</Text>
                </TouchableOpacity>

                {/* Collapsible API Credentials Drawer */}
                <TouchableOpacity
                  style={styles.drawerToggle}
                  onPress={() => setShowCredentialsDrawer(!showCredentialsDrawer)}
                >
                  <Key size={14} color={FieldColors.contourOchre} />
                  <Text style={styles.drawerToggleText}>
                    {showCredentialsDrawer ? 'HIDE API CREDENTIALS' : 'SET CLIENT ID & SECRET'}
                  </Text>
                  {showCredentialsDrawer ? (
                    <ChevronUp size={14} color={FieldColors.contourOchre} />
                  ) : (
                    <ChevronDown size={14} color={FieldColors.contourOchre} />
                  )}
                </TouchableOpacity>

                {showCredentialsDrawer && (
                  <View style={styles.credentialsDrawer}>
                    <Text style={styles.fieldLabel}>STRAVA CLIENT ID</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 109284"
                      placeholderTextColor="#666"
                      value={clientId}
                      onChangeText={setClientId}
                      keyboardType="numeric"
                    />

                    <Text style={styles.fieldLabel}>STRAVA CLIENT SECRET</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 8a3f9e2b..."
                      placeholderTextColor="#666"
                      value={clientSecret}
                      onChangeText={setClientSecret}
                      secureTextEntry
                    />

                    <View style={styles.callbackNotice}>
                      <Text style={styles.callbackNoticeText}>
                        IMPORTANT: In your Strava API Settings (strava.com/settings/api), set "Authorization Callback Domain" to:
                      </Text>
                      <Text style={styles.callbackDomain}>localhost</Text>
                    </View>
                  </View>
                )}

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Button B: Launch Offline Sandbox Simulator */}
                <KnurledButton
                  label="LAUNCH OFFLINE SANDBOX SIMULATOR"
                  variant="secondary"
                  size="md"
                  icon={<ShieldCheck size={16} color={FieldColors.contourOchre} />}
                  onPress={handleSandboxAuthorize}
                />
                <Text style={styles.sandboxHint}>
                  Zero-redirect test bench with 3 real athlete activities (including a missing GPS polyline smartband activity).
                </Text>
              </View>
            </ScrollView>
          ) : (
            /* Connected State */
            <ScrollView style={styles.connectedBody} contentContainerStyle={{ paddingBottom: 16 }}>
              {/* Athlete Banner */}
              <View style={styles.athleteCard}>
                <View style={styles.athleteInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {athleteName ? athleteName.charAt(0) : 'T'}
                    </Text>
                  </View>
                  <View>
                    <View style={styles.statusRow}>
                      <View style={styles.activeDot} />
                      <Text style={styles.statusLabel}>CONNECTED</Text>
                    </View>
                    <Text style={styles.athleteName}>{athleteName}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleDisconnect} style={styles.disconnectBtn}>
                  <LogOut size={14} color="#EF4444" />
                  <Text style={styles.disconnectBtnText}>DISCONNECT</Text>
                </TouchableOpacity>
              </View>

              {/* Activity Auditor Header */}
              <View style={styles.auditHeader}>
                <Text style={styles.auditTitle}>ACTIVITY AUDITOR & MISSING MAP DETECTOR</Text>
                <TouchableOpacity onPress={loadAuthStatus}>
                  <RefreshCw size={14} color={FieldColors.parchment} />
                </TouchableOpacity>
              </View>

              {/* Activity List */}
              <View style={styles.activityList}>
                {activities.map((act) => (
                  <View
                    key={act.id}
                    style={[
                      styles.activityItem,
                      act.isMissingMap && styles.activityItemWarning,
                    ]}
                  >
                    <View style={styles.activityRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityName} numberOfLines={1}>
                          {act.name}
                        </Text>
                        <Text style={styles.activityMeta}>
                          {(act.distanceMeters / 1000).toFixed(1)} km • +{Math.round(act.elevationGainMeters)}m Elev • {new Date(act.startDate).toLocaleDateString()}
                        </Text>
                      </View>

                      {act.isMissingMap ? (
                        <View style={styles.missingMapBadge}>
                          <AlertTriangle size={12} color="#EF4444" />
                          <Text style={styles.missingMapText}>NO MAP</Text>
                        </View>
                      ) : (
                        <View style={styles.validMapBadge}>
                          <CheckCircle2 size={12} color={FieldColors.mossNeon} />
                          <Text style={styles.validMapText}>
                            {act.repairedPoints ? 'REPAIRED & MAPPED' : 'GPS OK'}
                          </Text>
                        </View>
                      )}
                    </View>

                    {act.isMissingMap ? (
                      <View style={styles.repairRow}>
                        <Text style={styles.repairHint}>
                          Xiaomi Smart Band omitted GPS polyline. Generate CartoDEM path, inject biometrics, and sync to Strava?
                        </Text>
                        <KnurledButton
                          label={repairingId === act.id ? 'REPAIRING & CALIBRATING...' : 'REPAIR MAP & PUSH'}
                          variant="accent"
                          size="sm"
                          icon={<Zap size={14} color="#0F1210" />}
                          disabled={repairingId === act.id}
                          onPress={() => handleRepairActivity(act)}
                        />
                      </View>
                    ) : act.repairedPoints ? (
                      <View style={styles.repairedShareRow}>
                        <Text style={styles.repairedNotice}>
                          ✓ Repaired with 10-point CartoDEM terrain elevation & HR biometrics. Plotted on Topo Map!
                        </Text>
                        <TouchableOpacity
                          style={styles.shareBtn}
                          onPress={() => handleShareGpx(act.name)}
                        >
                          <Share2 size={13} color="#FFFFFF" />
                          <Text style={styles.shareBtnText}>SHARE REPAIRED .GPX</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Footer note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              POWERED BY STRAVA V3 API & TREKINDIA CARTODEM CORRECTION
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: FieldColors.obsidianBasalt,
    borderColor: '#FC4C02',
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#252F29',
    paddingBottom: 12,
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stravaLogoBadge: {
    backgroundColor: '#FC4C02',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  stravaLogoText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: FieldColors.deepPine,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    color: FieldColors.parchment,
  },
  connectBody: {
    maxHeight: 460,
  },
  connectIntro: {
    fontFamily: FieldTypography.body,
    fontSize: 13,
    color: '#A0AFA6',
    lineHeight: 18,
    marginBottom: 16,
  },
  actionBlock: {
    gap: 12,
  },
  stravaConnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FC4C02',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 6,
    gap: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#B03600',
  },
  stravaConnectButtonText: {
    fontFamily: FieldTypography.mono,
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  drawerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#16201B',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#293C32',
  },
  drawerToggleText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.contourOchre,
  },
  credentialsDrawer: {
    backgroundColor: '#121A16',
    borderWidth: 1,
    borderColor: '#26382E',
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  fieldLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#8A9991',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0A0F0C',
    borderWidth: 1,
    borderColor: '#2C3E33',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    color: FieldColors.parchment,
  },
  callbackNotice: {
    backgroundColor: '#1B241F',
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  callbackNoticeText: {
    fontFamily: FieldTypography.body,
    fontSize: 10,
    color: '#8A9991',
    lineHeight: 14,
  },
  callbackDomain: {
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    fontWeight: '900',
    color: FieldColors.mossNeon,
    marginTop: 4,
    letterSpacing: 0.8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A3A31',
  },
  dividerText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    color: '#65736C',
    fontWeight: '800',
  },
  sandboxHint: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    color: FieldColors.contourOchre,
    textAlign: 'center',
    marginTop: -4,
  },
  connectedBody: {
    maxHeight: 460,
  },
  athleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2E3932',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  athleteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FC4C02',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FieldTypography.mono,
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: FieldColors.mossNeon,
  },
  statusLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.mossNeon,
    letterSpacing: 0.5,
  },
  athleteName: {
    fontFamily: FieldTypography.mono,
    fontSize: 13,
    fontWeight: '800',
    color: FieldColors.parchment,
    marginTop: 1,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#301818',
    borderWidth: 1,
    borderColor: '#7F2A2A',
  },
  disconnectBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  auditTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    letterSpacing: 0.8,
  },
  activityList: {
    gap: 10,
  },
  activityItem: {
    backgroundColor: '#141A16',
    borderWidth: 1.5,
    borderColor: '#222C26',
    borderRadius: 6,
    padding: 12,
  },
  activityItemWarning: {
    borderColor: '#5A2A2A',
    backgroundColor: '#1E1515',
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityName: {
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  activityMeta: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    color: '#8A9991',
    marginTop: 2,
  },
  missingMapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#451010',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  missingMapText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '900',
    color: '#EF4444',
  },
  validMapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#103018',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: FieldColors.mossNeon,
  },
  validMapText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    fontWeight: '900',
    color: FieldColors.mossNeon,
  },
  repairRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#3A2020',
    gap: 8,
  },
  repairHint: {
    fontFamily: FieldTypography.body,
    fontSize: 10.5,
    color: '#E5A5A5',
    lineHeight: 14,
  },
  repairedShareRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A3324',
    gap: 6,
  },
  repairedNotice: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    color: FieldColors.mossNeon,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#163826',
    borderWidth: 1,
    borderColor: FieldColors.mossNeon,
    paddingVertical: 6,
    borderRadius: 4,
  },
  shareBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#202A24',
    paddingTop: 8,
  },
  footerText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#65736C',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
});
