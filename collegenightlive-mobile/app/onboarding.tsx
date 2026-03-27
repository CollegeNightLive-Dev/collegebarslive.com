import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  TextInput,
  FlatList,
  ScrollView,
  ListRenderItemInfo,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playSuccess } from '@/lib/sounds';
import { SCHOOLS, useSchool } from '@/context/school-context';
import { isSchoolLocked } from '@/context/school-context';
import {
  OSU_DORMS,
  OSU_DORM_SECTION_LABELS,
  buildOsuDormListItems,
  type OsuDorm,
  type OsuDormListItem,
} from '@/constants/onboarding-osu';
import { saveOsuDormFloor } from '@/lib/onboarding-dorm';
import { auth } from '@/lib/firebase';
import { upsertUserProfile } from '@/lib/user-profile';
import { markOsuDormFloorPushPromptPending } from '@/lib/push-notifications';
import {
  setAnalyticsUserProperty,
  trackDormFloorSelected,
  trackOnboardingCompleted,
  trackOnboardingStepCompleted,
  trackOnboardingStepViewed,
} from '@/lib/analytics';

const ACTIVE_OPACITY = 0.7;
const BORDER_RADIUS_BTN = 14;
const OSU_ID = 'ohio-state';

export const ONBOARDING_KEY = 'has_onboarded';

export default function OnboardingScreen() {
  const { setSchool } = useSchool();
  const [step, setStep] = useState<'campus' | 'details'>('campus');
  const [selected, setSelected] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [dormQuery, setDormQuery] = useState('');
  const [selectedDormId, setSelectedDormId] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  const selectedSchool = selected ? SCHOOLS.find((s) => s.id === selected) : null;
  const isOsu = selected === OSU_ID;
  const osuAccent = SCHOOLS.find((s) => s.id === OSU_ID)?.accent ?? '#ba0c2f';

  const selectedDorm = useMemo(
    () => (selectedDormId ? OSU_DORMS.find((d) => d.id === selectedDormId) ?? null : null),
    [selectedDormId],
  );

  const dormListItems = useMemo(() => {
    const q = dormQuery.trim().toLowerCase();
    const filtered =
      q.length === 0
        ? OSU_DORMS
        : OSU_DORMS.filter((d) => d.name.toLowerCase().includes(q));
    return buildOsuDormListItems(filtered, q.length === 0);
  }, [dormQuery]);

  const floorNumbers = useMemo(() => {
    if (!selectedDorm) return [];
    return Array.from({ length: selectedDorm.maxFloors }, (_, i) => i + 1);
  }, [selectedDorm]);

  const resetOsuSelections = useCallback(() => {
    setDormQuery('');
    setSelectedDormId(null);
    setSelectedFloor(null);
  }, []);

  const handleCampusNext = () => {
    if (!selected) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setTermsAgreed(false);
    setStep('details');
    void trackOnboardingStepCompleted('campus', 1);
  };

  const handleDetailsBack = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync();
    }
    setStep('campus');
    resetOsuSelections();
    setTermsAgreed(false);
  };

  const selectDorm = useCallback((dorm: OsuDorm) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync();
    }
    setSelectedDormId(dorm.id);
    setSelectedFloor((prev) => {
      if (prev != null && prev <= dorm.maxFloors) return prev;
      return null;
    });
  }, []);

  const canFinish = useMemo(() => {
    if (!selected || !termsAgreed) return false;
    if (selected === OSU_ID) {
      return selectedDormId != null && selectedFloor != null;
    }
    return true;
  }, [selected, termsAgreed, selectedDormId, selectedFloor]);

  async function handleContinue() {
    if (!canFinish || !selected) return;
    const school = SCHOOLS.find((s) => s.id === selected);
    if (!school) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await playSuccess();
    setSchool(school);
    if (selected === OSU_ID && selectedDormId != null && selectedFloor != null) {
      await saveOsuDormFloor({ dormId: selectedDormId, floor: selectedFloor });
      await trackDormFloorSelected({
        schoolId: selected,
        dormId: selectedDormId,
        floor: selectedFloor,
      });
      await setAnalyticsUserProperty('dorm', selectedDormId);
      await setAnalyticsUserProperty('floor', selectedFloor);
    } else {
      await saveOsuDormFloor(null);
    }
    const uid = auth.currentUser?.uid;
    if (uid) {
      await upsertUserProfile(uid, {
        schoolId: selected,
        dormId: selected === OSU_ID && selectedDormId ? selectedDormId : undefined,
        floor: selected === OSU_ID && selectedFloor != null ? selectedFloor : undefined,
      });
      if (selected === OSU_ID && selectedDormId != null && selectedFloor != null) {
        await markOsuDormFloorPushPromptPending();
      }
    }
    await trackOnboardingStepCompleted('details', 2);
    await trackOnboardingCompleted({
      schoolId: selected,
      dormId: selected === OSU_ID ? selectedDormId : null,
      floor: selected === OSU_ID ? selectedFloor : null,
    });
    await setAnalyticsUserProperty('school_id', selected);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(tabs)');
  }

  useEffect(() => {
    const stepName = step === 'campus' ? 'campus' : 'details';
    const stepIndex = step === 'campus' ? 1 : 2;
    void trackOnboardingStepViewed(stepName, stepIndex);
  }, [step]);

  const renderDormItem = useCallback(
    ({ item }: ListRenderItemInfo<OsuDormListItem>) => {
      if (item.kind === 'header') {
        return (
          <Text style={styles.sectionHeader} accessibilityRole="header">
            {OSU_DORM_SECTION_LABELS[item.section]}
          </Text>
        );
      }
      const dorm = item.dorm;
      const isSelected = selectedDormId === dorm.id;
      return (
        <TouchableOpacity
          style={[
            styles.dormRow,
            isSelected && { borderColor: osuAccent, backgroundColor: `${osuAccent}18` },
          ]}
          onPress={() => selectDorm(dorm)}
          activeOpacity={ACTIVE_OPACITY}
          accessibilityLabel={dorm.name}
          accessibilityState={{ selected: isSelected }}
        >
          <View style={[styles.dot, { backgroundColor: osuAccent }]} />
          <View style={styles.dormRowText}>
            <Text style={[styles.dormName, isSelected && { color: '#fff' }]}>{dorm.name}</Text>
            <Text style={styles.dormMeta}>Up to {dorm.maxFloors} floors</Text>
          </View>
          {isSelected && <Text style={[styles.check, { color: osuAccent }]}>✓</Text>}
        </TouchableOpacity>
      );
    },
    [osuAccent, selectedDormId, selectDorm],
  );

  if (step === 'campus') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.brand}>NYTE</Text>
            <Text style={styles.tagline}>REAL-TIME BAR WAIT TIMES</Text>
          </View>

          <Text style={styles.prompt}>SELECT YOUR CAMPUS</Text>

          <ScrollView
            style={styles.campusScroll}
            contentContainerStyle={styles.campusScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {SCHOOLS.map((s) => {
              const isSelected = selected === s.id;
              const locked = isSchoolLocked(s);
              const statusLabel = locked ? 'LOCKED' : 'LIVE';
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
                  <Text style={[styles.schoolName, isSelected && { color: '#fff' }]}>{s.label}</Text>
                  <View
                    style={[
                      styles.schoolStatusPill,
                      locked ? styles.schoolStatusLocked : styles.schoolStatusLive,
                    ]}
                  >
                    <Text style={styles.schoolStatusText}>{statusLabel}</Text>
                  </View>
                  {isSelected && <Text style={[styles.check, { color: s.accent }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.continueBtn,
              !selected && styles.continueBtnDisabled,
              selected && { backgroundColor: selectedSchool?.accent },
            ]}
            onPress={handleCampusNext}
            disabled={!selected}
            activeOpacity={ACTIVE_OPACITY}
          >
            <Text style={styles.continueBtnText}>NEXT →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // details step
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.detailsOuter}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={handleDetailsBack}
          activeOpacity={ACTIVE_OPACITY}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.brand}>NYTE</Text>
          <Text style={styles.tagline}>REAL-TIME BAR WAIT TIMES</Text>
        </View>

        {isOsu ? (
          <>
            <Text style={styles.prompt}>YOUR DORM</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search dorms"
              placeholderTextColor="#636366"
              value={dormQuery}
              onChangeText={setDormQuery}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              accessibilityLabel="Search dorms"
            />

            <FlatList
              style={styles.dormList}
              data={dormListItems}
              keyExtractor={(it) => it.key}
              renderItem={renderDormItem}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={6}
              removeClippedSubviews={Platform.OS === 'android'}
              ListEmptyComponent={
                <Text style={styles.emptyDorms}>No dorms match your search.</Text>
              }
            />

            {selectedDorm != null && (
              <View style={styles.floorBlock}>
                <Text style={styles.floorPrompt}>FLOOR</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.floorChipsRow}
                >
                  {floorNumbers.map((n) => {
                    const active = selectedFloor === n;
                    return (
                      <TouchableOpacity
                        key={n}
                        style={[
                          styles.floorChip,
                          active && { borderColor: osuAccent, backgroundColor: `${osuAccent}22` },
                        ]}
                        onPress={() => {
                          if (Platform.OS === 'ios' || Platform.OS === 'android') {
                            Haptics.selectionAsync();
                          }
                          setSelectedFloor(n);
                        }}
                        activeOpacity={ACTIVE_OPACITY}
                        accessibilityLabel={`Floor ${n}`}
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.floorChipText, active && { color: '#fff' }]}>{n}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </>
        ) : (
          <View style={styles.nonOsuHint}>
            <Text style={styles.nonOsuHintText}>Almost there — agree to the terms below to continue.</Text>
          </View>
        )}

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

        <TouchableOpacity
          style={[
            styles.continueBtn,
            !canFinish && styles.continueBtnDisabled,
            canFinish && { backgroundColor: isOsu ? osuAccent : selectedSchool?.accent },
          ]}
          onPress={handleContinue}
          disabled={!canFinish}
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
  },
  detailsOuter: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backChevron: {
    color: '#8e8e93',
    fontSize: 28,
    fontWeight: '300',
    marginTop: -2,
  },
  backText: {
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 12,
  },
  campusScroll: { flex: 1 },
  campusScrollContent: { gap: 10, paddingBottom: 16 },
  schoolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#2c2c2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  dormList: { flex: 1, minHeight: 200 },
  sectionHeader: {
    color: '#636366',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 8,
    marginBottom: 8,
  },
  dormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    marginBottom: 8,
  },
  dormRowText: { flex: 1 },
  dormName: {
    color: '#8e8e93',
    fontSize: 15,
    fontWeight: '600',
  },
  dormMeta: {
    color: '#636366',
    fontSize: 12,
    marginTop: 2,
  },
  emptyDorms: {
    color: '#636366',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  floorBlock: { marginTop: 8, marginBottom: 8 },
  floorPrompt: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  floorChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  floorChip: {
    minWidth: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    alignItems: 'center',
  },
  floorChipText: {
    color: '#8e8e93',
    fontSize: 15,
    fontWeight: '600',
  },
  nonOsuHint: { paddingVertical: 16 },
  nonOsuHintText: {
    color: '#8e8e93',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  schoolName: {
    flex: 1,
    color: '#8e8e93',
    fontSize: 16,
    fontWeight: '600',
  },
  schoolStatusPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  schoolStatusLive: {
    backgroundColor: 'rgba(52,199,89,0.2)',
    borderColor: '#34c759',
  },
  schoolStatusLocked: {
    backgroundColor: 'rgba(142,142,147,0.2)',
    borderColor: '#636366',
  },
  schoolStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  check: { fontSize: 16, fontWeight: '700' },
  termsBlock: { marginTop: 8, marginBottom: 16 },
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
