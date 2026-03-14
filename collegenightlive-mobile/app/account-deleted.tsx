import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_KEY } from './onboarding';

export default function AccountDeletedScreen() {
  async function handleContinue() {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    router.replace('/onboarding');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>✓</Text>
        </View>
        <Text style={styles.title}>Account successfully deleted!</Text>
        <Text style={styles.sub}>
          You can sign up again anytime by selecting your campus below.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={handleContinue}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>Select school</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#30d158',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: { color: '#000', fontSize: 36, fontWeight: '800' },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  sub: {
    color: '#8e8e93',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  btn: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  btnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
