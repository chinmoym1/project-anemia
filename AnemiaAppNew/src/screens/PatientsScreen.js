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
import {patientAPI} from '../services/api';
import {COLORS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

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
      <Icon name="chevron-right" size={24} color={COLORS.textSecondary} />
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
        visible={!!selectedPatient}
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

              {/* Screen Button */}
              <TouchableOpacity
                style={styles.screenBtn}
                onPress={() => {
                  setSelectedPatient(null);
                  navigation.navigate('Screening', {patient: selectedPatient});
                }}>
                <Icon name="camera-alt" size={26} color="#FFFFFF" />
                <Text style={styles.screenBtnText}>Screen This Patient</Text>
              </TouchableOpacity>

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
                        'en-IN',
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
                    <Icon
                      name={
                        g === 'Male'
                          ? 'male'
                          : g === 'Female'
                          ? 'female'
                          : 'transgender'
                      }
                      size={16}
                      color={
                        form.biological_sex === g
                          ? '#FFFFFF'
                          : COLORS.textSecondary
                      }
                    />
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
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: SPACING.sm,
                  }}>
                  <Icon name="save" size={20} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Patient</Text>
                </View>
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
