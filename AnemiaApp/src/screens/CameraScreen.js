// ============================================================
// HEMAVIEW — Camera Screen
// Medical image capture with anatomical overlay guidance
// ============================================================

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated, Alert, Dimensions,
  ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../utils/designSystem';
import { ScreeningAPI } from '../services/api';

const { width, height } = Dimensions.get('window');
const OVERLAY_SIZE = width * 0.7;

// ─── Scan Type Selector ──────────────────────────────────────
const SCAN_TYPES = [
  { id: 'conjunctiva', label: 'Inner Eyelid', icon: '👁', description: 'Most accurate — pull down lower eyelid gently', accuracy: '96%' },
  { id: 'fingernail',  label: 'Fingernail',   icon: '💅', description: 'Press nail firmly then release and capture quickly', accuracy: '91%' },
  { id: 'palmar',      label: 'Palm',          icon: '✋', description: 'Open hand flat under consistent lighting', accuracy: '88%' },
];

// ─── Animated Scan Line ──────────────────────────────────────
function ScanLine({ active }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [active]);

  const translateY = anim.interpolate({
    inputRange: [0, 1], outputRange: [0, OVERLAY_SIZE - 4],
  });

  if (!active) return null;
  return (
    <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]}>
      <View style={styles.scanLineGlow} />
    </Animated.View>
  );
}

// ─── Corner Brackets ─────────────────────────────────────────
function CornerBrackets({ color = Colors.primary[400] }) {
  const corners = [
    { top: 0,    left: 0,    borderTopWidth: 3, borderLeftWidth: 3 },
    { top: 0,    right: 0,   borderTopWidth: 3, borderRightWidth: 3 },
    { bottom: 0, left: 0,    borderBottomWidth: 3, borderLeftWidth: 3 },
    { bottom: 0, right: 0,   borderBottomWidth: 3, borderRightWidth: 3 },
  ];
  return (
    <>
      {corners.map((s, i) => (
        <View key={i} style={[styles.corner, { ...s, borderColor: color }]} />
      ))}
    </>
  );
}

// ─── Patient Selector Modal ───────────────────────────────────
function PatientSelectorModal({ visible, onClose, onSelect }) {
  const [selected, setSelected] = useState(null);

  // Mock patients for UI
  const patients = [
    { patient_id: 1001, full_name: 'Priya Sharma', age: 28, biological_sex: 'Female' },
    { patient_id: 1002, full_name: 'Anjali Devi',  age: 34, biological_sex: 'Female' },
    { patient_id: 1003, full_name: 'Ravi Kumar',   age: 45, biological_sex: 'Male' },
    { patient_id: 1004, full_name: 'Sunita Patel', age: 22, biological_sex: 'Female' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select Patient</Text>
          <Text style={styles.modalSub}>Choose who you're screening</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            {patients.map((p) => (
              <TouchableOpacity
                key={p.patient_id}
                style={[styles.modalPatientRow, selected?.patient_id === p.patient_id && styles.modalPatientSelected]}
                onPress={() => setSelected(p)}
              >
                <View style={styles.modalAvatar}>
                  <Text style={styles.modalAvatarText}>{p.full_name.split(' ').map(w => w[0]).join('')}</Text>
                </View>
                <View>
                  <Text style={styles.modalPatientName}>{p.full_name}</Text>
                  <Text style={styles.modalPatientMeta}>{p.age}y · {p.biological_sex}</Text>
                </View>
                {selected?.patient_id === p.patient_id && (
                  <Text style={styles.modalCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, !selected && styles.modalBtnDisabled]}
              onPress={() => selected && onSelect(selected)}
              disabled={!selected}
            >
              <Text style={styles.modalConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Processing Overlay ───────────────────────────────────────
function ProcessingOverlay({ stage }) {
  const stages = [
    { key: 'upload',   label: 'Uploading image securely...',  icon: '🔒' },
    { key: 'segment',  label: 'AI segmenting tissue...',       icon: '🧠' },
    { key: 'colorspace', label: 'Analyzing CIELab color space...', icon: '🎨' },
    { key: 'predict',  label: 'Predicting hemoglobin level...', icon: '🩸' },
    { key: 'report',   label: 'Generating clinical report...', icon: '📋' },
  ];
  const currentIdx = stages.findIndex(s => s.key === stage);

  return (
    <View style={styles.processingOverlay}>
      <View style={styles.processingCard}>
        <ActivityIndicator color={Colors.primary[500]} size="large" style={{ marginBottom: Spacing[4] }} />
        <Text style={styles.processingTitle}>AI Inference Running</Text>
        <View style={styles.processingSteps}>
          {stages.map((s, i) => (
            <View key={s.key} style={styles.processingStep}>
              <View style={[
                styles.processingDot,
                i < currentIdx  && styles.processingDotDone,
                i === currentIdx && styles.processingDotActive,
              ]}>
                {i < currentIdx && <Text style={{ fontSize: 10 }}>✓</Text>}
              </View>
              <Text style={[
                styles.processingStepText,
                i === currentIdx && styles.processingStepActive,
                i < currentIdx  && styles.processingStepDone,
              ]}>
                {s.icon} {s.label}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.processingNote}>Do not close the app</Text>
      </View>
    </View>
  );
}

// ─── Camera Screen ────────────────────────────────────────────
export default function CameraScreen({ navigation }) {
  const [scanType,     setScanType]     = useState(SCAN_TYPES[0]);
  const [flashOn,      setFlashOn]      = useState(true);
  const [patient,      setPatient]      = useState(null);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [capturing,    setCapturing]    = useState(false);
  const [processing,   setProcessing]   = useState(false);
  const [procStage,    setProcStage]    = useState('upload');
  const [imageQuality, setImageQuality] = useState(null); // 'good' | 'blurry' | null
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.00, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Simulate AI inference pipeline stages
  const simulateProcessing = useCallback(async (imageUri) => {
    const stages = ['upload', 'segment', 'colorspace', 'predict', 'report'];
    for (const stage of stages) {
      setProcStage(stage);
      await new Promise(r => setTimeout(r, 800));
    }

    // Simulate result
    const mockResult = {
      session_id:    'sess_' + Date.now(),
      patient_id:    patient?.patient_id,
      hb_level:      (7 + Math.random() * 7).toFixed(1),
      severity:      ['normal','mild','moderate','severe'][Math.floor(Math.random() * 4)],
      confidence:    (85 + Math.random() * 12).toFixed(1),
      image_type:    scanType.id,
      timestamp:     new Date().toISOString(),
    };

    setProcessing(false);
    navigation.navigate('Result', { result: mockResult, patient });
  }, [patient, scanType, navigation]);

  const handleCapture = useCallback(async () => {
    if (!patient) {
      setShowPatientModal(true);
      return;
    }

    setCapturing(true);
    // Simulate blur detection
    await new Promise(r => setTimeout(r, 500));
    const blurry = Math.random() < 0.15; // 15% chance of blur for demo
    setCapturing(false);

    if (blurry) {
      setImageQuality('blurry');
      Alert.alert(
        '⚠️ Image Quality Issue',
        'The image appears blurry. Please hold steady and ensure good lighting, then try again.',
        [{ text: 'Retake', onPress: () => setImageQuality(null) }]
      );
      return;
    }

    setImageQuality('good');
    setProcessing(true);
    await simulateProcessing('mock_image_uri');
  }, [patient, simulateProcessing]);

  const currentScanType = SCAN_TYPES.find(s => s.id === scanType.id);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Simulated Camera View ── */}
      <View style={styles.cameraView}>

        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.iconBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.topCenter}>
            <Text style={styles.topTitle}>HemaView Scan</Text>
            {patient && <Text style={styles.topPatient}>📋 {patient.full_name}</Text>}
          </View>

          <TouchableOpacity style={[styles.iconBtn, flashOn && styles.iconBtnActive]} onPress={() => setFlashOn(!flashOn)}>
            <Text style={styles.iconBtnText}>{flashOn ? '⚡' : '🔦'}</Text>
          </TouchableOpacity>
        </View>

        {/* Flash Indicator */}
        {flashOn && (
          <View style={styles.flashBadge}>
            <Text style={styles.flashText}>⚡ Flash Active — Lighting Normalized</Text>
          </View>
        )}

        {/* Main Overlay Area */}
        <View style={styles.overlayArea}>
          <Animated.View style={[
            styles.overlayFrame,
            { transform: [{ scale: pulseAnim }] },
            imageQuality === 'good'   && styles.overlayFrameGood,
            imageQuality === 'blurry' && styles.overlayFrameBad,
          ]}>
            <CornerBrackets color={
              imageQuality === 'good' ? Colors.success :
              imageQuality === 'blurry' ? Colors.accent[500] :
              Colors.primary[400]
            } />
            <ScanLine active={!capturing && !processing} />

            {/* Center instruction */}
            <View style={styles.overlayCenter}>
              <Text style={styles.overlayIcon}>{currentScanType?.icon}</Text>
              <Text style={styles.overlayInstruction}>
                {currentScanType?.id === 'conjunctiva'
                  ? 'Align inner eyelid\nwithin frame'
                  : currentScanType?.id === 'fingernail'
                  ? 'Place fingernail\nwithin frame'
                  : 'Open palm flat\nwithin frame'
                }
              </Text>
            </View>
          </Animated.View>

          {/* Quality indicator */}
          {imageQuality === 'good' && (
            <View style={styles.qualityBadge}>
              <Text style={styles.qualityText}>✓ Image Clear</Text>
            </View>
          )}
        </View>

        {/* Guidance Text */}
        <View style={styles.guidance}>
          <Text style={styles.guidanceText}>{currentScanType?.description}</Text>
          <Text style={styles.guidanceAccuracy}>Expected accuracy: <Text style={{ color: Colors.primary[300], fontWeight: '700' }}>{currentScanType?.accuracy}</Text></Text>
        </View>

        {/* Scan Type Row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scanTypeScroll} contentContainerStyle={styles.scanTypeRow}>
          {SCAN_TYPES.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[styles.scanTypeBtn, scanType.id === type.id && styles.scanTypeBtnActive]}
              onPress={() => setScanType(type)}
            >
              <Text style={styles.scanTypeBtnIcon}>{type.icon}</Text>
              <Text style={[styles.scanTypeBtnLabel, scanType.id === type.id && styles.scanTypeBtnLabelActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Capture Button */}
        <View style={styles.captureArea}>
          {/* Patient selection */}
          <TouchableOpacity style={styles.patientSelectBtn} onPress={() => setShowPatientModal(true)}>
            <Text style={styles.patientSelectText}>
              {patient ? `👤 ${patient.full_name}` : '👤 Select Patient'}
            </Text>
            <Text style={styles.patientSelectArrow}>›</Text>
          </TouchableOpacity>

          {/* Main capture button */}
          <TouchableOpacity
            style={[styles.captureBtn, capturing && styles.captureBtnActive]}
            onPress={handleCapture}
            disabled={capturing}
            activeOpacity={0.85}
          >
            {capturing ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <View style={styles.captureBtnInner} />
            )}
          </TouchableOpacity>

          <View style={styles.captureTip}>
            <Text style={styles.captureTipText}>Hold steady · Good lighting · Tap to capture</Text>
          </View>
        </View>
      </View>

      {/* Modals */}
      <PatientSelectorModal
        visible={showPatientModal}
        onClose={() => setShowPatientModal(false)}
        onSelect={(p) => { setPatient(p); setShowPatientModal(false); }}
      />
      {processing && <ProcessingOverlay stage={procStage} />}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#000' },
  cameraView:  { flex: 1, backgroundColor: '#0A1A1B' },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[3],
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnActive:  { backgroundColor: Colors.primary[600] },
  iconBtnText:    { fontSize: 18, color: '#fff' },
  topCenter:      { alignItems: 'center' },
  topTitle:       { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: '#fff' },
  topPatient:     { fontSize: Typography.size.xs, color: Colors.primary[300], marginTop: 2 },

  // Flash
  flashBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,220,50,0.15)',
    borderColor: 'rgba(255,220,50,0.4)',
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: 4,
    marginBottom: Spacing[2],
  },
  flashText: { fontSize: Typography.size.xs, color: '#FFD700', fontWeight: '600' },

  // Overlay
  overlayArea:    { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlayFrame: {
    width: OVERLAY_SIZE,
    height: OVERLAY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  overlayFrameGood: { backgroundColor: 'rgba(46,204,113,0.08)' },
  overlayFrameBad:  { backgroundColor: 'rgba(230,57,70,0.08)' },
  corner: { position: 'absolute', width: 24, height: 24 },
  overlayCenter:  { alignItems: 'center' },
  overlayIcon:    { fontSize: 44, marginBottom: Spacing[2] },
  overlayInstruction: {
    fontSize: Typography.size.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Scan line
  scanLine:     { position: 'absolute', left: 0, right: 0, height: 2, top: 0 },
  scanLineGlow: { height: 2, backgroundColor: Colors.primary[400], opacity: 0.8 },

  // Quality badge
  qualityBadge: {
    marginTop: Spacing[3],
    backgroundColor: Colors.success + '20',
    borderColor: Colors.success,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: 4,
  },
  qualityText: { fontSize: Typography.size.xs, color: Colors.success, fontWeight: '700' },

  // Guidance
  guidance:        { alignItems: 'center', paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  guidanceText:    { fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  guidanceAccuracy:{ fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.4)', marginTop: 4 },

  // Scan types
  scanTypeScroll:  { maxHeight: 70, flexGrow: 0 },
  scanTypeRow:     { paddingHorizontal: Spacing[4], gap: Spacing[3], alignItems: 'center' },
  scanTypeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 6,
  },
  scanTypeBtnActive:      { borderColor: Colors.primary[400], backgroundColor: Colors.primary[900] + '80' },
  scanTypeBtnIcon:        { fontSize: 16 },
  scanTypeBtnLabel:       { fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  scanTypeBtnLabelActive: { color: Colors.primary[300] },

  // Capture area
  captureArea: {
    paddingBottom: 40,
    paddingTop: Spacing[3],
    alignItems: 'center',
    paddingHorizontal: Spacing[5],
  },
  patientSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minWidth: 200,
    justifyContent: 'space-between',
  },
  patientSelectText:  { fontSize: Typography.size.sm, color: '#fff', fontWeight: '600' },
  patientSelectArrow: { fontSize: 18, color: 'rgba(255,255,255,0.5)', marginLeft: 8 },
  captureBtn: {
    width: 80, height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: Colors.primary[400],
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.primary,
  },
  captureBtnActive:  { borderColor: Colors.primary[300], backgroundColor: Colors.primary[700] + '40' },
  captureBtnInner: {
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary[500],
  },
  captureTip:     { marginTop: Spacing[3] },
  captureTipText: { fontSize: Typography.size.xs, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },

  // Patient Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.bg.card,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    padding: Spacing[6],
    paddingBottom: 40,
    ...Shadow.xl,
  },
  modalTitle:   { fontSize: Typography.size.xl, fontWeight: Typography.weight.bold, color: Colors.neutral[900] },
  modalSub:     { fontSize: Typography.size.sm, color: Colors.neutral[500], marginBottom: Spacing[4] },
  modalPatientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[3],
    borderRadius: Radius.lg,
    marginBottom: Spacing[2],
    borderWidth: 1.5,
    borderColor: Colors.neutral[150],
  },
  modalPatientSelected: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[50] },
  modalAvatar: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  modalAvatarText:     { fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, color: Colors.primary[600] },
  modalPatientName:    { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.neutral[900] },
  modalPatientMeta:    { fontSize: Typography.size.xs, color: Colors.neutral[500] },
  modalCheck:          { fontSize: 18, color: Colors.primary[500], marginLeft: 'auto' },
  modalBtns:           { flexDirection: 'row', gap: Spacing[3], marginTop: Spacing[4] },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    alignItems: 'center',
  },
  modalCancelText:   { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.neutral[600] },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: Spacing[3],
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary[500],
    alignItems: 'center',
    ...Shadow.primary,
  },
  modalBtnDisabled:  { opacity: 0.5 },
  modalConfirmText:  { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: '#fff' },

  // Processing overlay
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  processingCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: Radius['2xl'],
    padding: Spacing[8],
    alignItems: 'center',
    width: width * 0.85,
    ...Shadow.xl,
  },
  processingTitle: { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.neutral[900], marginBottom: Spacing[4] },
  processingSteps:     { width: '100%' },
  processingStep:      { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing[3] },
  processingDot: {
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.neutral[200],
    marginRight: Spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingDotActive: { borderColor: Colors.primary[500], backgroundColor: Colors.primary[50] },
  processingDotDone:   { borderColor: Colors.success, backgroundColor: Colors.success },
  processingStepText:  { fontSize: Typography.size.sm, color: Colors.neutral[400] },
  processingStepActive:{ color: Colors.primary[600], fontWeight: Typography.weight.semibold },
  processingStepDone:  { color: Colors.success },
  processingNote:      { fontSize: Typography.size.xs, color: Colors.neutral[400], marginTop: Spacing[4], fontStyle: 'italic' },
});
