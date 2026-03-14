import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import {COLORS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const {width} = Dimensions.get('window');

const LandingScreen = ({navigation}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const btnAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(btnAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#B71C1C" />

      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Logo + Title */}
      <Animated.View
        style={[
          styles.topSection,
          {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
        ]}>
        <View style={styles.logoContainer}>
          <View style={styles.logoOuter}>
            <View style={styles.logoInner}>
              <Text style={styles.logoIcon}>♥</Text>
            </View>
          </View>
        </View>
        <Text style={styles.appName}>HemaView</Text>
        <Text style={styles.tagline}>Non-Invasive Anemia Screening</Text>
        <Text style={styles.subTagline}>For Healthcare Providers</Text>
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>
            AI-POWERED • CONJUNCTIVAL ANALYSIS
          </Text>
          <View style={styles.dividerLine} />
        </View>
      </Animated.View>

      {/* Who is this for */}
      <Animated.View style={[styles.audienceCard, {opacity: fadeAnim}]}>
        <Text style={styles.audienceTitle}>Designed for</Text>
        <View style={styles.audienceRow}>
          {[
            {icon: '👨‍⚕️', label: 'Doctors'},
            {icon: '👩‍⚕️', label: 'Nurses'},
            {icon: '🏥', label: 'ASHA Workers'},
            {icon: '🔬', label: 'Clinicians'},
          ].map((item, i) => (
            <View key={i} style={styles.audienceItem}>
              <Text style={styles.audienceIcon}>{item.icon}</Text>
              <Text style={styles.audienceLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Stats */}
      <Animated.View style={[styles.statsRow, {opacity: fadeAnim}]}>
        {[
          {value: '< 30s', label: 'Per Screening'},
          {value: 'WHO', label: 'Hb Standard'},
          {value: 'No', label: 'Blood Test'},
        ].map((s, i) => (
          <View key={i} style={styles.statItem}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[styles.btnSection, {opacity: btnAnim}]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Signup')}
          activeOpacity={0.85}>
          <Text style={styles.secondaryBtnText}>Register as Provider</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          DISHA Compliant • AES-256 Encrypted • Uttaranchal University MCA
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#B71C1C',
    paddingHorizontal: SPACING.lg,
    justifyContent: 'space-between',
    paddingVertical: 56,
  },
  bgCircle1: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    top: -width * 0.5,
    right: -width * 0.3,
  },
  bgCircle2: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -width * 0.2,
    left: -width * 0.2,
  },
  topSection: {alignItems: 'center'},
  logoContainer: {marginBottom: SPACING.md},
  logoOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {fontSize: 32},
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  subTagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    width: '90%',
    marginTop: SPACING.md,
  },
  dividerLine: {flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.2)'},
  dividerText: {color: 'rgba(255,255,255,0.4)', fontSize: 9, letterSpacing: 1},
  audienceCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  audienceTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  audienceRow: {flexDirection: 'row', justifyContent: 'space-around'},
  audienceItem: {alignItems: 'center', gap: 4},
  audienceIcon: {fontSize: 26},
  audienceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statItem: {alignItems: 'center'},
  statValue: {color: '#FFFFFF', fontSize: 18, fontWeight: '800'},
  statLabel: {color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2},
  btnSection: {gap: SPACING.md},
  primaryBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.md,
  },
  primaryBtnText: {
    color: '#B71C1C',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    borderRadius: RADIUS.md,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footerText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    letterSpacing: 0.3,
  },
});

export default LandingScreen;
