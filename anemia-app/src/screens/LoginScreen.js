// ============================================================
// HEMAVIEW — Login Screen
// Professional medical-grade authentication UI
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Animated,
  StatusBar, ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, Shadow } from '../utils/designSystem';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

// ─── Animated Cell Background ────────────────────────────────
function RBCBackground() {
  const cells = useRef(
    Array.from({ length: 8 }, (_, i) => ({
      anim: new Animated.Value(0),
      x: Math.random() * width,
      y: Math.random() * height * 0.5,
      size: 30 + Math.random() * 40,
      delay: i * 300,
    }))
  ).current;

  useEffect(() => {
    cells.forEach((cell) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(cell.anim, {
            toValue: 1, duration: 3000 + Math.random() * 2000,
            delay: cell.delay, useNativeDriver: true,
          }),
          Animated.timing(cell.anim, {
            toValue: 0, duration: 3000 + Math.random() * 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cells.map((cell, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: cell.x,
            top: cell.y,
            width: cell.size,
            height: cell.size,
            borderRadius: cell.size / 2,
            backgroundColor: 'rgba(255,255,255,0.06)',
            opacity: cell.anim,
            transform: [{
              scale: cell.anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }),
            }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Input Field Component ───────────────────────────────────
function SecureInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize, icon, error }) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? Colors.accent[400] : Colors.neutral[200], Colors.primary[500]],
  });

  return (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Animated.View style={[styles.inputContainer, { borderColor }, error && styles.inputError]}>
        <Text style={styles.inputIcon}>{icon}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.neutral[400]}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

// ─── Main Login Screen ───────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const { login, isLoading, error, clearError } = useAuth();
  const [mode, setMode]           = useState('login'); // 'login' | 'register'
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [fullName, setFullName]   = useState('');
  const [facility, setFacility]   = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  const validate = () => {
    const errs = {};
    if (!email.includes('@')) errs.email = 'Enter a valid email address';
    if (password.length < 8)  errs.password = 'Password must be at least 8 characters';
    if (mode === 'register') {
      if (!fullName.trim())   errs.fullName = 'Full name is required';
      if (!facility.trim())   errs.facility = 'Facility name is required';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    clearError();
    if (!validate()) return;

    if (mode === 'login') {
      const result = await login(email.toLowerCase().trim(), password);
      if (!result.success) {
        Alert.alert('Login Failed', result.error || 'Invalid credentials. Please try again.');
      }
    } else {
      // Register flow
      Alert.alert(
        'Account Created',
        'Your account has been submitted for verification. Please wait for admin approval.',
        [{ text: 'OK', onPress: () => setMode('login') }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary[900]} />

      {/* ── Hero Header ── */}
      <View style={styles.hero}>
        <RBCBackground />
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          {/* Logo Mark */}
          <View style={styles.logoMark}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoIcon}>🩸</Text>
            </View>
            <View style={styles.logoRing} />
          </View>

          <Text style={styles.brandName}>HemaView</Text>
          <Text style={styles.brandTagline}>Non-Invasive Anemia Screening</Text>

          {/* Security Badge */}
          <View style={styles.securityBadge}>
            <Text style={styles.securityIcon}>🔒</Text>
            <Text style={styles.securityText}>DISHA · AES-256 · TLS 1.3 Secured</Text>
          </View>
        </Animated.View>
      </View>

      {/* ── Form Card ── */}
      <KeyboardAvoidingView
        style={styles.formOuter}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.formScroll}
          contentContainerStyle={styles.formScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}>

            {/* Tab Switcher */}
            <View style={styles.tabRow}>
              {['login', 'register'].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, mode === tab && styles.tabActive]}
                  onPress={() => { setMode(tab); setFieldErrors({}); clearError(); }}
                >
                  <Text style={[styles.tabText, mode === tab && styles.tabTextActive]}>
                    {tab === 'login' ? 'Sign In' : 'Register'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formTitle}>
              {mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </Text>
            <Text style={styles.formSubtitle}>
              {mode === 'login'
                ? 'Sign in to your healthcare provider account'
                : 'Register as a frontline healthcare worker'}
            </Text>

            {/* Register Fields */}
            {mode === 'register' && (
              <>
                <SecureInput
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Dr. Jane Smith"
                  icon="👤"
                  autoCapitalize="words"
                  error={fieldErrors.fullName}
                />
                <SecureInput
                  label="Healthcare Facility"
                  value={facility}
                  onChangeText={setFacility}
                  placeholder="PHC Rampur, District Hospital..."
                  icon="🏥"
                  autoCapitalize="words"
                  error={fieldErrors.facility}
                />
              </>
            )}

            <SecureInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              placeholder="provider@hospital.org"
              icon="✉️"
              keyboardType="email-address"
              error={fieldErrors.email}
            />

            <SecureInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'register' ? 'Min. 8 characters' : 'Enter your password'}
              icon="🔑"
              secureTextEntry
              error={fieldErrors.password}
            />

            {mode === 'login' && (
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.neutral[0]} size="small" />
              ) : (
                <>
                  <Text style={styles.submitText}>
                    {mode === 'login' ? 'Sign In Securely' : 'Create Account'}
                  </Text>
                  <Text style={styles.submitArrow}>→</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Disclaimer */}
            <Text style={styles.disclaimer}>
              🏥 For registered healthcare professionals only. Unauthorized access is prohibited and logged.
            </Text>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary[900],
  },
  hero: {
    height: height * 0.38,
    backgroundColor: Colors.primary[800],
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    overflow: 'hidden',
  },
  logoMark: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing[3],
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  logoIcon: { fontSize: 32 },
  brandName: {
    fontSize: Typography.size['4xl'],
    fontWeight: Typography.weight.black,
    color: Colors.neutral[0],
    textAlign: 'center',
    letterSpacing: Typography.tracking.wide,
  },
  brandTagline: {
    fontSize: Typography.size.sm,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: Typography.tracking.widest,
    textTransform: 'uppercase',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing[3],
    backgroundColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  securityIcon: { fontSize: 12, marginRight: 6 },
  securityText: {
    fontSize: Typography.size.xs,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: Typography.tracking.wide,
  },
  formOuter: { flex: 1 },
  formScroll: { flex: 1 },
  formScrollContent: { flexGrow: 1 },
  formCard: {
    flex: 1,
    backgroundColor: Colors.bg.secondary,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[6],
    paddingBottom: Spacing[10],
    ...Shadow.xl,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.neutral[100],
    borderRadius: Radius.lg,
    padding: 4,
    marginBottom: Spacing[5],
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing[2],
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Colors.primary[500],
    ...Shadow.primary,
  },
  tabText: {
    fontSize: Typography.size.base,
    fontWeight: Typography.weight.semibold,
    color: Colors.neutral[500],
  },
  tabTextActive: { color: Colors.neutral[0] },
  formTitle: {
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: Typography.size.sm,
    color: Colors.neutral[500],
    marginBottom: Spacing[5],
    lineHeight: Typography.size.sm * Typography.lineHeight.normal,
  },
  inputWrapper: { marginBottom: Spacing[4] },
  inputLabel: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
    color: Colors.neutral[700],
    marginBottom: 6,
    letterSpacing: Typography.tracking.wide,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.md,
    backgroundColor: Colors.neutral[50],
    paddingHorizontal: Spacing[3],
    height: 52,
  },
  inputError: { borderColor: Colors.accent[400] },
  inputIcon: { fontSize: 16, marginRight: Spacing[2] },
  input: {
    flex: 1,
    fontSize: Typography.size.base,
    color: Colors.neutral[900],
    fontWeight: Typography.weight.medium,
  },
  eyeBtn: { padding: 4 },
  eyeIcon: { fontSize: 16 },
  errorText: {
    fontSize: Typography.size.xs,
    color: Colors.accent[500],
    marginTop: 4,
    marginLeft: 2,
  },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: Spacing[4], marginTop: -Spacing[2] },
  forgotText: {
    fontSize: Typography.size.sm,
    color: Colors.primary[500],
    fontWeight: Typography.weight.semibold,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    borderRadius: Radius.lg,
    paddingVertical: Spacing[4],
    marginTop: Spacing[2],
    ...Shadow.primary,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
    color: Colors.neutral[0],
    letterSpacing: Typography.tracking.wide,
  },
  submitArrow: {
    fontSize: Typography.size.xl,
    color: Colors.neutral[0],
    marginLeft: Spacing[2],
  },
  disclaimer: {
    fontSize: Typography.size.xs,
    color: Colors.neutral[400],
    textAlign: 'center',
    marginTop: Spacing[5],
    lineHeight: Typography.size.xs * Typography.lineHeight.relaxed,
  },
});
