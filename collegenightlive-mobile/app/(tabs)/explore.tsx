import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useSchool } from '@/context/school-context';

const ACTIVE_OPACITY = 0.7;

const BEACONS = [
  {
    id: 'check-in',
    icon: '📍',
    label: 'Check In',
    color: '#60a5fa',
    comingSoon: true,
  },
  {
    id: 'lost',
    icon: '🔦',
    label: 'Lost',
    color: '#fcd34d',
    comingSoon: true,
  },
  {
    id: 'walk-with-me',
    icon: '🚶‍♀️',
    label: 'Walk With Me',
    color: '#fb923c',
    comingSoon: true,
  },
  {
    id: 'somethings-off',
    icon: '⚠️',
    label: "Something's Off",
    color: '#f87171',
    comingSoon: true,
  },
] as const;

export default function SafetyScreen() {
  const { school } = useSchool();

  function handleBeacon(id: string) {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    Alert.alert('Coming Soon', 'Safety features (Check-in, Walk With Me) are coming in a future update.');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={styles.container}>
        {/* Page header */}
        <Text style={[styles.heading, { color: school.accent }]}>SAFETY</Text>
        <Text style={styles.sub}>{school.label}</Text>

        {/* Beacon card */}
        <View style={styles.card}>
          <Text style={[styles.cardLabel, { color: school.accent }]}>
            PERSONAL INTELLIGENCE BEACONS
          </Text>

          <View style={styles.grid}>
            {BEACONS.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.beaconBtn, { borderBottomColor: b.color }]}
                onPress={() => handleBeacon(b.id)}
                activeOpacity={ACTIVE_OPACITY}
              >
                <View style={styles.comingSoonRow}>
                  <Text style={styles.comingSoonText}>Coming Soon</Text>
                </View>
                <Text style={styles.beaconIcon}>{b.icon}</Text>
                <Text style={[styles.beaconLabel, { color: b.color }]}>{b.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
  },

  heading: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sub: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 32,
  },

  card: {
    backgroundColor: 'rgba(28,28,30,0.8)',
    borderWidth: 1,
    borderColor: '#1c1c1e',
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },

  beaconBtn: {
    width: '45%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    borderBottomWidth: 3,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  comingSoonRow: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    color: '#8e8e93',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  beaconIcon: { fontSize: 28 },
  beaconLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
