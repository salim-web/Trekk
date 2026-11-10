import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Compass,
  Mountain,
  Plus,
  Check,
  X,
  Layers,
  Sparkles,
} from 'lucide-react-native';
import { FieldColors, FieldTypography } from '../constants/FieldTokens';
import { SoiAnalysisResult, SoiCandidateTrail } from '../services/SoiAnalysisService';
import { KnurledButton } from './KnurledButton';

interface SoiScanOverlayProps {
  visible: boolean;
  result: SoiAnalysisResult | null;
  onClose: () => void;
  onSaveCandidateAsTrail: (candidate: SoiCandidateTrail) => void;
  savedCandidateIds: string[];
}

export const SoiScanOverlay: React.FC<SoiScanOverlayProps> = ({
  visible,
  result,
  onClose,
  onSaveCandidateAsTrail,
  savedCandidateIds,
}) => {
  if (!result) return null;

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
            <View>
              <View style={styles.sheetBadgeRow}>
                <Layers size={14} color={FieldColors.contourOchre} />
                <Text style={styles.sheetBadgeText}>SOI SHEET {result.sheetNumber}</Text>
              </View>
              <Text style={styles.title}>AI CONTOUR TRAIL EXTRACTION</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={FieldColors.parchment} />
            </TouchableOpacity>
          </View>

          {/* Subheader info */}
          <View style={styles.metaBanner}>
            <Text style={styles.metaText}>
              Extracted from Survey of India 1:50,000 toposheet via morphological ridge detection and valley tracing algorithms.
            </Text>
          </View>

          {/* List of candidate trails */}
          <ScrollView style={styles.scrollArea}>
            <View style={styles.candidatesList}>
              {result.candidateTrails.map((candidate) => {
                const isSaved = savedCandidateIds.includes(candidate.id);
                const confidencePct = Math.round(candidate.confidence * 100);

                return (
                  <View key={candidate.id} style={styles.candidateCard}>
                    <View style={styles.cardTop}>
                      <View style={styles.typeBadge}>
                        <Mountain size={13} color="#A855F7" />
                        <Text style={styles.typeText}>{candidate.type.toUpperCase()}</Text>
                      </View>
                      <View style={styles.confidenceBadge}>
                        <Sparkles size={11} color={FieldColors.mossNeon} />
                        <Text style={styles.confidenceText}>{confidencePct}% MATCH</Text>
                      </View>
                    </View>

                    <Text style={styles.candidateName}>{candidate.name}</Text>

                    <View style={styles.specsRow}>
                      <Text style={styles.specItem}>
                        DIST: <Text style={styles.specValue}>{candidate.distanceKm.toFixed(1)} km</Text>
                      </Text>
                      <Text style={styles.specItem}>
                        ELEV GAIN: <Text style={styles.specValue}>+{candidate.elevationGainM}m</Text>
                      </Text>
                      <Text style={styles.specItem}>
                        POINTS: <Text style={styles.specValue}>{candidate.points.length}</Text>
                      </Text>
                    </View>

                    <View style={styles.actionRow}>
                      {isSaved ? (
                        <View style={styles.savedPill}>
                          <Check size={14} color={FieldColors.mossNeon} />
                          <Text style={styles.savedPillText}>ADDED TO MAP</Text>
                        </View>
                      ) : (
                        <KnurledButton
                          label="SAVE AS ACTIVE TRAIL"
                          variant="accent"
                          size="sm"
                          icon={<Plus size={14} color="#0F1210" />}
                          onPress={() => onSaveCandidateAsTrail(candidate)}
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              CANDIDATE TRAILS ARE RENDERED ON THE MAP AS DASHED VIOLET POLYLINES
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
    maxHeight: '88%',
    backgroundColor: FieldColors.obsidianBasalt,
    borderColor: '#A855F7',
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
  sheetBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  sheetBadgeText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.contourOchre,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: FieldTypography.mono,
    fontSize: 13,
    fontWeight: '900',
    color: FieldColors.parchment,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: FieldColors.deepPine,
  },
  metaBanner: {
    backgroundColor: '#1E1628',
    borderWidth: 1,
    borderColor: '#4A2A6B',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
  },
  metaText: {
    fontFamily: FieldTypography.body,
    fontSize: 11,
    color: '#D8B4FE',
    lineHeight: 15,
  },
  scrollArea: {
    maxHeight: 380,
  },
  candidatesList: {
    gap: 12,
  },
  candidateCard: {
    backgroundColor: FieldColors.deepPine,
    borderWidth: 1.5,
    borderColor: '#2F3833',
    borderRadius: 6,
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#301844',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: '#D8B4FE',
    letterSpacing: 0.5,
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#103018',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontFamily: FieldTypography.mono,
    fontSize: 9,
    fontWeight: '800',
    color: FieldColors.mossNeon,
  },
  candidateName: {
    fontFamily: FieldTypography.mono,
    fontSize: 12,
    fontWeight: '800',
    color: FieldColors.parchment,
    marginBottom: 8,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#111713',
    padding: 8,
    borderRadius: 4,
    marginBottom: 10,
  },
  specItem: {
    fontFamily: FieldTypography.mono,
    fontSize: 9.5,
    color: '#7B8A81',
  },
  specValue: {
    color: FieldColors.parchment,
    fontWeight: '700',
  },
  actionRow: {
    alignItems: 'flex-end',
  },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#102E1B',
    borderWidth: 1,
    borderColor: FieldColors.mossNeon,
  },
  savedPillText: {
    fontFamily: FieldTypography.mono,
    fontSize: 10,
    fontWeight: '800',
    color: FieldColors.mossNeon,
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#202A24',
  },
  footerNote: {
    fontFamily: FieldTypography.mono,
    fontSize: 8.5,
    color: '#65736C',
    textAlign: 'center',
    letterSpacing: 0.6,
  },
});
