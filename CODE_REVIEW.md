# Code Review – College Bar Wait Times

Review date: March 2026. Covers security, data flow, and the `ai_reason` / unauthorized content issue.

---

## 1. `ai_reason` / "Closed due to homosexual behavior" – Root cause and fix

### Finding

- **No code in this repo writes to `ai_reason` or `ai_last_refined`.**  
  Cloud Functions ([functions/index.js](functions/index.js)) only update `recent_reports`, `active_alerts`, and user cooldown fields. Mobile and web clients only send `wait_time`, `last_updated`, and `recent_reports` when vouching.

- **Firestore rules do not forbid client writes to `ai_reason`.**  
  For bars, the rule only blocks updates that *change* these keys:  
  `historical_baseline`, `name`, `location`, `admin_override`, `display_order`, `id`, `active_alerts`.  
  So a client (or script) can legally send an update that includes `ai_reason` (or `ai_last_refined`) and the write will be allowed. That could be:
  - A modified or compromised client.
  - Another script/tool you run that uses the same Firebase project.
  - An old or external service still writing to Firestore.

### Recommendation

1. **Lock down bar documents in Firestore rules**  
   Add `ai_reason` and `ai_last_refined` to the list of keys that only admin can change, so normal clients cannot write them.

   In [firestore.rules](firestore.rules), in the `match /bars/{barId}` block, change the `hasAny([...])` list to include:

   - `ai_reason`
   - `ai_last_refined`

   Example (conceptually):  
   `hasAny(['historical_baseline', 'name', 'location', 'admin_override', 'display_order', 'id', 'active_alerts', 'ai_reason', 'ai_last_refined'])`

   Do the same for the generic `match /{collectionPath}/{venueId}` block under universities so food-joints (and any other venue type) are also protected.

2. **App behavior (already done)**  
   The app no longer displays `ai_reason`; it only shows the computed wait (e.g. 0–5m). Keep that. Deploy the new build so all users get it.

3. **Find the writer**  
   Since it’s not in this repo, check: other repos, one-off scripts, Firebase Console manual edits, or any third-party service that has Firestore write access. After tightening rules, delete `ai_reason` (and optionally `ai_last_refined`) from affected bar docs again; with the new rules, unauthorized writes to those fields will be rejected.

---

## 2. Firestore rules – Other notes

- **Admin emails** are hardcoded in [firestore.rules](firestore.rules) (e.g. `srikar@collegenightlive.com`, `jackson@collegenightlive.com`). This is normal for small teams; just ensure only trusted people have those accounts.

- **Typo / mismatch:** Rules use `historical_baseline` (singular); your data uses `historical_baselines` (plural). Consider adding `historical_baselines` to the forbidden list so only admin can change baseline data.

- **Bars:** Only `update` is allowed for non-admin; create/delete are admin-only. Good.

- **Intel posts:** `isClean()` blocks a set of toxic terms; `isRealUser()` and rate limiting are in place. Consider adding more slurs or hate terms if you see abuse.

---

## 3. API keys and secrets

- **Firebase client config** (apiKey, projectId, etc.) appears in:
  - [collegenightlive-mobile/lib/firebase.ts](collegenightlive-mobile/lib/firebase.ts)
  - [home.html](home.html)  
  Firebase API keys in client apps are not secret; they’re meant to be in the bundle. Restricting usage is done via Firestore/Auth rules and App Check, not by hiding the key.

- **ReCaptcha / App Check** key in [app.js](app.js) (`6Lf7E38sAAAAAK7MUJUtKneKqKuoUEgukfClJrt8`) is a site key and is expected to be public.

- **Service account key:** Correctly excluded via [.gitignore](.gitignore) (`serviceAccountKey.json`). Scripts ([ethyl_baseline.py](ethyl_baseline.py), [scripts/init_sly_alert_fields.py](scripts/init_sly_alert_fields.py), [seed_food.py](seed_food.py)) expect it on the machine, not in the repo. Never commit it.

- **GitHub Actions** use `FIREBASE_SERVICE_ACCOUNT_COLLEGE_BARS_LIVE` from repo secrets for deploy. Good.

---

## 4. Client updates to bars – Consistency and bugs

- **Mobile** [collegenightlive-mobile/app/(tabs)/index.tsx](collegenightlive-mobile/app/(tabs)/index.tsx):  
  Sends `recent_reports` (arrayUnion), `wait_time`, `last_updated`. Correct and consistent with the wait-time algorithm.

- **university.html** (root):  
  Sends `recent_reports` (arrayUnion), `wait_time`, `last_updated`. Correct.

- **www/university.html**:  
  `reportIntel` only sends `wait_time` and `last_updated`; it does **not** send `recent_reports`. So web vouches from that file don’t feed the same consensus model as mobile and root university.html. Recommend adding `recent_reports: firebase.firestore.FieldValue.arrayUnion({ value: parseInt(newTime), timestamp: firebase.firestore.Timestamp.now(), user: auth.currentUser.uid })` to the update so behavior matches.

- **app.js**:  
  - Uses university id `"osu"` in path `universities/osu/bars/...`. Your Firestore and other UIs use `"ohio-state"`. So vouches from this app hit a different (or non-existent) document unless you have an `osu` university doc.  
  - Updates only `wait_time` and `total_historical_reports` (increment). No `recent_reports` or `last_updated`. So it doesn’t match the rest of the app’s schema or algorithm.  
  Recommend: use `ohio-state` and the same update shape as university.html (wait_time, last_updated, recent_reports) if this script is still in use.

---

## 5. Cloud Functions

- **deleteUserData:** Verifies user via context or idToken, then deletes map_reports, safety_beacons, bar `recent_reports` entries for that user, and the Auth account. No `ai_reason` or bar doc fields other than `recent_reports` are touched. Good.

- **submitAlertVote / onAlertVoteCreated:** Only read/write `active_alerts` and user cooldown fields. No `ai_reason`. Good.

- **sendSafetyBeacon:** Writes to `safety_beacons`. No bar writes. Good.

- Comment at end of [functions/index.js](functions/index.js): *"All AI-based 'predictVenueWait' triggers have been removed."* So no function in this repo is writing `ai_reason`; the bad content is from elsewhere (see §1).

---

## 6. Auth and callables

- Mobile uses **anonymous auth** and [lib/callableWithToken.ts](collegenightlive-mobile/lib/callableWithToken.ts) to send the idToken to callables. Functions use `getUidFromCallableContext` (context.auth or idToken). Consistent and appropriate.

- Web (university.html, www) uses **signed-in users** and direct Firestore updates from the client; no callable for vouching. Allowed by current rules.

---

## 7. Summary and action items

| Priority | Action |
|----------|--------|
| High | Add `ai_reason` and `ai_last_refined` to the Firestore rules forbidden list for bar (and venue) updates so only admin can write them. Then re-delete those fields from affected docs. |
| High | Track down what is writing `ai_reason` (other repo, script, or service with Firestore access). |
| Medium | In [firestore.rules](firestore.rules), add `historical_baselines` to the protected keys if you want only admin to change baselines; fix the singular `historical_baseline` if you use it. |
| Medium | In [www/university.html](www/university.html), add `recent_reports` to the bar update in `reportIntel` so web vouches match mobile and the algorithm. |
| Low | In [app.js](app.js), switch university id from `"osu"` to `"ohio-state"` and align bar update with university.html (wait_time, last_updated, recent_reports) if that script is still used. |

---

*This review is a snapshot of the codebase. Re-run checks after major changes or before releases.*
