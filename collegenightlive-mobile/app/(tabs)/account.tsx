import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { playError } from '@/lib/sounds';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/auth-context';
import { useSchool, SCHOOLS } from '@/context/school-context';
import { ONBOARDING_KEY } from '../onboarding';

const ACTIVE_OPACITY = 0.7;

const C = {
  bg: '#000000',
  card: '#1c1c1e',
  border: '#2c2c2e',
  textMain: '#ffffff',
  textDim: '#8e8e93',
  red: '#ff453a',
  separator: '#1c1c1e',
};

// ─── Section wrapper ─────────────────────────────────────────────────────────
function Section({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function Row({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? ACTIVE_OPACITY : 1}
    >
      <Text style={[styles.rowLabel, destructive && { color: C.red }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress && !destructive ? <Text style={styles.rowChevron}>›</Text> : null}
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function AccountScreen() {
  const { loading, authError, retrySignIn, deleteAccount } = useAuth();
  const { school, setSchool } = useSchool();
  const [schoolPickerVisible, setSchoolPickerVisible] = useState(false);

  function openTerms() {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/terms');
  }

  function handleChangeCampus() {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSchoolPickerVisible(true);
  }

  function handleDeleteAccount() {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            try {
              await deleteAccount();
              await AsyncStorage.removeItem(ONBOARDING_KEY);
              router.replace('/account-deleted');
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
              console.warn('[Delete account failed]', code || message, err);
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              await playError();
              Alert.alert('Error', message || 'Could not delete account. Please try again.');
            }
          },
        },
      ],
    );
  }

  if (loading && !authError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ActivityIndicator color={school.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (authError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Couldn&apos;t sign in</Text>
          <Text style={styles.errorSubtext}>Tap to try again</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: school.accent }]}
            onPress={() => {
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              retrySignIn();
            }}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <Text style={styles.pageTitle}>ACCOUNT</Text>

        {/* Hey Nyter! Waze-style header */}
        <View style={styles.heyNyterCard}>
          <View style={styles.heyNyterAvatar}>
            <Image
              source={require('@/assets/images/mascot.png')}
              style={styles.heyNyterImage}
              resizeMode="cover"
            />
          </View>
          <View style={styles.heyNyterRight}>
            <Text style={styles.heyNyterTitle}>Hey Nyter!</Text>
          </View>
        </View>

        <Section>
          <Row
            label="Campus"
            value={school.label}
            onPress={handleChangeCampus}
          />
        </Section>

        <Section>
          <Row label="Terms & Privacy" onPress={openTerms} />
        </Section>

        <Section>
          <Row label="Delete Account" destructive onPress={handleDeleteAccount} />
        </Section>

        {/* School picker inline (simple list, reuses school accent) */}
        {schoolPickerVisible && (
          <View style={styles.schoolPicker}>
            <Text style={styles.schoolPickerTitle}>SELECT CAMPUS</Text>
            {SCHOOLS.map((s) => {
              const selected = s.id === school.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.schoolRow, selected && { borderColor: s.accent }]}
                  onPress={() => {
                    if (Platform.OS === 'ios' || Platform.OS === 'android') {
                      Haptics.selectionAsync();
                    }
                    setSchool(s);
                    setSchoolPickerVisible(false);
                    if (Platform.OS === 'ios' || Platform.OS === 'android') {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  }}
                  activeOpacity={ACTIVE_OPACITY}
                >
                  <View style={[styles.schoolDot, { backgroundColor: s.accent }]} />
                  <Text style={[styles.schoolLabel, selected && { color: C.textMain }]}>
                    {s.label}
                  </Text>
                  {selected && (
                    <Text style={[styles.schoolCheck, { color: s.accent }]}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => setSchoolPickerVisible(false)}>
              <Text style={styles.schoolPickerCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.footer}>
          Nyte © 2026
          {'\n'}
          <Text style={styles.version}>
            v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },

  pageTitle: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 24,
    textAlign: 'center',
  },

  heyNyterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  heyNyterAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  heyNyterImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  heyNyterRight: { flex: 1 },
  heyNyterTitle: {
    color: C.textMain,
    fontSize: 20,
    fontWeight: '700',
  },

  // Rows
  section: {
    backgroundColor: C.card,
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: {
    flex: 1,
    color: C.textMain,
    fontSize: 15,
    fontWeight: '500',
  },
  rowValue: {
    color: C.textDim,
    fontSize: 14,
    marginRight: 6,
  },
  rowChevron: {
    color: C.textDim,
    fontSize: 18,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 16,
  },

  // School picker (inline)
  schoolPicker: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  schoolPickerTitle: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  schoolDot: { width: 9, height: 9, borderRadius: 5 },
  schoolLabel: { flex: 1, color: C.textDim, fontSize: 14, fontWeight: '600' },
  schoolCheck: { fontSize: 14, fontWeight: '700' },
  schoolPickerCancel: {
    color: C.textDim,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },

  footer: {
    color: '#3a3a3c',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
  },
  version: { color: '#3a3a3c', fontSize: 10 },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: { color: C.textMain, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorSubtext: { color: C.textDim, fontSize: 14, marginBottom: 24 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
