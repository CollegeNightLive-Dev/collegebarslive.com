import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useSchool, isSchoolLocked } from '@/context/school-context';
import { useAuth } from '@/context/auth-context';
import {
  WEEKEND_DAY_ORDER,
  WEEKEND_DAY_LABELS,
  type VotingRowItem,
  type WeekendDayId,
} from '@/constants/this-week-content';
import { db } from '@/lib/firebase';
import {
  loadOsuDormFloor,
  getOsuDormDisplayName,
  formatFloorDisplay,
  type OsuDormFloorPayload,
} from '@/lib/onboarding-dorm';
import { getCurrentWeekKey, isWeekendDayOpenAt } from '@/lib/weekendPoll';
import {
  EMPTY_PERCENTAGES,
  EMPTY_VOTES_BY_DAY,
  subscribeToThisWeekVotes,
  upsertThisWeekVote,
  type WeekendPercentages,
} from '@/lib/this-week-votes';
import { useFocusEffect } from '@react-navigation/native';

/** Same ordering as Wait Times: `universities/{schoolId}/bars` ordered by `display_order` asc. */
type WaitTimesBarDoc = {
  id: string;
  name: string;
  display_order?: number;
};

const C = {
  bg: '#000000',
  border: '#1c1c1e',
  cardBg: 'rgba(28,28,30,0.95)',
  textMain: '#ffffff',
  textDim: '#8e8e93',
  /** Same as Live Wait Times bar fill (short-wait / “good” state). */
  barGreen: '#30d158',
};

const ACTIVE_OPACITY = 0.7;
const TOP_BARS_COUNT = 5;
const OSU_ID = 'ohio-state';
const FLOOR_UNLOCK_THRESHOLD = 14;

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `#${h}${a.toString(16).padStart(2, '0')}`;
}

const BAR_GREEN_MUTED = hexWithAlpha(C.barGreen, 0.42);

export default function WeekendScreen() {
  const { school } = useSchool();
  const { user } = useAuth();
  const [selectedDay, setSelectedDay] = useState<WeekendDayId>('thu');
  const [votesByDay, setVotesByDay] = useState<Record<WeekendDayId, string | null>>(EMPTY_VOTES_BY_DAY);
  const [percentagesByDay, setPercentagesByDay] = useState<WeekendPercentages>(EMPTY_PERCENTAGES);
  const [floorGoingOutByDay, setFloorGoingOutByDay] = useState<Record<WeekendDayId, number>>({
    thu: 0,
    fri: 0,
    sat: 0,
  });
  const [activeFloorPopulation, setActiveFloorPopulation] = useState(0);
  const [weekKey, setWeekKey] = useState(() => getCurrentWeekKey());
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [waitBars, setWaitBars] = useState<WaitTimesBarDoc[]>([]);
  const [barsLoading, setBarsLoading] = useState(true);
  const [osuDormFloor, setOsuDormFloor] = useState<OsuDormFloorPayload | null>(null);
  const accent = school.accent;

  useFocusEffect(
    useCallback(() => {
      loadOsuDormFloor().then(setOsuDormFloor);
    }, []),
  );

  const campusLocked = isSchoolLocked(school);
  const isDayOpen = useMemo(() => {
    return {
      thu: isWeekendDayOpenAt('thu', new Date(), weekKey),
      fri: isWeekendDayOpenAt('fri', new Date(), weekKey),
      sat: isWeekendDayOpenAt('sat', new Date(), weekKey),
    };
  }, [weekKey]);

  const dormPulse = useMemo(() => {
    const base = {
      dormName: 'Your Dorm',
      floorDisplay: 'Your Floor',
      floorGoingOutPercent: 0,
      barMetricDormLabel: 'Campus',
      barMetricFloorLabel: 'Campus',
    };
    if (school.id !== OSU_ID || !osuDormFloor) return base;
    const dormName = getOsuDormDisplayName(osuDormFloor.dormId) ?? base.dormName;
    const floorDisplay = formatFloorDisplay(osuDormFloor.floor);
    return {
      ...base,
      dormName,
      floorDisplay,
      barMetricDormLabel: dormName,
      barMetricFloorLabel: `${dormName} ${floorDisplay}`,
    };
  }, [school.id, osuDormFloor]);

  useEffect(() => {
    const tick = setInterval(() => {
      setWeekKey(getCurrentWeekKey());
    }, 60 * 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setVotesByDay(EMPTY_VOTES_BY_DAY);
      setPercentagesByDay(EMPTY_PERCENTAGES);
      setActiveFloorPopulation(0);
      return;
    }

    const unsub = subscribeToThisWeekVotes(
      school.id,
      weekKey,
      user.uid,
      osuDormFloor?.dormId ?? null,
      osuDormFloor?.floor ?? null,
      (snap) => {
        setVotesByDay(snap.myVotes);
        setPercentagesByDay(snap.percentages);
        setFloorGoingOutByDay(snap.floorGoingOutByDay);
        setActiveFloorPopulation(snap.activeFloorPopulation);
      },
    );

    return unsub;
  }, [school.id, user?.uid, weekKey, osuDormFloor?.dormId, osuDormFloor?.floor]);

  useEffect(() => {
    setBarsLoading(true);
    const q = query(
      collection(db, 'universities', school.id, 'bars'),
      orderBy('display_order', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setWaitBars(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WaitTimesBarDoc)));
        setBarsLoading(false);
      },
      (err) => {
        console.error('This Week bars sync:', err);
        setBarsLoading(false);
      },
    );
    return unsub;
  }, [school.id]);

  const votingByBarName = useMemo(() => {
    const m = new Map<string, VotingRowItem>();
    waitBars.forEach((bar) => m.set(bar.name.toLowerCase().trim(), { id: bar.id, name: bar.name, percent: 0, percentDorm: 0, percentFloor: 0 }));
    return m;
  }, [waitBars]);

  /** First 5 bars in Wait Times order; voting % from local content for the selected night. */
  const barsList = useMemo((): VotingRowItem[] => {
    const dayDistribution = percentagesByDay[selectedDay] ?? {};
    const hasLiveDayDistribution = Object.keys(dayDistribution).length > 0;

    return waitBars.slice(0, TOP_BARS_COUNT).map((bar) => {
      const v = votingByBarName.get(bar.name.toLowerCase().trim());
      const row: VotingRowItem = v
        ? { ...v, id: bar.id, name: bar.name }
        : {
            id: bar.id,
            name: bar.name,
            percent: 0,
            percentDorm: 0,
            percentFloor: 0,
          };
      const livePct = dayDistribution[bar.id] ?? 0;
      const shownPct = hasLiveDayDistribution ? livePct : 0;
      return {
        id: bar.id,
        name: bar.name,
        percent: shownPct,
        percentDorm: shownPct,
        percentFloor: shownPct,
      };
    });
  }, [waitBars, votingByBarName, selectedDay, percentagesByDay]);

  const floorGoingOutForDay = useMemo(
    () => {
      const live = floorGoingOutByDay[selectedDay];
      // Keep this metric fully live-backed to avoid stale fallback values.
      return Math.max(0, Math.min(100, live));
    },
    [selectedDay, floorGoingOutByDay],
  );

  const selectedVoteId = votesByDay[selectedDay];
  const floorNeedsForUnlock = Math.max(0, FLOOR_UNLOCK_THRESHOLD - activeFloorPopulation);
  const floorUnlocked = floorNeedsForUnlock === 0;
  const floorLockActive = !campusLocked && !floorUnlocked;

  const handleDayChange = (day: WeekendDayId) => {
    if (day === selectedDay) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync();
    }
    setSelectedDay(day);
  };

  const handleVote = async (id: string) => {
    if (campusLocked || !isDayOpen[selectedDay] || !floorUnlocked) return;
    if (!user?.uid) {
      Alert.alert('Sign-in required', 'Please wait a moment and try again.');
      return;
    }
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync();
    }
    try {
      setIsSubmittingVote(true);
      await upsertThisWeekVote(
        school.id,
        weekKey,
        user.uid,
        selectedDay,
        id,
        osuDormFloor?.dormId ?? null,
        osuDormFloor?.floor ?? null,
      );
    } catch (err) {
      console.error('Vote submit failed:', err);
      Alert.alert('Vote failed', 'Could not update your vote. Please try again.');
    } finally {
      setIsSubmittingVote(false);
    }
  };
  const statusText = campusLocked || !isDayOpen[selectedDay] || !floorUnlocked ? 'Voting closed' : 'Voting open';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!floorLockActive}
      >
        {/* Header — matches Wait Times tab */}
        <View style={styles.header}>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>THIS WEEK</Text>
            <View style={[styles.headerDot, { backgroundColor: accent }]} />
          </View>
        </View>

        <Text style={styles.tagline}>
          Where&apos;s your floor going? · {statusText.toUpperCase()}
        </Text>
        <Text style={styles.taglineSub}>
          {dormPulse.dormName.toUpperCase()} · {dormPulse.floorDisplay.toUpperCase()}
        </Text>

        <View style={styles.dayTabsRow}>
          {WEEKEND_DAY_ORDER.map((day) => {
            const active = selectedDay === day;
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayTab,
                  { borderColor: C.border },
                  active && { borderColor: accent, backgroundColor: hexWithAlpha(accent, 0.14) },
                ]}
                onPress={() => handleDayChange(day)}
                activeOpacity={ACTIVE_OPACITY}
              >
                <Text
                  style={[
                    styles.dayTabText,
                    { color: C.textDim },
                    active && { color: accent, fontWeight: '800' },
                  ]}
                >
                  {WEEKEND_DAY_LABELS[day]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>YOUR FLOOR</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={[styles.dormCard, { borderColor: C.border }]}>
          <View style={styles.dormHeader}>
            <Text style={styles.dormLabel}>Your floor going out</Text>
            <Text style={[styles.dormPercent, { color: C.barGreen }]}>{floorGoingOutForDay}%</Text>
          </View>
          <Text style={styles.dormSubLabel}>
            {dormPulse.dormName} · {dormPulse.floorDisplay}
          </Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${floorGoingOutForDay}%`, backgroundColor: C.barGreen },
              ]}
            />
          </View>
          <View style={styles.dormDivider} />
          <Text style={styles.floorTitle}>{dormPulse.floorDisplay}</Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>WHERE PEOPLE ARE HEADING</Text>
          <View style={styles.sectionLine} />
        </View>

        {barsLoading ? (
          <View style={styles.barsLoadingWrap}>
            <ActivityIndicator size="large" color={accent} />
          </View>
        ) : barsList.length === 0 ? (
          <Text style={styles.barsEmptyText}>No bars listed yet for {school.label}.</Text>
        ) : (
          <View style={styles.voteSectionWrap}>
            {barsList.map((item) => {
              const voted = selectedVoteId === item.id;
              const fillFloor = voted ? C.barGreen : BAR_GREEN_MUTED;
              return (
                <View key={item.id} style={styles.voteRow}>
                <View style={styles.voteRowTop}>
                  <Text style={styles.venueName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.votePill,
                      { borderColor: accent },
                      voted && { backgroundColor: accent, borderColor: accent },
                    ]}
                    activeOpacity={ACTIVE_OPACITY}
                    disabled={campusLocked || !isDayOpen[selectedDay] || !floorUnlocked || isSubmittingVote}
                    onPress={() => handleVote(item.id)}
                  >
                    <Text
                      style={[
                        styles.votePillText,
                        { color: accent },
                        voted && { color: '#ffffff' },
                      ]}
                    >
                      {voted ? 'Voted' : !isDayOpen[selectedDay] || !floorUnlocked ? 'Locked' : 'Vote'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.barMetricBlock}>
                  <View style={styles.barMetricRow}>
                    <Text style={styles.barMetricLabel} numberOfLines={1}>
                      {dormPulse.barMetricDormLabel}
                    </Text>
                    <Text style={styles.barMetricValue}>{item.percentDorm}%</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(100, item.percentDorm)}%`,
                          backgroundColor: BAR_GREEN_MUTED,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.barMetricBlockTight}>
                  <View style={styles.barMetricRow}>
                    <Text style={styles.barMetricLabel} numberOfLines={1}>
                      {dormPulse.barMetricFloorLabel}
                    </Text>
                    <Text style={styles.barMetricValue}>{item.percentFloor}%</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(100, item.percentFloor)}%`,
                          backgroundColor: fillFloor,
                        },
                      ]}
                    />
                  </View>
                </View>
                </View>
              );
            })}
          </View>
        )}

        {campusLocked && (
          <View style={styles.lockBanner}>
            <Text style={styles.lockBannerText}>This campus is locked — preview only.</Text>
          </View>
        )}
      </ScrollView>
      {floorLockActive && (
        <View style={styles.pageLockOverlay} pointerEvents="auto">
          <View style={styles.lockOverlayCard}>
            <Text style={styles.lockOverlayEyebrow}>THIS WEEK LOCKED</Text>
            <Text style={styles.lockOverlayTitle}>Get your floor in to unlock voting</Text>
            <Text style={styles.lockOverlayText}>
              Floor voting unlocks automatically when enough people on your floor are active.
            </Text>
            <Text style={styles.lockOverlayNeedText}>
              {floorNeedsForUnlock} more needed on {dormPulse.dormName} {dormPulse.floorDisplay}.
            </Text>
            <View style={styles.unlockProgressTrack}>
              <View
                style={[
                  styles.unlockProgressFill,
                  {
                    width: `${Math.max(
                      60,
                      Math.min(100, 60 + (activeFloorPopulation / FLOOR_UNLOCK_THRESHOLD) * 40),
                    )}%`,
                  },
                ]}
              >
                <View style={styles.unlockProgressShimmer} />
              </View>
            </View>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 104,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    color: C.textMain,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerDot: { width: 8, height: 8, borderRadius: 4 },

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
  taglineSub: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 32,
    marginTop: 6,
    lineHeight: 15,
  },

  dayTabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 8,
  },
  dayTab: {
    flex: 1,
    maxWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayTabText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  sectionHeader: { marginTop: 24, marginBottom: 8 },
  sectionTitle: {
    color: C.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionLine: { height: 1, backgroundColor: C.border },

  dormCard: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  dormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dormLabel: {
    color: C.textDim,
    fontSize: 12,
    lineHeight: 16,
  },
  dormPercent: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  dormSubLabel: {
    color: C.textDim,
    fontSize: 13,
    lineHeight: 18,
  },
  barTrack: {
    height: 3,
    backgroundColor: C.border,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  barFill: { height: '100%', borderRadius: 1.5 },
  dormDivider: {
    height: 1,
    backgroundColor: C.border,
    marginTop: 4,
    marginBottom: 2,
  },
  floorTitle: {
    color: C.textMain,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },

  barsLoadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barsEmptyText: {
    color: C.textDim,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 24,
  },

  voteRow: {
    marginBottom: 32,
    marginTop: 16,
  },
  voteSectionWrap: {
    position: 'relative',
  },
  voteRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  venueName: {
    color: C.textMain,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  votePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  votePillText: { fontSize: 10, fontWeight: '600' },
  barMetricBlock: {
    gap: 4,
    marginTop: 2,
  },
  barMetricBlockTight: {
    gap: 4,
    marginTop: 8,
  },
  barMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barMetricLabel: {
    color: C.textDim,
    fontSize: 11,
    lineHeight: 14,
    flex: 1,
    paddingRight: 8,
  },
  barMetricValue: {
    color: C.textMain,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  lockBanner: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  lockBannerText: {
    color: C.textDim,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,10,0.58)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  lockOverlayTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  lockOverlayText: {
    color: '#e5e5ea',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  lockOverlayNeedText: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  pageLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,8,10,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  lockOverlayCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    backgroundColor: 'rgba(16,16,18,0.92)',
    paddingHorizontal: 18,
    paddingVertical: 20,
    alignItems: 'center',
  },
  lockOverlayEyebrow: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  unlockProgressTrack: {
    marginTop: 10,
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  unlockProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#30d158',
    shadowColor: '#30d158',
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    overflow: 'hidden',
  },
  unlockProgressShimmer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 22,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
