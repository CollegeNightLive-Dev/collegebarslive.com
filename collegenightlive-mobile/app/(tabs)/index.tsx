import React, { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { useSchool, SCHOOLS, School } from '@/context/school-context';
import { useAuth } from '@/context/auth-context';
import { calculateDynamicWait } from '@/lib/waitTime';

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

// ─── Bar doc type (extends shared wait-time shape) ───────────────────────────
interface BarDoc {
  id: string;
  name: string;
  display_order?: number;
  wait_time?: number;
  historical_baselines?: Record<string, number>;
  recent_reports?: Array<{ value: number; timestamp: unknown; user: string }>;
}

function getBarColor(minutes: number) {
  if (minutes <= 15) return { fill: 25, color: C.green };
  if (minutes <= 45) return { fill: 75, color: C.yellow };
  return { fill: 100, color: C.red };
}

// ─── Bar Row ─────────────────────────────────────────────────────────────────
interface BarRowProps {
  bar: BarDoc;
  accent: string;
  isLocked: boolean;
  vouchedId: string | null;
  cooldownStr: string | null;
  onVouch: (barId: string, mins: number) => void;
}

function BarRow({ bar, accent, isLocked, vouchedId, cooldownStr, onVouch }: BarRowProps) {
  const prevFillRef = useRef<number | null>(null);
  const waitRange = calculateDynamicWait(bar);
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

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.venueName}>{bar.name}</Text>
        <Text style={[styles.waitText, { color: C.textMain }]}>
          {`${waitRange}m`}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${fill}%` as any, backgroundColor: color }]} />
      </View>
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
              onPress={() => {
                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                  Haptics.selectionAsync();
                }
                onVouch(bar.id, t);
              }}
              activeOpacity={ACTIVE_OPACITY}
            >
              <Text style={styles.vouchBtnText}>{t}m</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── School Picker Modal ──────────────────────────────────────────────────────
function SchoolPicker({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: School;
  onSelect: (s: School) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.pickerOverlay} onPress={onClose}>
        <Pressable style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>SELECT YOUR CAMPUS</Text>
          {SCHOOLS.map((s) => {
            const isSelected = s.id === current.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.pickerRow, isSelected && { borderColor: s.accent }]}
                onPress={() => {
                  if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    Haptics.selectionAsync();
                  }
                  onSelect(s);
                  onClose();
                }}
                activeOpacity={ACTIVE_OPACITY}
              >
                <View style={[styles.pickerDot, { backgroundColor: s.accent }]} />
                <Text style={[styles.pickerLabel, isSelected && { color: C.textMain }]}>
                  {s.label}
                </Text>
                {isSelected && <Text style={[styles.pickerCheck, { color: s.accent }]}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function WaitTimesScreen() {
  const { school, setSchool } = useSchool();
  const { user } = useAuth();
  const [bars, setBars] = useState<BarDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
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
    [cooldownExpiry, school.id],
  );

  const isLocked = !!(cooldownExpiry && Date.now() < cooldownExpiry);

  const renderItem = useCallback(
    ({ item }: { item: BarDoc }) => (
      <BarRow
        bar={item}
        accent={school.accent}
        isLocked={isLocked}
        vouchedId={vouchedId}
        cooldownStr={cooldownStr}
        onVouch={handleVouch}
      />
    ),
    [isLocked, vouchedId, cooldownStr, handleVouch, school.accent],
  );

  const schoolTitle = `${school.label.toUpperCase()} LIVE`;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft} />
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{schoolTitle}</Text>
          <Animated.View style={[styles.liveDot, { backgroundColor: school.accent, opacity: dotOpacity }]} />
        </View>
        {/* School switcher */}
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => setPickerVisible(true)}
          activeOpacity={ACTIVE_OPACITY}
        >
          <Text style={[styles.schoolChip, { borderColor: school.accent, color: school.accent }]}>
            {school.shortLabel} ▾
          </Text>
        </TouchableOpacity>
      </View>

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
        <FlatList
          data={bars}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8e8e93"
            />
          }
        />
      )}

      <SchoolPicker
        visible={pickerVisible}
        current={school}
        onSelect={setSchool}
        onClose={() => setPickerVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  headerLeft: { flex: 1 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  title: {
    color: C.textMain,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  schoolChip: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

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
  venueName: { color: C.textMain, fontSize: 16, fontWeight: '700' },
  waitText: { color: C.textMain, fontSize: 13, fontWeight: '700' },
  barTrack: {
    height: 3,
    backgroundColor: C.border,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  barFill: { height: '100%', borderRadius: 1.5 },
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

  // School Picker
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#3a3a3c',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  pickerTitle: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 8,
  },
  pickerDot: { width: 10, height: 10, borderRadius: 5 },
  pickerLabel: {
    flex: 1,
    color: C.textDim,
    fontSize: 15,
    fontWeight: '600',
  },
  pickerCheck: { fontSize: 16, fontWeight: '700' },
});
