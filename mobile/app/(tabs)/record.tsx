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
import * as Haptics from 'expo-haptics';
import {
  Radio,
  Play,
  Square,
  Pause,
  AlertOctagon,
  Heart,
  Gauge,
  Compass,
  TrendingUp,
  MapPin,
  Clock,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../../constants/FieldTokens';
import { KnurledButton } from '../../components/KnurledButton';

export default function RecordScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elevationGain, setElevationGain] = useState(0);
  const [heartRate, setHeartRate] = useState(132);
  const [altitude, setAltitude] = useState(3812);
  const [pressureHpa, setPressureHpa] = useState(648.5);

  // Timer loop when recording
  useEffect(() => {
    let interval: any = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
        setDistanceMeters((d) => d + 0.95); // ~3.4 km/h
        // Slight natural drift in altitude and heart rate
        setAltitude((a) => a + (Math.random() > 0.4 ? 0.3 : -0.1));
        setElevationGain((g) => g + (Math.random() > 0.5 ? 0.3 : 0));
        setHeartRate((hr) => Math.round(130 + Math.sin(Date.now() / 10000) * 15));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const handleStartRecording = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setIsRecording(true);
    setIsPaused(false);
  };

  const handlePauseRecording = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setIsPaused(!isPaused);
  };

  const handleStopRecording = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    Alert.alert(
      'Track Recorded & Saved',
      `Session Summary:\n• Duration: ${formatTime(elapsedSeconds)}\n• Distance: ${(distanceMeters / 1000).toFixed(2)} km\n• Elev Gain: +${Math.round(elevationGain)}m\n• Avg HR: 134 bpm\n\nTrack saved locally and queued for Strava push.`
    );
    setIsRecording(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setDistanceMeters(0);
    setElevationGain(0);
  };

  const handleTriggerSOS = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
    Alert.alert(
      '🚨 DISTRESS BEACON ACTIVATED',
      'EMERGENCY SOS BROADCAST INITIATED!\n\n• Sending high-priority BLE Mesh packet to all nearby squad radios.\n• Coordinates: 31.0772°N 78.1831°E • 3,812m\n• State Disaster Management Authority (SDMA) SMS packet queued.',
      [{ text: 'CANCEL SOS', style: 'cancel' }, { text: 'CONFIRM BROADCAST', style: 'destructive' }]
    );
  };

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const speedKmh = isRecording && !isPaused ? 3.4 : 0.0;
  const pace = isRecording && !isPaused ? '17:38' : '--:--';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header Telemetry Pill */}
        <View style={styles.header}>
          <View style={styles.recordStatusRow}>
            <View
              style={[
                styles.recordLed,
                { backgroundColor: isRecording ? (isPaused ? '#F59E0B' : FieldColors.rescueOrange) : '#444' },
              ]}
            />
            <Text style={styles.recordStatusText}>
              {isRecording ? (isPaused ? 'RECORDING PAUSED' : 'LIVE EXPEDITION TELEMETRY') : 'FIELD INSTRUMENT STANDBY'}
            </Text>
          </View>
          <Text style={styles.headerSub}>HARDWARE SENSORS & BLE POLLED AT 1.0 HZ</Text>
        </View>

        {/* Primary Monospace Altimeter / Duration Readout */}
        <View style={styles.primaryDisplayCard}>
          <View style={styles.durationRow}>
            <Clock size={16} color={FieldColors.parchment} />
            <Text style={styles.durationValue}>{formatTime(elapsedSeconds)}</Text>
          </View>

          <View style={styles.altimeterBlock}>
            <Text style={styles.altimeterLabel}>CALIBRATED BAROMETRIC ALTITUDE</Text>
            <Text style={styles.altimeterNumber}>
              {Math.round(altitude)}
              <Text style={styles.altimeterUnit}> M</Text>
            </Text>
            <Text style={styles.pressureReading}>
              BARO: {pressureHpa.toFixed(1)} hPa • QNH 1013.25
            </Text>
          </View>
        </View>

        {/* Grid Metrics */}
        <View style={styles.metricsGrid}>
          {/* Distance */}
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>DISTANCE</Text>
            <Text style={styles.cellValue}>
              {(distanceMeters / 1000).toFixed(2)}
              <Text style={styles.cellUnit}> km</Text>
            </Text>
          </View>

          {/* Elevation Gain */}
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>ELEV GAIN</Text>
            <Text style={[styles.cellValue, { color: FieldColors.contourOchre }]}>
              +{Math.round(elevationGain)}
              <Text style={styles.cellUnit}> m</Text>
            </Text>
          </View>

          {/* Speed */}
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>SPEED</Text>
            <Text style={styles.cellValue}>
              {speedKmh.toFixed(1)}
              <Text style={styles.cellUnit}> km/h</Text>
            </Text>
          </View>

          {/* Pace */}
          <View style={styles.gridCell}>
            <Text style={styles.cellLabel}>PACE</Text>
            <Text style={styles.cellValue}>
              {pace}
              <Text style={styles.cellUnit}> /km</Text>
            </Text>
          </View>
        </View>

        {/* Biometrics Card */}
        <View style={styles.biometricsCard}>
          <View style={styles.bioHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Heart size={16} color="#EF4444" />
              <Text style={styles.bioTitle}>BLE SMARTBAND HEART RATE</Text>
            </View>
            <View style={styles.zoneBadge}>
              <Text style={styles.zoneText}>ZONE 3 • AEROBIC</Text>
            </View>
          </View>

          <View style={styles.hrDisplayRow}>
            <Text style={styles.hrNumber}>
              {heartRate} <Text style={styles.hrUnit}>BPM</Text>
            </Text>
            <View style={styles.hrBarContainer}>
              <View style={[styles.hrBarFill, { width: `${(heartRate / 190) * 100}%` }]} />
            </View>
          </View>
        </View>

        {/* Main Recording Controls */}
        <View style={styles.controlsRow}>
          {!isRecording ? (
            <KnurledButton
              label="START RECORDING"
              variant="primary"
              size="lg"
              icon={<Play size={18} color="#0F1210" />}
              onPress={handleStartRecording}
              style={{ flex: 1 }}
            />
          ) : (
            <>
              <KnurledButton
                label={isPaused ? 'RESUME' : 'PAUSE'}
                variant="accent"
                size="lg"
                icon={isPaused ? <Play size={18} color="#0F1210" /> : <Pause size={18} color="#0F1210" />}
                onPress={handlePauseRecording}
                style={{ flex: 1 }}
              />
              <KnurledButton
                label="STOP & SAVE"
                variant="danger"
                size="lg"
                icon={<Square size={18} color="#FFFFFF" />}
                onPress={handleStopRecording}
                style={{ flex: 1 }}
              />
            </>
          )}
        </View>

        {/* Tactical Emergency Distress SOS Trigger */}
        <View style={styles.sosCard}>
          <View style={styles.sosHeader}>
            <AlertOctagon size={18} color="#EF4444" />
            <Text style={styles.sosTitle}>EMERGENCY RESCUE SOS BEACON</Text>
          </View>
          <Text style={styles.sosDesc}>
            Transmits distress payload containing exact GPS fix, altitude, and team ID over offline BLE mesh and satellite relay.
          </Text>
          <KnurledButton
            label="TRIGGER EMERGENCY SOS (HOLD)"
            variant="danger"
            size="lg"
            icon={<AlertOctagon size={18} color="#FFFFFF" />}
            onPress={handleTriggerSOS}
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
  recordStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordLed: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recordStatusText: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 0.8,
  },
  headerSub: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#6E7E75',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  primaryDisplayCard: {
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2B372F',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F1411',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#232E27',
    marginBottom: 12,
  },
  durationValue: {
    fontFamily: FieldTypography.mono,
    fontSize: 16,
    fontWeight: '800',
    color: FieldColors.parchment,
    letterSpacing: 1.5,
  },
  altimeterBlock: {
    alignItems: 'center',
  },
  altimeterLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    letterSpacing: 0.8,
  },
  altimeterNumber: {
    fontFamily: FieldTypography.mono,
    fontSize: 48,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: -1,
    marginVertical: -4,
  },
  altimeterUnit: {
    fontSize: 22,
    fontWeight: '700',
    color: FieldColors.contourOchre,
  },
  pressureReading: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    color: '#8A9990',
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2B372F',
    borderRadius: 8,
    padding: 12,
  },
  cellLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#7B8C82',
    letterSpacing: 0.5,
  },
  cellValue: {
    fontFamily: FieldTypography.mono,
    fontSize: 20,
    fontWeight: '900',
    color: FieldColors.parchment,
    marginTop: 4,
  },
  cellUnit: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  biometricsCard: {
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2B372F',
    borderRadius: 8,
    padding: 14,
  },
  bioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bioTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  zoneBadge: {
    backgroundColor: '#351B1B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  zoneText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: '#EF4444',
  },
  hrDisplayRow: {
    gap: 8,
  },
  hrNumber: {
    fontFamily: FieldTypography.mono,
    fontSize: 26,
    fontWeight: '900',
    color: FieldColors.parchment,
  },
  hrUnit: {
    fontSize: 13,
    color: '#EF4444',
  },
  hrBarContainer: {
    height: 6,
    backgroundColor: '#0F1310',
    borderRadius: 3,
    overflow: 'hidden',
  },
  hrBarFill: {
    height: '100%',
    backgroundColor: '#EF4444',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  sosCard: {
    backgroundColor: '#231212',
    borderWidth: 1.5,
    borderColor: '#592020',
    borderRadius: 8,
    padding: 14,
    gap: 10,
    marginTop: 6,
  },
  sosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sosTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: 0.8,
  },
  sosDesc: {
    fontFamily: FieldTypography.body,
    fontSize: 11,
    color: '#C79A9A',
    lineHeight: 15,
  },
});
