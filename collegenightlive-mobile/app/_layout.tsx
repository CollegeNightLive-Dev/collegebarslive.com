import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { useEffect, useRef } from 'react';

import { SchoolProvider } from '@/context/school-context';
import { AuthProvider } from '@/context/auth-context';
import { RemoteConfigProvider } from '@/context/remote-config-context';
import { AdminProvider } from '@/context/admin-context';
import { logAnalyticsAppOpen, logAnalyticsScreenView } from '@/lib/analytics';

SplashScreen.preventAutoHideAsync();
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const unstable_settings = {
  anchor: '(tabs)',
  initialRouteName: 'index',
};

export default function RootLayout() {
  const pathname = usePathname();
  const didLogOpenRef = useRef(false);

  useEffect(() => {
    if (didLogOpenRef.current) return;
    didLogOpenRef.current = true;
    void logAnalyticsAppOpen();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    void logAnalyticsScreenView(pathname);
  }, [pathname]);

  return (
    <AuthProvider>
      <RemoteConfigProvider>
        <SchoolProvider>
          <AdminProvider>
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
          </AdminProvider>
        </SchoolProvider>
      </RemoteConfigProvider>
    </AuthProvider>
  );
}
