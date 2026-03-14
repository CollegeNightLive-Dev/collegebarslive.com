import { initializeApp, getApps, getApp } from 'firebase/app';
// getReactNativePersistence missing from Firebase v12 types but present at runtime for React Native
// @ts-expect-error
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getRemoteConfig } from 'firebase/remote-config';

const firebaseConfig = {
  apiKey: 'AIzaSyDmGXzQ8jLvclzZySdjgz_Xcx0AhA2tJv0',
  authDomain: 'collegenightlive.com',
  projectId: 'college-bars-live',
  storageBucket: 'college-bars-live.firebasestorage.app',
  messagingSenderId: '383445682025',
  appId: '1:383445682025:web:e52c5c7c3978909755dff8',
  measurementId: 'G-WNYYV54JZZ',
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const db = getFirestore(app);

export const functions = getFunctions(app, 'us-central1');

// Remote Config – defaults so labels work offline
export const remoteConfig = getRemoteConfig(app);
(remoteConfig as { defaultConfig?: Record<string, string> }).defaultConfig = {
  undercover_label: 'Event Security',
  creep_label: 'Fishy',
};
