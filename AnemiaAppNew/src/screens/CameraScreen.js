import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {screeningAPI} from '../services/api';
import {COLORS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const CameraScreen = ({navigation, route}) => {
  const preselectedPatient = route.params?.patient || null;
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const captureImage = async (fromCamera = true) => {
    const options = {
      mediaType: 'photo',
      quality: 1,
      maxWidth: 1920,
      maxHeight: 1080,
      saveToPhotos: false,
    };
    try {
      const result = fromCamera
        ? await launchCamera(options)
        : await launchImageLibrary(options);
      if (result.didCancel || result.errorCode) return;
      if (result.assets?.[0]) setImage(result.assets[0]);
    } catch (e) {
      Alert.alert(
        'Error',
        'Could not access camera. Check permissions in Settings.',
      );
    }
  };

  const analyzeImage = async () => {
    if (!image) {
      Alert.alert(
        'No Image',
        'Please capture or select a conjunctival image first.',
      );
      return;
    }
    if (!preselectedPatient) {
      Alert.alert(
        'No Patient Selected',
        'Please go to the Patients tab, select a patient, and tap "Screen This Patient".',
        [
          {
            text: 'Go to Patients',
            onPress: () => navigation.navigate('Patients'),
          },
        ],
      );
      return;
    }

    setAnalyzing(true);
    try {
      // Build FormData matching backend:
      // image, patient_id (Form int), image_type, device_model, ambient_lux
      const formData = new FormData();
      formData.append('image', {
        uri:
          Platform.OS === 'android'
            ? image.uri
            : image.uri.replace('file://', ''),
        type: image.type || 'image/jpeg',
        name: image.fileName || `conjunctiva_${Date.now()}.jpg`,
      });
      formData.append('patient_id', String(preselectedPatient.patient_id));
      formData.append('image_type', 'conjunctiva');
      formData.append('device_model', 'Android');
      formData.append('ambient_lux', '0.0');

      const response = await screeningAPI.analyze(formData);
      const result = response.data;

      // Navigate to result with full data
      navigation.navigate('Result', {
        result: {
          session_id: result.session_id,
          patient_id: result.patient_id,
          hemoglobin_estimate: result.hb_level,
          severity: result.severity,
          confidence: result.confidence,
          is_critical: result.is_critical,
          image_type: result.image_type,
          timestamp: result.timestamp,
          processing_time_ms: result.processing_time_ms,
          model_version: result.model_version,
          erythema_index: result.erythema_index,
        },
        patient: preselectedPatient,
      });
    } catch (e) {
      let msg = 'Analysis failed. Please try again.';
      if (e.response?.data?.detail) {
        msg =
          typeof e.response.data.detail === 'string'
            ? e.response.data.detail
            : JSON.stringify(e.response.data.detail);
      }
      Alert.alert('Analysis Failed', msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{paddingBottom: 40}}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Anemia Screening</Text>
        <Text style={styles.headerSub}>
          Conjunctival (inner eyelid) image analysis
        </Text>
      </View>

      {/* Patient Banner */}
      {preselectedPatient ? (
        <View style={styles.patientBanner}>
          <View style={styles.patientAvatar}>
            <Text style={styles.patientAvatarText}>
              {preselectedPatient.full_name?.[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={{flex: 1}}>
            <Text style={styles.patientBannerLabel}>Screening for</Text>
            <Text style={styles.patientBannerName}>
              {preselectedPatient.full_name}
            </Text>
            <Text style={styles.patientBannerMeta}>
              {preselectedPatient.biological_sex} • Age {preselectedPatient.age}{' '}
              • ID #{preselectedPatient.patient_id}
            </Text>
          </View>
          <Text style={{fontSize: 20}}>✅</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.noPatientBanner}
          onPress={() => navigation.navigate('Patients')}>
          <Text style={{fontSize: 24}}>⚠️</Text>
          <View style={{flex: 1}}>
            <Text style={styles.noPatientTitle}>No patient selected</Text>
            <Text style={styles.noPatientSub}>
              Tap here → go to Patients → select patient → "Screen This Patient"
            </Text>
          </View>
          <Text style={{fontSize: 18, color: COLORS.warning}}>›</Text>
        </TouchableOpacity>
      )}

      {/* Instructions */}
      <View style={styles.instructionCard}>
        <Text style={styles.instructionTitle}>📸 Capture Instructions</Text>
        {[
          "Gently pull down the patient's lower eyelid",
          'Ensure good lighting — natural or white light',
          'Hold phone 10–15 cm from the eye',
          'Keep the inner (pink) eyelid fully visible',
          'Hold steady — avoid motion blur',
        ].map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Image Preview */}
      <View style={styles.previewContainer}>
        {image ? (
          <>
            <Image
              source={{uri: image.uri}}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setImage(null)}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.imageInfo}>
              <Text style={styles.imageInfoText}>
                {image.width}×{image.height} •{' '}
                {image.fileSize
                  ? `${(image.fileSize / 1024).toFixed(0)} KB`
                  : ''}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>No image selected</Text>
            <Text style={styles.placeholderSub}>
              Capture or select from gallery
            </Text>
          </View>
        )}
      </View>

      {/* Capture Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[styles.captureBtn, {backgroundColor: COLORS.primary}]}
          onPress={() => captureImage(true)}>
          <Text style={styles.captureBtnText}>📷 Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.captureBtn, {backgroundColor: COLORS.secondary}]}
          onPress={() => captureImage(false)}>
          <Text style={styles.captureBtnText}>🖼 Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Analyze Button */}
      <TouchableOpacity
        style={[
          styles.analyzeBtn,
          (!image || analyzing) && styles.analyzeBtnDisabled,
        ]}
        onPress={analyzeImage}
        disabled={!image || analyzing}>
        {analyzing ? (
          <View style={styles.analyzingRow}>
            <ActivityIndicator color="#FFFFFF" />
            <Text style={styles.analyzeBtnText}>Analyzing conjunctiva...</Text>
          </View>
        ) : (
          <Text style={styles.analyzeBtnText}>🔬 Analyze for Anemia</Text>
        )}
      </TouchableOpacity>

      {analyzing && (
        <View style={styles.analyzingCard}>
          <Text style={styles.analyzingTitle}>ML Pipeline Running</Text>
          {[
            '🔍 Blur detection & quality check',
            '🎨 CLAHE normalization',
            '✂️ ROI segmentation',
            '🔬 CIELab feature extraction',
            '🧠 Random Forest inference',
            '📊 WHO severity classification',
          ].map((step, i) => (
            <Text key={i} style={styles.analyzingStep}>
              {step}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background},
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  headerTitle: {color: '#FFFFFF', fontSize: 24, fontWeight: '700'},
  headerSub: {color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4},
  patientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.normal,
    gap: SPACING.md,
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.normal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: {color: '#FFFFFF', fontSize: 20, fontWeight: '700'},
  patientBannerLabel: {
    fontSize: 11,
    color: COLORS.normal,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  patientBannerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  patientBannerMeta: {fontSize: 12, color: COLORS.textSecondary, marginTop: 2},
  noPatientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    gap: SPACING.md,
  },
  noPatientTitle: {fontSize: 14, fontWeight: '700', color: COLORS.textPrimary},
  noPatientSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  instructionCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    color: COLORS.textPrimary,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  previewContainer: {
    margin: SPACING.md,
    height: 240,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    ...SHADOW.md,
  },
  previewImage: {width: '100%', height: '100%'},
  clearBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {color: '#FFFFFF', fontSize: 14, fontWeight: '700'},
  imageInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: SPACING.xs,
  },
  imageInfoText: {color: '#FFFFFF', fontSize: 11, textAlign: 'center'},
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  placeholderIcon: {fontSize: 48},
  placeholderText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  placeholderSub: {fontSize: 12, color: COLORS.textSecondary},
  btnRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  captureBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    ...SHADOW.sm,
  },
  captureBtnText: {color: '#FFFFFF', fontWeight: '600', fontSize: 15},
  analyzeBtn: {
    backgroundColor: COLORS.success,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    ...SHADOW.md,
  },
  analyzeBtnDisabled: {opacity: 0.5},
  analyzingRow: {flexDirection: 'row', alignItems: 'center', gap: SPACING.sm},
  analyzeBtnText: {color: '#FFFFFF', fontSize: 17, fontWeight: '700'},
  analyzingCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    ...SHADOW.sm,
    gap: SPACING.xs,
  },
  analyzingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  analyzingStep: {fontSize: 13, color: COLORS.textSecondary, lineHeight: 22},
});

export default CameraScreen;
