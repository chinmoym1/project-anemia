import React from 'react';
import {ActivityIndicator, View} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';

import {useAuth} from '../context/AuthContext';
import {COLORS} from '../utils/designSystem';

import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CameraScreen from '../screens/CameraScreen';
import ResultScreen from '../screens/ResultScreen';
import PatientsScreen from '../screens/PatientsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Dashboard: 'dashboard',
  Screening: 'camera-alt',
  Patients: 'people',
  Profile: 'person',
};

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({route}) => ({
      headerShown: false,
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      tabBarStyle: {
        backgroundColor: COLORS.surface,
        borderTopColor: COLORS.border,
        height: 62,
        paddingBottom: 8,
        paddingTop: 6,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '600',
      },
      tabBarIcon: ({color, size}) => (
        <Icon name={TAB_ICONS[route.name]} size={size} color={color} />
      ),
    })}>
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Screening" component={CameraScreen} />
    <Tab.Screen name="Patients" component={PatientsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const {user, loading} = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.background,
        }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="Result" component={ResultScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
