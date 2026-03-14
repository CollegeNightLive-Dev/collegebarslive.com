# Firestore index for Sly alerts

The Sly alert system needs one composite index so the Cloud Function can query "votes of type X in the last N minutes" per bar.

## Option A: Deploy with Firebase CLI (recommended)

1. Make sure you have [Firebase CLI](https://firebase.google.com/docs/cli) installed and are logged in:
   ```bash
   firebase login
   ```

2. In your project root (where `firestore.rules` and this file live), ensure you have a `firebase.json` that configures Firestore. If you don’t, create one:
   ```json
   {
     "firestore": {
       "rules": "firestore.rules",
       "indexes": "firestore.indexes.json"
     }
   }
   ```

3. Deploy only the indexes (and optionally rules):
   ```bash
   firebase deploy --only firestore:indexes
   ```
   To deploy rules as well:
   ```bash
   firebase deploy --only firestore
   ```

4. In the Firebase Console, open **Firestore → Indexes**. The new index may show as “Building” for a few minutes.

---

## Option B: Create the index in Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com) → your project **College Bars Live** → **Firestore Database** → **Indexes** tab.

2. Click **Create index**.

3. Configure:
   - **Collection ID:** `alert_votes`  
   - **Query scope:** Collection (not Collection group).
   - **Fields:**
     - `type` — Ascending  
     - `createdAt` — Descending  

4. Click **Create**. Wait until the index status is **Enabled**.

---

## What this index is for

The Cloud Function `submitAlertVote` will query each bar’s `alert_votes` subcollection like this:

- **Collection path:** `universities/{schoolId}/bars/{barId}/alert_votes`
- **Filter:** `type == 'security'` (or the chosen alert type)
- **Filter:** `createdAt >= cutoffTimestamp` (e.g. 15 minutes ago)
- **Order by:** `createdAt` descending (optional, for “latest first”)

The composite index on `type` (asc) and `createdAt` (desc) makes these queries efficient.
