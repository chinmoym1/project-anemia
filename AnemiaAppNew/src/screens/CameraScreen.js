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
import Icon from 'react-native-vector-icons/MaterialIcons';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {screeningAPI} from '../services/api';
import {COLORS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const CameraScreen = ({navigation, route}) => {
  const preselectedPatient = route.params?.patient || null;
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const captureImage = async (fromCamera = true) => {
    setValidationError(null); // Clear previous errors
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
    setValidationError(null);

    try {
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

      // 🛑 Strict Backend Image Validation Check
      if (result.error) {
        setValidationError(result.error);
        return;
      }

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
      // Show strict validation failures in the UI instead of a popup
      setValidationError(msg);
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
          <Icon
            name="verified-user"
            size={24}
            color={COLORS.normal || '#4CAF50'}
          />
        </View>
      ) : (
        <TouchableOpacity
          style={styles.noPatientBanner}
          onPress={() => navigation.navigate('Patients')}>
          <Icon name="warning" size={24} color={COLORS.warning || '#FF9800'} />
          <View style={{flex: 1}}>
            <Text style={styles.noPatientTitle}>No patient selected</Text>
            <Text style={styles.noPatientSub}>
              Tap here → Patients → select → "Screen This Patient"
            </Text>
          </View>
          <Icon
            name="chevron-right"
            size={22}
            color={COLORS.warning || '#FF9800'}
          />
        </TouchableOpacity>
      )}

      {/* Instructions */}
      <View style={styles.instructionCard}>
        <Text style={styles.instructionTitle}>How to Capture</Text>
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

      {/* Image Preview & Target Guide */}
      <View style={styles.previewContainer}>
        {image ? (
          <View style={styles.imageWrapper}>
            <Image
              source={{uri: image.uri}}
              style={styles.previewImage}
              resizeMode="cover"
            />

            {/* Lenskart Style Targeting Box */}
            <View style={styles.targetOverlay} pointerEvents="none">
              <View style={styles.targetBox}>
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />
                <View style={styles.cornerBR} />
              </View>
              <Text style={styles.overlayInstruction}>
                Verify eyelid is visible inside the brackets
              </Text>
            </View>

            {/* Clear Button (Rendered after overlay so it's clickable) */}
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setImage(null);
                setValidationError(null);
              }}>
              <Icon name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.imageInfo}>
              <Text style={styles.imageInfoText}>
                {image.width}×{image.height} •{' '}
                {image.fileSize
                  ? `${(image.fileSize / 1024).toFixed(0)} KB`
                  : ''}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <Icon
              name="camera-alt"
              size={56}
              color={COLORS.border || '#E0E0E0'}
            />
            <Text style={styles.placeholderText}>No image selected</Text>
            <Text style={styles.placeholderSub}>
              Capture or select from gallery
            </Text>
          </View>
        )}
      </View>

      {/* Validation Error Banner */}
      {validationError && (
        <View style={styles.errorBanner}>
          <Icon name="error" size={24} color="#D32F2F" />
          <Text style={styles.errorText}>{validationError}</Text>
        </View>
      )}

      {/* Capture Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={[
            styles.captureBtn,
            {backgroundColor: COLORS.primary || '#C62828'},
          ]}
          onPress={() => captureImage(true)}>
          <Icon name="camera-alt" size={22} color="#FFFFFF" />
          <Text style={styles.captureBtnText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.captureBtn,
            {backgroundColor: COLORS.secondary || '#1565C0'},
          ]}
          onPress={() => captureImage(false)}>
          <Icon name="photo-library" size={22} color="#FFFFFF" />
          <Text style={styles.captureBtnText}>Gallery</Text>
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
          <View style={styles.analyzingRow}>
            <Icon name="biotech" size={24} color="#FFFFFF" />
            <Text style={styles.analyzeBtnText}>Analyze for Anemia</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ML Pipeline Steps */}
      {analyzing && (
        <View style={styles.analyzingCard}>
          <Text style={styles.analyzingTitle}>ML Pipeline Running</Text>
          {[
            {icon: 'search', text: 'Blur detection & Haar Cascade eye check'},
            {icon: 'tune', text: 'CLAHE lighting normalization'},
            {icon: 'crop', text: 'ROI conjunctiva segmentation'},
            {icon: 'palette', text: 'CIELab/HSV feature extraction'},
            {icon: 'memory', text: 'Random Forest inference'},
            {icon: 'assessment', text: 'WHO severity classification'},
          ].map((step, i) => (
            <View key={i} style={styles.mlStep}>
              <Icon
                name={step.icon}
                size={16}
                color={COLORS.primary || '#C62828'}
              />
              <Text style={styles.mlStepText}>{step.text}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.background || '#f8f9fa'},
  header: {
    backgroundColor: COLORS.primary || '#C62828',
    padding: SPACING.lg || 20,
    paddingTop: SPACING.xl || 30,
  },
  headerTitle: {color: '#FFFFFF', fontSize: 24, fontWeight: '700'},
  headerSub: {color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4},
  patientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    margin: SPACING.md || 15,
    borderRadius: RADIUS.md || 12,
    padding: SPACING.md || 15,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.normal || '#4CAF50',
    gap: SPACING.md || 15,
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.normal || '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientAvatarText: {color: '#FFFFFF', fontSize: 20, fontWeight: '700'},
  patientBannerLabel: {
    fontSize: 11,
    color: COLORS.normal || '#4CAF50',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  patientBannerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary || '#212121',
  },
  patientBannerMeta: {
    fontSize: 12,
    color: COLORS.textSecondary || '#757575',
    marginTop: 2,
  },
  noPatientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    margin: SPACING.md || 15,
    borderRadius: RADIUS.md || 12,
    padding: SPACING.md || 15,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning || '#FF9800',
    gap: SPACING.md || 15,
  },
  noPatientTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary || '#212121',
  },
  noPatientSub: {
    fontSize: 12,
    color: COLORS.textSecondary || '#757575',
    marginTop: 2,
    lineHeight: 18,
  },
  instructionCard: {
    backgroundColor: COLORS.surface || '#FFFFFF',
    margin: SPACING.md || 15,
    borderRadius: RADIUS.md || 12,
    padding: SPACING.md || 15,
    ...(SHADOW?.sm || {elevation: 2}),
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.sm || 10,
    color: COLORS.textPrimary || '#212121',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm || 10,
    gap: SPACING.sm || 10,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary || '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
  stepText: {
    fontSize: 14,
    color: COLORS.textSecondary || '#757575',
    flex: 1,
    lineHeight: 20,
  },
  previewContainer: {
    margin: SPACING.md || 15,
    height: 280,
    borderRadius: RADIUS.lg || 16,
    backgroundColor: COLORS.surface || '#FFFFFF',
    overflow: 'hidden',
    ...(SHADOW?.md || {elevation: 5}),
  },
  imageWrapper: {width: '100%', height: '100%'},
  previewImage: {width: '100%', height: '100%'},

  /* Lenskart Style Targeting Elements */
  targetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)', // Dim the outside slightly
  },
  targetBox: {
    width: 240,
    height: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 25,
    height: 25,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#4CAF50',
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 25,
    height: 25,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#4CAF50',
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 25,
    height: 25,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#4CAF50',
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 25,
    height: 25,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#4CAF50',
  },
  overlayInstruction: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 25,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  clearBtn: {
    position: 'absolute',
    top: SPACING.sm || 10,
    right: SPACING.sm || 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  imageInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: SPACING.xs || 5,
  },
  imageInfoText: {color: '#FFFFFF', fontSize: 11, textAlign: 'center'},
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm || 10,
  },
  placeholderText: {
    fontSize: 16,
    color: COLORS.textSecondary || '#757575',
    fontWeight: '600',
  },
  placeholderSub: {fontSize: 12, color: COLORS.textSecondary || '#757575'},

  errorBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFEBEE',
    marginHorizontal: SPACING.md || 15,
    marginBottom: SPACING.md || 15,
    padding: SPACING.md || 15,
    borderRadius: RADIUS.md || 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 10,
    flex: 1,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },

  btnRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md || 15,
    gap: SPACING.md || 15,
    marginBottom: SPACING.md || 15,
  },
  captureBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm || 10,
    padding: SPACING.md || 15,
    borderRadius: RADIUS.md || 12,
    ...(SHADOW?.sm || {elevation: 2}),
  },
  captureBtnText: {color: '#FFFFFF', fontWeight: '600', fontSize: 15},
  analyzeBtn: {
    backgroundColor: COLORS.success || '#4CAF50',
    marginHorizontal: SPACING.md || 15,
    marginBottom: SPACING.md || 15,
    padding: SPACING.md || 15,
    borderRadius: RADIUS.md || 12,
    alignItems: 'center',
    ...(SHADOW?.md || {elevation: 5}),
  },
  analyzeBtnDisabled: {opacity: 0.5},
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm || 10,
  },
  analyzeBtnText: {color: '#FFFFFF', fontSize: 17, fontWeight: '700'},
  analyzingCard: {
    backgroundColor: COLORS.surface || '#FFFFFF',
    marginHorizontal: SPACING.md || 15,
    marginBottom: SPACING.xl || 30,
    borderRadius: RADIUS.md || 12,
    padding: SPACING.md || 15,
    ...(SHADOW?.sm || {elevation: 2}),
    gap: SPACING.xs || 5,
  },
  analyzingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary || '#212121',
    marginBottom: SPACING.xs || 5,
  },
  mlStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm || 10,
    paddingVertical: 3,
  },
  mlStepText: {fontSize: 13, color: COLORS.textSecondary || '#757575'},
});

export default CameraScreen;
