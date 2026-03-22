import React, {useState, useRef, useEffect} from 'react';
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
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {screeningAPI} from '../services/api';
import {COLORS, SPACING, RADIUS, SHADOW} from '../utils/designSystem';

const {width: screenWidth} = Dimensions.get('window');

const CameraScreen = ({navigation, route}) => {
  const preselectedPatient = route.params?.patient || null;
  const [image, setImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // ===================================================================
  // 🚀 PHYSICS ENGINE: Image Panning & Pinch-to-Zoom
  // ===================================================================
  const pan = useRef(new Animated.ValueXY({x: 0, y: 0})).current;
  const scale = useRef(new Animated.Value(1)).current;

  const currentPan = useRef({x: 0, y: 0});
  const currentScale = useRef(1);
  const lastImageTouch = useRef({x: 0, y: 0, distance: 0, touches: 0});

  const imagePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => true, // Allow children to steal touch if needed
      onPanResponderGrant: evt => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 1) {
          lastImageTouch.current = {
            x: touches[0].pageX,
            y: touches[0].pageY,
            touches: 1,
          };
        } else if (touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          lastImageTouch.current = {
            distance: Math.sqrt(dx * dx + dy * dy),
            touches: 2,
          };
        }
      },
      onPanResponderMove: evt => {
        const touches = evt.nativeEvent.touches;

        if (touches.length !== lastImageTouch.current.touches) {
          if (touches.length === 1) {
            lastImageTouch.current = {
              x: touches[0].pageX,
              y: touches[0].pageY,
              touches: 1,
            };
          } else if (touches.length === 2) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            lastImageTouch.current = {
              distance: Math.sqrt(dx * dx + dy * dy),
              touches: 2,
            };
          }
          return;
        }

        if (touches.length === 1) {
          // Pan
          const dx = touches[0].pageX - lastImageTouch.current.x;
          const dy = touches[0].pageY - lastImageTouch.current.y;
          currentPan.current.x += dx;
          currentPan.current.y += dy;
          pan.setValue({x: currentPan.current.x, y: currentPan.current.y});
          lastImageTouch.current = {
            x: touches[0].pageX,
            y: touches[0].pageY,
            touches: 1,
          };
        } else if (touches.length === 2) {
          // Zoom
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const scaleFactor = distance / lastImageTouch.current.distance;

          let newScale = currentScale.current * scaleFactor;
          newScale = Math.max(1, Math.min(newScale, 6));

          currentScale.current = newScale;
          scale.setValue(newScale);
          lastImageTouch.current = {distance: distance, touches: 2};
        }
      },
      onPanResponderRelease: () => {
        lastImageTouch.current.touches = 0;
      },
      onPanResponderTerminate: () => {
        lastImageTouch.current.touches = 0;
      },
    }),
  ).current;

  // ===================================================================
  // 🚀 PHYSICS ENGINE: The Fixed Box Resizer
  // ===================================================================
  const boxSizeAnim = useRef(new Animated.Value(240)).current;
  const currentBoxSize = useRef(240);
  const baseBoxSize = useRef(240);

  const boxResizeResponder = useRef(
    PanResponder.create({
      // 🛑 FORCE CAPTURE: Stop the image pan from stealing this gesture
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: () => {
        // Lock in the starting size the moment the finger touches
        baseBoxSize.current = currentBoxSize.current;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Smooth delta tracking based on total drag distance
        const delta = (gestureState.dx + gestureState.dy) / 2;
        let newSize = baseBoxSize.current + delta * 2.5; // 2.5x speed multiplier for responsiveness

        // Constrain so it doesn't break the screen
        newSize = Math.max(100, Math.min(newSize, screenWidth - 40));

        currentBoxSize.current = newSize;
        boxSizeAnim.setValue(newSize);
      },
      onPanResponderRelease: () => {
        baseBoxSize.current = currentBoxSize.current;
      },
      onPanResponderTerminate: () => {
        baseBoxSize.current = currentBoxSize.current;
      },
    }),
  ).current;

  // ===================================================================

  const captureImage = async (fromCamera = true) => {
    setValidationError(null);
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
      if (result.assets?.[0]) {
        setImage(result.assets[0]);
        // Reset all physics
        scale.setValue(1);
        currentScale.current = 1;
        pan.setValue({x: 0, y: 0});
        currentPan.current = {x: 0, y: 0};
        boxSizeAnim.setValue(240);
        currentBoxSize.current = 240;
        baseBoxSize.current = 240;
      }
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
        const rawError =
          typeof e.response.data.detail === 'string'
            ? e.response.data.detail
            : JSON.stringify(e.response.data.detail);

        const lowerError = rawError.toLowerCase();

        // UX FIX: Intercept backend HTTP Exceptions and translate them here!
        if (lowerError.includes('blur') || lowerError.includes('variance')) {
          msg =
            'The image is too blurry to analyze. Please hold the camera steady, allow the lens to focus, and retake.';
        } else if (
          lowerError.includes('no eye') ||
          lowerError.includes('detect')
        ) {
          msg =
            'Could not cleanly detect the eye. Please ensure the inner eyelid is well-lit and centered in the box.';
        } else if (
          lowerError.includes('glare') ||
          lowerError.includes('reflection')
        ) {
          msg =
            'Too much light reflection detected. Please adjust your angle to reduce glare on the eye.';
        } else {
          msg = rawError; // Fallback to the original error if it's something else
        }
      }

      setValidationError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{paddingBottom: 40}}
      scrollEnabled={!image}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Anemia Screening</Text>
        <Text style={styles.headerSub}>
          Conjunctival (inner eyelid) image analysis
        </Text>
      </View>

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

      {!image && (
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
      )}

      {/* =========================================================
          IMAGE PREVIEW & GESTURE TARGETING UI 
      ========================================================= */}
      <View style={styles.previewContainer}>
        {image ? (
          <View style={styles.imageBoundary} {...imagePanResponder.panHandlers}>
            <Animated.View
              style={[
                styles.imageWrapper,
                {
                  transform: [
                    {translateX: pan.x},
                    {translateY: pan.y},
                    {scale: scale},
                  ],
                },
              ]}>
              <Image
                source={{uri: image.uri}}
                style={styles.previewImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* Target Box Overlay */}
            <View style={styles.targetOverlay} pointerEvents="box-none">
              <Animated.View
                style={[
                  styles.targetBox,
                  {width: boxSizeAnim, height: boxSizeAnim},
                ]}
                pointerEvents="box-none">
                <View style={styles.cornerTL} />
                <View style={styles.cornerTR} />
                <View style={styles.cornerBL} />

                {/* THE ACTIVE DRAG HANDLE */}
                <View
                  style={styles.resizeHandleContainer}
                  {...boxResizeResponder.panHandlers}>
                  <View style={styles.cornerBR_Visual} />
                  <View style={styles.dragIconWrapper}>
                    <Icon
                      name="sync-alt"
                      size={24}
                      color="#FFFFFF"
                      style={{transform: [{rotate: '45deg'}]}}
                    />
                  </View>
                </View>
              </Animated.View>

              <Text style={styles.overlayInstruction}>
                Pinch to zoom image. Drag green icon to resize box.
              </Text>
            </View>

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

      {validationError && (
        <View style={styles.errorBanner}>
          <Icon name="error" size={24} color="#D32F2F" />
          <Text style={styles.errorText}>{validationError}</Text>
        </View>
      )}

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
    height: 400,
    borderRadius: RADIUS.lg || 16,
    backgroundColor: '#000000',
    overflow: 'hidden',
    ...(SHADOW?.md || {elevation: 5}),
  },
  imageBoundary: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {width: '100%', height: '100%'},
  previewImage: {width: '100%', height: '100%'},

  targetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  targetBox: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
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

  // 🚀 FIXED: Massive invisible hit-area for the drag handle so it never slips
  resizeHandleContainer: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  cornerBR_Visual: {
    position: 'absolute',
    top: 28,
    left: 28,
    width: 25,
    height: 25,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#4CAF50',
  },
  dragIconWrapper: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    padding: 4,
    elevation: 5,
  },

  overlayInstruction: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 45,
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: SPACING.xs || 5,
  },
  imageInfoText: {color: '#FFFFFF', fontSize: 11, textAlign: 'center'},
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm || 10,
    backgroundColor: COLORS.surface || '#FFFFFF',
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
