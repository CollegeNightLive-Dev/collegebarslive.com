import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
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
import { useSchool } from '@/context/school-context';
import { useAdmin } from '@/context/admin-context';
import { ONBOARDING_KEY } from '../onboarding';
import {
  loadOsuDormFloor,
  getOsuDormDisplayName,
  formatFloorDisplay,
  OSU_DORM_FLOOR_KEY,
} from '@/lib/onboarding-dorm';
import { useFocusEffect } from '@react-navigation/native';

const ACTIVE_OPACITY = 0.7;

const OSU_ID = 'ohio-state';

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
  const { school } = useSchool();
  const { toggleAdminMode } = useAdmin();
  const [osuDormName, setOsuDormName] = useState<string | null>(null);
  const [osuFloorLabel, setOsuFloorLabel] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (school.id !== OSU_ID) {
        setOsuDormName(null);
        setOsuFloorLabel(null);
        return;
      }
      let cancelled = false;
      loadOsuDormFloor().then((p) => {
        if (cancelled) return;
        if (!p) {
          setOsuDormName(null);
          setOsuFloorLabel(null);
          return;
        }
        const name = getOsuDormDisplayName(p.dormId);
        setOsuDormName(name);
        setOsuFloorLabel(formatFloorDisplay(p.floor));
      });
      return () => {
        cancelled = true;
      };
    }, [school.id]),
  );

  function openTerms() {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/terms');
  }

  function handleDeleteAccount() {
    if (isDeletingAccount) return;
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
            setIsDeletingAccount(true);
            try {
              await deleteAccount();
              await AsyncStorage.removeItem(ONBOARDING_KEY);
              await AsyncStorage.removeItem(OSU_DORM_FLOOR_KEY);
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
              setIsDeletingAccount(false);
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
          <Row label="Campus" value={school.label} />
          {school.id === OSU_ID && (
            <>
              <View style={styles.divider} />
              <Row label="Dorm" value={osuDormName ?? '—'} />
              <View style={styles.divider} />
              <Row label="Floor" value={osuFloorLabel ?? '—'} />
            </>
          )}
        </Section>

        <Section>
          <Row label="Terms & Privacy" onPress={openTerms} />
        </Section>

        <Section>
          <TouchableOpacity
            style={styles.row}
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Text style={[styles.rowLabel, { color: C.red }]}>
              {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
            </Text>
            {isDeletingAccount ? <ActivityIndicator color={C.red} size="small" /> : null}
          </TouchableOpacity>
        </Section>

        <View style={styles.footer}>
          <Pressable
            onLongPress={() => {
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              toggleAdminMode();
            }}
            delayLongPress={650}
          >
            <Text style={styles.footerBrand}>Nyte © 2026</Text>
          </Pressable>
          <Text style={styles.version}>
            v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </View>
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

  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerBrand: {
    color: '#3a3a3c',
    fontSize: 11,
    textAlign: 'center',
  },
  version: { color: '#3a3a3c', fontSize: 10, marginTop: 6, textAlign: 'center' },
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
