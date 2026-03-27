import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  Animated,
  RefreshControl,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { playSuccess, playError } from '@/lib/sounds';
import { useSchool, isSchoolLocked } from '@/context/school-context';
import { useAuth } from '@/context/auth-context';
import { useAdmin } from '@/context/admin-context';
import { calculateDynamicWait, getFreshReportCount } from '@/lib/waitTime';
import { getBarDealsDays } from '@/constants/bar-deals-registry';
import { WeeklyDealsModal } from '@/components/weekly-deals-modal';
import {
  ADMIN_BAR_OVERRIDE_DURATION_MS,
  ADMIN_ICON_TYPES,
  isAdminBarOverrideExpired,
  type AdminBarOverride,
} from '@/lib/admin-bar-override';
import { callCallableWithToken, CallableAuthError } from '@/lib/callableWithToken';
import { trackDealOpened } from '@/lib/analytics';
import { consumePendingOsuDormFloorPushPrompt } from '@/lib/push-notifications';

// ─── Design Tokens ──────────────────────────────────────────────────────────
const C = {
  bg: '#000000',
  border: '#1c1c1e',
  cardBg: 'rgba(28,28,30,0.95)',
  textMain: '#ffffff',
  textDim: '#8e8e93',
  green: '#30d158',
  yellow: '#ffd60a',
  red: '#ff453a',
};

const VOUCH_OPTIONS = [0, 5, 15, 25, 40, 60];
const COOLDOWN_MS = 5 * 60 * 1000;
const ACTIVE_OPACITY = 0.7;
const OSU_ID = 'ohio-state';

// ─── Bar doc type (extends shared wait-time shape) ───────────────────────────
interface BarDoc {
  id: string;
  name: string;
  display_order?: number;
  wait_time?: number;
  historical_baselines?: Record<string, number>;
  recent_reports?: Array<{ value: number; timestamp: unknown; user: string }>;
  active_alerts?: Array<{ type: string; expiresAt?: { toMillis(): number } }>;
  admin_bar_override?: AdminBarOverride;
}

const ADMIN_ICON_LABEL: Record<string, string> = {
  security: 'Security',
  ambulance: 'Creep',
  strict_bouncer: 'Bouncer',
  vibe: 'Vibe',
  fire_music: 'Music',
  dead: 'Dead',
};

function getBarColor(minutes: number) {
  if (minutes <= 15) return { fill: 25, color: C.green };
  if (minutes <= 45) return { fill: 75, color: C.yellow };
  return { fill: 100, color: C.red };
}

const CAMPUS_LOCKED_MSG = 'This campus is currently locked.';

type AdminApplyOpts = { clear?: boolean; waitMinutes?: number; iconTypes?: string[] };

function getDayOfWeekLower(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
}

// ─── Bar Row ─────────────────────────────────────────────────────────────────
interface BarRowProps {
  bar: BarDoc;
  accent: string;
  isLocked: boolean;
  vouchedId: string | null;
  cooldownStr: string | null;
  onVouch: (barId: string, mins: number) => void;
  campusLocked?: boolean;
  adminMode?: boolean;
  onAdminApply?: (barId: string, opts: AdminApplyOpts) => Promise<void>;
}

function BarRow({
  bar,
  accent,
  isLocked,
  vouchedId,
  cooldownStr,
  onVouch,
  campusLocked,
  adminMode,
  onAdminApply,
}: BarRowProps) {
  const prevFillRef = useRef<number | null>(null);
  const [dealsModalVisible, setDealsModalVisible] = useState(false);
  const [adminWaitPick, setAdminWaitPick] = useState<number | null>(null);
  const [adminIconPicks, setAdminIconPicks] = useState<string[]>([]);
  const [adminSaving, setAdminSaving] = useState(false);
  const dealDays = useMemo(() => getBarDealsDays(bar.name), [bar.name]);
  const waitRange = calculateDynamicWait(bar);
  const freshReportCount = getFreshReportCount(bar, Date.now(), 10);
  const hasHighConfidence = freshReportCount >= 5;
  const reportSubscript = hasHighConfidence
    ? `${freshReportCount} report${freshReportCount === 1 ? '' : 's'} in past 10 min.`
    : `Only ${freshReportCount} report${freshReportCount === 1 ? '' : 's'} in past 10 min so relying more on historical data.`;
  const isAdminWaitActive =
    typeof bar.admin_bar_override?.waitMinutes === 'number' &&
    !isAdminBarOverrideExpired(bar.admin_bar_override);
  const adminUpdatedTimestamp = (() => {
    if (!isAdminWaitActive) return null;
    const exp = bar.admin_bar_override?.expiresAt;
    const expMs = exp && typeof exp.toMillis === 'function' ? exp.toMillis() : 0;
    if (!expMs) return null;
    const updatedAt = new Date(expMs - ADMIN_BAR_OVERRIDE_DURATION_MS);
    return updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  })();
  const minutes = parseInt(waitRange.split('-')[0]) || 0;
  const { fill, color } = getBarColor(minutes);

  // Haptic when bar fill updates after user vouched this bar
  useEffect(() => {
    if (vouchedId !== bar.id || prevFillRef.current === null) {
      prevFillRef.current = fill;
      return;
    }
    if (prevFillRef.current !== fill) {
      prevFillRef.current = fill;
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }, [fill, vouchedId, bar.id]);

  const openDealsModal = () => {
    if (campusLocked) {
      Alert.alert('Campus locked', CAMPUS_LOCKED_MSG);
      return;
    }
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync();
    }
    const now = new Date();
    void trackDealOpened({
      barId: bar.id,
      barName: bar.name,
      sourceScreen: 'wait_times',
      localHour: now.getHours(),
      dayOfWeek: getDayOfWeekLower(now),
    });
    setDealsModalVisible(true);
  };

  const handleVouchPress = (mins: number) => {
    if (campusLocked) {
      Alert.alert('Campus locked', CAMPUS_LOCKED_MSG);
      return;
    }
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync();
    }
    onVouch(bar.id, mins);
  };

  const toggleAdminIcon = (t: string) => {
    setAdminIconPicks((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const handleAdminSave = async () => {
    if (!onAdminApply) return;
    const hasWait = adminWaitPick !== null;
    const hasIcons = adminIconPicks.length > 0;
    if (!hasWait && !hasIcons) {
      Alert.alert('Select something', 'Choose a wait time and/or at least one icon.');
      return;
    }
    setAdminSaving(true);
    try {
      await onAdminApply(bar.id, {
        ...(hasWait ? { waitMinutes: adminWaitPick! } : {}),
        ...(hasIcons ? { iconTypes: adminIconPicks } : {}),
      });
    } finally {
      setAdminSaving(false);
    }
  };

  const handleAdminClear = async () => {
    if (!onAdminApply) return;
    setAdminSaving(true);
    try {
      await onAdminApply(bar.id, { clear: true });
      setAdminWaitPick(null);
      setAdminIconPicks([]);
    } finally {
      setAdminSaving(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.venueNameRow}>
          <Text style={styles.venueName}>{bar.name}</Text>
          <TouchableOpacity
            style={[styles.dealsBtn, { borderColor: accent }]}
            onPress={openDealsModal}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Text style={[styles.dealsBtnText, { color: accent }]}>Deals</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.waitText, { color: C.textMain }]}>
          {`${waitRange}m`}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${fill}%` as any, backgroundColor: color }]} />
      </View>
      <Text
        style={styles.reportSubscript}
        numberOfLines={1}
        ellipsizeMode="tail"
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {`Confidence level: ${reportSubscript}`}
      </Text>
      {isAdminWaitActive ? (
        <Text style={styles.adminWaitSubscript}>
          {adminUpdatedTimestamp
            ? `Admin updated timestamp: ${adminUpdatedTimestamp}.`
            : 'Admin updated timestamp.'}
        </Text>
      ) : null}
      {adminMode && !campusLocked && onAdminApply ? (
        <View style={styles.adminPanel}>
          <Text style={styles.adminPanelTitle}>Admin override (15 min)</Text>
          <Text style={styles.adminPanelHint}>Wait (optional)</Text>
          <View style={styles.adminChipWrap}>
            {VOUCH_OPTIONS.map((t) => {
              const on = adminWaitPick === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.adminChipBtn, on && { borderColor: accent }]}
                  onPress={() => setAdminWaitPick((p) => (p === t ? null : t))}
                  activeOpacity={ACTIVE_OPACITY}
                >
                  <Text style={[styles.adminChipBtnText, { color: on ? accent : C.textDim }]}>{t}m</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.adminPanelHint}>Icons (optional)</Text>
          <View style={styles.adminChipWrap}>
            {ADMIN_ICON_TYPES.map((t) => {
              const on = adminIconPicks.includes(t);
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.adminChipBtn, on && { borderColor: accent }]}
                  onPress={() => toggleAdminIcon(t)}
                  activeOpacity={ACTIVE_OPACITY}
                >
                  <Text style={[styles.adminChipBtnText, { color: on ? accent : C.textDim }]}>
                    {ADMIN_ICON_LABEL[t] ?? t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.adminActionsRow}>
            <TouchableOpacity
              style={[styles.adminApplyBtn, { backgroundColor: accent, opacity: adminSaving ? 0.6 : 1 }]}
              onPress={handleAdminSave}
              disabled={adminSaving}
              activeOpacity={ACTIVE_OPACITY}
            >
              <Text style={styles.adminApplyBtnText}>Apply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adminClearBtn, { opacity: adminSaving ? 0.6 : 1 }]}
              onPress={handleAdminClear}
              disabled={adminSaving}
              activeOpacity={ACTIVE_OPACITY}
            >
              <Text style={styles.adminClearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {isLocked && bar.id === vouchedId ? (
        <Text style={[styles.thankYouText, { color: C.green }]}>
          ✅ THANK YOU!{'  '}{cooldownStr}
        </Text>
      ) : isLocked ? null : (
        <View style={styles.vouchRow}>
          {VOUCH_OPTIONS.map((t) => (
            <TouchableOpacity
              key={t}
              style={styles.vouchBtn}
              onPress={() => handleVouchPress(t)}
              activeOpacity={ACTIVE_OPACITY}
            >
              <Text style={styles.vouchBtnText}>{t}m</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {dealDays ? (
        <WeeklyDealsModal
          visible={dealsModalVisible}
          venueName={bar.name}
          days={dealDays}
          accentColor={accent}
          onClose={() => setDealsModalVisible(false)}
        />
      ) : (
        <Modal
          visible={dealsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDealsModalVisible(false)}
        >
          <Pressable
            style={styles.dealsOverlay}
            onPress={() => setDealsModalVisible(false)}
          >
            <Pressable
              style={[styles.dealsCard, { borderColor: `${accent}66` }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.dealsCardTitle, { color: accent }]}>DEALS</Text>
              <Text style={styles.dealsCardVenue}>{bar.name}</Text>
              <View style={styles.dealsCardDivider} />
              <Text style={styles.dealsCardBody}>
                Email us at partners@collegenightlive.com if you want your deals posted here.
              </Text>
              <TouchableOpacity
                style={[styles.dealsCloseBtn, { backgroundColor: accent }]}
                onPress={() => setDealsModalVisible(false)}
                activeOpacity={ACTIVE_OPACITY}
              >
                <Text style={styles.dealsCloseBtnText}>Got it</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function WaitTimesScreen() {
  const insets = useSafeAreaInsets();
  const { school } = useSchool();
  const { user } = useAuth();
  const { adminMode, adminSecret, setAdminSecret } = useAdmin();
  const [bars, setBars] = useState<BarDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [cooldownExpiry, setCooldownExpiry] = useState<number | null>(null);
  const [vouchedId, setVouchedId] = useState<string | null>(null);
  const [cooldownStr, setCooldownStr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotOpacity = useRef(new Animated.Value(1)).current;

  // Pulsing live dot
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 750, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [dotOpacity]);

  // Restore cooldown from storage on mount
  useEffect(() => {
    (async () => {
      const expiry = await AsyncStorage.getItem('vouch_cooldown');
      const vid = await AsyncStorage.getItem('vouched_venue_id');
      if (expiry && Date.now() < parseInt(expiry)) {
        setCooldownExpiry(parseInt(expiry));
        setVouchedId(vid);
      } else {
        await AsyncStorage.multiRemove(['vouch_cooldown', 'vouched_venue_id']);
      }
    })();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!cooldownExpiry) { setCooldownStr(null); return; }
    const tick = () => {
      const diff = cooldownExpiry - Date.now();
      if (diff <= 0) {
        setCooldownExpiry(null); setVouchedId(null); setCooldownStr(null);
        AsyncStorage.multiRemove(['vouch_cooldown', 'vouched_venue_id']);
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCooldownStr(`${m}:${s < 10 ? '0' : ''}${s}`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [cooldownExpiry]);

  // Firestore real-time listener — re-subscribes when school changes
  useEffect(() => {
    setLoading(true);
    setBars([]);
    const q = query(
      collection(db, 'universities', school.id, 'bars'),
      orderBy('display_order', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBars(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BarDoc)));
        setLoading(false);
      },
      (err) => { console.error('Bar sync error:', err); setLoading(false); },
    );
    return unsub;
  }, [school.id]);

  // Prompt for iOS notifications only after OSU onboarding lands users on Wait Times.
  useEffect(() => {
    if (school.id !== OSU_ID) return;
    if (!user?.uid) return;
    void consumePendingOsuDormFloorPushPrompt(user.uid);
  }, [school.id, user?.uid]);

  const handleVouch = useCallback(
    async (barId: string, mins: number) => {
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      if (cooldownExpiry && Date.now() < cooldownExpiry) {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        Alert.alert('Hold on', 'You can vouch again in a few minutes.');
        return;
      }
      const expiry = Date.now() + COOLDOWN_MS;
      setCooldownExpiry(expiry); setVouchedId(barId);
      await AsyncStorage.setItem('vouch_cooldown', String(expiry));
      await AsyncStorage.setItem('vouched_venue_id', barId);
      try {
        await updateDoc(doc(db, 'universities', school.id, 'bars', barId), {
          recent_reports: arrayUnion({ value: mins, timestamp: Timestamp.now(), user: user?.uid ?? 'anonymous' }),
          wait_time: mins,
          last_updated: serverTimestamp(),
        });
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        await playSuccess();
      } catch (e) {
        console.error('Vouch failed:', e);
        setCooldownExpiry(null);
        setVouchedId(null);
        await AsyncStorage.multiRemove(['vouch_cooldown', 'vouched_venue_id']);
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        await playError();
        Alert.alert(
          "Couldn't save",
          'Check your connection and try again.',
          [{ text: 'OK' }],
        );
      }
    },
    [cooldownExpiry, school.id, user?.uid],
  );

  const applyAdminBar = useCallback(
    async (barId: string, opts: AdminApplyOpts) => {
      if (!user) {
        Alert.alert('Not signed in', 'Wait for the app to finish signing you in, then try again.');
        return;
      }
      const secret = adminSecret.trim();
      if (!secret) {
        Alert.alert('Admin key required', 'Enter the admin key at the bottom of the screen.');
        return;
      }
      const token = await user.getIdToken();
      try {
        await callCallableWithToken('setAdminBarOverride', token, {
          schoolId: school.id,
          barId,
          adminSecret: secret,
          ...opts,
          _idToken: token,
        });
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        await playSuccess();
      } catch (e) {
        const msg = e instanceof CallableAuthError ? e.message : String(e);
        console.error('setAdminBarOverride failed:', e);
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        await playError();
        Alert.alert('Could not save', msg);
      }
    },
    [user, school.id, adminSecret],
  );

  const isLocked = !!(cooldownExpiry && Date.now() < cooldownExpiry);

  const campusLocked = isSchoolLocked(school);

  const renderItem = useCallback(
    ({ item }: { item: BarDoc }) => (
      <BarRow
        bar={item}
        accent={school.accent}
        isLocked={isLocked}
        vouchedId={vouchedId}
        cooldownStr={cooldownStr}
        onVouch={handleVouch}
        campusLocked={campusLocked}
        adminMode={adminMode}
        onAdminApply={applyAdminBar}
      />
    ),
    [isLocked, vouchedId, cooldownStr, handleVouch, school.accent, campusLocked, adminMode, applyAdminBar],
  );

  const schoolTitle = `${school.label.toUpperCase()} LIVE`;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{schoolTitle}</Text>
          <Animated.View style={[styles.liveDot, { backgroundColor: school.accent, opacity: dotOpacity }]} />
        </View>
      </View>

      {adminMode ? (
        <Text style={[styles.adminBanner, { color: school.accent }]}>
          Admin mode — long-press Nyte © 2026 on Account to exit
        </Text>
      ) : null}

      <Text style={styles.tagline}>
        The more people on your campus who use the app, the more accurate the
        wait times become.
      </Text>

      {/* Section label */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>LOCAL BARS LIVE</Text>
        <View style={styles.sectionLine} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={school.accent} />
        </View>
      ) : bars.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No bars listed yet for {school.label}.</Text>
        </View>
      ) : (
        <View style={styles.listWrap}>
          <FlatList
            data={bars}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              adminMode && { paddingBottom: 100 + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
            scrollEnabled={!campusLocked}
            refreshControl={
              !campusLocked ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#8e8e93"
                />
              ) : undefined
            }
          />
          {campusLocked && (
            <View style={styles.lockCenterOverlay} pointerEvents="none">
              <Text style={styles.lockCenterText}>This campus is currently locked.</Text>
            </View>
          )}
        </View>
      )}

      {adminMode ? (
        <View style={[styles.adminKeyBar, { paddingBottom: 10 + insets.bottom }]}>
          <Text style={styles.adminKeyLabel}>Admin key</Text>
          <TextInput
            value={adminSecret}
            onChangeText={setAdminSecret}
            secureTextEntry
            placeholder="Enter server secret"
            placeholderTextColor={C.textDim}
            style={styles.adminKeyInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center' },
  adminBanner: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  title: {
    color: C.textMain,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },

  // Tagline
  tagline: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 32,
    marginTop: 10,
    lineHeight: 15,
  },

  // Section header
  sectionHeader: { paddingHorizontal: 24, marginTop: 24, marginBottom: 8 },
  sectionTitle: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionLine: { height: 1, backgroundColor: C.border },
  listWrap: { flex: 1, position: 'relative' },
  lockCenterOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  lockCenterText: {
    color: C.textMain,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  listContent: { paddingHorizontal: 24, paddingBottom: 60 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: C.textDim, fontSize: 13, textAlign: 'center' },

  // Bar Row
  row: { marginBottom: 32, marginTop: 16 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  venueNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  venueName: { color: C.textMain, fontSize: 16, fontWeight: '700' },
  dealsBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  dealsBtnText: { fontSize: 10, fontWeight: '600' },
  waitText: { color: C.textMain, fontSize: 13, fontWeight: '700' },
  barTrack: {
    height: 3,
    backgroundColor: C.border,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  barFill: { height: '100%', borderRadius: 1.5 },
  reportSubscript: {
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 13,
    color: C.textDim,
    marginBottom: 4,
  },
  adminWaitSubscript: {
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 13,
    color: C.textDim,
    marginBottom: 10,
  },
  vouchRow: { flexDirection: 'row', gap: 6 },
  vouchBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  vouchBtnText: { color: C.textDim, fontSize: 10, fontWeight: '600' },
  thankYouText: { fontSize: 11, fontWeight: '700' },

  adminPanel: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: 'rgba(28,28,30,0.6)',
  },
  adminPanelTitle: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  adminPanelHint: { color: C.textDim, fontSize: 10, fontWeight: '600', marginBottom: 6 },
  adminChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  adminChipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  adminChipBtnText: { fontSize: 10, fontWeight: '700' },
  adminActionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  adminApplyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  adminApplyBtnText: { color: '#fff', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  adminClearBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  adminClearBtnText: { color: C.textDim, fontSize: 12, fontWeight: '700' },

  adminKeyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(22,22,24,0.98)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  adminKeyLabel: { color: C.textDim, fontSize: 10, fontWeight: '700', marginBottom: 6 },
  adminKeyInput: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.textMain,
    fontSize: 14,
  },

  // Deals popup (styled like future deals content)
  dealsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dealsCard: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  dealsCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
  },
  dealsCardVenue: {
    color: C.textMain,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  dealsCardDivider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 16,
  },
  dealsCardBody: {
    color: C.textMain,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  dealsCloseBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  dealsCloseBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
