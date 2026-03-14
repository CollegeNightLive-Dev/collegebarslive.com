import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playSuccess } from '@/lib/sounds';
import { SCHOOLS, useSchool } from '@/context/school-context';

const ACTIVE_OPACITY = 0.7;
const BORDER_RADIUS_BTN = 14;

export const ONBOARDING_KEY = 'has_onboarded';

export default function OnboardingScreen() {
  const { setSchool } = useSchool();
  const [selected, setSelected] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);

  async function handleContinue() {
    if (!selected || !termsAgreed) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await playSuccess();
    const school = SCHOOLS.find((s) => s.id === selected)!;
    setSchool(school);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>NYTE</Text>
          <Text style={styles.tagline}>REAL-TIME BAR WAIT TIMES</Text>
        </View>

        {/* School list */}
        <Text style={styles.prompt}>SELECT YOUR CAMPUS</Text>

        <View style={styles.list}>
          {SCHOOLS.map((s) => {
            const isSelected = selected === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.schoolRow,
                  isSelected && { borderColor: s.accent, backgroundColor: `${s.accent}18` },
                ]}
                onPress={() => {
                  if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    Haptics.selectionAsync();
                  }
                  setSelected(s.id);
                }}
                activeOpacity={ACTIVE_OPACITY}
              >
                <View style={[styles.dot, { backgroundColor: s.accent }]} />
                <Text style={[styles.schoolName, isSelected && { color: '#fff' }]}>
                  {s.label}
                </Text>
                {isSelected && (
                  <Text style={[styles.check, { color: s.accent }]}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Terms agreement */}
        <View style={styles.termsBlock}>
          <View style={styles.checkboxRow}>
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                  Haptics.selectionAsync();
                }
                setTermsAgreed((a) => !a);
              }}
              activeOpacity={ACTIVE_OPACITY}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={[styles.checkbox, termsAgreed && styles.checkboxChecked]}>
                {termsAgreed && <Text style={styles.checkboxCheck}>✓</Text>}
              </View>
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>
              I agree to the{' '}
              <Text
                style={styles.termsLink}
                onPress={() => {
                  if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  router.push('/terms');
                }}
              >
                Terms & Privacy Policy
              </Text>
            </Text>
          </View>
        </View>

        {/* Continue button */}
        <TouchableOpacity
          style={[
            styles.continueBtn,
            (!selected || !termsAgreed) && styles.continueBtnDisabled,
            selected && termsAgreed && {
              backgroundColor: SCHOOLS.find((s) => s.id === selected)?.accent,
            },
          ]}
          onPress={handleContinue}
          disabled={!selected || !termsAgreed}
          activeOpacity={ACTIVE_OPACITY}
        >
          <Text style={styles.continueBtnText}>LET&apos;S GO →</Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },

  header: { alignItems: 'center', gap: 8, marginBottom: 8 },
  brand: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tagline: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },

  prompt: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 16,
  },

  list: { flex: 1, gap: 10, justifyContent: 'center' },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  schoolName: {
    flex: 1,
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '600',
  },
  check: { fontSize: 16, fontWeight: '700' },

  termsBlock: { marginBottom: 20 },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3a3a3e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: '#60a5fa',
    backgroundColor: '#60a5fa',
  },
  checkboxCheck: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkboxLabel: { flex: 1, color: '#8e8e93', fontSize: 13 },
  termsLink: { color: '#60a5fa', fontWeight: '600' },
  continueBtn: {
    marginTop: 8,
    padding: 18,
    borderRadius: BORDER_RADIUS_BTN,
    alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: '#1c1c1e' },
  continueBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
});
