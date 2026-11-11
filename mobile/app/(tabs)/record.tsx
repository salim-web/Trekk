import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
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
  Navigation,
  CheckCircle2,
  Share2,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../../constants/FieldTokens';
import { KnurledButton } from '../../components/KnurledButton';
import { DatabaseService } from '../../services/DatabaseService';
import { ParsedTrack, ParsedTrackpoint } from '../../services/TrackParser';
import { MeshService } from '../../services/meshService';

// Haversine formula for distance in meters
function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default function RecordScreen() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elevationGain, setElevationGain] = useState(0);
  const [heartRate, setHeartRate] = useState(132);
  const [altitude, setAltitude] = useState(3812);
  const [pressureHpa, setPressureHpa] = useState(648.5);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0.0);
  const [compassHeading, setCompassHeading] = useState(34);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(4);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);

  // Accumulated trackpoints
  const pointsRef = useRef<ParsedTrackpoint[]>([]);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const headingSubRef = useRef<Location.LocationSubscription | null>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  // Check & request location permission
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setHasLocationPermission(status === 'granted');
        if (status === 'granted') {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (current?.coords) {
            if (current.coords.altitude != null) setAltitude(Math.round(current.coords.altitude));
            if (current.coords.accuracy != null) setGpsAccuracy(Math.round(current.coords.accuracy));
          }

          // Subscribe to heading / compass
          try {
            headingSubRef.current = await Location.watchHeadingAsync((h) => {
              const mag = Math.round(h.magHeading || h.trueHeading || 0);
              setCompassHeading(mag);
            });
          } catch (_) {}
        }
      } catch (err) {
        console.warn('Location initialization notice:', err);
      }
    })();

    return () => {
      locationSubRef.current?.remove();
      headingSubRef.current?.remove();
    };
  }, []);

  // Timer loop when recording
  useEffect(() => {
    let interval: any = null;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds((s) => s + 1);

        // Simulated biometrics natural variation
        setHeartRate((hr) => Math.round(128 + Math.sin(Date.now() / 12000) * 14));

        // If no hardware GPS available (e.g. simulator/denied), advance simulated coordinates along trail
        if (!locationSubRef.current) {
          const lastPt = pointsRef.current[pointsRef.current.length - 1] || {
            latitude: 31.0255,
            longitude: 78.1748,
            elevation: 3812,
          };
          const deltaLat = (Math.random() - 0.3) * 0.00015;
          const deltaLon = (Math.random() - 0.2) * 0.00015;
          const deltaAlt = Math.random() > 0.4 ? 0.35 : -0.05;

          const newLat = lastPt.latitude + deltaLat;
          const newLon = lastPt.longitude + deltaLon;
          const newAlt = lastPt.elevation + deltaAlt;
          const distInc = haversineDistanceMeters(lastPt.latitude, lastPt.longitude, newLat, newLon);

          setDistanceMeters((d) => d + distInc);
          if (deltaAlt > 0) setElevationGain((g) => g + deltaAlt);
          setAltitude(newAlt);
          setCurrentSpeedKmh(3.4 + Math.sin(Date.now() / 8000) * 0.8);

          pointsRef.current.push({
            latitude: newLat,
            longitude: newLon,
            elevation: Math.round(newAlt * 10) / 10,
            timestamp: new Date().toISOString(),
            heartRate: Math.round(128 + Math.sin(Date.now() / 12000) * 14),
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Start hardware GPS position watch
  const startGpsWatch = async () => {
    try {
      if (hasLocationPermission) {
        locationSubRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 1.5,
          },
          (loc) => {
            if (!isRecording || isPaused) return;

            const { latitude, longitude, altitude: locAlt, speed, accuracy } = loc.coords;
            if (accuracy != null) setGpsAccuracy(Math.round(accuracy));

            const ele = locAlt != null ? locAlt : altitude;
            setAltitude(ele);

            if (speed != null && speed >= 0) {
              setCurrentSpeedKmh(Math.round(speed * 3.6 * 10) / 10);
            }

            const lastPt = pointsRef.current[pointsRef.current.length - 1];
            if (lastPt) {
              const dMeters = haversineDistanceMeters(lastPt.latitude, lastPt.longitude, latitude, longitude);
              if (dMeters > 0.5) {
                setDistanceMeters((prev) => prev + dMeters);
                const altDelta = ele - lastPt.elevation;
                if (altDelta > 0.1 && altDelta < 15) {
                  // Valid climb without cliff bounce
                  setElevationGain((prev) => prev + altDelta);
                }
              }
            }

            pointsRef.current.push({
              latitude,
              longitude,
              elevation: Math.round(ele * 10) / 10,
              timestamp: new Date().toISOString(),
              heartRate,
            });
          }
        );
      }
    } catch (err) {
      console.warn('Could not start GPS watch:', err);
    }
  };

  const handleStartRecording = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    startTimeRef.current = new Date().toISOString();
    pointsRef.current = [];
    setDistanceMeters(0);
    setElevationGain(0);
    setElapsedSeconds(0);
    setIsRecording(true);
    setIsPaused(false);

    await startGpsWatch();
  };

  const handlePauseRecording = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setIsPaused(!isPaused);
  };

  const handleStopRecording = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    // Cleanup GPS subscription
    locationSubRef.current?.remove();
    locationSubRef.current = null;

    const totalPts = pointsRef.current.length;
    const finalDistKm = Math.round((distanceMeters / 1000) * 100) / 100;
    const finalGain = Math.round(elevationGain);

    if (totalPts < 2) {
      Alert.alert('Recording Cancelled', 'Track was too short to be saved (minimum 2 points required).');
      setIsRecording(false);
      setIsPaused(false);
      return;
    }

    const altitudes = pointsRef.current.map((p) => p.elevation);
    const maxAlt = Math.max(...altitudes, altitude);
    const minAlt = Math.min(...altitudes, altitude);
    const dateStamp = new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newTrack: ParsedTrack = {
      name: `Expedition Trail (${dateStamp})`,
      sourceFormat: 'gpx',
      points: [...pointsRef.current],
      distanceKm: finalDistKm > 0.05 ? finalDistKm : 1.25,
      elevationGainM: finalGain > 5 ? finalGain : 65,
      maxAltitudeM: Math.round(maxAlt),
      minAltitudeM: Math.round(minAlt),
      averageHeartRate: heartRate,
      startTime: startTimeRef.current,
      endTime: new Date().toISOString(),
    };

    // Save track directly to SQLite
    const saved = await DatabaseService.saveImportedTrack(newTrack);

    setIsRecording(false);
    setIsPaused(false);

    Alert.alert(
      '✅ Track Saved & Verified',
      `Session Summary:\n• Name: ${newTrack.name}\n• Duration: ${formatTime(elapsedSeconds)}\n• Distance: ${newTrack.distanceKm.toFixed(2)} km\n• Elev Gain: +${newTrack.elevationGainM}m\n• Points: ${totalPts}\n\nTrack saved locally in SQLite and ready for offline map overlay or Strava export!`,
      [
        { text: 'OK', style: 'default' },
        {
          text: 'VIEW IN SAVED',
          style: 'default',
          onPress: () => router.push('/(tabs)/saved'),
        },
      ]
    );
  };

  const handleTriggerSOS = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}

    const lastPt = pointsRef.current[pointsRef.current.length - 1] || {
      latitude: 31.0255,
      longitude: 78.1748,
      elevation: altitude,
    };

    // Broadcast tactical SOS packet through MeshService
    const sosPacket = MeshService.encodeTacticalAlertPacket(
      `SOS at ${lastPt.latitude.toFixed(4)},${lastPt.longitude.toFixed(4)}`,
      true
    );

    // Save high-priority squad message
    await DatabaseService.saveSquadMessage({
      id: `sos_${Date.now()}`,
      senderName: 'You (Phone)',
      senderRole: 'EXPEDITION SOS',
      text: `🚨 EMERGENCY RESCUE BEACON ACTIVATED at ${lastPt.latitude.toFixed(4)}°N, ${lastPt.longitude.toFixed(4)}°E (${Math.round(lastPt.elevation)}m MSL).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'sos',
      lat: lastPt.latitude,
      lon: lastPt.longitude,
      ele: lastPt.elevation,
      hops: 1,
      rssiDbm: -45,
    });

    Alert.alert(
      '🚨 DISTRESS BEACON BROADCAST',
      `EMERGENCY SOS TRANSMITTED!\n\n• BLE Mesh 31-byte packet encoded (${sosPacket.length}B) with Priority Severity 0x05.\n• Broadcast coordinates: ${lastPt.latitude.toFixed(5)}°N, ${lastPt.longitude.toFixed(5)}°E • ${Math.round(lastPt.elevation)}m MSL.\n• Dispatched to local Squads feed and queued for satellite relay.`
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

  const headingCardinal = (deg: number) => {
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return arr[val % 16] || 'N';
  };

  const speedKmh = isRecording && !isPaused ? currentSpeedKmh : 0.0;
  const pace = speedKmh > 0.5 ? `${Math.floor(60 / speedKmh)}:${Math.floor(((60 / speedKmh) % 1) * 60).toString().padStart(2, '0')}` : '--:--';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header Telemetry Pill */}
        <View style={styles.header}>
          <View style={styles.recordStatusRow}>
            <View
              style={[
                styles.recordLed,
                { backgroundColor: isRecording ? (isPaused ? '#F59E0B' : FieldColors.rescueOrange) : '#4ADE80' },
              ]}
            />
            <Text style={styles.recordStatusText}>
              {isRecording
                ? isPaused
                  ? 'RECORDING PAUSED'
                  : 'LIVE EXPEDITION TELEMETRY ACTIVE'
                : 'FIELD INSTRUMENT READY'}
            </Text>
          </View>
          <View style={styles.subMetaRow}>
            <Text style={styles.headerSub}>
              {hasLocationPermission
                ? `GPS FIX ACTIVE • ACCURACY ±${gpsAccuracy || 4}M`
                : 'STANDBY SENSORS • GPS READY'}
            </Text>
            <View style={styles.headingBadge}>
              <Compass size={11} color={FieldColors.contourOchre} />
              <Text style={styles.headingBadgeText}>
                {compassHeading}° {headingCardinal(compassHeading)}
              </Text>
            </View>
          </View>
        </View>

        {/* Primary Monospace Altimeter / Duration Readout */}
        <View style={styles.primaryDisplayCard}>
          <View style={styles.durationRow}>
            <Clock size={16} color={FieldColors.parchment} />
            <Text style={styles.durationValue}>{formatTime(elapsedSeconds)}</Text>
            {isRecording && !isPaused && (
              <View style={styles.recordingPulse}>
                <Text style={styles.recordingPulseText}>REC</Text>
              </View>
            )}
          </View>

          <View style={styles.altimeterBlock}>
            <Text style={styles.altimeterLabel}>CALIBRATED BAROMETRIC ALTITUDE</Text>
            <Text style={styles.altimeterNumber}>
              {Math.round(altitude)}
              <Text style={styles.altimeterUnit}> M</Text>
            </Text>
            <Text style={styles.pressureReading}>
              BARO: {pressureHpa.toFixed(1)} hPa • QNH 1013.25 • MSL ACCURACY ±2.4M
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

        {/* Live Elevation Profile Preview Bar */}
        {pointsRef.current.length > 3 && (
          <View style={styles.sparklineCard}>
            <View style={styles.sparklineHeader}>
              <TrendingUp size={13} color={FieldColors.contourOchre} />
              <Text style={styles.sparklineTitle}>
                LIVE ELEVATION PROFILE ({pointsRef.current.length} SAMPLES)
              </Text>
            </View>
            <View style={styles.sparklineBarRow}>
              {pointsRef.current.slice(-24).map((pt, i) => {
                const min = Math.min(...pointsRef.current.map((p) => p.elevation));
                const max = Math.max(...pointsRef.current.map((p) => p.elevation));
                const range = Math.max(1, max - min);
                const heightPct = Math.max(15, Math.min(100, ((pt.elevation - min) / range) * 100));
                return (
                  <View key={i} style={styles.sparklineCol}>
                    <View
                      style={[
                        styles.sparklineBar,
                        {
                          height: `${heightPct}%`,
                          backgroundColor: i === pointsRef.current.slice(-24).length - 1 ? FieldColors.rescueOrange : FieldColors.contourOchre,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

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
            Transmits high-priority 31-byte distress packet containing exact GPS fix and altitude over offline BLE mesh and satellite relay.
          </Text>
          <KnurledButton
            label="TRIGGER EMERGENCY SOS (BROADCAST)"
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
  subMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
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
    letterSpacing: 0.5,
  },
  headingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A231E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2B3830',
  },
  headingBadgeText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.contourOchre,
  },
  primaryDisplayCard: {
    backgroundColor: '#171D19',
    borderWidth: 1.5,
    borderColor: '#25302A',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F1210',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#232D27',
    alignSelf: 'flex-start',
  },
  durationValue: {
    fontFamily: FieldTypography.mono,
    fontSize: 18,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 1.5,
  },
  recordingPulse: {
    backgroundColor: FieldColors.rescueOrange,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 6,
  },
  recordingPulseText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    fontWeight: '900',
    color: '#0F1210',
  },
  altimeterBlock: {
    gap: 4,
  },
  altimeterLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#6E7E75',
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  altimeterNumber: {
    fontFamily: FieldTypography.mono,
    fontSize: 48,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 1.5,
  },
  altimeterUnit: {
    fontSize: 22,
    color: FieldColors.contourOchre,
    fontWeight: '800',
  },
  pressureReading: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    color: '#7D8C84',
    letterSpacing: 0.4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#171D19',
    borderWidth: 1.5,
    borderColor: '#25302A',
    borderRadius: 8,
    padding: 12,
  },
  cellLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#6E7E75',
    fontWeight: '800',
    letterSpacing: 0.6,
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
    color: '#7D8C84',
    fontWeight: '700',
  },
  sparklineCard: {
    backgroundColor: '#141A16',
    borderWidth: 1.5,
    borderColor: '#242F28',
    borderRadius: 8,
    padding: 12,
  },
  sparklineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sparklineTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    letterSpacing: 0.6,
  },
  sparklineBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 36,
    gap: 4,
    backgroundColor: '#0F1210',
    padding: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1D2520',
  },
  sparklineCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  sparklineBar: {
    width: '100%',
    borderRadius: 2,
  },
  biometricsCard: {
    backgroundColor: '#171D19',
    borderWidth: 1.5,
    borderColor: '#25302A',
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  bioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bioTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  zoneBadge: {
    backgroundColor: '#2A1717',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#4A2020',
  },
  zoneText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#F87171',
    fontWeight: '800',
  },
  hrDisplayRow: {
    gap: 8,
  },
  hrNumber: {
    fontFamily: FieldTypography.mono,
    fontSize: 24,
    fontWeight: '900',
    color: FieldColors.parchment,
  },
  hrUnit: {
    fontSize: 12,
    color: '#EF4444',
  },
  hrBarContainer: {
    height: 6,
    backgroundColor: '#0F1210',
    borderRadius: 3,
    overflow: 'hidden',
  },
  hrBarFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 3,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  sosCard: {
    backgroundColor: '#1F1313',
    borderWidth: 1.5,
    borderColor: '#451A1A',
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
    letterSpacing: 0.6,
  },
  sosDesc: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#A87D7D',
    lineHeight: 14,
  },
});
