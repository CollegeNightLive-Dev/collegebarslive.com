import React, { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { ONBOARDING_KEY } from './onboarding';

export default function IndexRedirect() {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (cancelled || done.current) return;
      done.current = true;
      SplashScreen.hideAsync().then(() => {
        router.replace('/onboarding');
      });
    }, 3000);
    AsyncStorage.getItem(ONBOARDING_KEY).then((value) => {
      if (cancelled || done.current) return;
      done.current = true;
      clearTimeout(timeout);
      SplashScreen.hideAsync().then(() => {
        if (value === 'true') {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding');
        }
      });
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [router]);

  return null;
}
