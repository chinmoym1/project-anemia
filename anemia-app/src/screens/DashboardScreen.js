// ============================================================
// HEMAVIEW — Dashboard Screen
// Main hub: stats, recent patients, quick screening access
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  FlatList, TextInput, ActivityIndicator, RefreshControl,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../utils/designSystem';
import { useAuth } from '../context/AuthContext';
import { AnalyticsAPI, PatientAPI } from '../services/api';

const { width } = Dimensions.get('window');

// ─── Severity Pill ───────────────────────────────────────────
function SeverityPill({ severity }) {
  const s = Colors.severity[severity?.toLowerCase()] || Colors.severity.normal;
  const labels = { normal: 'Normal', mild: 'Mild', moderate: 'Moderate', severe: 'Severe' };
  return (
    <View style={[styles.pill, { backgroundColor: s.bg, borderColor: s.border }]}>
      <View style={[styles.pillDot, { backgroundColor: s.dot }]} />
      <Text style={[styles.pillText, { color: s.text }]}>{labels[severity?.toLowerCase()] || 'Normal'}</Text>
    </View>
  );
}

// ─── Stat Card ───────────────────────────────────────────────
function StatCard({ icon, value, label, color, delay }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, delay, useNativeDriver: true, tension: 80 }).start();
  }, []);
  return (
    <Animated.View style={[styles.statCard, {
      opacity: anim,
      transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
    }]}>
      <View style={[styles.statIconBg, { backgroundColor: color + '20' }]}>
        <Text style={styles.statIcon}>{icon}</Text>
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── Patient Row ─────────────────────────────────────────────
function PatientRow({ patient, onPress }) {
  const initials = (patient.full_name || 'P N').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const lastHb   = patient.last_hb_level;
  const severity = patient.last_severity || 'normal';

  return (
    <TouchableOpacity style={styles.patientRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.avatar, { backgroundColor: Colors.primary[100] }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>{patient.full_name}</Text>
        <Text style={styles.patientMeta}>
          {patient.age}y · {patient.biological_sex} · ID #{patient.patient_id?.toString().slice(-4).padStart(4,'0')}
        </Text>
      </View>
      <View style={styles.patientRight}>
        {lastHb ? (
          <>
            <Text style={styles.patientHb}>{lastHb} <Text style={styles.patientHbUnit}>g/dL</Text></Text>
            <SeverityPill severity={severity} />
          </>
        ) : (
          <Text style={styles.noScreening}>No screening</Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Hero Banner ─────────────────────────────────────────────
function HeroBanner({ provider, onNewScreening }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = provider?.full_name?.split(' ')[0] || 'Doctor';

  return (
    <View style={styles.heroBanner}>
      {/* Background Pattern */}
      <View style={styles.heroPattern}>
        {[...Array(4)].map((_, i) => (
          <View key={i} style={[styles.heroCircle, {
            width: 60 + i * 40, height: 60 + i * 40,
            borderRadius: (60 + i * 40) / 2,
            right: -20 + i * -10, top: -20 + i * -10,
            opacity: 0.08 - i * 0.015,
          }]} />
        ))}
      </View>

      <View style={styles.heroContent}>
        <View>
          <Text style={styles.heroGreeting}>{greeting}</Text>
          <Text style={styles.heroName}>{firstName} 👋</Text>
          <Text style={styles.heroSub}>{provider?.facility_location || 'Healthcare Provider'}</Text>
        </View>

        <TouchableOpacity style={styles.heroBtn} onPress={onNewScreening} activeOpacity={0.85}>
          <Text style={styles.heroBtnIcon}>📷</Text>
          <Text style={styles.heroBtnText}>New Scan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { provider } = useAuth();
  const [stats,    setStats]    = useState(null);
  const [patients, setPatients] = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsData, patientsData] = await Promise.all([
        AnalyticsAPI.getDashboardStats(),
        PatientAPI.list(1, 20, search),
      ]);
      setStats(statsData);
      setPatients(patientsData.items || []);
    } catch (e) {
      console.warn('Dashboard fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Mock data for UI preview when API is not connected
  const displayStats = stats || {
    total_patients: 142,
    screenings_today: 8,
    severe_cases: 3,
    normal_cases: 97,
  };

  const displayPatients = patients.length > 0 ? patients : [
    { patient_id: 1001, full_name: 'Priya Sharma', age: 28, biological_sex: 'Female', last_hb_level: 9.2, last_severity: 'mild' },
    { patient_id: 1002, full_name: 'Anjali Devi',  age: 34, biological_sex: 'Female', last_hb_level: 7.1, last_severity: 'moderate' },
    { patient_id: 1003, full_name: 'Ravi Kumar',   age: 45, biological_sex: 'Male',   last_hb_level: 12.8, last_severity: 'normal' },
    { patient_id: 1004, full_name: 'Sunita Patel', age: 22, biological_sex: 'Female', last_hb_level: 5.9, last_severity: 'severe' },
    { patient_id: 1005, full_name: 'Meena Yadav',  age: 31, biological_sex: 'Female', last_hb_level: null, last_severity: null },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary[700]} />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            colors={[Colors.primary[500]]}
          />
        }
      >
        {/* Hero */}
        <HeroBanner
          provider={provider}
          onNewScreening={() => navigation.navigate('Camera')}
        />

        {/* Stats Row */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="👥" value={displayStats.total_patients} label="Patients" color={Colors.primary[500]} delay={0} />
            <StatCard icon="📊" value={displayStats.screenings_today} label="Today" color={Colors.info} delay={100} />
            <StatCard icon="⚠️" value={displayStats.severe_cases} label="Severe" color={Colors.accent[500]} delay={200} />
            <StatCard icon="✅" value={`${displayStats.normal_cases}%`} label="Normal" color={Colors.success} delay={300} />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickRow}>
            {[
              { icon: '📷', label: 'New Screening', screen: 'Camera', color: Colors.primary[500] },
              { icon: '👤', label: 'Add Patient',   screen: 'AddPatient', color: Colors.info },
              { icon: '📈', label: 'Analytics',     screen: 'Analytics',  color: Colors.warning },
              { icon: '📋', label: 'Reports',       screen: 'Reports',    color: Colors.success },
            ].map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.quickCard}
                onPress={() => navigation.navigate(action.screen)}
                activeOpacity={0.8}
              >
                <View style={[styles.quickIconBg, { backgroundColor: action.color + '15' }]}>
                  <Text style={styles.quickIcon}>{action.icon}</Text>
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Patient List */}
        <View style={styles.patientsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Patients</Text>
            <TouchableOpacity onPress={() => navigation.navigate('PatientList')}>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search patients by name or ID..."
              placeholderTextColor={Colors.neutral[400]}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
          </View>

          {loading ? (
            <ActivityIndicator color={Colors.primary[500]} style={{ marginTop: Spacing[6] }} />
          ) : (
            <View style={styles.patientList}>
              {displayPatients.map((p, i) => (
                <PatientRow
                  key={p.patient_id || i}
                  patient={p}
                  onPress={() => navigation.navigate('PatientDetail', { patientId: p.patient_id })}
                />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg.primary },
  scroll:      { flex: 1 },

  // Hero
  heroBanner: {
    backgroundColor: Colors.primary[600],
    paddingTop: 56,
    paddingBottom: Spacing[6],
    paddingHorizontal: Spacing[5],
    overflow: 'hidden',
  },
  heroPattern: { position: 'absolute', right: 0, top: 0 },
  heroCircle:  { position: 'absolute', backgroundColor: '#fff' },
  heroContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroGreeting:{ fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  heroName:    { fontSize: Typography.size['3xl'], fontWeight: Typography.weight.black, color: '#fff' },
  heroSub:     { fontSize: Typography.size.sm, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  heroBtnIcon: { fontSize: 22, marginBottom: 2 },
  heroBtnText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.bold, color: '#fff' },

  // Stats
  statsSection:    { padding: Spacing[5], paddingBottom: 0 },
  sectionTitle:    { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.neutral[800], marginBottom: Spacing[3] },
  statsGrid:       { flexDirection: 'row', gap: Spacing[3] },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    alignItems: 'center',
    ...Shadow.sm,
  },
  statIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statIcon:   { fontSize: 18 },
  statValue:  { fontSize: Typography.size.xl, fontWeight: Typography.weight.black },
  statLabel:  { fontSize: Typography.size.xs, color: Colors.neutral[500], marginTop: 2, textAlign: 'center' },

  // Quick Actions
  quickSection:  { padding: Spacing[5], paddingBottom: 0, paddingTop: Spacing[4] },
  quickRow:      { flexDirection: 'row', gap: Spacing[3] },
  quickCard: {
    flex: 1,
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    alignItems: 'center',
    ...Shadow.sm,
  },
  quickIconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickIcon:   { fontSize: 22 },
  quickLabel:  { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold, color: Colors.neutral[700], textAlign: 'center' },

  // Patients
  patientsSection: { padding: Spacing[5], paddingTop: Spacing[4] },
  sectionHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing[3] },
  seeAll:          { fontSize: Typography.size.sm, color: Colors.primary[500], fontWeight: Typography.weight.semibold },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    marginBottom: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.neutral[150],
    ...Shadow.sm,
  },
  searchIcon:  { fontSize: 16, marginRight: Spacing[2] },
  searchInput: { flex: 1, fontSize: Typography.size.base, color: Colors.neutral[800] },

  patientList: { backgroundColor: Colors.bg.card, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.md },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[100],
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  avatarText:   { fontSize: Typography.size.base, fontWeight: Typography.weight.bold, color: Colors.primary[600] },
  patientInfo:  { flex: 1 },
  patientName:  { fontSize: Typography.size.base, fontWeight: Typography.weight.semibold, color: Colors.neutral[900] },
  patientMeta:  { fontSize: Typography.size.xs, color: Colors.neutral[500], marginTop: 2 },
  patientRight: { alignItems: 'flex-end', marginRight: Spacing[2] },
  patientHb:    { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.neutral[900] },
  patientHbUnit:{ fontSize: Typography.size.xs, fontWeight: Typography.weight.regular },
  noScreening:  { fontSize: Typography.size.xs, color: Colors.neutral[400], fontStyle: 'italic' },
  chevron:      { fontSize: 22, color: Colors.neutral[300] },

  // Severity Pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 3,
  },
  pillDot:  { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  pillText: { fontSize: Typography.size.xs, fontWeight: Typography.weight.semibold },
});
