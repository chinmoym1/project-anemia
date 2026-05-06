import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {authAPI} from '../services/api';
import {COLORS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const SignupScreen = ({navigation}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [facilityLocation, setFacilityLocation] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailRef = useRef();
  const facilityRef = useRef();
  const contactRef = useRef();
  const passwordRef = useRef();
  const confirmRef = useRef();

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Name, email and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.register({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        facility_location: facilityLocation.trim() || null,
        contact_info: contactInfo.trim() || null,
      });
      Alert.alert(
        '✅ Registration Successful',
        'Your provider account has been created and is pending admin verification. You can sign in now.',
        [{text: 'Sign In', onPress: () => navigation.navigate('Login')}],
      );
    } catch (err) {
      let msg = 'Registration failed. Please try again.';
      if (err.response?.data?.detail) {
        msg =
          typeof err.response.data.detail === 'string'
            ? err.response.data.detail
            : JSON.stringify(err.response.data.detail);
      }
      Alert.alert('Registration Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}>
            <Icon name="arrow-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Provider Registration</Text>
          <Text style={styles.headerSub}>
            Create your healthcare provider account
          </Text>
        </View>

        <View style={styles.card}>
          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>FULL NAME *</Text>
            <TextInput
              style={styles.input}
              placeholder="Dr. Priya Sharma"
              placeholderTextColor={COLORS.textSecondary}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL ADDRESS *</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              placeholder="doctor@hospital.com"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => facilityRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Facility Location */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>HOSPITAL / CLINIC NAME</Text>
            <TextInput
              ref={facilityRef}
              style={styles.input}
              placeholder="e.g. AIIMS Delhi, PHC Dehradun"
              placeholderTextColor={COLORS.textSecondary}
              value={facilityLocation}
              onChangeText={setFacilityLocation}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => contactRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Contact Info */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>CONTACT NUMBER</Text>
            <TextInput
              ref={contactRef}
              style={styles.input}
              placeholder="9876543210"
              placeholderTextColor={COLORS.textSecondary}
              value={contactInfo}
              onChangeText={(text) =>{   
                const numericValue = text.replace(/[^0-9]/g, '');   
                setContactInfo(numericValue); 
              }}
              keyboardType="phone-pad"
              maxLength={10}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD *</Text>
            <View style={styles.inputRow}>
              <TextInput
                ref={passwordRef}
                style={styles.inputInner}
                placeholder="Minimum 8 characters"
                placeholderTextColor={COLORS.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmRef.current?.focus()}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(v => !v)}
                style={styles.eyeBtn}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={22}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>CONFIRM PASSWORD *</Text>
            <View style={styles.inputRow}>
              <TextInput
                ref={confirmRef}
                style={styles.inputInner}
                placeholder="Re-enter your password"
                placeholderTextColor={COLORS.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(v => !v)}
                style={styles.eyeBtn}
                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                <Icon
                  name={showConfirm ? 'visibility' : 'visibility-off'}
                  size={22}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.signupBtn, loading && {opacity: 0.7}]}
            onPress={handleSignup}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signupBtnText}>Create Provider Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already registered? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.disclaimer}>
          This app is intended for licensed healthcare professionals only.
          Patient data is AES-256 encrypted and DISHA compliant.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  scroll: {flexGrow: 1, paddingBottom: 40},
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl, // Increased bottom padding to give the text more breathing room
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: SPACING.xs,
    marginLeft: -8,
  },
  headerTitle: {color: '#FFFFFF', fontSize: 24, fontWeight: '700'},
  headerSub: {color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4},
  card: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    marginTop: SPACING.md, // FIXED: Removed the negative margin so it no longer overlaps
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.md,
  },
  fieldGroup: {marginBottom: SPACING.md},
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    paddingRight: SPACING.sm,
  },
  inputInner: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md,
  },
  eyeBtn: {padding: SPACING.sm, justifyContent: 'center', alignItems: 'center'},
  signupBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOW.sm,
  },
  signupBtnText: {color: '#FFFFFF', fontSize: 17, fontWeight: '700'},
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.md,
  },
  loginText: {fontSize: 14, color: COLORS.textSecondary},
  loginLink: {fontSize: 14, color: COLORS.primary, fontWeight: '700'},
  disclaimer: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.md,
    lineHeight: 16,
  },
});

export default SignupScreen;
