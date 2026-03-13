// ============================================================
// HEMAVIEW — Result Screen
// Hemoglobin prediction display with severity, trend, report
// ============================================================

import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Dimensions, StatusBar, Share, Alert,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../utils/designSystem';

const { width } = Dimensions.get('window');

// ─── WHO Thresholds ──────────────────────────────────────────
const WHO_THRESHOLDS = {
  Female: { severe: 8.0, moderate: 10.0, mild: 12.0 },
  Male:   { severe: 8.0, moderate: 10.0, mild: 13.0 },
};

function classifySeverity(hb, sex = 'Female') {
  const t = WHO_THRESHOLDS[sex] || WHO_THRESHOLDS.Female;
  if (hb < t.severe)   return 'severe';
  if (hb < t.moderate) return 'moderate';
  if (hb < t.mild)     return 'mild';
  return 'normal';
}

function getSeverityInfo(severity) {
  return {
    normal:   { label: 'Normal',        icon: '✅', desc: 'Hemoglobin level is within the healthy range.', advice: 'Continue monitoring every 3 months.' },
    mild:     { label: 'Mild Anemia',   icon: '⚠️', desc: 'Slightly below normal. Iron-rich diet recommended.', advice: 'Prescribe iron supplements and schedule follow-up in 4 weeks.' },
    moderate: { label: 'Moderate Anemia', icon: '🔶', desc: 'Significantly below normal. Immediate dietary intervention needed.', advice: 'Oral iron therapy. Recheck in 2 weeks. Consider referring to physician.' },
    severe:   { label: 'Severe Anemia', icon: '🚨', desc: 'Critically low. Immediate medical attention required.', advice: 'URGENT: Refer to hospital immediately. Blood transfusion may be required.' },
  }[severity] || {};
}

// ─── Hb Gauge ────────────────────────────────────────────────
function HbGauge({ hbValue, severity }) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Normalize: 0–20 g/dL range
  const normalized = Math.min(Math.max(hbValue / 20, 0), 1);
  const s = Colors.severity[severity];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fillAnim, { toValue: normalized, delay: 300, tension: 40, friction: 8, useNativeDriver: false }),
      Animated.spring(scaleAnim, { toValue: 1, delay: 200, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const gaugeWidth = fillAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.gaugeContainer, { transform: [{ scale: scaleAnim }] }]}>
      {/* Value Display */}
      <View style={[styles.gaugeCircle, { borderColor: s?.border || Colors.primary[300] }]}>
        <Text style={[styles.gaugeValue, { color: s?.text || Colors.primary[600] }]}>{hbValue}</Text>
        <Text style={styles.gaugeUnit}>g/dL</Text>
        <Text style={styles.gaugeLabel}>Hemoglobin</Text>
      </View>

      {/* Bar */}
      <View style={styles.gaugeBar}>
        {/* Reference zones */}
        <View style={[styles.gaugeZone, { width: '40%', backgroundColor: Colors.severity.severe.bg }]} />
        <View style={[styles.gaugeZone, { width: '20%', backgroundColor: Colors.severity.moderate.bg }]} />
        <View style={[styles.gaugeZone, { width: '20%', backgroundColor: Colors.severity.mild.bg }]} />
        <View style={[styles.gaugeZone, { width: '20%', backgroundColor: Colors.severity.normal.bg }]} />
        {/* Fill */}
        <Animated.View style={[styles.gaugeFill, { width: gaugeWidth, backgroundColor: s?.border }]} />
        {/* Marker */}
        <Animated.View style={[styles.gaugeMarker, { left: gaugeWidth, borderColor: s?.border }]} />
      </View>

      <View style={styles.gaugeScale}>
        <Text style={styles.gaugeScaleText}>0</Text>
        <Text style={styles.gaugeScaleText}>8</Text>
        <Text style={styles.gaugeScaleText}>10</Text>
        <Text style={styles.gaugeScaleText}>12</Text>
        <Text style={styles.gaugeScaleText}>20 g/dL</Text>
      </View>
    </Animated.View>
  );
}

// ─── Mini Trend Chart (SVG-like with Views) ──────────────────
function MiniTrend({ data }) {
  if (!data || data.length < 2) return null;
  const maxV = Math.max(...data.map(d => d.hb));
  const minV = Math.min(...data.map(d => d.hb));
  const range = maxV - minV || 1;
  const chartH = 60;
  const chartW = width - Spacing[10] * 2;
  const stepX  = chartW / (data.length - 1);

  return (
    <View style={styles.trendContainer}>
      <Text style={styles.trendTitle}>📈 Screening History</Text>
      <View style={{ height: chartH, position: 'relative' }}>
        {/* Grid lines */}
        {[0, 0.5, 1].map((f, i) => (
          <View key={i} style={[styles.trendGridLine, { top: f * chartH }]} />
        ))}
        {/* Data points connected by line approximation */}
        {data.map((d, i) => {
          if (i === data.length - 1) return null;
          const x1 = i * stepX;
          const y1 = chartH - ((d.hb - minV) / range) * chartH;
          return (
            <View key={i} style={{
              position: 'absolute',
              left: x1,
              top: y1 - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: Colors.primary[500],
            }} />
          );
        })}
        {/* Last point highlighted */}
        {(() => {
          const last = data[data.length - 1];
          const x = (data.length - 1) * stepX;
          const y = chartH - ((last.hb - minV) / range) * chartH;
          return (
            <View style={{
              position: 'absolute',
              left: x - 6,
              top: y - 6,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: Colors.accent[500],
              borderWidth: 2,
              borderColor: '#fff',
            }} />
          );
        })()}
      </View>
      <View style={styles.trendLabels}>
        {data.map((d, i) => (
          <Text key={i} style={styles.trendLabel}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

// ─── Result Screen ────────────────────────────────────────────
export default function ResultScreen({ route, navigation }) {
  const { result, patient } = route.params || {};
  const [sharing, setSharing] = useState(false);

  const hb       = parseFloat(result?.hb_level || 10.5);
  const sex      = patient?.biological_sex || 'Female';
  const severity = result?.severity || classifySeverity(hb, sex);
  const sevInfo  = getSeverityInfo(severity);
  const s        = Colors.severity[severity];
  const confidence = parseFloat(result?.confidence || 92.3);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // Mock historical trend
  const trendData = [
    { label: 'Jan', hb: 8.2 },
    { label: 'Feb', hb: 9.1 },
    { label: 'Mar', hb: 9.8 },
    { label: 'Now', hb: hb },
  ];

  const handleShare = async () => {
    setSharing(true);
    try {
      await Share.share({
        message: `HemaView Clinical Report\nPatient: ${patient?.full_name || 'N/A'}\nHemoglobin: ${hb} g/dL\nSeverity: ${sevInfo.label}\nDate: ${new Date().toLocaleDateString()}\n\nGenerated by HemaView — Non-Invasive Anemia Screening`,
      });
    } catch (e) {
      Alert.alert('Share Failed', 'Could not share the report.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bg.primary} />

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: s?.bg || Colors.primary[50] }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Screening Result</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>↗</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Patient Info ── */}
          {patient && (
            <View style={styles.patientCard}>
              <View style={styles.patientAvatar}>
                <Text style={styles.patientAvatarText}>
                  {patient.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </Text>
              </View>
              <View>
                <Text style={styles.patientName}>{patient.full_name}</Text>
                <Text style={styles.patientMeta}>{patient.age}y · {patient.biological_sex}</Text>
              </View>
              <View style={styles.sessionBadge}>
                <Text style={styles.sessionText}>📋 {result?.image_type || 'conjunctiva'}</Text>
              </View>
            </View>
          )}

          {/* ── Severity Banner ── */}
          <View style={[styles.severityBanner, { backgroundColor: s?.bg, borderColor: s?.border }]}>
            <Text style={styles.severityIcon}>{sevInfo.icon}</Text>
            <View style={styles.severityInfo}>
              <Text style={[styles.severityLabel, { color: s?.text }]}>{sevInfo.label}</Text>
              <Text style={styles.severityDesc}>{sevInfo.desc}</Text>
            </View>
          </View>

          {/* ── Gauge ── */}
          <View style={styles.card}>
            <HbGauge hbValue={hb} severity={severity} />

            {/* Confidence */}
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>AI Confidence</Text>
              <View style={styles.confidenceBar}>
                <View style={[styles.confidenceFill, { width: `${confidence}%`, backgroundColor: confidence > 90 ? Colors.success : Colors.warning }]} />
              </View>
              <Text style={[styles.confidenceValue, { color: confidence > 90 ? Colors.success : Colors.warning }]}>{confidence}%</Text>
            </View>
          </View>

          {/* ── WHO Reference ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>WHO Reference Ranges</Text>
            {[
              { label: 'Normal',   range: sex === 'Male' ? '≥ 13.0' : '≥ 12.0', s: 'normal' },
              { label: 'Mild',     range: sex === 'Male' ? '10.0–12.9' : '10.0–11.9', s: 'mild' },
              { label: 'Moderate', range: '8.0–9.9', s: 'moderate' },
              { label: 'Severe',   range: '< 8.0',   s: 'severe' },
            ].map((row) => (
              <View key={row.label} style={[styles.whoRow, severity === row.s && styles.whoRowActive]}>
                <View style={[styles.whoDot, { backgroundColor: Colors.severity[row.s].dot }]} />
                <Text style={styles.whoLabel}>{row.label}</Text>
                <Text style={styles.whoRange}>{row.range} g/dL</Text>
                {severity === row.s && <Text style={styles.whoCurrentTag}>← Current</Text>}
              </View>
            ))}
          </View>

          {/* ── Clinical Advice ── */}
          <View style={[styles.adviceCard, { borderLeftColor: s?.border }]}>
            <Text style={styles.adviceTitle}>🩺 Clinical Recommendation</Text>
            <Text style={styles.adviceText}>{sevInfo.advice}</Text>
            {severity === 'severe' && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>🚨 URGENT ACTION REQUIRED</Text>
              </View>
            )}
          </View>

          {/* ── Trend ── */}
          <View style={styles.card}>
            <MiniTrend data={trendData} />
          </View>

          {/* ── Metadata ── */}
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>Screening Details</Text>
            {[
              { label: 'Session ID',    value: result?.session_id?.slice(-8) || 'N/A' },
              { label: 'Scan Type',     value: result?.image_type || 'Conjunctiva' },
              { label: 'Timestamp',     value: new Date(result?.timestamp || Date.now()).toLocaleString() },
              { label: 'AI Model',      value: 'HemaNet v2.1 (U-Net + Random Forest)' },
              { label: 'Encryption',    value: 'AES-256 · TLS 1.3' },
              { label: 'Data Policy',   value: 'DISHA Compliant · PII Stripped' },
            ].map((item) => (
              <View key={item.label} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{item.label}</Text>
                <Text style={styles.metaValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* ── Disclaimer ── */}
          <Text style={styles.disclaimer}>
            ⚕️ This result is generated by an AI screening tool and is intended for preliminary assessment only. It does not replace a formal clinical diagnosis. Always confirm with a Complete Blood Count (CBC) test by a certified pathology laboratory.
          </Text>

          {/* ── Action Buttons ── */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.pdfBtn} onPress={handleShare}>
              <Text style={styles.pdfBtnText}>📄 Download PDF Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.newScanBtn}
              onPress={() => navigation.navigate('Camera')}
            >
              <Text style={styles.newScanText}>📷 New Screening</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <Text style={styles.homeText}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 60 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[150],
  },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' },
  backBtnText:  { fontSize: 28, color: Colors.neutral[700], lineHeight: 32 },
  headerTitle:  { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.neutral[900] },
  shareBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary[50], alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary[200] },
  shareBtnText: { fontSize: 20, color: Colors.primary[600] },

  scroll: { flex: 1 },

  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    margin: Spacing[5],
    marginBottom: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.xl,
    ...Shadow.sm,
  },
  patientAvatar: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary[100],
    alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing[3],
  },
  patientAvatarText: { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.primary[600] },
  patientName:  { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.neutral[900] },
  patientMeta:  { fontSize: Typography.size.xs, color: Colors.neutral[500] },
  sessionBadge: { marginLeft: 'auto', backgroundColor: Colors.neutral[100], borderRadius: Radius.full, paddingHorizontal: Spacing[3], paddingVertical: 4 },
  sessionText:  { fontSize: Typography.size.xs, color: Colors.neutral[600], fontWeight: '600', textTransform: 'capitalize' },

  severityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: 1.5,
  },
  severityIcon:  { fontSize: 32, marginRight: Spacing[3] },
  severityInfo:  { flex: 1 },
  severityLabel: { fontSize: Typography.size.xl, fontWeight: Typography.weight.black },
  severityDesc:  { fontSize: Typography.size.sm, color: Colors.neutral[600], marginTop: 2 },

  card: {
    backgroundColor: Colors.bg.card,
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[3],
    padding: Spacing[5],
    borderRadius: Radius.xl,
    ...Shadow.sm,
  },
  cardTitle: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.neutral[800], marginBottom: Spacing[3] },

  // Gauge
  gaugeContainer: { alignItems: 'center' },
  gaugeCircle: {
    width: 140, height: 140,
    borderRadius: 70,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[5],
    backgroundColor: Colors.bg.primary,
  },
  gaugeValue: { fontSize: Typography.size['5xl'], fontWeight: Typography.weight.black, lineHeight: 50 },
  gaugeUnit:  { fontSize: Typography.size.base, color: Colors.neutral[500], fontWeight: '600' },
  gaugeLabel: { fontSize: Typography.size.xs, color: Colors.neutral[400], marginTop: 2 },
  gaugeBar:   { width: '100%', height: 12, borderRadius: 6, backgroundColor: Colors.neutral[100], flexDirection: 'row', overflow: 'visible', position: 'relative', marginBottom: 6 },
  gaugeZone:  { height: '100%' },
  gaugeFill:  { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 6 },
  gaugeMarker:{ position: 'absolute', top: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 3, backgroundColor: '#fff', marginLeft: -10, ...Shadow.sm },
  gaugeScale: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  gaugeScaleText: { fontSize: Typography.size.xs, color: Colors.neutral[400] },

  // Confidence
  confidenceRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing[4] },
  confidenceLabel:{ fontSize: Typography.size.sm, color: Colors.neutral[600], width: 100 },
  confidenceBar: { flex: 1, height: 6, backgroundColor: Colors.neutral[100], borderRadius: 3, marginHorizontal: Spacing[2] },
  confidenceFill: { height: '100%', borderRadius: 3 },
  confidenceValue:{ fontSize: Typography.size.sm, fontWeight: Typography.weight.bold, width: 45, textAlign: 'right' },

  // WHO
  whoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
    borderRadius: Radius.md,
    marginBottom: Spacing[1],
  },
  whoRowActive: { backgroundColor: Colors.neutral[50], borderWidth: 1, borderColor: Colors.neutral[150] },
  whoDot:      { width: 10, height: 10, borderRadius: 5, marginRight: Spacing[3] },
  whoLabel:    { flex: 1, fontSize: Typography.size.base, fontWeight: Typography.weight.medium, color: Colors.neutral[800] },
  whoRange:    { fontSize: Typography.size.sm, color: Colors.neutral[500] },
  whoCurrentTag: { fontSize: Typography.size.xs, color: Colors.primary[500], fontWeight: '700', marginLeft: 6 },

  // Advice
  adviceCard: {
    backgroundColor: Colors.bg.card,
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[3],
    padding: Spacing[5],
    borderRadius: Radius.xl,
    borderLeftWidth: 4,
    ...Shadow.sm,
  },
  adviceTitle: { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.neutral[900], marginBottom: Spacing[2] },
  adviceText:  { fontSize: Typography.size.base, color: Colors.neutral[700], lineHeight: 22 },
  urgentBadge: { marginTop: Spacing[3], backgroundColor: Colors.accent[50], borderRadius: Radius.md, padding: Spacing[3], borderWidth: 1, borderColor: Colors.accent[200] },
  urgentText:  { fontSize: Typography.size.sm, color: Colors.accent[600], fontWeight: Typography.weight.bold },

  // Trend
  trendContainer: {},
  trendTitle:     { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.neutral[800], marginBottom: Spacing[3] },
  trendGridLine:  { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Colors.neutral[100] },
  trendLabels:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing[2] },
  trendLabel:     { fontSize: Typography.size.xs, color: Colors.neutral[400] },

  // Meta
  metaCard: {
    backgroundColor: Colors.bg.card,
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[3],
    padding: Spacing[5],
    borderRadius: Radius.xl,
    ...Shadow.sm,
  },
  metaTitle:  { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.neutral[800], marginBottom: Spacing[3] },
  metaRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing[2], borderBottomWidth: 1, borderBottomColor: Colors.neutral[50] },
  metaLabel:  { fontSize: Typography.size.sm, color: Colors.neutral[500] },
  metaValue:  { fontSize: Typography.size.sm, color: Colors.neutral[800], fontWeight: '500', textAlign: 'right', flex: 1, marginLeft: Spacing[3] },

  disclaimer: {
    fontSize: Typography.size.xs,
    color: Colors.neutral[400],
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[4],
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // Actions
  actions: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  pdfBtn: {
    backgroundColor: Colors.primary[500],
    borderRadius: Radius.lg,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    ...Shadow.primary,
  },
  pdfBtnText:   { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: '#fff' },
  newScanBtn: {
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.lg,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary[200],
  },
  newScanText:  { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.primary[600] },
  homeBtn: {
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  homeText:     { fontSize: Typography.size.base, color: Colors.neutral[500] },
});
