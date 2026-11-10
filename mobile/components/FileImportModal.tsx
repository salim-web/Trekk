import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  FileText,
  MapPin,
  Sparkles,
  X,
  Upload,
  Layers,
  ChevronRight,
  Eye,
  CheckCircle,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../constants/FieldTokens';
import { TrackParserService, ParsedTrack } from '../services/TrackParser';
import { DatabaseService } from '../services/DatabaseService';
import { SoiAnalysisService, SoiAnalysisResult } from '../services/SoiAnalysisService';
import {
  SoiAnalyzerService,
  SoiExtractionResult,
  SOI_GRATICULE_PRESETS,
  SoiSheetGraticule,
} from '../services/soiAnalyzerService';
import { KnurledButton } from './KnurledButton';

interface FileImportModalProps {
  visible: boolean;
  onClose: () => void;
  onTrackImported: (track: ParsedTrack) => void;
  onSoiAnalyzed: (result: SoiAnalysisResult) => void;
  onSoiSheetOverlaid?: (result: SoiExtractionResult) => void;
}

export const FileImportModal: React.FC<FileImportModalProps> = ({
  visible,
  onClose,
  onTrackImported,
  onSoiAnalyzed,
  onSoiSheetOverlaid,
}) => {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [showGraticulePicker, setShowGraticulePicker] = useState(false);

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
      setStatusMessage('Selecting SOI Topographical Sheet (.PDF, .TIF, .PNG, .JPG)...');

      const res = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        setLoading(false);
        return;
      }

      const file = res.assets[0];
      const fileName = file.name || 'soi_sheet.png';
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

      setStatusMessage('Reading sheet and extracting topographical features...');

      let base64Data: string | undefined;
      if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        try {
          const rawBase64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
          const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
          base64Data = `data:${mime};base64,${rawBase64}`;
        } catch (_) {}
      }

      // Process dynamically from the uploaded file name & contents (NO HARDCODED 53J/1!)
      const result = await SoiAnalyzerService.processUploadedSheet(
        fileName,
        file.uri,
        base64Data
      );

      if (onSoiSheetOverlaid) {
        onSoiSheetOverlaid(result);
      }

      // Legacy analysis bridge
      const legacyResult = await SoiAnalysisService.analyzeSheet(file.uri, fileName);
      onSoiAnalyzed(legacyResult);

      setLoading(false);
      onClose();
      Alert.alert(
        'SOI Sheet Overlaid',
        `Survey of India Sheet: ${result.sheetNumber} (${result.sheetName})\nOverlaid 1:50,000 raster sheet with ${result.trails.length} extracted footpaths and ${result.pois.length} water springs / campsites.`
      );
    } catch (err: any) {
      console.error('SOI sheet import error:', err);
      Alert.alert('Analysis Failed', err.message || 'Could not analyze sheet.');
      setLoading(false);
    }
  };

  const handleSelectGraticulePreset = async (preset: SoiSheetGraticule) => {
    try {
      setLoading(true);
      setStatusMessage(`Synthesizing Survey of India Sheet ${preset.sheetNumber} (1:50,000)...`);

      const result = await SoiAnalyzerService.processUploadedSheet(preset.sheetNumber);

      if (onSoiSheetOverlaid) {
        onSoiSheetOverlaid(result);
      }

      const legacyResult = await SoiAnalysisService.analyzeSheet(preset.sheetNumber);
      onSoiAnalyzed(legacyResult);

      setLoading(false);
      setShowGraticulePicker(false);
      onClose();
      Alert.alert(
        'SOI Sheet Overlaid on Map',
        `Sheet ${result.sheetNumber} (${preset.name}) has been overlaid directly on the topographical map with ${result.trails.length} extracted trails, springs & camps!`
      );
    } catch (err: any) {
      console.error('Graticule synthesis error:', err);
      Alert.alert('Error', err.message || 'Failed to synthesize sheet.');
      setLoading(false);
    }
  };

  const handle1TapSampleSoi = () => {
    handleSelectGraticulePreset(SOI_GRATICULE_PRESETS[0]);
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
              <Text style={styles.title}>
                {showGraticulePicker ? 'SELECT SOI SHEET GRATICULE' : 'IMPORT ACTIVITY OR TOPO SHEET'}
              </Text>
              <Text style={styles.subtitle}>TACTILE FIELD IMPORT & OVERLAY ENGINE</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (showGraticulePicker) setShowGraticulePicker(false);
                else onClose();
              }}
              style={styles.closeBtn}
            >
              <X size={20} color={FieldColors.parchment} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={FieldColors.rescueOrange} />
              <Text style={styles.loadingText}>{statusMessage}</Text>
            </View>
          ) : showGraticulePicker ? (
            /* Sheet Graticule Selector Sub-view */
            <ScrollView style={{ maxHeight: 360 }}>
              <View style={styles.graticuleList}>
                <Text style={styles.graticuleDesc}>
                  Select an official 15' × 15' Survey of India Open Series Map sheet to georeference and overlay directly onto the live map:
                </Text>

                {SOI_GRATICULE_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.sheetNumber}
                    style={styles.graticuleItem}
                    onPress={() => handleSelectGraticulePreset(preset)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.graticuleTop}>
                      <View style={styles.sheetBadge}>
                        <Layers size={12} color={FieldColors.contourOchre} />
                        <Text style={styles.sheetBadgeText}>SHEET {preset.sheetNumber}</Text>
                      </View>
                      <Text style={styles.graticuleRegion}>{preset.region}</Text>
                    </View>
                    <Text style={styles.graticuleName}>{preset.name}</Text>
                    <Text style={styles.graticuleCoords}>
                      Bounds: {preset.bounds[0][0]}°N, {preset.bounds[0][1]}°E to {preset.bounds[1][0]}°N, {preset.bounds[1][1]}°E
                    </Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setShowGraticulePicker(false)}
                >
                  <Text style={styles.backButtonText}>← BACK TO MAIN IMPORT</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <View style={styles.body}>
                {/* Option 1: Fitness track */}
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={handlePickWorkoutTrack}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconBadge, { backgroundColor: '#38BDF822', borderColor: '#38BDF8' }]}>
                    <FileText size={22} color="#38BDF8" />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>FITNESS ACTIVITY TRACK</Text>
                    <Text style={styles.optionDesc}>
                      Load Garmin, Coros, Suunto or smartband recordings (.GPX, .TCX, .FIT).
                    </Text>
                    <Text style={styles.optionMeta}>Auto-snaps to CartoDEM elevation</Text>
                  </View>
                </TouchableOpacity>

                {/* Option 2: Upload Real SOI Toposheet */}
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={handlePickSoiSheet}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconBadge, { backgroundColor: '#D99B2622', borderColor: '#D99B26' }]}>
                    <MapPin size={22} color="#D99B26" />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>UPLOAD & OVERLAY SOI SHEET</Text>
                    <Text style={styles.optionDesc}>
                      Upload official 1:50k sheet (.PDF, .TIF, .PNG, .JPG). Live Leaflet raster overlay.
                    </Text>
                    <Text style={styles.optionMeta}>Overlays image + extracts candidate footpaths</Text>
                  </View>
                </TouchableOpacity>

                {/* Option 3: Choose from Sheet Graticule Selector */}
                <TouchableOpacity
                  style={styles.optionCard}
                  onPress={() => setShowGraticulePicker(true)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconBadge, { backgroundColor: '#A855F722', borderColor: '#A855F7' }]}>
                    <Layers size={22} color="#A855F7" />
                  </View>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionTitle}>SHEET GRATICULE SELECTOR</Text>
                    <Text style={styles.optionDesc}>
                      Choose from presets: 53J/1 Sankri, 52H/8 Hampta, 78O/11 Meghalaya, 83K/2 Dzukou.
                    </Text>
                    <Text style={styles.optionMeta}>Instant 15' × 15' vector/raster synthesis</Text>
                  </View>
                  <ChevronRight size={18} color="#888" />
                </TouchableOpacity>

                {/* Option 4: 1-Tap Sample Toposheet */}
                <View style={styles.sampleSection}>
                  <View style={styles.sampleHeader}>
                    <Sparkles size={15} color={FieldColors.rescueOrange} />
                    <Text style={styles.sampleLabel}>TEST BENCH & LIVE DEMOS</Text>
                  </View>
                  <View style={{ gap: 8 }}>
                    <KnurledButton
                      label="1-TAP LOAD SAMPLE SOI TOPOSHEET (53J/1)"
                      variant="primary"
                      size="sm"
                      icon={<Eye size={15} color="#0F1210" />}
                      onPress={handle1TapSampleSoi}
                    />
                    <KnurledButton
                      label="1-TAP LOAD SAMPLE SMARTBAND GPX"
                      variant="secondary"
                      size="sm"
                      icon={<Upload size={15} color={FieldColors.parchment} />}
                      onPress={handleLoadSampleGpx}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>
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
    maxWidth: 460,
    backgroundColor: FieldColors.obsidianBasalt,
    borderColor: FieldColors.contourOchre,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 16,
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
    paddingBottom: 10,
    marginBottom: 12,
  },
  title: {
    fontFamily: FieldTypography.mono,
    fontSize: 13,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 0.8,
  },
  subtitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.contourOchre,
    marginTop: 2,
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    color: FieldColors.parchment,
    textAlign: 'center',
  },
  body: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161D19',
    borderColor: '#2A362E',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 10,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: FieldTypography.mono,
    fontSize: 11,
    fontWeight: '800',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  optionDesc: {
    fontFamily: 'System',
    fontSize: 11,
    color: '#A0AAB0',
    marginTop: 2,
  },
  optionMeta: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.mossNeon,
    marginTop: 3,
    fontWeight: '600',
  },
  sampleSection: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#252F29',
    gap: 8,
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
    letterSpacing: 1,
  },
  footerNote: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#252F29',
  },
  footerText: {
    fontFamily: FieldTypography.mono,
    fontSize: 8,
    color: '#607267',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  graticuleList: {
    gap: 8,
    paddingVertical: 4,
  },
  graticuleDesc: {
    fontFamily: 'System',
    fontSize: 11,
    color: '#A0AAB0',
    marginBottom: 6,
  },
  graticuleItem: {
    backgroundColor: '#161D19',
    borderColor: '#2A362E',
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 4,
  },
  graticuleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2D1B0A',
    borderColor: FieldColors.contourOchre,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sheetBadgeText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.contourOchre,
  },
  graticuleRegion: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: '#888',
  },
  graticuleName: {
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: FieldColors.parchment,
    marginTop: 2,
  },
  graticuleCoords: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    color: FieldColors.glacierCyan,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 6,
  },
  backButtonText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.contourOchre,
  },
});
