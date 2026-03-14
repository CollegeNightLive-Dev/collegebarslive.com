const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const ALERT_CONFIG = {
  vibe: { threshold: 1, windowMinutes: 0, lifespanMinutes: 5 },
  fire_music: { threshold: 1, windowMinutes: 0, lifespanMinutes: 5 },
  dead: { threshold: 3, windowMinutes: 15, lifespanMinutes: 15 },
  strict_bouncer: { threshold: 3, windowMinutes: 5, lifespanMinutes: 30 },
  security: {
    threshold: 7,
    windowMinutes: 15,
    lifespanMinutes: 30,
    cooldownField: "undercoverCooldownUntil",
  },
  ambulance: {
    threshold: 2,
    windowMinutes: 5,
    lifespanMinutes: 10,
    cooldownField: "creepCooldownUntil",
  },
};

function getNow() {
  return admin.firestore.Timestamp.now();
}

/**
 * Resolve uid from callable context or from idToken in request body (React Native fallback).
 * Accepts _idToken from data._idToken or data.data._idToken (2nd gen may wrap payload).
 */
async function getUidFromCallableContext(data, context) {
  if (context.auth && context.auth.uid) {
    return context.auth.uid;
  }
  const raw = data || {};
  const idToken =
    (typeof raw._idToken === "string" && raw._idToken) ||
    (raw.data && typeof raw.data._idToken === "string" && raw.data._idToken) ||
    null;
  if (!idToken) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be signed in.",
    );
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (e) {
    console.warn("verifyIdToken failed:", e && e.message);
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Invalid or expired sign-in. Please try again.",
    );
  }
}

/**
 * SAFETY BEACON SYSTEM
 * This handles the emergency alerts sent by students.
 * It is NOT connected to Gemini and does not cost AI fees.
 */
exports.sendSafetyBeacon = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Only authenticated students can trigger beacons.",
    );
  }

  const { type, location, battery } = data;
  const uid = context.auth.uid;
  const userName = context.auth.token.name || "A Student";

  console.log(`Safety Beacon [${type}] triggered by ${userName} (${uid})`);

  try {
    await admin.firestore().collection("safety_beacons").add({
      uid,
      userName,
      type,
      location,
      battery,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: "active",
    });

    return { success: true, message: "Beacon successfully broadcasted to your circle." };
  } catch (error) {
    console.error("Beacon Failure:", error);
    throw new functions.https.HttpsError("internal", "Failed to send beacon.");
  }
});

/**
 * DELETE USER DATA (App Store Guideline 5.1.1(v))
 * Callable function to delete all Firestore data for the user and the Firebase Auth account.
 * Client calls this then signs in anonymously again (no client-side deleteUser to avoid requires-recent-login).
 */
exports.deleteUserData = functions.https.onCall(async (data, context) => {
  const uid = await getUidFromCallableContext(data || {}, context);
  const db = admin.firestore();
  const BATCH_SIZE = 500;

  try {
    const mapReportsSnap = await db.collection("map_reports").where("uid", "==", uid).get();
    for (let i = 0; i < mapReportsSnap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = mapReportsSnap.docs.slice(i, i + BATCH_SIZE);
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    const beaconsSnap = await db.collection("safety_beacons").where("uid", "==", uid).get();
    for (let i = 0; i < beaconsSnap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = beaconsSnap.docs.slice(i, i + BATCH_SIZE);
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    const universitiesSnap = await db.collection("universities").listDocuments();
    for (const uniRef of universitiesSnap) {
      const barsSnap = await uniRef.collection("bars").get();
      for (const barDoc of barsSnap.docs) {
        const data = barDoc.data();
        const recentReports = data.recent_reports || [];
        const filtered = recentReports.filter((r) => r.user !== uid);
        if (filtered.length !== recentReports.length) {
          await barDoc.ref.update({ recent_reports: filtered });
        }
      }
    }

    await admin.auth().deleteUser(uid);

    return { success: true };
  } catch (err) {
    console.error("deleteUserData failed:", err);
    throw new functions.https.HttpsError("internal", "Failed to delete user data.");
  }
});

/**
 * Sly alert vote system for bar-scoped alerts.
 * Enforces thresholds, time windows, lifespans, and 20-minute cooldowns.
 */
exports.submitAlertVote = functions.https.onCall(async (data, context) => {
  const uid = await getUidFromCallableContext(data || {}, context);
  const payload = data || {};
  const { schoolId, barId, type } = payload;
  // _idToken was only for auth; do not use it in business logic

  if (!schoolId || !barId || typeof schoolId !== "string" || typeof barId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing or invalid schoolId or barId.",
    );
  }

  if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(ALERT_CONFIG, type)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid alert type.");
  }

  const config = ALERT_CONFIG[type];
  const db = admin.firestore();
  const now = getNow();

  try {
    // Cooldown for undercover / creep
    if (config.cooldownField) {
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const cooldownUntil = userData && userData[config.cooldownField];
      if (cooldownUntil && cooldownUntil.toMillis() > now.toMillis()) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "You recently reported this. Try again in a few minutes.",
        );
      }
    }

    const barRef = db
      .collection("universities")
      .doc(schoolId)
      .collection("bars")
      .doc(barId);

    const votesRef = barRef.collection("alert_votes");

    await votesRef.add({
      type,
      uid,
      createdAt: now,
    });

    let countInWindow = 1;
    const windowMinutes = config.windowMinutes || 0;
    if (windowMinutes > 0) {
      const cutoff = new admin.firestore.Timestamp(
        Math.floor((now.toMillis() - windowMinutes * 60 * 1000) / 1000),
        0,
      );
      const snap = await votesRef
        .where("type", "==", type)
        .where("createdAt", ">=", cutoff)
        .orderBy("createdAt", "desc")
        .get();
      countInWindow = snap.size;
    }

    const barSnap = await barRef.get();
    if (!barSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Bar not found.");
    }

    const barData = barSnap.data() || {};
    const existingAlerts = Array.isArray(barData.active_alerts) ? barData.active_alerts : [];

    const freshAlerts = existingAlerts.filter((a) => {
      if (!a || !a.expiresAt || typeof a.expiresAt.toMillis !== "function") return false;
      return a.expiresAt.toMillis() > now.toMillis();
    });

    if (countInWindow >= config.threshold) {
      const activatedAt = now;
      const expiresAt = new admin.firestore.Timestamp(
        Math.floor((now.toMillis() + config.lifespanMinutes * 60 * 1000) / 1000),
        0,
      );

      const others = freshAlerts.filter((a) => a.type !== type);
      const updatedForType = {
        type,
        activatedAt,
        expiresAt,
        countInWindow,
      };
      freshAlerts.splice(0, freshAlerts.length, ...others, updatedForType);
    }

    const updates = { active_alerts: freshAlerts };

    if (config.cooldownField) {
      const cooldownUntil = new admin.firestore.Timestamp(
        Math.floor((now.toMillis() + 20 * 60 * 1000) / 1000),
        0,
      );
      updates[`users.${uid}.${config.cooldownField}`] = cooldownUntil;
      const userRef = db.collection("users").doc(uid);
      await userRef.set({ [config.cooldownField]: cooldownUntil }, { merge: true });
    }

    await barRef.update({ active_alerts: freshAlerts });

    return {
      success: true,
      type,
      countInWindow,
      threshold: config.threshold,
    };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    console.error("submitAlertVote failed:", err);
    throw new functions.https.HttpsError("internal", "Failed to submit alert vote.");
  }
});

/**
 * When a client adds an alert vote doc to a bar (same pattern as wait time),
 * run threshold + cooldown logic and update the bar's active_alerts.
 */
exports.onAlertVoteCreated = functions.firestore.onDocumentCreated(
  "universities/{schoolId}/bars/{barId}/alert_votes/{voteId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const { schoolId, barId } = event.params;
    const data = snap.data() || {};
    const type = data.type;
    const uid = data.uid;
    const createdAt = data.createdAt;

    if (!type || !uid || !Object.prototype.hasOwnProperty.call(ALERT_CONFIG, type)) {
      return;
    }

    const config = ALERT_CONFIG[type];
    const db = admin.firestore();
    const now = createdAt && typeof createdAt.toMillis === "function" ? createdAt : getNow();
    const nowMs = typeof now.toMillis === "function" ? now.toMillis() : Date.now();

    const barRef = db.collection("universities").doc(schoolId).collection("bars").doc(barId);
    const votesRef = barRef.collection("alert_votes");

    if (config.cooldownField) {
      const userRef = db.collection("users").doc(uid);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const cooldownUntil = userData && userData[config.cooldownField];
      if (cooldownUntil && cooldownUntil.toMillis() > nowMs) {
        await event.data.ref.delete();
        return;
      }
    }

    let countInWindow = 1;
    const windowMinutes = config.windowMinutes || 0;
    if (windowMinutes > 0) {
      const cutoff = admin.firestore.Timestamp.fromMillis(nowMs - windowMinutes * 60 * 1000);
      const snapQ = await votesRef
        .where("type", "==", type)
        .where("createdAt", ">=", cutoff)
        .get();
      countInWindow = snapQ.size;
    }

    const barSnap = await barRef.get();
    if (!barSnap.exists) return;

    const barData = barSnap.data() || {};
    const existingAlerts = Array.isArray(barData.active_alerts) ? barData.active_alerts : [];
    const freshAlerts = existingAlerts.filter((a) => {
      if (!a || !a.expiresAt || typeof a.expiresAt.toMillis !== "function") return false;
      return a.expiresAt.toMillis() > nowMs;
    });

    if (countInWindow >= config.threshold) {
      const activatedAt = admin.firestore.Timestamp.fromMillis(nowMs);
      const expiresAt = admin.firestore.Timestamp.fromMillis(
        nowMs + config.lifespanMinutes * 60 * 1000,
      );
      const others = freshAlerts.filter((a) => a.type !== type);
      freshAlerts.length = 0;
      freshAlerts.push(...others, { type, activatedAt, expiresAt, countInWindow });
    }

    await barRef.update({ active_alerts: freshAlerts });

    if (config.cooldownField) {
      const cooldownUntil = admin.firestore.Timestamp.fromMillis(nowMs + 20 * 60 * 1000);
      await db.collection("users").doc(uid).set({ [config.cooldownField]: cooldownUntil }, { merge: true });
    }
  }
);

// NOTE: All AI-based 'predictVenueWait' triggers have been removed.
// Wait times are now handled by the Mathematical Vouch model in the frontend.