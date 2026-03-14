import {Alert, PermissionsAndroid, Platform} from 'react-native';
import RNBlobUtil from 'react-native-blob-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '@env';

export const downloadReport = async (sessionId, patientName = 'Patient') => {
  if (!sessionId) {
    Alert.alert('Error', 'No session ID found.');
    return;
  }

  try {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      Alert.alert('Error', 'Not logged in.');
      return;
    }

    // Request storage permission (Android < 13 only)
    if (Platform.OS === 'android' && Platform.Version < 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Storage permission is required.');
        return;
      }
    }

    const cleanName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `HemaView_${cleanName}_S${sessionId}.pdf`;
    const url = `${API_BASE_URL}/reports/${sessionId}/pdf`;

    // Fetch PDF bytes into memory first
    const res = await RNBlobUtil.fetch('GET', url, {
      Authorization: `Bearer ${token}`,
      Accept: 'application/pdf',
    });

    const status = res.info().status;
    console.log('Status:', status);

    if (status !== 200) {
      const text = await res.text();
      Alert.alert('Failed', `Server error ${status}: ${text}`);
      return;
    }

    const base64Data = res.base64();

    // Try paths in order — works on ALL Android devices
    const possiblePaths = [
      `/storage/emulated/0/Download/${fileName}`, // Most common
      `/sdcard/Download/${fileName}`, // Some older devices
      `/mnt/sdcard/Download/${fileName}`, // Some custom ROMs
      `${RNBlobUtil.fs.dirs.DownloadDir}/${fileName}`, // Fallback
    ];

    let savedPath = null;

    for (const path of possiblePaths) {
      try {
        await RNBlobUtil.fs.writeFile(path, base64Data, 'base64');
        // Verify file was actually written
        const exists = await RNBlobUtil.fs.exists(path);
        if (exists) {
          savedPath = path;
          console.log('Successfully saved to:', path);
          break;
        }
      } catch (e) {
        console.log('Failed path:', path, e.message);
        continue;
      }
    }

    if (!savedPath) {
      // Last resort — save to app cache and open directly
      const cachePath = `${RNBlobUtil.fs.dirs.CacheDir}/${fileName}`;
      await RNBlobUtil.fs.writeFile(cachePath, base64Data, 'base64');
      savedPath = cachePath;
      console.log('Saved to cache:', cachePath);
    }

    // Scan file so it appears in Files app
    try {
      await RNBlobUtil.fs.scanFile([
        {path: savedPath, mime: 'application/pdf'},
      ]);
    } catch (e) {
      console.log('Scan failed (non-critical):', e.message);
    }

    const isInDownloads = savedPath.includes('/Download/');

    Alert.alert(
      '✅ Report Ready!',
      isInDownloads
        ? `Saved to Downloads folder!\n\nFile: ${fileName}`
        : `Saved successfully!\n\nFile: ${fileName}`,
      [
        {
          text: '📄 Open PDF',
          onPress: () => {
            RNBlobUtil.android
              .actionViewIntent(savedPath, 'application/pdf')
              .catch(() => {
                Alert.alert(
                  'No PDF Viewer',
                  'Install Adobe Acrobat or Google Drive to open PDFs.',
                );
              });
          },
        },
        {text: 'OK'},
      ],
    );
  } catch (e) {
    console.log('Download exception:', e);
    Alert.alert('Download Failed', `Error: ${e.message || 'Unknown error'}`);
  }
};
