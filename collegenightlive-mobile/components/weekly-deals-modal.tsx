import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  defaultDealDayForDays,
  type DayDeals,
  type DealDayId,
} from '@/constants/bar-deals-types';

const ACTIVE_OPACITY = 0.7;

type Props = {
  visible: boolean;
  venueName: string;
  days: DayDeals[];
  accentColor: string;
  onClose: () => void;
};

export function WeeklyDealsModal({ visible, venueName, days, accentColor, onClose }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  /** Fixed modal height so ScrollView gets a real flex budget (avoids clipping behind “Got it”) */
  const cardHeight = Math.min(windowHeight * 0.88, windowHeight - 32);

  const [day, setDay] = useState<DealDayId>(() => defaultDealDayForDays(days));

  useEffect(() => {
    if (visible && days.length > 0) {
      setDay(defaultDealDayForDays(days));
    }
  }, [visible, days]);

  const dayData = useMemo(
    () => days.find((d) => d.id === day) ?? days[0],
    [day, days],
  );

  const selectDay = (id: DealDayId) => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.selectionAsync();
    }
    setDay(id);
  };

  if (days.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View pointerEvents="box-none" style={styles.overlayFore}>
          <View
            style={[
              styles.card,
              { height: cardHeight, borderColor: `${accentColor}99` },
            ]}
          >
            <View style={styles.cardInner}>
              <View style={styles.cardHeader}>
                <Text style={styles.title}>DEALS</Text>
                <Text style={styles.venue}>{venueName}</Text>
                <View style={styles.divider} />

                <Text style={styles.subPrompt}>SELECT DAY</Text>
                <View style={styles.dayRow}>
                  {days.map((d) => {
                    const active = d.id === day;
                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={[
                          styles.dayChip,
                          { borderColor: `${accentColor}44` },
                          active && {
                            borderColor: accentColor,
                            backgroundColor: `${accentColor}22`,
                          },
                        ]}
                        onPress={() => selectDay(d.id)}
                        activeOpacity={ACTIVE_OPACITY}
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={d.label}
                      >
                        <Text
                          style={[
                            styles.dayChipShort,
                            !active && { color: `${accentColor}cc` },
                            active && styles.dayChipTextActive,
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.65}
                        >
                          {d.short}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <ScrollView
                style={styles.dealsScroll}
                contentContainerStyle={styles.dealsScrollContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                bounces
              >
                {dayData?.sections.map((section, si) => (
                  <View key={si} style={styles.section}>
                    {section.timeLabel ? (
                      <View style={[styles.timeBar, { borderColor: `${accentColor}55` }]}>
                        <Text style={styles.timeBarText}>{section.timeLabel}</Text>
                        <View style={[styles.timeAccent, { backgroundColor: accentColor }]} />
                      </View>
                    ) : null}
                    {section.banner ? (
                      <Text
                        style={[
                          styles.banner,
                          section.banner.useAccent && { color: accentColor },
                        ]}
                      >
                        {section.banner.text}
                      </Text>
                    ) : null}
                    {section.rows.map((row, ri) => (
                      <View key={ri} style={styles.dealBlock}>
                        {row.price != null && row.price !== '' ? (
                          <Text style={styles.price}>{row.price}</Text>
                        ) : null}
                        <Text style={[styles.itemName, !row.price && styles.itemNameSolo]}>{row.name}</Text>
                        {row.detail ? <Text style={styles.itemDetail}>{row.detail}</Text> : null}
                      </View>
                    ))}
                    {section.footNote ? (
                      <Text style={styles.footNote}>{section.footNote}</Text>
                    ) : null}
                  </View>
                ))}
              </ScrollView>

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={[styles.closeBtn, { backgroundColor: accentColor, borderColor: accentColor }]}
                  onPress={onClose}
                  activeOpacity={ACTIVE_OPACITY}
                >
                  <Text style={styles.closeBtnText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayFore: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#0c0c0e',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2c2c2e',
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  cardInner: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  cardHeader: {
    flexShrink: 0,
  },
  cardFooter: {
    flexShrink: 0,
    paddingTop: 4,
  },
  title: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  venue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#2c2c2e',
    marginVertical: 14,
  },
  subPrompt: {
    color: '#636366',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 4,
    width: '100%',
    paddingBottom: 12,
  },
  dayChip: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipShort: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  dayChipTextActive: {
    color: '#fff',
  },
  dealsScroll: {
    flex: 1,
    minHeight: 0,
  },
  dealsScrollContent: {
    paddingBottom: 26,
  },
  section: {
    marginBottom: 16,
  },
  banner: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  timeBar: {
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  timeBarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  timeAccent: {
    height: 2,
    width: 32,
    alignSelf: 'center',
    marginTop: 6,
    borderRadius: 1,
  },
  dealBlock: {
    marginBottom: 14,
  },
  price: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  itemName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  itemNameSolo: {
    fontSize: 14,
    marginTop: 0,
  },
  itemDetail: {
    color: '#8e8e93',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  footNote: {
    color: '#8e8e93',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
    marginTop: 4,
  },
  closeBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
