import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {patientAPI, screeningAPI} from '../services/api';
import {COLORS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';
// IMPORT ADDED: Download Report Utility
import {downloadReport} from '../utils/reportDownload';

const GENDERS = ['Male', 'Female', 'Other'];

// ADDED: Severity Configuration from ResultScreen
const SEVERITY_CONFIG = {
  severe: {
    color: COLORS.severe || '#D32F2F',
    icon: '🔴',
    bg: '#FFEBEE',
    label: 'Severe Anemia',
    action: 'Immediate medical attention required',
  },
  moderate: {
    color: COLORS.moderate || '#F57C00',
    icon: '🟠',
    bg: '#FBE9E7',
    label: 'Moderate Anemia',
    action: 'Schedule CBC blood test within 48 hours',
  },
  mild: {
    color: COLORS.mild || '#FF9800',
    icon: '🟡',
    bg: '#FFFDE7',
    label: 'Mild Anemia',
    action: 'Iron supplementation recommended',
  },
  normal: {
    color: COLORS.normal || '#4CAF50',
    icon: '🟢',
    bg: '#E8F5E9',
    label: 'Normal',
    action: 'Maintain balanced iron-rich diet',
  },
};

// ADDED: RecRow Component from ResultScreen
const RecRow = ({icon, text}) => (
  <View style={styles.recRow}>
    <Text style={styles.recIcon}>{icon}</Text>
    <Text style={styles.recText}>{text}</Text>
  </View>
);

const PatientsScreen = ({navigation}) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals & Forms
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [form, setForm] = useState({
    full_name: '',
    age: '',
    biological_sex: 'Female',
    phone: '',
    notes: '',
  });

  // History State
  const [patientHistory, setPatientHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  const loadPatients = useCallback(async () => {
    try {
      const res = await patientAPI.list();
      const data = res.data?.items || res.data || [];
      setPatients(Array.isArray(data) ? data : []);
    } catch (e) {
      Alert.alert('Error', 'Could not load patients.');
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadPatients);
    return unsubscribe;
  }, [navigation, loadPatients]);

  // Load patient history when opening modal
  const openPatientModal = async patient => {
    setSelectedPatient(patient);
    setLoadingHistory(true);
    try {
      const res = await screeningAPI.getHistory(patient.patient_id);
      setPatientHistory(res.data?.items || []);
    } catch (e) {
      console.log('Failed to fetch history', e);
      setPatientHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const resetForm = () =>
    setForm({
      full_name: '',
      age: '',
      biological_sex: 'Female',
      phone: '',
      notes: '',
    });

  const savePatient = async () => {
    if (!form.full_name.trim() || !form.age) {
      Alert.alert('Error', 'Name and age are required.');
      return;
    }
    const age = parseInt(form.age);
    if (isNaN(age) || age < 0 || age > 120) {
      Alert.alert('Error', 'Please enter a valid age (0-120).');
      return;
    }
    setSaving(true);
    try {
      await patientAPI.create({
        full_name: form.full_name.trim(),
        age,
        biological_sex: form.biological_sex,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      setModalVisible(false);
      resetForm();
      loadPatients();
      Alert.alert('✅ Success', 'Patient added successfully.');
    } catch (e) {
      const msg = e.response?.data?.detail || 'Could not save patient.';
      Alert.alert('Error', typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  const severityColor = sev =>
    ({
      severe: COLORS.severe || '#D32F2F',
      moderate: COLORS.moderate || '#F57C00',
      mild: COLORS.mild || '#FF9800',
      normal: COLORS.normal || '#4CAF50',
    }[sev?.toLowerCase()] || COLORS.textSecondary);

  const filtered = patients.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()),
  );

  // UPDATED: Connected actual downloadReport function
  const handleDownloadReport = async report => {
    try {
      const patientName = selectedPatient?.full_name || 'Patient';
      await downloadReport(report.session_id, patientName);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate the PDF report.');
      console.error(error);
    }
  };

  const renderPatient = ({item}) => (
    <TouchableOpacity
      style={styles.patientCard}
      onPress={() => openPatientModal(item)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.full_name?.[0]?.toUpperCase() || 'P'}
        </Text>
      </View>
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>{item.full_name}</Text>
        <Text style={styles.patientMeta}>
          {item.biological_sex} • Age {item.age}
        </Text>
        {item.last_severity && (
          <View
            style={[
              styles.severityBadge,
              {backgroundColor: severityColor(item.last_severity) + '20'},
            ]}>
            <Text
              style={[
                styles.severityText,
                {color: severityColor(item.last_severity)},
              ]}>
              Last: {item.last_severity}{' '}
              {item.last_hb_level
                ? `(${item.last_hb_level.toFixed(1)} g/dL)`
                : ''}
            </Text>
          </View>
        )}
      </View>
      <Icon name="chevron-right" size={24} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );

  // Helper function to render the report content cleanly
  const renderReportContent = () => {
    if (!selectedReport) return null;
    const severity = selectedReport.severity?.toLowerCase() || 'normal';
    const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.normal;

    return (
      <View style={styles.detailContainer}>
        {/* Header */}
        <View style={styles.detailHeader}>
          <TouchableOpacity
            onPress={() => setSelectedReport(null)}
            style={styles.backBtn}>
            <Icon name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.detailTitle}>Diagnostic Report</Text>
          <View style={{width: 40}} />
        </View>

        <ScrollView contentContainerStyle={{paddingBottom: 40}}>
          {/* Patient Info */}
          {selectedPatient && (
            <View style={styles.patientRow}>
              <View style={styles.patientAvatar}>
                <Text style={styles.patientAvatarText}>
                  {selectedPatient.full_name?.[0]?.toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.patientName}>
                  {selectedPatient.full_name}
                </Text>
                <Text style={styles.patientMeta}>
                  {selectedPatient.biological_sex} • Age {selectedPatient.age} •
                  ID #{selectedPatient.patient_id}
                </Text>
              </View>
            </View>
          )}

          {/* Critical Alert */}
          {selectedReport.is_critical && (
            <View style={styles.criticalBanner}>
              <Text style={styles.criticalIcon}>🚨</Text>
              <Text style={styles.criticalText}>
                CRITICAL: Hb below 7.0 g/dL — Immediate medical attention
                required!
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
              Hb ≈ {selectedReport.hb_level?.toFixed(1) || '--'} g/dL
            </Text>
            <Text style={[styles.severityAction, {color: config.color}]}>
              {config.action}
            </Text>
          </View>

          {/* Diagnostic Details */}
          <Text style={styles.sectionTitle}>Diagnostic Details</Text>
          <View style={styles.metricsCard}>
            {[
              {
                label: 'Hb Level (estimated_hb_level)',
                value: `${selectedReport.hb_level?.toFixed(2) || '--'} g/dL`,
              },
              {
                label: 'Severity (severity_classification)',
                value: selectedReport.severity || '--',
              },
              {
                label: 'Critical Flag',
                value: selectedReport.is_critical ? '⚠️ YES' : '✅ No',
              },
            ].map(item => (
              <View key={item.label} style={styles.metricRow}>
                <Text style={styles.metricLabel}>{item.label}</Text>
                <Text
                  style={[
                    styles.metricValue,
                    item.label.includes('Critical') &&
                      selectedReport.is_critical && {
                        color: COLORS.severe || '#D32F2F',
                      },
                  ]}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Session Details */}
          <Text style={styles.sectionTitle}>Session Info</Text>
          <View style={styles.metricsCard}>
            {[
              {
                label: 'Session ID',
                value: `#${selectedReport.session_id || '--'}`,
              },
              {
                label: 'Patient ID',
                value: `#${selectedPatient?.patient_id || '--'}`,
              },
              {
                label: 'Timestamp',
                value: selectedReport.timestamp
                  ? new Date(selectedReport.timestamp).toLocaleString('en-IN')
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
                {
                  icon: '💉',
                  text: 'Consider IV iron therapy or blood transfusion',
                },
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
              {
                label: 'Normal',
                range: '≥ 12.0',
                color: COLORS.normal || '#4CAF50',
              },
              {
                label: 'Mild',
                range: '10.0 – 11.9',
                color: COLORS.mild || '#FF9800',
              },
              {
                label: 'Moderate',
                range: '7.0 – 9.9',
                color: COLORS.moderate || '#F57C00',
              },
              {
                label: 'Severe',
                range: '< 7.0',
                color: COLORS.severe || '#D32F2F',
              },
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
              onPress={() => handleDownloadReport(selectedReport)}>
              <Text style={styles.actionBtnText}>📄 Download Report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, {backgroundColor: COLORS.secondary}]}
              onPress={() => setSelectedReport(null)}>
              <Text style={styles.actionBtnText}>❌ Close Report</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}>
          <Icon name="person-add" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Icon name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search patients..."
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Icon name="close" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Patient List */}
      {loading ? (
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
          style={{marginTop: SPACING.xl}}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.patient_id)}
          renderItem={renderPatient}
          contentContainerStyle={{
            padding: SPACING.md,
            gap: SPACING.sm,
            paddingBottom: 100,
          }}
          onRefresh={loadPatients}
          refreshing={loading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="people-outline" size={64} color={COLORS.border} />
              <Text style={styles.emptyText}>No patients yet</Text>
              <Text style={styles.emptySubText}>
                Tap "Add" to add your first patient
              </Text>
            </View>
          }
        />
      )}

      {/* Patient Detail Modal */}
      <Modal
        visible={!!selectedPatient && !selectedReport}
        animationType="slide"
        onRequestClose={() => setSelectedPatient(null)}>
        {selectedPatient && (
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <TouchableOpacity
                onPress={() => setSelectedPatient(null)}
                style={styles.backBtn}>
                <Icon name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.detailTitle}>Patient Details</Text>
              <View style={{width: 40}} />
            </View>

            <ScrollView contentContainerStyle={styles.detailScroll}>
              <View style={styles.detailCard}>
                <View style={styles.detailAvatar}>
                  <Text style={styles.detailAvatarText}>
                    {selectedPatient.full_name?.[0]?.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.detailName}>
                  {selectedPatient.full_name}
                </Text>
                <Text style={styles.detailMeta}>
                  {selectedPatient.biological_sex} • Age {selectedPatient.age}
                </Text>

                <View style={styles.detailStats}>
                  {[
                    {
                      label: 'Patient ID',
                      value: `#${selectedPatient.patient_id}`,
                    },
                    {
                      label: 'Last Hb',
                      value: selectedPatient.last_hb_level
                        ? `${selectedPatient.last_hb_level.toFixed(1)} g/dL`
                        : 'No data',
                    },
                    {
                      label: 'Status',
                      value: selectedPatient.last_severity || 'Not screened',
                    },
                  ].map(s => (
                    <View key={s.label} style={styles.detailStat}>
                      <Text style={styles.detailStatValue}>{s.value}</Text>
                      <Text style={styles.detailStatLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.screenBtn}
                onPress={() => {
                  const patientToScreen = selectedPatient;
                  setSelectedPatient(null);
                  navigation.navigate('Screening', {patient: patientToScreen});
                }}>
                <Icon name="camera-alt" size={26} color="#FFFFFF" />
                <Text style={styles.screenBtnText}>Screen This Patient</Text>
              </TouchableOpacity>

              {/* Patient History Section */}
              <View style={styles.historyContainer}>
                <Text style={styles.historyTitle}>Screening History</Text>

                {loadingHistory ? (
                  <ActivityIndicator
                    color={COLORS.primary}
                    style={{marginTop: 20}}
                  />
                ) : patientHistory.length === 0 ? (
                  <Text style={styles.noHistoryText}>
                    No previous screenings found.
                  </Text>
                ) : (
                  patientHistory.map((item, index) => (
                    <TouchableOpacity
                      key={item.session_id || index}
                      style={styles.historyCard}
                      onPress={() => setSelectedReport(item)}>
                      <View style={styles.historyDate}>
                        <Icon
                          name="calendar-today"
                          size={16}
                          color={COLORS.textSecondary}
                        />
                        <Text style={styles.historyDateText}>
                          {new Date(item.timestamp).toLocaleDateString(
                            'en-US',
                            {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          )}
                        </Text>
                      </View>
                      <View style={styles.historyResult}>
                        <Text style={styles.historyHb}>
                          {item.hb_level} g/dL
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          }}>
                          <View
                            style={[
                              styles.badge,
                              {
                                backgroundColor:
                                  (SEVERITY_CONFIG[item.severity?.toLowerCase()]
                                    ?.color || COLORS.textSecondary) + '20',
                              },
                            ]}>
                            <Text
                              style={[
                                styles.badgeText,
                                {
                                  color:
                                    SEVERITY_CONFIG[
                                      item.severity?.toLowerCase()
                                    ]?.color || COLORS.textSecondary,
                                },
                              ]}>
                              {item.severity?.toUpperCase()}
                            </Text>
                          </View>
                          <Icon
                            name="chevron-right"
                            size={20}
                            color={COLORS.border || '#ccc'}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Info rows */}
              {[
                {
                  icon: 'edit-note',
                  title: 'Notes',
                  value: selectedPatient.notes || 'No notes added',
                  show: true,
                },
                {
                  icon: 'calendar-today',
                  title: 'Registered',
                  value: selectedPatient.created_at
                    ? new Date(selectedPatient.created_at).toLocaleDateString(
                        'en-US',
                        {day: 'numeric', month: 'long', year: 'numeric'},
                      )
                    : 'Unknown',
                  show: true,
                },
              ]
                .filter(i => i.show)
                .map(item => (
                  <View key={item.title} style={styles.infoCard}>
                    <View style={styles.infoCardRow}>
                      <Icon name={item.icon} size={18} color={COLORS.primary} />
                      <Text style={styles.infoCardTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.infoCardValue}>{item.value}</Text>
                  </View>
                ))}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* --- NEW: DETAILED REPORT MODAL USING RESULT SCREEN UI --- */}
      <Modal
        visible={!!selectedReport}
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}>
        {renderReportContent()}
      </Modal>

      {/* Add Patient Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.detailHeader}>
            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
              style={styles.backBtn}>
              <Icon name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.detailTitle}>Add New Patient</Text>
            <View style={{width: 40}} />
          </View>

          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled">
            {[
              {
                label: 'FULL NAME *',
                key: 'full_name',
                placeholder: 'Patient full name',
                keyboard: 'default',
                capitalize: 'words',
              },
              {
                label: 'AGE *',
                key: 'age',
                placeholder: 'Age in years',
                keyboard: 'numeric',
                capitalize: 'none',
              },
              {
                label: 'PHONE (optional)',
                key: 'phone',
                placeholder: '+91 XXXXX XXXXX',
                keyboard: 'phone-pad',
                capitalize: 'none',
              },
              {
                label: 'NOTES (optional)',
                key: 'notes',
                placeholder: 'Any medical notes',
                keyboard: 'default',
                capitalize: 'sentences',
              },
            ].map(field => (
              <View key={field.key} style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder={field.placeholder}
                  placeholderTextColor={COLORS.textSecondary}
                  value={form[field.key]}
                  onChangeText={v => setForm(f => ({...f, [field.key]: v}))}
                  keyboardType={field.keyboard}
                  autoCapitalize={field.capitalize}
                />
              </View>
            ))}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>BIOLOGICAL SEX *</Text>
              <View style={styles.genderRow}>
                {GENDERS.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderBtn,
                      form.biological_sex === g && styles.genderBtnActive,
                    ]}
                    onPress={() => setForm(f => ({...f, biological_sex: g}))}>
                    <Text
                      style={[
                        styles.genderText,
                        form.biological_sex === g && styles.genderTextActive,
                      ]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && {opacity: 0.7}]}
              onPress={savePatient}
              disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Patient</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  headerTitle: {color: '#FFFFFF', fontSize: 24, fontWeight: '700'},
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  addBtnText: {color: '#FFFFFF', fontWeight: '700', fontSize: 14},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  searchInput: {flex: 1, height: 44, fontSize: 15, color: COLORS.textPrimary},
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {color: '#FFFFFF', fontSize: 20, fontWeight: '700'},
  patientInfo: {flex: 1},
  patientName: {fontSize: 16, fontWeight: '600', color: COLORS.textPrimary},
  patientMeta: {fontSize: 13, color: COLORS.textSecondary, marginTop: 2},
  severityBadge: {
    marginTop: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  severityText: {fontSize: 11, fontWeight: '600'},
  empty: {alignItems: 'center', paddingTop: 80, gap: SPACING.sm},
  emptyText: {fontSize: 18, fontWeight: '600', color: COLORS.textSecondary},
  emptySubText: {fontSize: 14, color: COLORS.textSecondary},

  // Detail Modal
  detailContainer: {flex: 1, backgroundColor: COLORS.background},
  modalContainer: {flex: 1, backgroundColor: COLORS.background},
  detailHeader: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  backBtn: {width: 40, height: 40, justifyContent: 'center'},
  detailTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailScroll: {padding: SPACING.md, gap: SPACING.md},
  modalScroll: {padding: SPACING.md, gap: SPACING.md, paddingBottom: 40},
  detailCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOW.md,
  },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  detailAvatarText: {color: '#FFFFFF', fontSize: 30, fontWeight: '700'},
  detailName: {fontSize: 22, fontWeight: '700', color: COLORS.textPrimary},
  detailMeta: {fontSize: 14, color: COLORS.textSecondary, marginTop: 4},
  detailStats: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    width: '100%',
    justifyContent: 'space-around',
  },
  detailStat: {alignItems: 'center'},
  detailStatValue: {fontSize: 16, fontWeight: '700', color: COLORS.textPrimary},
  detailStatLabel: {fontSize: 11, color: COLORS.textSecondary, marginTop: 2},
  screenBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOW.md,
  },
  screenBtnText: {color: '#FFFFFF', fontSize: 18, fontWeight: '700'},
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  infoCardValue: {fontSize: 15, color: COLORS.textPrimary},

  // History Styles
  historyContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.sm,
    marginTop: SPACING.xs,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  noHistoryText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.md,
    fontStyle: 'italic',
  },
  historyCard: {
    borderWidth: 1,
    borderColor: COLORS.border || '#E0E0E0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  historyDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  historyDateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  historyResult: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyHb: {fontSize: 18, fontWeight: '700', color: COLORS.textPrimary},
  badge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  badgeText: {fontSize: 12, fontWeight: '700'},

  // --- RESULT SCREEN IMPORTED STYLES FOR THE REPORT MODAL ---
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
  criticalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.severe || '#D32F2F',
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
    borderBottomColor: COLORS.border || '#E0E0E0',
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
    borderBottomColor: COLORS.border || '#E0E0E0',
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
    borderLeftColor: COLORS.warning || '#FFA000',
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

  // Form
  fieldGroup: {marginBottom: SPACING.md},
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  genderRow: {flexDirection: 'row', gap: SPACING.sm},
  genderBtn: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  genderBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderText: {fontSize: 13, color: COLORS.textSecondary, fontWeight: '500'},
  genderTextActive: {color: '#FFFFFF', fontWeight: '700'},
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  saveBtnText: {color: '#FFFFFF', fontSize: 17, fontWeight: '700'},
});

export default PatientsScreen;
