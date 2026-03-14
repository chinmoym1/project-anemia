import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {reportAPI} from '../services/api';
import {COLORS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const SEVERITY_CONFIG = {
  severe: {
    color: COLORS.severe,
    icon: '🔴',
    bg: '#FFEBEE',
    label: 'Severe Anemia',
    action: 'Immediate medical attention required',
  },
  moderate: {
    color: COLORS.moderate,
    icon: '🟠',
    bg: '#FBE9E7',
    label: 'Moderate Anemia',
    action: 'Schedule CBC blood test within 48 hours',
  },
  mild: {
    color: COLORS.mild,
    icon: '🟡',
    bg: '#FFFDE7',
    label: 'Mild Anemia',
    action: 'Iron supplementation recommended',
  },
  normal: {
    color: COLORS.normal,
    icon: '🟢',
    bg: '#E8F5E9',
    label: 'Normal',
    action: 'Maintain balanced iron-rich diet',
  },
};

const ResultScreen = ({navigation, route}) => {
  const result = route.params?.result || {};
  const patient = route.params?.patient || null;
  const severity = result.severity?.toLowerCase() || 'normal';
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.normal;

  const downloadReport = async () => {
    if (!result.session_id) {
      Alert.alert('Error', 'No session ID found.');
      return;
    }
    try {
      await reportAPI.generate(result.session_id);
      Alert.alert('✅ Success', 'Report generated successfully.');
    } catch (e) {
      Alert.alert(
        'Error',
        'Could not generate report. Backend may not support this yet.',
      );
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{paddingBottom: 40}}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Screening Result</Text>
        <View style={{width: 40}} />
      </View>

      {/* Patient Info */}
      {patient && (
        <View style={styles.patientRow}>
          <View style={styles.patientAvatar}>
            <Text style={styles.patientAvatarText}>
              {patient.full_name?.[0]?.toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.patientName}>{patient.full_name}</Text>
            <Text style={styles.patientMeta}>
              {patient.biological_sex} • Age {patient.age} • ID #
              {patient.patient_id}
            </Text>
          </View>
        </View>
      )}

      {/* Critical Alert */}
      {result.is_critical && (
        <View style={styles.criticalBanner}>
          <Text style={styles.criticalIcon}>🚨</Text>
          <Text style={styles.criticalText}>
            CRITICAL: Hb below 7.0 g/dL — Immediate medical attention required!
          </Text>
        </View>
      )}

      {/* Severity Banner */}
      <View
        style={[
          styles.severityBanner,
          {backgroundColor: config.bg, borderColor: config.color},
        ]}>
        <Text style={styles.severityIcon}>{config.icon}</Text>
        <Text style={[styles.severityLabel, {color: config.color}]}>
          {config.label}
        </Text>
        <Text style={[styles.severityHb, {color: config.color}]}>
          Hb ≈ {result.hemoglobin_estimate?.toFixed(1) || '--'} g/dL
        </Text>
        <Text style={[styles.severityAction, {color: config.color}]}>
          {config.action}
        </Text>
      </View>

      {/* Diagnostic Details — matches diagnostic_result table */}
      <Text style={styles.sectionTitle}>Diagnostic Details</Text>
      <View style={styles.metricsCard}>
        {[
          {
            label: 'Hb Level (estimated_hb_level)',
            value: `${result.hemoglobin_estimate?.toFixed(2) || '--'} g/dL`,
          },
          {
            label: 'Severity (severity_classification)',
            value: result.severity || '--',
          },
          {
            label: 'Confidence Score',
            value: `${((result.confidence || 0) * 100).toFixed(1)}%`,
          },
          {
            label: 'Erythema Index',
            value: result.erythema_index?.toFixed(4) || '--',
          },
          {label: 'Model Version', value: result.model_version || '2.1'},
          {
            label: 'Processing Time',
            value: result.processing_time_ms
              ? `${result.processing_time_ms} ms`
              : '--',
          },
          {
            label: 'Critical Flag',
            value: result.is_critical ? '⚠️ YES' : '✅ No',
          },
        ].map(item => (
          <View key={item.label} style={styles.metricRow}>
            <Text style={styles.metricLabel}>{item.label}</Text>
            <Text
              style={[
                styles.metricValue,
                item.label.includes('Critical') &&
                  result.is_critical && {color: COLORS.severe},
              ]}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>

      {/* Session Details — matches screening_session table */}
      <Text style={styles.sectionTitle}>Session Info</Text>
      <View style={styles.metricsCard}>
        {[
          {label: 'Session ID', value: `#${result.session_id || '--'}`},
          {label: 'Patient ID', value: `#${result.patient_id || '--'}`},
          {label: 'Image Type', value: result.image_type || 'conjunctiva'},
          {
            label: 'Timestamp',
            value: result.timestamp
              ? new Date(result.timestamp).toLocaleString('en-IN')
              : '--',
          },
        ].map(item => (
          <View key={item.label} style={styles.metricRow}>
            <Text style={styles.metricLabel}>{item.label}</Text>
            <Text style={styles.metricValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* Clinical Recommendations */}
      <Text style={styles.sectionTitle}>Clinical Recommendations</Text>
      <View style={styles.recCard}>
        {severity === 'severe' &&
          [
            {icon: '🏥', text: 'Immediate hospital referral required'},
            {icon: '🩸', text: 'Urgent CBC and peripheral blood smear'},
            {icon: '💉', text: 'Consider IV iron therapy or blood transfusion'},
            {icon: '📞', text: 'Alert supervising physician immediately'},
          ].map((r, i) => <RecRow key={i} {...r} />)}

        {severity === 'moderate' &&
          [
            {icon: '🧪', text: 'Schedule CBC blood test within 48 hours'},
            {icon: '💊', text: 'Oral iron 60mg elemental iron twice daily'},
            {
              icon: '🥬',
              text: 'Iron-rich diet: leafy greens, red meat, legumes',
            },
            {icon: '📅', text: 'Follow up in 4 weeks'},
          ].map((r, i) => <RecRow key={i} {...r} />)}

        {severity === 'mild' &&
          [
            {icon: '🥗', text: 'Increase dietary iron intake'},
            {icon: '💊', text: 'Iron + folic acid supplements'},
            {icon: '🍊', text: 'Vitamin C with iron for better absorption'},
            {icon: '📅', text: 'Follow up in 6 weeks'},
          ].map((r, i) => <RecRow key={i} {...r} />)}

        {severity === 'normal' &&
          [
            {icon: '✅', text: 'Hemoglobin levels appear normal'},
            {icon: '🥗', text: 'Maintain balanced iron-rich diet'},
            {icon: '📅', text: 'Routine screening in 6 months'},
          ].map((r, i) => <RecRow key={i} {...r} />)}
      </View>

      {/* WHO Reference */}
      <View style={styles.whoCard}>
        <Text style={styles.whoTitle}>WHO Hb Reference (g/dL)</Text>
        {[
          {label: 'Normal', range: '≥ 12.0', color: COLORS.normal},
          {label: 'Mild', range: '10.0 – 11.9', color: COLORS.mild},
          {label: 'Moderate', range: '7.0 – 9.9', color: COLORS.moderate},
          {label: 'Severe', range: '< 7.0', color: COLORS.severe},
        ].map(item => (
          <View key={item.label} style={styles.whoRow}>
            <View style={[styles.whoDot, {backgroundColor: item.color}]} />
            <Text style={styles.whoLabel}>{item.label}</Text>
            <Text style={styles.whoRange}>{item.range}</Text>
          </View>
        ))}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          ⚠️ This is a screening tool only. Results must be confirmed with
          laboratory CBC testing. Not a substitute for clinical diagnosis.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, {backgroundColor: COLORS.primary}]}
          onPress={downloadReport}>
          <Text style={styles.actionBtnText}>📄 Download Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, {backgroundColor: COLORS.secondary}]}
          onPress={() => navigation.navigate('Patients')}>
          <Text style={styles.actionBtnText}>👥 Back to Patients</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const RecRow = ({icon, text}) => (
  <View style={styles.recRow}>
    <Text style={styles.recIcon}>{icon}</Text>
    <Text style={styles.recText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  backBtn: {padding: SPACING.sm, width: 40},
  backIcon: {color: '#FFFFFF', fontSize: 24},
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.md,
    ...SHADOW.sm,
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: {color: '#FFFFFF', fontSize: 20, fontWeight: '700'},
  patientName: {fontSize: 16, fontWeight: '700', color: COLORS.textPrimary},
  patientMeta: {fontSize: 12, color: COLORS.textSecondary, marginTop: 2},
  criticalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.severe,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  criticalIcon: {fontSize: 24},
  criticalText: {color: '#FFFFFF', fontWeight: '700', flex: 1, fontSize: 13},
  severityBanner: {
    margin: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  severityIcon: {fontSize: 48},
  severityLabel: {fontSize: 22, fontWeight: '800'},
  severityHb: {fontSize: 36, fontWeight: '900'},
  severityAction: {fontSize: 13, fontWeight: '500', textAlign: 'center'},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  metricsCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  metricLabel: {fontSize: 12, color: COLORS.textSecondary, flex: 1},
  metricValue: {fontSize: 13, fontWeight: '700', color: COLORS.textPrimary},
  recCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
    gap: SPACING.sm,
  },
  recRow: {flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm},
  recIcon: {fontSize: 16},
  recText: {fontSize: 14, color: COLORS.textPrimary, flex: 1, lineHeight: 20},
  whoCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  whoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    color: COLORS.textPrimary,
  },
  whoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  whoDot: {width: 12, height: 12, borderRadius: 6, marginRight: SPACING.sm},
  whoLabel: {fontSize: 14, flex: 1, color: COLORS.textPrimary},
  whoRange: {fontSize: 14, fontWeight: '700', color: COLORS.textPrimary},
  disclaimer: {
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: '#FFF8E1',
    borderRadius: RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
  },
  disclaimerText: {fontSize: 12, color: COLORS.textSecondary, lineHeight: 18},
  actions: {flexDirection: 'row', padding: SPACING.md, gap: SPACING.md},
  actionBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  actionBtnText: {color: '#FFFFFF', fontWeight: '600', fontSize: 14},
});

export default ResultScreen;
