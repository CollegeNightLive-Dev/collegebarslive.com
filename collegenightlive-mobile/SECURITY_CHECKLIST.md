# Security Checklist – Nyte (College Bar Wait Times)

Use this list to verify and harden security across the app, backend, and configuration. Tick items as you complete or verify them.

---

## 1. Authentication & identity

- [ ] **Anonymous auth only** – App uses Firebase anonymous sign-in only; no passwords or email stored in-app. Ensure no sign-in flow leaks tokens or credentials in logs or URLs.
- [ ] **Token handling** – ID tokens are sent to callable functions via `Authorization: Bearer` or in request body for React Native; tokens are not logged or stored in plain text. `callCallableWithToken` does not persist the token beyond the request.
- [ ] **Sign-out / account deletion** – On delete, the client calls `deleteUserData` with a fresh ID token; the Cloud Function verifies the token and deletes the Firebase Auth user and Firestore data. No client-side credential left behind.
- [ ] **Admin identity in rules** – Firestore rules use `request.auth.token.email` for `isAdmin()`. Only use this if those emails are verified (e.g. Google sign-in for admin tools). Anonymous app users do not have email, so they correctly cannot satisfy `isRealUser()` for intel_posts/reports (those paths are for other clients if any).

---

## 2. Firestore rules

- [ ] **Map reports** – Rules: `allow create: if request.auth != null`. Consider adding `request.resource.data.uid == request.auth.uid` so clients cannot create reports with a different user ID.
- [ ] **Bar updates** – Client updates `wait_time`, `recent_reports`, `last_updated`. Rules already restrict `affectedKeys` and `wait_time` range. Ensure `recent_reports` entries cannot spoof another user’s ID if you rely on that for attribution (optional: validate `user` field server-side or in rules).
- [ ] **Alert votes** – Rules validate `type` and `uid == request.auth.uid`; good. No change needed.
- [ ] **Users collection** – Users can read/write only their own document; cooldown fields are protected from client writes. Good.
- [ ] **Rate limiting** – Rules enforce 2-minute cooldown for intel posts. For bar vouches and map reports, cooldowns are enforced in the app and/or Cloud Functions; confirm they cannot be bypassed by direct Firestore writes (e.g. alert_votes go through function or rules only).

---

## 3. Cloud Functions

- [ ] **deleteUserData** – Verifies caller via `getUidFromCallableContext` (context.auth or verified idToken). Deletes map_reports, safety_beacons, and recent_reports in bars, then `admin.auth().deleteUser(uid)`. Confirm every collection that stores user data is included (e.g. alert_votes, reports, intel_posts if applicable).
- [ ] **getUidFromCallableContext** – Validates idToken with `admin.auth().verifyIdToken`; rejects invalid or expired tokens. No raw token logged.
- [ ] **submitAlertVote** – Validates `schoolId`, `barId`, `type` server-side; enforces cooldowns and thresholds. No sensitive data logged.
- [ ] **sendSafetyBeacon** (if used) – Only authenticated users; payload (type, location, battery) stored in Firestore. Ensure location is not logged in plain form if sensitive.
- [ ] **Error messages** – Functions throw `HttpsError` with generic messages to clients; avoid leaking internal paths or user data in error text.

---

## 4. Secrets & configuration

- [ ] **Firebase config in app** – `apiKey` and other config in `lib/firebase.ts` are normal for client apps (Firebase API keys are not secret). Ensure no server-side secrets (e.g. service account keys, Admin SDK keys) are ever in the mobile repo or bundled in the app.
- [ ] **Environment-specific config** – If you add staging/production later, use environment variables or build-time config for different Firebase projects; keep `.env*.local` in `.gitignore` (already there).
- [ ] **Apple / signing keys** – `.gitignore` includes `*.p8`, `*.p12`, `*.key`. Ensure `AuthKey_*.p8` and other signing or push credentials are never committed (check repo root if keys live there).
- [ ] **No secrets in logs** – No `console.log` of tokens, emails, or PII in production code paths. Strip or guard logs in release builds if needed.

---

## 5. Data in transit & storage

- [ ] **HTTPS only** – All Firebase and callable URLs use HTTPS. No mixed content or custom HTTP endpoints for sensitive data.
- [ ] **Local storage** – AsyncStorage used for cooldowns, selected school, onboarding flag. No tokens or passwords stored. Sensitive data (if any later) should use secure storage (e.g. expo-secure-store) instead of AsyncStorage.
- [ ] **Remote Config** – Fetched over HTTPS; only non-sensitive label strings. Defaults in code so app works offline; no user data in config.

---

## 6. Input validation & abuse

- [ ] **Map report payload** – Client sends `schoolId`, `type`, `lat`, `lng`, `uid`, `createdAt`. Firestore rules do not validate full shape; consider validating `type` in allowed list and `lat`/`lng` range in rules or in a Cloud Function if you want to reject bad data.
- [ ] **Bar vouch payload** – Client sends `wait_time` (0–120), `recent_reports`, `last_updated`. Rules constrain keys and wait_time range; good.
- [ ] **Rate limiting / cooldowns** – Vouch cooldown is client-side (AsyncStorage) plus server could enforce; alert cooldowns are enforced in Cloud Function. Consider server-side rate limits for map_reports (e.g. per uid per school) if abuse is a concern.
- [ ] **Toxicity / content** – Firestore rules `isClean()` filter for intel_posts/comments. Map reports and bar data are structured (type, numbers); no free-text from the mobile app that could need filtering.

---

## 7. Dependency & supply chain

- [ ] **Dependencies** – Run `npm audit` (or `pnpm audit`) in `collegenightlive-mobile` and `functions`; fix or accept high/critical findings. Keep Firebase and Expo SDKs up to date for security patches.
- [ ] **Lockfiles** – Commit `package-lock.json` (or equivalent) so builds are reproducible and dependencies are pinned.
- [ ] **No eval / dynamic code** – No `eval()`, `new Function()`, or unsafe `require()` of user-controlled input in app or functions.

---

## 8. Privacy & data minimization

- [ ] **Data collected** – Only what’s described in the Privacy Policy: anonymous ID, wait-time and map report data, school selection. No device identifiers or location beyond what’s disclosed.
- [ ] **Account deletion** – Delete Account flow triggers full deletion (Auth + Firestore) per policy. Document any retention for legal/compliance (e.g. logs) and state in policy if required.
- [ ] **Third-party SDKs** – Firebase (Auth, Firestore, Remote Config, Functions) and any analytics are disclosed in the Privacy Policy; no undisclosed tracking or sharing.

---

## 9. Operational security

- [ ] **Firebase Console / GCP** – Restrict project access to needed roles; use separate projects for dev/staging/prod if possible. Enable 2FA on Google accounts with project access.
- [ ] **Firestore indexes** – Deploy only intended indexes; avoid open-ended composite indexes that could be abused for expensive queries.
- [ ] **Function IAM** – Cloud Functions run with default or minimal service account; no broad cross-project permissions unless required.
- [ ] **Monitoring** – Enable Cloud Functions and Firestore monitoring; set alerts for unusual error rates or usage spikes.

---

## 10. Quick wins to implement

1. **Map reports rule** – In `firestore.rules`, under `map_reports`, change create to:
   `allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;`
   so clients cannot impersonate another user in report documents.

2. **deleteUserData coverage** – In `functions/index.js`, confirm every collection that stores data by `uid` is deleted (e.g. `alert_votes` if stored per-user and you want them removed; currently bar-level alert_votes are not deleted by uid in the function—document whether that’s intentional).

3. **Audit and trim logs** – Search for `console.log`/`console.warn` that might print tokens, UIDs, or PII; remove or guard in production.

4. **Run npm audit** – In both `collegenightlive-mobile` and `functions`, run `npm audit` and address reported vulnerabilities.

---

When everything above is verified or addressed, the app and backend should be in good shape for launch from a security perspective. Revisit after major feature or dependency changes.
