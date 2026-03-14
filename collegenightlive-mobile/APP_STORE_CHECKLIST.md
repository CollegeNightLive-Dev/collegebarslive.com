# App Store Submission Checklist – Nyte

Use this list before submitting to reduce the chance of rejection. Tick items as you complete them.

---

## 1. App metadata and identity

- [ ] **Display name** – App shows as "Nyte" in app.json; ensure this matches App Store Connect.
- [ ] **Bundle ID** – `com.nyte.app` is set; must match exactly in App Store Connect and in your Apple Developer account.
- [ ] **Version and build** – `version` (e.g. 1.0.0) and iOS `buildNumber` (e.g. 1) are set in app.json. For later submissions, bump version and/or build per Apple’s rules.
- [ ] **Encryption** – `ITSAppUsesNonExemptEncryption: false` is in app.json; if you use only HTTPS and no custom crypto, you can answer “No” to encryption in App Store Connect and avoid export compliance docs.

---

## 2. Privacy and data

- [ ] **Privacy Policy** – You have a live, public URL (e.g. https://collegenightlive.com/terms.html) and it’s linked from in-app Terms & Privacy. App Store Connect also requires a Privacy Policy URL.
- [ ] **Terms & Privacy in-app** – Users can open Terms & Privacy (account and onboarding); content matches what you tell Apple and what’s on the web.
- [ ] **Privacy manifest (iOS)** – You have `privacyManifests` in app.json with `NSPrivacyAccessedAPICategoryUserDefaults` and reason CA92.1; add any other required API reasons if you use more “required reason” APIs.
- [ ] **Data collection disclosure** – If you collect any data (e.g. bar wait times, map reports, device identifiers), it’s described in your Privacy Policy and, if needed, in App Store Connect “App Privacy” (data types and purposes).
- [ ] **Account deletion** – Delete Account is available in Account screen and is clearly described in your Privacy Policy (you already mention it). Ensure the backend/Cloud Function actually deletes or anonymizes user data as promised.

---

## 3. Sign-in and account

- [ ] **Sign in with Apple** – You currently use **anonymous only** sign-in. If you later add Google, Facebook, or any other third-party sign-in, Apple requires you to also offer Sign in with Apple (Guideline 4.8).
- [ ] **No broken sign-in** – Anonymous sign-in and retry flow work; no crash or endless loading on launch.
- [ ] **Account deletion flow** – Delete Account triggers your Cloud Function, then redirects to account-deleted screen; no crash and user is clearly informed.

---

## 4. Content and functionality

- [ ] **No placeholder content** – All copy and assets are final (no “Lorem ipsum”, “Test”, or obvious placeholders).
- [ ] **No broken links** – “View online” for Terms & Privacy and any other outbound links open the correct URLs.
- [ ] **No debug / test-only UI** – Remove or hide any debug menus, test buttons, or internal-only options before release.
- [ ] **User-generated content** – If applicable, you have moderation/safety in place and describe it in your Terms; you already reserve the right to remove content and restrict users.

---

## 5. Permissions and capabilities

- [ ] **Location** – If you request location, you have a clear purpose (e.g. map/campus) and an Info.plist usage description (Expo will add from app.json if you set the right plugin). Only request when needed.
- [ ] **No unnecessary permissions** – Don’t request contacts, camera, etc. unless the app actually uses them and you explain why in App Store Connect and/or in-app.
- [ ] **Background modes** – If you use any (e.g. location background), they must be justified and declared in capabilities and in App Store Connect.

---

## 6. App Store Connect

- [ ] **App record** – App is created in App Store Connect with correct bundle ID, name, and primary language.
- [ ] **Screenshots** – Required sizes for the highest supported device (e.g. 6.7" and 5.5" for iPhone) are uploaded; no placeholder or wrong-device screenshots.
- [ ] **Description and keywords** – Short and full description and keywords are filled and accurate (no misleading claims).
- [ ] **Support URL** – A working support URL (e.g. support@collegenightlive.com or a help page) is set; your terms mention support.
- [ ] **Privacy Policy URL** – Same URL as in-app is set in App Store Connect.
- [ ] **Category** – Appropriate category (e.g. Navigation or Social Networking) is selected.
- [ ] **Age rating** – Questionnaire completed; if you allow user-generated content or references to alcohol/venues, answer accordingly and set the correct rating.
- [ ] **Pricing** – Free or paid is set; if free with IAP or subscriptions, those are configured correctly.

---

## 7. Build and technical

- [ ] **Production build** – You build with a production profile (e.g. `eas build --platform ios --profile production`); no dev client or debug-only config in the build you submit.
- [ ] **No crash on launch** – App launches and reaches the first real screen (onboarding or main app) without crashing on a physical device.
- [ ] **Offline / weak network** – Critical paths (e.g. viewing wait times, labels from Remote Config) degrade gracefully; you have in-app defaults (e.g. “Event Security”, “Fishy”) so the app doesn’t depend on network for core UI.
- [ ] **No console errors in release** – Remove or guard any `console.log` that could leak sensitive data; ensure no unhandled promise rejections or errors in the main flow.

---

## 8. Guidelines that often cause rejection

- [ ] **2.1 App completeness** – App is feature-complete; no “Coming soon” or non-functional sections.
- [ ] **4.2 Minimum functionality** – App provides clear value (e.g. bar wait times, map reports) and isn’t just a web wrapper without added functionality.
- [ ] **5.1.1 Data collection** – Privacy Policy and in-app disclosure match what the app actually collects and how it’s used.
- [ ] **5.1.2 Right to delete** – Users can delete their account and data; your policy and in-app flow reflect that (you already have this).
- [ ] **4.8 Sign in with Apple** – Only needed if you add another third-party sign-in option; not required for anonymous-only.
- [ ] **1.1 Objectionable content** – Descriptions and in-app content are appropriate for your age rating and don’t encourage harmful behavior.

---

## 9. Pre-submit quick checks

- [ ] Run the app from a production (or release) build on a real device.
- [ ] Complete onboarding, use main features (wait times, map, report flow, account, Terms, Delete Account).
- [ ] Confirm Terms & Privacy URL loads in a browser.
- [ ] Confirm support contact or URL is valid.
- [ ] In App Store Connect, re-check Privacy Policy URL, support URL, and screenshots for the correct build and device sizes.

---

## Notes specific to your project

- **Firebase / Google** – You use Firebase (Auth, Firestore, Remote Config, Functions). Ensure your Privacy Policy and App Privacy section mention authentication, analytics (if any), and cloud backend.
- **Maps** – If you use Google Maps or similar, ensure the SDK is used in line with the provider’s terms and that any required attribution is present.
- **Remote Config** – Labels (e.g. Undercover, Creep) have in-app defaults and work offline; no need to call this out separately in the checklist beyond “offline behavior” above.

When everything above is checked and your build is uploaded, submit for review and respond promptly to any reviewer questions.
