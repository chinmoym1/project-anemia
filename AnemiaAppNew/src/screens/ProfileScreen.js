import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAuth} from '../context/AuthContext';
import {COLORS, FONTS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const MenuItem = ({icon, label, onPress, color = COLORS.textPrimary}) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <Icon name={icon} size={22} color={color} style={styles.menuIcon} />
    <Text style={[styles.menuLabel, {color}]}>{label}</Text>
    <Icon name="chevron-right" size={20} color={COLORS.textSecondary} />
  </TouchableOpacity>
);

const ProfileScreen = () => {
  const {user, logout} = useAuth();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Logout', style: 'destructive', onPress: logout},
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{user?.full_name?.[0]?.toUpperCase() || 'D'}</Text>
        </View>
        <Text style={styles.name}>{user?.full_name || 'Doctor'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Healthcare Provider</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="person" label="Edit Profile" onPress={() => {}} />
          <MenuItem icon="lock" label="Change Password" onPress={() => {}} />
          <MenuItem icon="notifications" label="Notifications" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.menuCard}>
          <MenuItem icon="info" label="About HemaView" onPress={() => {}} />
          <MenuItem icon="description" label="Privacy Policy" onPress={() => {}} />
          <MenuItem icon="help" label="Help & Support" onPress={() => {}} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.menuCard}>
          <MenuItem icon="logout" label="Logout" onPress={handleLogout} color={COLORS.error} />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>HemaView v1.0.0</Text>
        <Text style={styles.footerText}>MCA IV Project • Uttaranchal University</Text>
        <Text style={styles.footerText}>DISHA Compliant • AES-256 Secured</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {
    backgroundColor: COLORS.primary, alignItems: 'center',
    padding: SPACING.xl, paddingTop: SPACING.xxl,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md,
  },
  avatarText: {fontSize: 36, fontWeight: '700', color: COLORS.textLight},
  name: {fontSize: 22, fontWeight: '700', color: COLORS.textLight},
  email: {color: 'rgba(255,255,255,0.8)', marginTop: 4, fontSize: 14},
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, marginTop: SPACING.sm,
  },
  badgeText: {color: COLORS.textLight, fontSize: 12, fontWeight: '600'},
  section: {marginTop: SPACING.lg, paddingHorizontal: SPACING.md},
  sectionTitle: {...FONTS.caption, fontWeight: '700', textTransform: 'uppercase', marginBottom: SPACING.sm, color: COLORS.textSecondary},
  menuCard: {backgroundColor: COLORS.surface, borderRadius: RADIUS.md, ...SHADOW.sm},
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.divider,
  },
  menuIcon: {marginRight: SPACING.md},
  menuLabel: {...FONTS.body1, flex: 1},
  footer: {alignItems: 'center', padding: SPACING.xl, gap: 4},
  footerText: {...FONTS.caption, color: COLORS.textSecondary},
});

export default ProfileScreen;
