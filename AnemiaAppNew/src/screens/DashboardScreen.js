import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {patientAPI, screeningAPI} from '../services/api';
import {useAuth} from '../context/AuthContext';
import {COLORS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const StatCard = ({iconName, label, value, color}) => (
  <View style={[styles.statCard, SHADOW.sm]}>
    <View style={[styles.statIcon, {backgroundColor: color + '20'}]}>
      <Icon name={iconName} size={26} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const DashboardScreen = ({navigation}) => {
  const {user} = useAuth();
  const [stats, setStats] = useState({
    patients: 0,
    screenings: 0,
    severe: 0,
    normal: 0,
  });
  const [recentScreenings, setRecentScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const patientsRes = await patientAPI.list(1, 100);
      const totalPatients =
        patientsRes.data?.total || patientsRes.data?.items?.length || 0;

      const screeningsRes = await screeningAPI.recent(50);
      const recentItems = screeningsRes.data?.items || [];
      const totalScreenings = screeningsRes.data?.count || recentItems.length;
      const severeCount = recentItems.filter(
        s => s.severity?.toLowerCase() === 'severe',
      ).length;
      const normalCount = recentItems.filter(
        s => s.severity?.toLowerCase() === 'normal',
      ).length;

      setStats({
        patients: totalPatients,
        screenings: totalScreenings,
        severe: severeCount,
        normal: normalCount,
      });
      setRecentScreenings(recentItems.slice(0, 5));
    } catch (e) {
      console.log('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  const severityColor = sev =>
    ({
      severe: COLORS.severe,
      moderate: COLORS.moderate,
      mild: COLORS.mild,
      normal: COLORS.normal,
    }[sev?.toLowerCase()] || COLORS.textSecondary);

  const severityIcon = sev =>
    ({
      severe: 'warning',
      moderate: 'error',
      mild: 'info',
      normal: 'check-circle',
    }[sev?.toLowerCase()] || 'help');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          colors={[COLORS.primary]}
        />
      }>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.full_name || 'Doctor'}</Text>
          <Text style={styles.subTitle}>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {user?.full_name?.[0]?.toUpperCase() || 'D'}
          </Text>
        </View>
      </View>

      <Text style={styles.refreshHint}>↓ Pull down to refresh</Text>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard
          iconName="people"
          label="Patients"
          value={stats.patients}
          color={COLORS.secondary}
        />
        <StatCard
          iconName="camera-alt"
          label="Screenings"
          value={stats.screenings}
          color={COLORS.primary}
        />
        <StatCard
          iconName="warning"
          label="Severe"
          value={stats.severe}
          color={COLORS.severe}
        />
        <StatCard
          iconName="check-circle"
          label="Normal"
          value={stats.normal}
          color={COLORS.normal}
        />
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, {backgroundColor: COLORS.primary}]}
          onPress={() => navigation.navigate('Patients')}>
          <Icon name="camera-alt" size={30} color="#FFFFFF" />
          <Text style={styles.actionText}>New Screening</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, {backgroundColor: COLORS.secondary}]}
          onPress={() => navigation.navigate('Patients')}>
          <Icon name="person-add" size={30} color="#FFFFFF" />
          <Text style={styles.actionText}>Add Patient</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Screenings */}
      <Text style={styles.sectionTitle}>Recent Screenings</Text>
      {recentScreenings.length > 0 ? (
        <View style={styles.recentCard}>
          {recentScreenings.map((item, index) => (
            <View
              key={item.session_id}
              style={[
                styles.recentRow,
                index < recentScreenings.length - 1 && styles.recentRowBorder,
              ]}>
              <View
                style={[
                  styles.recentIconCircle,
                  {backgroundColor: severityColor(item.severity) + '20'},
                ]}>
                <Icon
                  name={severityIcon(item.severity)}
                  size={20}
                  color={severityColor(item.severity)}
                />
              </View>
              <View style={{flex: 1, marginLeft: SPACING.sm}}>
                <Text style={styles.recentPatient}>
                  Patient #{item.patient_id}
                </Text>
                <Text style={styles.recentTime}>
                  {item.timestamp
                    ? new Date(item.timestamp).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Unknown'}
                </Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text
                  style={[
                    styles.recentHb,
                    {color: severityColor(item.severity)},
                  ]}>
                  {item.hb_level?.toFixed(1) || '--'} g/dL
                </Text>
                <Text
                  style={[
                    styles.recentSeverity,
                    {color: severityColor(item.severity)},
                  ]}>
                  {item.severity}
                </Text>
              </View>
              {item.is_critical && (
                <Icon
                  name="error"
                  size={18}
                  color={COLORS.severe}
                  style={{marginLeft: 4}}
                />
              )}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyRecent}>
          <Icon name="assignment" size={48} color={COLORS.border} />
          <Text style={styles.emptyRecentText}>No screenings yet</Text>
          <Text style={styles.emptyRecentSub}>
            Add a patient and perform a screening to see results here
          </Text>
        </View>
      )}

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

      {/* Info Banner */}
      <View style={styles.infoBanner}>
        <Icon name="info" size={20} color={COLORS.secondary} />
        <Text style={styles.infoText}>
          HemaView uses conjunctival (inner eyelid) analysis to screen for
          anemia non-invasively using your smartphone camera.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {fontSize: 14, color: COLORS.textSecondary},
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {color: 'rgba(255,255,255,0.7)', fontSize: 13},
  userName: {color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 2},
  subTitle: {color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2},
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {color: '#FFFFFF', fontSize: 22, fontWeight: '700'},
  refreshHint: {
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textSecondary,
    paddingVertical: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  statCard: {
    width: '47%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {fontSize: 28, fontWeight: '800', color: COLORS.textPrimary},
  statLabel: {fontSize: 12, color: COLORS.textSecondary, marginTop: 2},
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  actionBtn: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
    ...SHADOW.md,
  },
  actionText: {color: '#FFFFFF', fontWeight: '600', fontSize: 14},
  recentCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    ...SHADOW.sm,
    overflow: 'hidden',
  },
  recentRow: {flexDirection: 'row', alignItems: 'center', padding: SPACING.md},
  recentRowBorder: {borderBottomWidth: 1, borderBottomColor: COLORS.divider},
  recentIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentPatient: {fontSize: 14, fontWeight: '600', color: COLORS.textPrimary},
  recentTime: {fontSize: 11, color: COLORS.textSecondary, marginTop: 2},
  recentHb: {fontSize: 15, fontWeight: '800'},
  recentSeverity: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  emptyRecent: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOW.sm,
  },
  emptyRecentText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyRecentSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  whoCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
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
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary + '15',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    alignItems: 'flex-start',
    marginBottom: SPACING.xl,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});

export default DashboardScreen;
