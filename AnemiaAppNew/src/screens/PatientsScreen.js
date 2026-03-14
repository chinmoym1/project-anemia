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
import {patientAPI} from '../services/api';
import {COLORS, FONTS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const GENDERS = ['Male', 'Female', 'Other'];

const PatientsScreen = ({navigation}) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  const loadPatients = useCallback(async () => {
    try {
      const res = await patientAPI.list();
      // Backend returns {items: [...], total: N}
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

  // Refresh when coming back from screening
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadPatients);
    return unsubscribe;
  }, [navigation, loadPatients]);

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
      severe: COLORS.severe,
      moderate: COLORS.moderate,
      mild: COLORS.mild,
      normal: COLORS.normal,
    }[sev?.toLowerCase()] || COLORS.textSecondary);

  const filtered = patients.filter(p =>
    p.full_name?.toLowerCase().includes(search.toLowerCase()),
  );

  const renderPatient = ({item}) => (
    <TouchableOpacity
      style={styles.patientCard}
      onPress={() => setSelectedPatient(item)}>
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
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Patients</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search patients..."
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* List */}
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
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No patients yet</Text>
              <Text style={styles.emptySubText}>
                Tap "+ Add" to add your first patient
              </Text>
            </View>
          }
        />
      )}

      {/* Patient Detail Modal */}
      <Modal
        visible={!!selectedPatient}
        animationType="slide"
        onRequestClose={() => setSelectedPatient(null)}>
        {selectedPatient && (
          <View style={styles.detailContainer}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setSelectedPatient(null)}>
                <Text style={styles.backIcon}>←</Text>
              </TouchableOpacity>
              <Text style={styles.detailTitle}>Patient Details</Text>
              <View style={{width: 40}} />
            </View>

            <ScrollView contentContainerStyle={styles.detailScroll}>
              {/* Patient Info Card */}
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
                        : 'No screening',
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

              {/* Screen This Patient Button */}
              <TouchableOpacity
                style={styles.screenBtn}
                onPress={() => {
                  setSelectedPatient(null);
                  navigation.navigate('Screening', {patient: selectedPatient});
                }}>
                <Text style={styles.screenBtnIcon}>📷</Text>
                <Text style={styles.screenBtnText}>Screen This Patient</Text>
              </TouchableOpacity>

              {/* Notes */}
              {selectedPatient.notes && (
                <View style={styles.notesCard}>
                  <Text style={styles.notesTitle}>Notes</Text>
                  <Text style={styles.notesText}>{selectedPatient.notes}</Text>
                </View>
              )}

              {/* Registered date */}
              <View style={styles.notesCard}>
                <Text style={styles.notesTitle}>Registered</Text>
                <Text style={styles.notesText}>
                  {selectedPatient.created_at
                    ? new Date(selectedPatient.created_at).toLocaleDateString(
                        'en-IN',
                        {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        },
                      )
                    : 'Unknown'}
                </Text>
              </View>
            </ScrollView>
          </View>
        )}
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
              }}>
              <Text style={styles.backIcon}>←</Text>
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
                placeholder: 'Any relevant medical notes',
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  addBtnText: {color: '#FFFFFF', fontWeight: '700', fontSize: 15},
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
  searchIcon: {fontSize: 16},
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
  chevron: {fontSize: 24, color: COLORS.textSecondary},
  empty: {alignItems: 'center', paddingTop: 80, gap: SPACING.sm},
  emptyIcon: {fontSize: 48},
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
  backIcon: {color: '#FFFFFF', fontSize: 24, width: 40},
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
  screenBtnIcon: {fontSize: 24},
  screenBtnText: {color: '#FFFFFF', fontSize: 18, fontWeight: '700'},
  notesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  notesText: {fontSize: 15, color: COLORS.textPrimary},
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  genderBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genderText: {fontSize: 14, color: COLORS.textSecondary, fontWeight: '500'},
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
