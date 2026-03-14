import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Modal,
  FlatList,
  Pressable,
  Animated,
  Dimensions,
  LayoutAnimation,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { playSuccess, playError } from '@/lib/sounds';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { useSchool, getMapRegion } from '@/context/school-context';
import { useRemoteConfig } from '@/context/remote-config-context';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

// ─── Dark map style (vibrant base so hotspots and safety icons pop) ───────────
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#141418' }] },
  { elementType: 'labels', stylers: [{ visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#252530' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2a2a32' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2e2e36' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c0c12' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#1a1a1e' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#121216' }] },
  {
    featureType: 'building',
    elementType: 'geometry.fill',
    stylers: [{ color: '#1e1e22' }],
  },
  {
    featureType: 'building',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#2e2e32' }, { weight: 1 }],
  },
];

const CLUSTER_RADIUS_KM = 0.5;
const WINDOW_MS = 30 * 60 * 1000;
const MIN_CONSENSUS = 5;
const HEATMAP_RECENCY_WEIGHT_MS = 10 * 60 * 1000; // higher weight for reports in last 10 min
const CAMPUS_REGION_TOLERANCE = 0.002; // lat/lng delta tolerance to consider "at campus"

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Report type (sheet options: undercover, creep, strict_bouncer, vibe, fire_music, dead) ───
export type MapReportType =
  | 'hot'
  | 'safe'
  | 'police'
  | 'ambulance'
  | 'fire'
  | 'security'
  | 'vibe'
  | 'strict_bouncer'
  | 'fire_music'
  | 'dead';

interface MapReport {
  id: string;
  type: MapReportType;
  lat: number;
  lng: number;
  uid: string;
  schoolId: string;
  createdAt: Timestamp;
}

interface Cluster {
  type: MapReportType;
  lat: number;
  lng: number;
  uids: Set<string>;
  count: number;
}

/** Bar from Firestore for map report picker (optional lat/lng for report location). */
interface BarForMap {
  id: string;
  name: string;
  display_order?: number;
  lat?: number;
  lng?: number;
  historical_baselines?: Record<string, number>;
  recent_reports?: Array<{ value: number; timestamp: unknown; user: string }>;
}

const REPORT_LABEL: Record<MapReportType, string> = {
  hot: 'Hot',
  safe: 'Safe',
  police: 'Police',
  ambulance: 'Creep',
  fire: 'Fire',
  security: 'Undercover',
  vibe: 'Vibe',
  strict_bouncer: 'Strict bouncer',
  fire_music: 'Fire Music',
  dead: 'Dead',
};

// ─── Emoji-style inline SVG icons (illustrated, colorful; no proprietary emoji) ─
function ReportTypeIcon({
  type,
  size = 24,
  dimmed = false,
}: {
  type: MapReportType;
  size?: number;
  dimmed?: boolean;
}) {
  const opacity = dimmed ? 0.7 : 1;
  const vb = '0 0 24 24';
  const common = { width: size, height: size, viewBox: vb, opacity };

  // Report types that use custom PNG assets
  const imageAssets: Partial<Record<MapReportType, number>> = {
    strict_bouncer: require('@/assets/images/bouncer.png'),
    security: require('@/assets/images/undercover.png'),
    vibe: require('@/assets/images/vibe.png'),
    dead: require('@/assets/images/dead.png'),
  };
  const imageSource = imageAssets[type];
  if (imageSource != null) {
    return (
      <Image
        source={imageSource}
        style={{ width: size, height: size, opacity }}
        resizeMode="contain"
      />
    );
  }

  // Fire symbol – for hot, fire, vibe (custom flame icon)
  const flameGradId = `flameGrad-${size}-${opacity}`;
  const FlameSvg = () => (
    <Svg {...common}>
      <Defs>
        <LinearGradient id={flameGradId} x1="12" y1="24" x2="12" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#ff4500" />
          <Stop offset="0.4" stopColor="#ff6b35" />
          <Stop offset="0.7" stopColor="#ff9500" />
          <Stop offset="1" stopColor="#ffcc00" />
        </LinearGradient>
      </Defs>
      <Path
        fill={`url(#${flameGradId})`}
        d="M12 22.5c0 0-6-5.5-6-10.5 0-3 2.5-5 6-5s6 2 6 5c0 5-6 10.5-6 10.5z"
      />
      <Path
        fill="rgba(255,220,120,0.5)"
        d="M12 19c0 0-3-3-3-6 0-1.5 1.2-2.5 3-2.5s3 1 3 2.5c0 3-3 6-3 6z"
      />
    </Svg>
  );

  // Shield (safe, police) – filled green
  const ShieldSvg = () => (
    <Svg {...common}>
      <Path
        fill="#34c759"
        stroke="#2aa84a"
        strokeWidth={0.8}
        strokeLinejoin="round"
        d="M12 2L3 7v6c0 6 4 10 9 12 5-2 9-6 9-12V7l-9-5z"
      />
      <Path fill="#5dd879" d="M12 4L5 8v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V8l-7-4z" />
    </Svg>
  );

  // Creep – two eyes (watching)
  const CreepSvg = () => (
    <Svg {...common}>
      <G fill="#fff" stroke="#333" strokeWidth={0.6}>
        <Circle cx="8" cy="12" r="3.2" />
        <Circle cx="16" cy="12" r="3.2" />
      </G>
      <Circle fill="#1a1a1a" cx="8" cy="12" r="1.8" />
      <Circle fill="#1a1a1a" cx="16" cy="12" r="1.8" />
      <Circle fill="#fff" cx="8.5" cy="11.2" r="0.4" />
      <Circle fill="#fff" cx="16.5" cy="11.2" r="0.4" />
    </Svg>
  );

  // Undercover – face with detective (fedora on face + magnifying glass)
  const DetectiveSvg = () => (
    <Svg {...common}>
      {/* Face – central */}
      <Circle fill="#e8c4a0" cx="12" cy="12" r="9" />
      <Circle fill="#d4a574" cx="12" cy="12" r="8" stroke="#c99a6a" strokeWidth={0.4} />
      {/* Eyes */}
      <Circle fill="#5c4033" cx="9" cy="11" r="1.1" />
      <Circle fill="#5c4033" cx="15" cy="11" r="1.1" />
      <Circle fill="#fff" cx="9.2" cy="10.5" r="0.3" />
      <Circle fill="#fff" cx="15.2" cy="10.5" r="0.3" />
      {/* Mouth */}
      <Path stroke="#8b6914" strokeWidth={0.7} fill="none" strokeLinecap="round" d="M10 15c.8.5 1.8.5 2.5 0" />
      {/* Detective fedora on top of head */}
      <Path fill="#1a1a1a" d="M5 7h14v1.2c0 .8-.6 1.8-2 2.2H7c-1.4-.4-2-1.4-2-2.2V7z" />
      <Path fill="#2d2d2d" stroke="#1a1a1a" strokeWidth={0.4} d="M8 8v-2c0-.6 1-1 4-1s4 .4 4 1v2H8z" />
      {/* Magnifying glass by face */}
      <Circle fill="none" stroke="#4a4a4a" strokeWidth={1.2} cx="17" cy="10" r="3" />
      <Circle fill="rgba(255,255,255,0.25)" cx="16.2" cy="9.2" r="0.8" />
      <Path stroke="#3a3a3a" strokeWidth={1} strokeLinecap="round" d="M19.2 12.2l2 2" />
    </Svg>
  );

  // Nerd (Strict bouncer) – face with round glasses, slight smile
  const NerdSvg = () => (
    <Svg {...common}>
      <Circle fill="#e8c4a0" cx="12" cy="12" r="10" />
      <Circle fill="#d4a574" cx="12" cy="12" r="9" stroke="#c99a6a" strokeWidth={0.4} />
      {/* Glasses frames – two round lenses + bridge */}
      <Circle fill="none" stroke="#2d2d2d" strokeWidth={1.2} cx="8" cy="11" r="2.8" />
      <Circle fill="none" stroke="#2d2d2d" strokeWidth={1.2} cx="16" cy="11" r="2.8" />
      <Path stroke="#2d2d2d" strokeWidth={1} strokeLinecap="round" d="M10.8 11h2.4" />
      {/* Eyes behind glasses */}
      <Circle fill="#5c4033" cx="8" cy="11" r="1" />
      <Circle fill="#5c4033" cx="16" cy="11" r="1" />
      <Circle fill="#fff" cx="8.2" cy="10.5" r="0.25" />
      <Circle fill="#fff" cx="16.2" cy="10.5" r="0.25" />
      {/* Nerd smile */}
      <Path stroke="#8b6914" strokeWidth={0.9} strokeLinecap="round" fill="none" d="M9.5 15.5c.6.8 2 .8 2.5 0" />
    </Svg>
  );

  // Music notes (fire_music) – two eighth notes
  const MusicSvg = () => (
    <Svg {...common}>
      {/* First note – stem up, flag, head */}
      <Path fill="#ff9f0a" stroke="#e68a00" strokeWidth={0.5} strokeLinejoin="round" d="M8 4v9" />
      <Circle fill="#ff9f0a" stroke="#e68a00" strokeWidth={0.5} cx="8" cy="15" r="2.2" />
      <Path fill="#ff9f0a" stroke="#e68a00" strokeWidth={0.5} d="M8 4l3-1.5v2L8 6v-2z" />
      {/* Second note – stem down, flag, head */}
      <Path fill="#ffb84d" stroke="#e68a00" strokeWidth={0.4} d="M15 8v8" />
      <Circle fill="#ffb84d" stroke="#e68a00" strokeWidth={0.4} cx="15" cy="18" r="1.8" />
      <Path fill="#ffb84d" stroke="#e68a00" strokeWidth={0.4} d="M15 8l2.5 1.2v-1.5L15 8z" />
    </Svg>
  );

  // Sleeping – face with closed eyes and “zzz”
  const DeadSvg = () => (
    <Svg {...common}>
      <Circle fill="#e8e6e3" cx="12" cy="12" r="10" />
      <Circle fill="#d8d6d2" cx="12" cy="12" r="9" stroke="#c9c7c3" strokeWidth={0.4} />
      {/* Closed eyes (sleeping curves) */}
      <Path stroke="#8b8680" strokeWidth={1.2} strokeLinecap="round" fill="none" d="M6 11.5 Q8 12.5 10 11.5" />
      <Path stroke="#8b8680" strokeWidth={1.2} strokeLinecap="round" fill="none" d="M14 11.5 Q16 12.5 18 11.5" />
      {/* Small sleeping mouth */}
      <Path stroke="#8b8680" strokeWidth={0.7} fill="none" d="M11 15.2 Q12 15.8 13 15.2" />
      {/* Z Z Z floating */}
      <Path stroke="#7a7570" strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M17 6l-2.5 3 2.5 3" />
      <Path stroke="#7a7570" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M15.5 8.5l-2 2.5 2 2.5" />
      <Path stroke="#7a7570" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" fill="none" d="M14 11l-1.5 2 1.5 2" />
    </Svg>
  );

  switch (type) {
    case 'hot':
    case 'fire':
    case 'vibe':
      return <FlameSvg />;
    case 'safe':
    case 'police':
      return <ShieldSvg />;
    case 'ambulance':
      return <CreepSvg />;
    case 'security':
      return <DetectiveSvg />;
    case 'strict_bouncer':
      return <NerdSvg />;
    case 'fire_music':
      return <MusicSvg />;
    case 'dead':
      return <DeadSvg />;
    default:
      return <FlameSvg />;
  }
}

function getMarkerStyle(type: MapReportType): { bg: string; border: string } {
  switch (type) {
    case 'hot':
    case 'vibe':
      return { bg: 'rgba(255,69,58,0.45)', border: '#ff6b6b' };
    case 'safe':
    case 'security':
      return { bg: 'rgba(48,209,88,0.45)', border: '#34c759' };
    case 'police':
      return { bg: 'rgba(10,132,255,0.45)', border: '#0a84ff' };
    case 'ambulance':
      return { bg: 'rgba(255,59,48,0.45)', border: '#ff3b30' };
    case 'fire':
    case 'fire_music':
      return { bg: 'rgba(255,149,0,0.45)', border: '#ff9f0a' };
    case 'strict_bouncer':
      return { bg: 'rgba(100,100,120,0.45)', border: '#6a6a80' };
    case 'dead':
      return { bg: 'rgba(80,80,90,0.45)', border: '#5a5a6a' };
  }
}

const SHEET_REPORT_TYPES: MapReportType[] = [
  'security',
  'ambulance',
  'strict_bouncer',
  'vibe',
  'fire_music',
  'dead',
];

const THANKS_BAR_DURATION_MS = 4000;

function ThanksCard({ accentColor }: { accentColor: string }) {
  const barWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    barWidth.setValue(0);
    const anim = Animated.timing(barWidth, {
      toValue: 1,
      duration: THANKS_BAR_DURATION_MS,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [barWidth]);
  const barWidthInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  return (
    <View style={styles.thanksCard}>
      <View style={styles.thanksCheckWrap}>
        <Text style={styles.thanksCheckmark}>✓</Text>
      </View>
      <Text style={styles.thanksTitle}>Thanks! You helped your campus!</Text>
      <View style={styles.thanksBarTrack}>
        <Animated.View
          style={[
            styles.thanksBarFill,
            { backgroundColor: accentColor, width: barWidthInterpolated },
          ]}
        />
      </View>
    </View>
  );
}

// ─── Clustering engine ────────────────────────────────────────────────────────
function buildClusters(reports: MapReport[]): Cluster[] {
  const clusters: Cluster[] = [];

  for (const r of reports) {
    let joined = false;
    for (const c of clusters) {
      if (c.type !== r.type) continue;
      if (haversineKm(c.lat, c.lng, r.lat, r.lng) <= CLUSTER_RADIUS_KM) {
        // Update running centroid
        c.count += 1;
        c.lat = c.lat + (r.lat - c.lat) / c.count;
        c.lng = c.lng + (r.lng - c.lng) / c.count;
        c.uids.add(r.uid);
        joined = true;
        break;
      }
    }
    if (!joined) {
      clusters.push({ type: r.type, lat: r.lat, lng: r.lng, uids: new Set([r.uid]), count: 1 });
    }
  }

  return clusters.filter((c) => c.uids.size >= MIN_CONSENSUS);
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MapScreen() {
  const { school } = useSchool();
  const { user } = useAuth();
  const { undercoverLabel, creepLabel } = useRemoteConfig();
  const mapRef = useRef<MapView>(null);
  const [verifiedClusters, setVerifiedClusters] = useState<Cluster[]>([]);
  const [mapReports, setMapReports] = useState<MapReport[]>([]);
  const [reporting, setReporting] = useState<MapReportType | null>(null);
  const [showCenterToCampus, setShowCenterToCampus] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<MapReportType | null>(null);
  const [bars, setBars] = useState<BarForMap[]>([]);
  const [showThanksCard, setShowThanksCard] = useState(false);
  const thanksCardDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barsLoading, setBarsLoading] = useState(true);
  const [barsError, setBarsError] = useState(false);
  const [mapReportsError, setMapReportsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [undercoverCooldownUntilMs, setUndercoverCooldownUntilMs] = useState<number | null>(null);
  const [creepCooldownUntilMs, setCreepCooldownUntilMs] = useState<number | null>(null);

  const getReportLabel = useCallback(
    (type: MapReportType) => {
      if (type === 'security') return undercoverLabel;
      if (type === 'ambulance') return creepLabel;
      return REPORT_LABEL[type];
    },
    [undercoverLabel, creepLabel],
  );

  // Listen to user cooldowns for Undercover/Creep (20-min freeze) so we can dim those options
  useEffect(() => {
    const uid = user?.uid ?? auth.currentUser?.uid;
    if (!uid) {
      setUndercoverCooldownUntilMs(null);
      setCreepCooldownUntilMs(null);
      return;
    }
    const userRef = doc(db, 'users', uid);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        const data = snap.data();
        const undercover = data?.undercoverCooldownUntil;
        const creep = data?.creepCooldownUntil;
        setUndercoverCooldownUntilMs(
          undercover && typeof undercover.toMillis === 'function' ? undercover.toMillis() : null,
        );
        setCreepCooldownUntilMs(
          creep && typeof creep.toMillis === 'function' ? creep.toMillis() : null,
        );
      },
      () => {
        setUndercoverCooldownUntilMs(null);
        setCreepCooldownUntilMs(null);
      },
    );
    return unsub;
  }, [user?.uid]);

  // Animate map to selected campus when school changes (geofenced to campus area)
  const region = getMapRegion(school);
  useEffect(() => {
    mapRef.current?.animateToRegion(region, 600);
    setShowCenterToCampus(false);
    setReportSheetVisible(false);
    setSelectedReportType(null);
  }, [school.id]);

  // Bars for this school (for report-at-bar picker)
  useEffect(() => {
    setBarsLoading(true);
    setBarsError(false);
    const q = query(
      collection(db, 'universities', school.id, 'bars'),
      orderBy('display_order', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBars(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BarForMap)));
        setBarsLoading(false);
      },
      (err) => {
        console.error('Bars for map:', err);
        setBarsError(true);
        setBarsLoading(false);
      },
    );
    return unsub;
  }, [school.id, refreshKey]);

  // Firestore real-time listener for map_reports
  useEffect(() => {
    setMapReportsError(false);
    const cutoff = Timestamp.fromDate(new Date(Date.now() - WINDOW_MS));
    const q = query(
      collection(db, 'map_reports'),
      where('schoolId', '==', school.id),
      where('createdAt', '>=', cutoff),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MapReport));
        setMapReports(reports);
        setVerifiedClusters(buildClusters(reports));
        setMapReportsError(false);
      },
      (err) => {
        console.error('Map reports error:', err);
        setMapReportsError(true);
      },
    );

    return unsub;
  }, [school.id, refreshKey]);

  // Heatmap: one point per report; weight by recency (last 10 min = higher)
  const heatmapPoints = React.useMemo(() => {
    const now = Date.now();
    return mapReports.map((r) => {
      const t = r.createdAt?.toMillis?.() ?? now;
      const age = now - t;
      const weight = age <= HEATMAP_RECENCY_WEIGHT_MS ? 1.5 : 1;
      return { latitude: r.lat, longitude: r.lng, weight };
    });
  }, [mapReports]);

  useEffect(() => {
    return () => {
      if (thanksCardDismissRef.current) clearTimeout(thanksCardDismissRef.current);
    };
  }, []);

  const campusRegion = getMapRegion(school);
  const handleRegionChangeComplete = useCallback(
    (r: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => {
      const latOff = Math.abs(r.latitude - campusRegion.latitude);
      const lngOff = Math.abs(r.longitude - campusRegion.longitude);
      const deltaOff =
        Math.abs(r.latitudeDelta - campusRegion.latitudeDelta) +
        Math.abs(r.longitudeDelta - campusRegion.longitudeDelta);
      setShowCenterToCampus(latOff > CAMPUS_REGION_TOLERANCE || lngOff > CAMPUS_REGION_TOLERANCE || deltaOff > CAMPUS_REGION_TOLERANCE);
    },
    [campusRegion],
  );

  const handleCenterToCampus = useCallback(() => {
    mapRef.current?.animateToRegion(campusRegion, 600);
    setShowCenterToCampus(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [campusRegion]);

  const handleRefresh = useCallback(() => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRefreshing(true);
    setBarsError(false);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const openBarPicker = useCallback((type: MapReportType) => {
    Haptics.selectionAsync();
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setSelectedReportType(type);
  }, []);

  const closeReportSheet = useCallback(() => {
    setReportSheetVisible(false);
    setSelectedReportType(null);
  }, []);

  const handleReportAtBar = useCallback(
    async (type: MapReportType, bar: BarForMap) => {
      if (reporting) return;
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Haptics.selectionAsync();
      }
      setReporting(type);
      const lat = bar.lat ?? school.lat;
      const lng = bar.lng ?? school.lng;
      try {
        if (['security', 'ambulance', 'strict_bouncer', 'vibe', 'fire_music', 'dead'].includes(type)) {
          const currentUser = auth.currentUser ?? user;
          if (!currentUser) {
            Alert.alert(
              'Sign in required',
              'Please wait a moment for the app to sign you in, then try again.',
            );
            setReporting(null);
            return;
          }
          await addDoc(
            collection(db, 'universities', school.id, 'bars', bar.id, 'alert_votes'),
            { type, uid: currentUser.uid, createdAt: serverTimestamp() },
          );
          await addDoc(collection(db, 'map_reports'), {
            schoolId: school.id,
            type,
            lat,
            lng,
            uid: currentUser.uid,
            createdAt: serverTimestamp(),
          });
        } else {
          await addDoc(collection(db, 'map_reports'), {
            schoolId: school.id,
            type,
            lat,
            lng,
            uid: user?.uid ?? 'anonymous',
            createdAt: serverTimestamp(),
          });
        }
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        await playSuccess();
        closeReportSheet();
        setShowThanksCard(true);
        if (thanksCardDismissRef.current) clearTimeout(thanksCardDismissRef.current);
        thanksCardDismissRef.current = setTimeout(() => {
          setShowThanksCard(false);
          thanksCardDismissRef.current = null;
        }, 5000);
      } catch (e: unknown) {
        console.error('Report failed:', e);
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        await playError();
        Alert.alert('Report failed', 'Could not send report. Please try again.');
      } finally {
        setReporting(null);
      }
    },
    [reporting, school.id, school.lat, school.lng, user, closeReportSheet],
  );

  if (barsLoading && bars.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={school.accent} />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={region}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {Platform.OS === 'android' && (
          <Heatmap
            points={heatmapPoints}
            radius={32}
            opacity={0.75}
            gradient={{
              colorMapSize: 3,
              colors: ['transparent', 'rgba(255,140,0,0.7)', 'rgba(255,69,58,0.95)'],
              startPoints: [0, 0.4, 1],
            }}
          />
        )}
        {verifiedClusters.map((c, i) => {
          const style = getMarkerStyle(c.type);
          return (
            <Marker
              key={`${c.type}-${i}`}
              coordinate={{ latitude: c.lat, longitude: c.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.markerOuter,
                  { backgroundColor: style.bg, borderColor: style.border },
                ]}
              >
                <ReportTypeIcon type={c.type} size={20} />
                <Text style={styles.markerCount}>{c.uids.size}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Campus label */}
      <View style={[styles.campusLabel, { borderColor: school.accent }]}>
        <View style={[styles.campusDot, { backgroundColor: school.accent }]} />
        <Text style={styles.campusText}>{school.label.toUpperCase()}</Text>
      </View>

      {/* Center to campus: discrete button when user has panned/zoomed away */}
      {showCenterToCampus && (
        <TouchableOpacity
          style={styles.centerToCampusBtn}
          onPress={handleCenterToCampus}
          activeOpacity={0.8}
        >
          <Text style={styles.centerToCampusText}>Center to campus</Text>
        </TouchableOpacity>
      )}

      {/* Waze-style thanks card at bottom (hides FAB while visible) */}
      {showThanksCard && <ThanksCard accentColor={school.accent} />}

      {/* Waze-style report FAB: hidden when thanks card is showing */}
      {!showThanksCard && (
        <View style={styles.fabContainer}>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setReportSheetVisible(true);
            }}
            activeOpacity={0.9}
          >
            <Image
              source={require('@/assets/images/mascot.png')}
              style={styles.fabIconImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Single report sheet: grid extends to bar list (no close-then-open) */}
      <Modal
        visible={reportSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeReportSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeReportSheet}>
          <Pressable
            style={[
              styles.wazeSheet,
              selectedReportType ? styles.wazeSheetExpanded : undefined,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            {selectedReportType === null ? (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>What do you see?</Text>
                  <TouchableOpacity
                    hitSlop={12}
                    onPress={closeReportSheet}
                    style={styles.sheetClose}
                  >
                    <Text style={styles.sheetCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.sheetGrid}>
                  {SHEET_REPORT_TYPES.map((type) => {
                    const isUndercoverCooldown =
                      type === 'security' &&
                      undercoverCooldownUntilMs != null &&
                      undercoverCooldownUntilMs > Date.now();
                    const isCreepCooldown =
                      type === 'ambulance' &&
                      creepCooldownUntilMs != null &&
                      creepCooldownUntilMs > Date.now();
                    const isDimmed = isUndercoverCooldown || isCreepCooldown;
                    const minsLeft = isUndercoverCooldown
                      ? Math.ceil((undercoverCooldownUntilMs! - Date.now()) / 60000)
                      : isCreepCooldown
                        ? Math.ceil((creepCooldownUntilMs! - Date.now()) / 60000)
                        : 0;
                    return (
                      <TouchableOpacity
                        key={type}
                        style={[styles.sheetGridItem, isDimmed && styles.sheetGridItemDimmed]}
                        onPress={() => !isDimmed && openBarPicker(type)}
                        activeOpacity={0.8}
                        disabled={isDimmed}
                      >
                        <View style={styles.sheetGridIconWrap}>
                          <ReportTypeIcon
                            type={type}
                            size={['security', 'strict_bouncer', 'vibe', 'dead'].includes(type) ? 44 : 28}
                            dimmed={isDimmed}
                          />
                        </View>
                        <Text
                          style={[
                            styles.sheetGridLabel,
                            isDimmed && styles.sheetGridLabelDimmed,
                          ]}
                        >
                          {getReportLabel(type)}
                        </Text>
                        {isDimmed && (
                          <Text style={styles.sheetGridCooldown}>
                            {minsLeft} min
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View style={styles.sheetHeader}>
                  <TouchableOpacity
                    onPress={() => setSelectedReportType(null)}
                    style={styles.sheetBackBtn}
                    hitSlop={8}
                  >
                    <Text style={styles.sheetBackChevron}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>
                    {selectedReportType && getReportLabel(selectedReportType)} at
                  </Text>
                  <TouchableOpacity
                    hitSlop={12}
                    onPress={closeReportSheet}
                    style={styles.sheetClose}
                  >
                    <Text style={styles.sheetCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.sheetBarListContainer}>
                  {bars.length === 0 ? (
                    <Text style={styles.barPickerEmpty}>No bars for {school.label} yet.</Text>
                  ) : (
                    <FlatList
                      data={bars}
                      keyExtractor={(b) => b.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.barPickerRow}
                          onPress={() =>
                            selectedReportType &&
                            handleReportAtBar(selectedReportType, item)
                          }
                          disabled={!!reporting}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.barPickerRowName}>{item.name}</Text>
                          <Text style={styles.barPickerRowChevron}>›</Text>
                        </TouchableOpacity>
                      )}
                      style={styles.barPickerList}
                    />
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Refresh button (when error or for manual refresh) */}
      {(barsError || mapReportsError || refreshing) && (
        <View style={styles.refreshOverlay}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={refreshing}
            activeOpacity={0.7}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.refreshBtnText}>
                {barsError || mapReportsError ? 'Tap to retry' : 'Refresh'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

    </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  loadingText: { color: '#8e8e93', fontSize: 13, marginTop: 12 },
  refreshOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  refreshBtn: {
    backgroundColor: '#1c1c1e',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a3c',
    minWidth: 120,
    alignItems: 'center',
  },
  refreshBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Campus label (top overlay)
  campusLabel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1.5,
  },
  campusDot: { width: 8, height: 8, borderRadius: 4 },
  campusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Verified markers
  markerOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  markerEmoji: { fontSize: 20, lineHeight: 24 },
  markerCount: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Center to campus (discrete, appears when user moves map)
  centerToCampusBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 90,
    right: 16,
    backgroundColor: '#1e1e22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#3a3a3e',
  },
  centerToCampusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Thanks card (Waze-style, anchored to bottom; no FAB while visible)
  thanksCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#1c1c1e',
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 + 50 : 24 + 50,
    borderWidth: 0,
    borderTopWidth: 1,
    borderColor: '#2c2c2e',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 16 },
    }),
  },
  thanksCheckWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#34c759',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  thanksCheckmark: { color: '#fff', fontSize: 16, fontWeight: '700' },
  thanksTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  thanksBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2c2c2e',
    overflow: 'hidden',
  },
  thanksBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Waze-style report FAB (bottom-right)
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 88,
    right: 20,
    alignItems: 'flex-end',
  },
  fab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#000000',
    borderWidth: 2.5,
    borderColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 8 },
      android: { elevation: 10 },
    }),
  },
  fabIcon: { fontSize: 38 },
  fabIconImage: { width: 38, height: 38 },

  // "What do you see?" Waze-style sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  wazeSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingHorizontal: 20,
  },
  wazeSheetExpanded: {
    minHeight: Dimensions.get('window').height * 0.45,
    maxHeight: Dimensions.get('window').height * 0.7,
  },
  sheetBackBtn: {
    padding: 4,
    marginRight: 8,
  },
  sheetBackChevron: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a3a3e',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  sheetClose: { padding: 4 },
  sheetCloseText: { color: '#8e8e93', fontSize: 18, fontWeight: '600' },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  sheetGridItem: {
    width: '30%',
    minWidth: 100,
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  sheetGridIconWrap: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetGridItemDimmed: {
    opacity: 0.5,
    backgroundColor: '#000000',
  },
  sheetGridEmoji: { fontSize: 28 },
  sheetGridEmojiDimmed: { opacity: 0.7 },
  sheetGridLabel: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  sheetGridLabelDimmed: { color: '#8e8e93' },
  sheetGridCooldown: {
    color: '#8e8e93',
    fontSize: 10,
    fontWeight: '500',
  },
  sheetBarListContainer: {
    minHeight: 200,
    maxHeight: 320,
  },

  // Bar picker modal (bottom sheet)
  barPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  barPickerSheet: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '60%',
  },
  barPickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a3a3e',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  barPickerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  barPickerEmpty: {
    color: '#8e8e93',
    fontSize: 15,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  barPickerList: { maxHeight: 320 },
  barPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2c2c2e',
  },
  barPickerRowName: { color: '#fff', fontSize: 16, fontWeight: '500' },
  barPickerRowChevron: { color: '#8e8e93', fontSize: 20, fontWeight: '300' },
});
