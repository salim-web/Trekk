import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  FileText,
  MapPin,
  Sparkles,
  X,
  Upload,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../constants/FieldTokens';
import { TrackParserService, ParsedTrack } from '../services/TrackParser';
import { DatabaseService } from '../services/DatabaseService';
import { SoiAnalysisService, SoiAnalysisResult } from '../services/SoiAnalysisService';
import { KnurledButton } from './KnurledButton';

interface FileImportModalProps {
  visible: boolean;
  onClose: () => void;
  onTrackImported: (track: ParsedTrack) => void;
  onSoiAnalyzed: (result: SoiAnalysisResult) => void;
}

export const FileImportModal: React.FC<FileImportModalProps> = ({
  visible,
  onClose,
  onTrackImported,
  onSoiAnalyzed,
}) => {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handlePickWorkoutTrack = async () => {
    try {
      setLoading(true);
      setStatusMessage('Opening device file picker...');

      // CRITICAL: Type must be '*/*' to prevent Android SAF OS-level 'Unsupported filter' crash
      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setLoading(false);
        return;
      }

      const file = res.assets[0];
      const fileName = file.name || 'track.gpx';
      const lower = fileName.toLowerCase();

      if (!lower.endsWith('.gpx') && !lower.endsWith('.tcx') && !lower.endsWith('.fit')) {
        Alert.alert(
          'Unsupported Track Format',
          `Selected file "${fileName}" is not a recognized track format.\n\nPlease choose a .gpx, .tcx, or .fit file.`
        );
        setLoading(false);
        return;
      }

      setStatusMessage(`Parsing ${fileName}...`);

      let track: ParsedTrack;
      if (lower.endsWith('.fit')) {
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'base64',
        });
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        track = TrackParserService.parseTrack(fileName, bytes);
      } else {
        const textContent = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'utf8',
        });
        track = TrackParserService.parseTrack(fileName, textContent);
      }

      setStatusMessage('Saving track to local database...');
      const savedTrack = await DatabaseService.saveImportedTrack(track);

      setLoading(false);
      onTrackImported(savedTrack);
      onClose();
      Alert.alert(
        'Track Imported',
        `Successfully loaded "${savedTrack.name}":\n• ${savedTrack.distanceKm.toFixed(1)} km\n• +${Math.round(savedTrack.elevationGainM)}m Gain\n• ${savedTrack.points.length} trackpoints`
      );
    } catch (err: any) {
      console.error('Track import error:', err);
      Alert.alert('Import Failed', err.message || 'Could not parse selected file.');
      setLoading(false);
    }
  };

  const handlePickSoiSheet = async () => {
    try {
      setLoading(true);
      setStatusMessage('Selecting SOI Topographical Sheet...');

      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setLoading(false);
        return;
      }

      const file = res.assets[0];
      const fileName = file.name || 'soi_sheet.tif';
      const lower = fileName.toLowerCase();

      const validExts = ['.pdf', '.tif', '.tiff', '.jpg', '.jpeg', '.png'];
      if (!validExts.some((ext) => lower.endsWith(ext))) {
        Alert.alert(
          'Invalid Sheet Format',
          `Please select an SOI Toposheet in .pdf, .tif, or image format.`
        );
        setLoading(false);
        return;
      }

      setStatusMessage('Analyzing sheet for ridges, valleys & trail candidates...');
      const analysis = await SoiAnalysisService.analyzeSheet(file.uri, fileName);

      setLoading(false);
      onSoiAnalyzed(analysis);
      onClose();
      Alert.alert(
        'SOI Sheet Analyzed',
        `Sheet: ${analysis.sheetNumber}\nDetected ${analysis.candidateTrails.length} viable ridgeline & valley trails on the contour map.`
      );
    } catch (err: any) {
      console.error('SOI sheet import error:', err);
      Alert.alert('Analysis Failed', err.message || 'Could not analyze sheet.');
      setLoading(false);
    }
  };

  const handleLoadSampleGpx = async () => {
    try {
      setLoading(true);
      setStatusMessage('Generating sample Xiaomi Band Kedarkantha Summit GPX...');
      const sampleGpx = TrackParserService.generateSampleXiaomiBandGpx();
      const track = TrackParserService.parseTrack('Xiaomi_Band_Kedarkantha_Summit.gpx', sampleGpx);

      setStatusMessage('Saving to local database...');
      const savedTrack = await DatabaseService.saveImportedTrack(track);

      setLoading(false);
      onTrackImported(savedTrack);
      onClose();
      Alert.alert(
        'Sample Track Loaded',
        `Loaded "${savedTrack.name}":\n• ${savedTrack.distanceKm.toFixed(1)} km\n• +${Math.round(savedTrack.elevationGainM)}m Gain\n• HR Avg: ${savedTrack.averageHeartRate} bpm\n\nRoute is now plotted on the topographical map!`
      );
    } catch (err: any) {
      console.error('Sample generation error:', err);
      Alert.alert('Sample Error', err.message || 'Failed to generate sample.');
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>IMPORT ACTIVITY OR TOPO SHEET</Text>
              <Text style={styles.subtitle}>TACTILE FIELD IMPORT ENGINE</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={FieldColors.parchment} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={FieldColors.rescueOrange} />
              <Text style={styles.loadingText}>{statusMessage}</Text>
            </View>
          ) : (
            <View style={styles.body}>
              {/* Option 1: Fitness track */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={handlePickWorkoutTrack}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBadge, { backgroundColor: '#38BDF822', borderColor: '#38BDF8' }]}>
                  <FileText size={24} color="#38BDF8" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>FITNESS ACTIVITY TRACK</Text>
                  <Text style={styles.optionDesc}>
                    Load Garmin, Coros, Suunto or smartband recordings (.GPX, .TCX, .FIT).
                  </Text>
                  <Text style={styles.optionMeta}>Auto-snaps to CartoDEM elevation</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Toposheet */}
              <TouchableOpacity
                style={styles.optionCard}
                onPress={handlePickSoiSheet}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBadge, { backgroundColor: '#D99B2622', borderColor: '#D99B26' }]}>
                  <MapPin size={24} color="#D99B26" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>SURVEY OF INDIA TOPO SHEET</Text>
                  <Text style={styles.optionDesc}>
                    Scan official 1:50,000 sheet (.PDF, .TIF, .PNG). AI detects ridgelines & valleys.
                  </Text>
                  <Text style={styles.optionMeta}>Dashed violet candidate paths</Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: 1-Tap Sample */}
              <View style={styles.sampleSection}>
                <View style={styles.sampleHeader}>
                  <Sparkles size={16} color={FieldColors.rescueOrange} />
                  <Text style={styles.sampleLabel}>TEST BENCH / NO FILE HANDY?</Text>
                </View>
                <KnurledButton
                  label="1-TAP LOAD SAMPLE XIAOMI BAND GPX"
                  variant="primary"
                  size="md"
                  icon={<Upload size={16} color="#0F1210" />}
                  onPress={handleLoadSampleGpx}
                />
              </View>
            </View>
          )}

          <View style={styles.footerNote}>
            <Text style={styles.footerText}>
              SECURE LOCAL-FIRST IMPORT • NO SENSITIVE LOCATION DATA SENT TO CLOUD
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
    maxWidth: 440,
    backgroundColor: FieldColors.obsidianBasalt,
    borderColor: FieldColors.contourOchre,
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
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: '#252F29',
    paddingBottom: 12,
    marginBottom: 16,
  },
  title: {
    fontFamily: FieldTypography.mono,
    fontSize: 14,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '600',
    color: FieldColors.contourOchre,
    marginTop: 2,
    letterSpacing: 1.2,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: FieldColors.deepPine,
  },
  body: {
    gap: 14,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    color: FieldColors.parchment,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2E3932',
    borderRadius: 6,
    padding: 12,
    gap: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  optionDesc: {
    fontFamily: FieldTypography.body,
    fontSize: 11,
    color: '#A0AFA6',
    marginTop: 2,
    lineHeight: 15,
  },
  optionMeta: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '600',
    color: FieldColors.mossNeon,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  sampleSection: {
    backgroundColor: '#161F1A',
    borderWidth: 1,
    borderColor: '#2A3A31',
    borderRadius: 6,
    padding: 12,
    gap: 10,
    marginTop: 4,
  },
  sampleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sampleLabel: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.rescueOrange,
    letterSpacing: 0.8,
  },
  footerNote: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#202A24',
    paddingTop: 10,
  },
  footerText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#65736C',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
});
