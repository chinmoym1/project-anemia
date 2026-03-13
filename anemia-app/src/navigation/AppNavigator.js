// App Navigator
// Auth-aware navigation with protected routes

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Typography } from '../utils/designSystem';
import { useAuth } from '../context/AuthContext';

import LoginScreen    from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CameraScreen   from '../screens/CameraScreen';
import ResultScreen   from '../screens/ResultScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─── Loading Screen ──────────────────────────────────────────
function SplashLoader() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashLogo}>🩸</Text>
      <Text style={styles.splashBrand}>HemaView</Text>
      <ActivityIndicator color={Colors.primary[400]} style={{ marginTop: 24 }} />
    </View>
  );
}

// ─── Tab Icon ────────────────────────────────────────────────
function TabIcon({ icon, label, focused }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

// ─── Main Tabs ───────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} /> }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📷" label="Scan" focused={focused} /> }}
      />
      <Tab.Screen
        name="Patients"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👥" label="Patients" focused={focused} /> }}
      />
      <Tab.Screen
        name="Reports"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="📋" label="Reports" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────
export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <SplashLoader />;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main"      component={MainTabs} />
            <Stack.Screen name="Result"    component={ResultScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Camera"    component={CameraScreen} options={{ animation: 'slide_from_right' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: Colors.primary[900], alignItems: 'center', justifyContent: 'center' },
  splashLogo:  { fontSize: 64, marginBottom: 12 },
  splashBrand: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  tabBar: {
    backgroundColor: Colors.bg.card,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[100],
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabIcon:        { alignItems: 'center', justifyContent: 'center' },
  tabEmoji:       { fontSize: 22, opacity: 0.5 },
  tabEmojiActive: { opacity: 1 },
  tabLabel:       { fontSize: Typography.size.xs, color: Colors.neutral[400], marginTop: 2 },
  tabLabelActive: { color: Colors.primary[500], fontWeight: Typography.weight.semibold },
});
