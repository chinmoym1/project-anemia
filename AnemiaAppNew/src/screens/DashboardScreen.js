import React, {useState, useEffect} from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAuth} from '../context/AuthContext';
import {patientAPI, screeningAPI} from '../services/api';
import {COLORS, FONTS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const StatCard = ({icon, label, value, color}) => (
  <View style={[styles.statCard, SHADOW.sm]}>
    <View style={[styles.statIcon, {backgroundColor: color + '20'}]}>
      <Icon name={icon} size={24} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const DashboardScreen = ({navigation}) => {
  const {user} = useAuth();
  const [stats, setStats] = useState({patients: 0, screenings: 0, severe: 0, normal: 0});
  const [recentScreenings, setRecentScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [patientsRes] = await Promise.allSettled([patientAPI.list()]);
      if (patientsRes.status === 'fulfilled') {
        setStats(prev => ({...prev, patients: patientsRes.value.data?.length || 0}));
      }
    } catch (e) {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const severityColor = sev => ({
    severe: COLORS.severe, moderate: COLORS.moderate,
    mild: COLORS.mild, normal: COLORS.normal,
  }[sev?.toLowerCase()] || COLORS.textSecondary);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.userName}>Dr. {user?.full_name || user?.email?.split('@')[0] || 'Doctor'}</Text>
          <Text style={styles.subTitle}>{new Date().toDateString()}</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Icon name="person" size={32} color={COLORS.textLight} />
        </View>
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsRow}>
        <StatCard icon="people" label="Patients" value={stats.patients} color={COLORS.secondary} />
        <StatCard icon="camera-alt" label="Screenings" value={stats.screenings} color={COLORS.primary} />
        <StatCard icon="warning" label="Severe" value={stats.severe} color={COLORS.severe} />
        <StatCard icon="check-circle" label="Normal" value={stats.normal} color={COLORS.normal} />
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, {backgroundColor: COLORS.primary}]}
          onPress={() => navigation.navigate('Screening')}>
          <Icon name="camera-alt" size={28} color={COLORS.textLight} />
          <Text style={styles.actionText}>New Screening</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, {backgroundColor: COLORS.secondary}]}
          onPress={() => navigation.navigate('Patients')}>
          <Icon name="person-add" size={28} color={COLORS.textLight} />
          <Text style={styles.actionText}>Add Patient</Text>
        </TouchableOpacity>
      </View>

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="info" size={20} color={COLORS.secondary} />
        <Text style={styles.infoText}>
          HemaView uses conjunctival analysis to screen for anemia non-invasively using your smartphone camera.
        </Text>
      </View>

      {/* WHO Reference */}
      <Text style={styles.sectionTitle}>WHO Hb Reference (g/dL)</Text>
      <View style={styles.whoCard}>
        {[
          {label: 'Normal', range: '≥ 12.0', color: COLORS.normal},
          {label: 'Mild Anemia', range: '10.0 – 11.9', color: COLORS.mild},
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  header: {
    backgroundColor: COLORS.primary, padding: SPACING.lg,
    paddingTop: SPACING.xl, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  greeting: {color: 'rgba(255,255,255,0.7)', fontSize: 14},
  userName: {color: COLORS.textLight, fontSize: 22, fontWeight: '700'},
  subTitle: {color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2},
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: {...FONTS.h4, margin: SPACING.md, marginBottom: SPACING.sm},
  statsRow: {flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.md, gap: SPACING.sm},
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center',
  },
  statIcon: {width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm},
  statValue: {fontSize: 24, fontWeight: '700', color: COLORS.textPrimary},
  statLabel: {...FONTS.caption, marginTop: 2},
  actionsRow: {flexDirection: 'row', paddingHorizontal: SPACING.md, gap: SPACING.md},
  actionBtn: {
    flex: 1, borderRadius: RADIUS.lg, padding: SPACING.md,
    alignItems: 'center', gap: SPACING.sm, ...SHADOW.md,
  },
  actionText: {color: COLORS.textLight, fontWeight: '600', fontSize: 14},
  infoBanner: {
    flexDirection: 'row', backgroundColor: COLORS.secondaryLight + '20',
    margin: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md,
    gap: SPACING.sm, alignItems: 'flex-start',
  },
  infoText: {...FONTS.body2, flex: 1, lineHeight: 20},
  whoCard: {
    backgroundColor: COLORS.surface, margin: SPACING.md,
    borderRadius: RADIUS.md, padding: SPACING.md, ...SHADOW.sm,
    marginBottom: SPACING.xl,
  },
  whoRow: {flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.divider},
  whoDot: {width: 12, height: 12, borderRadius: 6, marginRight: SPACING.sm},
  whoLabel: {...FONTS.body2, flex: 1, fontWeight: '500'},
  whoRange: {...FONTS.body2, fontWeight: '600'},
});

export default DashboardScreen;
