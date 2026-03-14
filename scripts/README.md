# Scripts

## init_sly_alert_fields.py

Adds `active_alerts: []` to every bar document in Firestore so the Sly alert system can display and update alerts without missing fields.

### 1. Get a service account key

1. Firebase Console → **Project settings** (gear) → **Service accounts**.
2. Click **Generate new private key** and save the JSON file somewhere safe (e.g. `serviceAccountKey.json` in this folder — **do not commit it**).

### 2. Install dependency

```bash
pip install -r scripts/requirements.txt
```

Or:

```bash
pip install google-cloud-firestore
```

### 3. Run the script

From the **project root** (College Bar Wait Times):

**Option A — environment variable**

```bash
set GOOGLE_APPLICATION_CREDENTIALS=path\to\serviceAccountKey.json
python scripts/init_sly_alert_fields.py
```

**Option B — argument**

```bash
python scripts/init_sly_alert_fields.py path\to\serviceAccountKey.json
```

**Dry run (no writes):**

```bash
python scripts/init_sly_alert_fields.py path\to\serviceAccountKey.json --dry-run
```

### 4. Deploy rules and index

After the script has run, deploy Firestore rules and indexes (see **FIRESTORE_INDEX_SETUP.md** in the project root).
