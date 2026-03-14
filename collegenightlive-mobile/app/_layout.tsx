import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { SchoolProvider } from '@/context/school-context';
import { AuthProvider } from '@/context/auth-context';
import { RemoteConfigProvider } from '@/context/remote-config-context';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <RemoteConfigProvider>
        <SchoolProvider>
          <ThemeProvider value={DarkTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="account-deleted" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="terms" />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
        </SchoolProvider>
      </RemoteConfigProvider>
    </AuthProvider>
  );
}
