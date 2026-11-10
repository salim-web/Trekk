import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Users,
  Radio,
  Wifi,
  QrCode,
  ShieldAlert,
  Battery,
  Signal,
  Compass,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../../constants/FieldTokens';
import { KnurledButton } from '../../components/KnurledButton';

interface MeshNode {
  id: string;
  name: string;
  role: string;
  distanceMeters: number;
  bearingDeg: number;
  batteryPct: number;
  rssiDbm: number;
  lastPingSecs: number;
}

const INITIAL_NODES: MeshNode[] = [
  {
    id: 'node_1',
    name: 'Tenzing Norgay (Lead Guide)',
    role: 'GUIDE',
    distanceMeters: 45,
    bearingDeg: 35,
    batteryPct: 91,
    rssiDbm: -56,
    lastPingSecs: 2,
  },
  {
    id: 'node_2',
    name: 'Rohan Sharma (Xiaomi Band)',
    role: 'TREKKER',
    distanceMeters: 82,
    bearingDeg: 210,
    batteryPct: 76,
    rssiDbm: -68,
    lastPingSecs: 5,
  },
  {
    id: 'node_3',
    name: 'Maya Sen (Sweep)',
    role: 'SWEEP',
    distanceMeters: 140,
    bearingDeg: 165,
    batteryPct: 62,
    rssiDbm: -81,
    lastPingSecs: 9,
  },
];

export default function SquadsScreen() {
  const [nodes, setNodes] = useState<MeshNode[]>(INITIAL_NODES);
  const [campSyncActive, setCampSyncActive] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState<string | null>(null);

  const handleBroadcast = (status: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setLastBroadcast(status);
    Alert.alert(
      'BLE Mesh Broadcast',
      `Transmitted status "${status}" across 3 hops to all expedition members via offline BLE advertisement frames.`
    );
  };

  const toggleCampSync = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setCampSyncActive(!campSyncActive);
    if (!campSyncActive) {
      Alert.alert(
        'Camp Sync Server Running',
        'Offline HTTP/WS sync socket active on port 8080.\nOther team members can point their camera at your screen to sync cached map tiles, waypoint notes, and GPS tracks without cellular data.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.radarPill}>
              <Radio size={14} color={FieldColors.mossNeon} />
              <Text style={styles.radarPillText}>CAMPFIRE P2P BLE MESH</Text>
            </View>
            <View style={styles.nodeCountBadge}>
              <Text style={styles.nodeCountText}>{nodes.length} SQUAD PEERS IN RANGE</Text>
            </View>
          </View>
          <Text style={styles.subText}>
            ZERO-CELLULAR BLUETOOTH LOW ENERGY AD-HOC COMMUNICATIONS MATRIX
          </Text>
        </View>

        {/* Tactical Radar Display Widget */}
        <View style={styles.radarCard}>
          <View style={styles.radarCircleOuter}>
            <View style={styles.radarCircleMiddle}>
              <View style={styles.radarCircleInner}>
                <View style={styles.radarCenterMe}>
                  <Text style={styles.radarCenterText}>YOU</Text>
                </View>
              </View>
            </View>

            {/* Radar Crosshairs */}
            <View style={styles.crosshairH} />
            <View style={styles.crosshairV} />

            {/* Simulated Blips */}
            <View style={[styles.blip, { top: '25%', right: '35%', backgroundColor: FieldColors.mossNeon }]} />
            <View style={[styles.blip, { bottom: '28%', left: '32%', backgroundColor: FieldColors.glacierCyan }]} />
            <View style={[styles.blip, { bottom: '20%', right: '42%', backgroundColor: FieldColors.contourOchre }]} />
          </View>
          <Text style={styles.radarLegend}>MAX RANGE: 250M • MULTI-HOP RELAY ACTIVE</Text>
        </View>

        {/* Quick Tactical Broadcast Beacons */}
        <View style={styles.broadcastSection}>
          <Text style={styles.sectionLabel}>QUICK SQUAD BLE STATUS BROADCAST</Text>
          <View style={styles.broadcastButtons}>
            <TouchableOpacity
              style={styles.broadcastBtn}
              onPress={() => handleBroadcast('HOLD POSITION / WAIT')}
            >
              <Text style={styles.broadcastBtnText}>🛑 HOLD POSITION</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.broadcastBtn}
              onPress={() => handleBroadcast('WATER SPRING LOCATED')}
            >
              <Text style={styles.broadcastBtnText}>💧 WATER FOUND</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.broadcastBtn}
              onPress={() => handleBroadcast('TRAIL FORK / TAKE LEFT')}
            >
              <Text style={styles.broadcastBtnText}>🔀 FORK: LEFT</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.broadcastBtn}
              onPress={() => handleBroadcast('ALL OK / REGULAR PACE')}
            >
              <Text style={styles.broadcastBtnText}>✅ ALL OK</Text>
            </TouchableOpacity>
          </View>
          {lastBroadcast && (
            <Text style={styles.lastBroadcastText}>Last packet: "{lastBroadcast}"</Text>
          )}
        </View>

        {/* Peer Telemetry List */}
        <View style={styles.peersSection}>
          <Text style={styles.sectionLabel}>SQUAD SENSORS & TELEMETRY</Text>
          <View style={styles.nodesList}>
            {nodes.map((node) => (
              <View key={node.id} style={styles.nodeCard}>
                <View style={styles.nodeTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nodeName}>{node.name}</Text>
                    <Text style={styles.nodeRole}>{node.role}</Text>
                  </View>
                  <View style={styles.nodeDistanceBadge}>
                    <Compass size={12} color={FieldColors.parchment} />
                    <Text style={styles.nodeDistanceText}>{node.distanceMeters}m</Text>
                  </View>
                </View>

                <View style={styles.nodeMetricsRow}>
                  <View style={styles.nodeMetric}>
                    <Battery size={13} color={FieldColors.mossNeon} />
                    <Text style={styles.metricText}>{node.batteryPct}%</Text>
                  </View>
                  <View style={styles.nodeMetric}>
                    <Signal size={13} color={FieldColors.glacierCyan} />
                    <Text style={styles.metricText}>{node.rssiDbm} dBm</Text>
                  </View>
                  <View style={styles.nodeMetric}>
                    <Text style={styles.pingText}>{node.lastPingSecs}s ago</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Camp Sync P2P Server */}
        <View style={styles.campSyncCard}>
          <View style={styles.campSyncHeader}>
            <Wifi size={18} color={campSyncActive ? FieldColors.mossNeon : '#888'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.campSyncTitle}>CAMP SYNC LOCAL HOTSPOT SERVER</Text>
              <Text style={styles.campSyncSub}>
                {campSyncActive ? 'ACTIVE: 192.168.49.1:8080' : 'OFFLINE'}
              </Text>
            </View>
          </View>
          <Text style={styles.campSyncDesc}>
            Hosts offline P2P map tile & GPX sync via local WiFi Direct or Bluetooth PAN hotspot.
          </Text>
          <KnurledButton
            label={campSyncActive ? 'STOP CAMP SYNC SERVER' : 'START CAMP SYNC SERVER'}
            variant={campSyncActive ? 'secondary' : 'accent'}
            size="md"
            icon={<QrCode size={16} color={campSyncActive ? FieldColors.parchment : '#0F1210'} />}
            onPress={toggleCampSync}
          />
        </View>
      </ScrollView>
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
  radarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radarPillText: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: FieldColors.mossNeon,
    letterSpacing: 0.8,
  },
  nodeCountBadge: {
    backgroundColor: '#182C20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: FieldColors.mossNeon,
  },
  nodeCountText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: FieldColors.mossNeon,
  },
  subText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#6E7E75',
    letterSpacing: 0.5,
  },
  radarCard: {
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2B372F',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  radarCircleOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: '#2D3E33',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#0F1511',
  },
  radarCircleMiddle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: '#24352A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCircleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#1F2E24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCenterMe: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: FieldColors.rescueOrange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  radarCenterText: {
    fontFamily: FieldTypography.mono,
    fontSize: 7.5,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  crosshairH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: '#1B2920',
  },
  crosshairV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: '#1B2920',
  },
  blip: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  radarLegend: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  broadcastSection: {
    backgroundColor: '#131A15',
    borderWidth: 1.5,
    borderColor: '#243027',
    borderRadius: 8,
    padding: 12,
  },
  sectionLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    marginBottom: 10,
    letterSpacing: 0.6,
  },
  broadcastButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  broadcastBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2E3D33',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  broadcastBtnText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  lastBroadcastText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.mossNeon,
    marginTop: 8,
    textAlign: 'center',
  },
  peersSection: {
    gap: 8,
  },
  nodesList: {
    gap: 8,
  },
  nodeCard: {
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2B372F',
    borderRadius: 6,
    padding: 12,
  },
  nodeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nodeName: {
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  nodeRole: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.contourOchre,
    fontWeight: '700',
    marginTop: 1,
  },
  nodeDistanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#121A15',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#233328',
  },
  nodeDistanceText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.parchment,
  },
  nodeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#202C24',
    paddingTop: 8,
  },
  nodeMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '700',
    color: FieldColors.parchment,
  },
  pingText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#65736C',
  },
  campSyncCard: {
    backgroundColor: '#151D18',
    borderWidth: 1.5,
    borderColor: '#28362B',
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  campSyncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  campSyncTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  campSyncSub: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.mossNeon,
    fontWeight: '700',
  },
  campSyncDesc: {
    fontFamily: FieldTypography.body,
    fontSize: 11,
    color: '#9EAEA5',
    lineHeight: 15,
  },
});
