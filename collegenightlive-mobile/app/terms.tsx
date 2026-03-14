import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

/** Public URL for Terms & Privacy (view online). */
const TERMS_AND_PRIVACY_URL = 'https://collegenightlive.com/terms.html';

const SUPPORT_EMAIL = 'support@collegenightlive.com';

const C = {
  bg: '#000000',
  text: '#ffffff',
  muted: '#a1a1a6',
  dim: '#666666',
  border: '#1c1c1e',
  box: '#111111',
  link: '#60a5fa',
};

export default function TermsScreen() {
  const openTermsUrl = () => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (TERMS_AND_PRIVACY_URL) Linking.openURL(TERMS_AND_PRIVACY_URL);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            router.back();
          }}
          style={styles.back}
        >
          <Text style={styles.backText}>← BACK</Text>
        </TouchableOpacity>

        <Text style={styles.h1}>Terms & Privacy Policy</Text>
        <Text style={styles.updated}>Last Modified: March 9, 2026</Text>
        {TERMS_AND_PRIVACY_URL ? (
          <TouchableOpacity onPress={openTermsUrl} style={styles.viewOnline}>
            <Text style={styles.viewOnlineText}>View online</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.h2}>1. Privacy Policy & Data Handling</Text>
        <Text style={styles.p}>
          Nyte (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) values your privacy. We use{' '}
          <Text style={styles.strong}>anonymous authentication</Text>—no email or name is required.
        </Text>
        <Text style={styles.strong}>Information We Collect:</Text>
        <Text style={styles.p}>
          We collect (1) bar wait-time submissions you make (the value you select, timestamp, and an anonymous account ID), and (2) map reports you submit (report type, venue location, anonymous ID, and your selected school). We do not collect your name or email.
        </Text>
        <Text style={styles.strong}>Data We Do Not Collect:</Text>
        <Text style={styles.p}>
          We do not collect your precise device location, contacts, or calendar.
        </Text>
        <Text style={styles.strong}>How We Use It:</Text>
        <Text style={styles.p}>
          We use this data to attribute reports, calculate wait-time estimates, and improve the platform. We do not sell or rent user data to third parties.
        </Text>
        <Text style={styles.strong}>Session Storage:</Text>
        <Text style={styles.p}>
          We use local storage and Firebase to keep you logged in. This app does not use cookies in the web sense.
        </Text>
        <Text style={styles.strong}>Data Retention & Deletion:</Text>
        <Text style={styles.p}>
          We retain data only as needed to provide the service. You can request deletion of your account and associated data at any time using the <Text style={styles.strong}>Delete Account</Text> option in the Account screen. Deletion is permanent.
        </Text>
        <Text style={styles.strong}>Your Rights:</Text>
        <Text style={styles.p}>
          You may request deletion of your account and associated data at any time via the Delete Account option in the Account screen or by contacting us at{' '}
          <Text style={styles.linkText} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>{SUPPORT_EMAIL}</Text>.
        </Text>
        <Text style={styles.strong}>Third-Party Services:</Text>
        <Text style={styles.p}>
          We use Firebase (Google) for authentication and database storage. We do not share personal data with third parties for marketing. Service providers that process data on our behalf are required to protect user data in line with this policy and applicable law.
        </Text>
        <View style={styles.box}>
          <Text style={styles.p}>
            <Text style={styles.strong}>Strict Non-Sharing Clause:</Text> No personal user information—including email addresses or names—will be shared with third parties or affiliates for marketing or promotional purposes.
          </Text>
        </View>

        <Text style={styles.h2}>2. User Content & Conduct</Text>
        <Text style={styles.p}>
          When you submit bar wait-time vouches or map reports, you agree to the following:
        </Text>
        <Text style={styles.strong}>Visibility:</Text>
        <Text style={styles.p}>Your submissions contribute to wait-time estimates and map data visible to other users at your school.</Text>
        <Text style={styles.strong}>Moderation:</Text>
        <Text style={styles.p}>We reserve the right to remove any content that is harassing, illegal, or violates campus safety standards, and to restrict or block users who violate these terms.</Text>
        <Text style={styles.strong}>Responsibility:</Text>
        <Text style={styles.p}>You are solely responsible for the content you submit.</Text>

        <Text style={styles.h2}>3. Wait-Time Algorithm Disclaimer</Text>
        <Text style={styles.p}>
          Nyte is an information-sharing tool. Wait times displayed are{' '}
          <Text style={styles.strong}>estimates</Text> calculated using a consensus-weighted algorithm based on live user reports and historical baselines.
        </Text>
        <View style={styles.box}>
          <Text style={styles.p}>
            <Text style={styles.strong}>Accuracy Notice:</Text> Real-world conditions change rapidly. We do not guarantee the accuracy of wait times. Use of this data is at your own risk, and we are not liable for any inconvenience or outcome resulting from inaccurate estimates.
          </Text>
        </View>

        <Text style={styles.h2}>4. Third-Party Links</Text>
        <Text style={styles.p}>
          If we add links to third-party websites or apps, we are not responsible for their privacy practices or content.
        </Text>

        <Text style={styles.h2}>5. Affiliation</Text>
        <Text style={styles.p}>This platform is not affiliated or endorsed by any academic institution.</Text>

        <Text style={styles.h2}>6. Contact, Support & Reporting</Text>
        <Text style={styles.p}>
          For support, questions, or to report abusive or objectionable content, contact us at{' '}
          <Text style={styles.linkText} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>{SUPPORT_EMAIL}</Text>.
          We will respond in a timely manner and may remove content or take action against users who violate these terms.
        </Text>

        <Text style={styles.h2}>7. Changes to This Policy</Text>
        <Text style={styles.p}>
          We may update this policy from time to time. The &quot;Last Modified&quot; date at the top will be updated when we do. Continued use of the app after changes means you accept the updated policy. For material changes we may notify you in the app or by email if we have it.
        </Text>

        <Text style={styles.footer}>© 2026 Nyte. All rights reserved.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  back: { marginBottom: 24 },
  backText: { color: C.dim, fontSize: 13 },
  h1: {
    color: C.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  updated: {
    color: C.dim,
    fontSize: 13,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  viewOnline: {
    marginBottom: 40,
  },
  viewOnlineText: {
    color: C.link,
    fontSize: 14,
    fontWeight: '600',
  },
  linkText: {
    color: C.link,
    fontWeight: '600',
  },
  h2: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 40,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 8,
  },
  p: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  strong: { color: C.text, fontWeight: '600' },
  box: {
    backgroundColor: C.box,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginVertical: 16,
  },
  footer: {
    color: '#424245',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 48,
  },
});
