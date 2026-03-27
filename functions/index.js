const functions = require("firebase-functions");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { Expo } = require("expo-server-sdk");
admin.initializeApp();
const expo = new Expo();

/** Deployed from functions/.env — quote values that contain # (e.g. ADMIN_BAR_OVERRIDE_SECRET="#Chicken2024"). */
const adminBarOverrideSecret = defineString("ADMIN_BAR_OVERRIDE_SECRET");
const adminPushSecret = defineString("ADMIN_PUSH_SECRET");

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

function toMillisSafe(tsLike) {
  if (tsLike && typeof tsLike.toMillis === "function") return tsLike.toMillis();
  return 0;
}

const WEEKEND_DAYS = ["thu", "fri", "sat"];

function buildFloorKey(dormId, floor) {
  return `${dormId}__${floor}`;
}

async function recomputeThisWeekFloorAggregate(db, schoolId, weekKey, dormId, floor) {
  if (!dormId || typeof dormId !== "string" || typeof floor !== "number") return;

  const votesRef = db
    .collection("universities")
    .doc(schoolId)
    .collection("this_week_polls")
    .doc(weekKey)
    .collection("votes");

  const votesSnap = await votesRef
    .where("voterDormId", "==", dormId)
    .where("voterFloor", "==", floor)
    .get();

  const dayState = {
    thu: { totalVotes: 0, uniqueSet: new Set(), barVotes: {} },
    fri: { totalVotes: 0, uniqueSet: new Set(), barVotes: {} },
    sat: { totalVotes: 0, uniqueSet: new Set(), barVotes: {} },
  };

  for (const d of votesSnap.docs) {
    const data = d.data() || {};
    const byDay = data.byDay || {};
    for (const day of WEEKEND_DAYS) {
      const barId = byDay[day];
      if (!barId || typeof barId !== "string") continue;
      dayState[day].totalVotes += 1;
      dayState[day].uniqueSet.add(d.id);
      dayState[day].barVotes[barId] = (dayState[day].barVotes[barId] || 0) + 1;
    }
  }

  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const usersSnap = await db
    .collection("users")
    .where("schoolId", "==", schoolId)
    .where("dormId", "==", dormId)
    .where("floor", "==", floor)
    .where("lastActiveAt", ">=", cutoff)
    .get();

  const aggregateRef = db
    .collection("universities")
    .doc(schoolId)
    .collection("this_week_aggregates")
    .doc(weekKey)
    .collection("floors")
    .doc(buildFloorKey(dormId, floor));

  await aggregateRef.set(
    {
      dormId,
      floor,
      active30DayPopulation: usersSnap.size,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      days: {
        thu: {
          totalVotes: dayState.thu.totalVotes,
          uniqueVoters: dayState.thu.uniqueSet.size,
          barVotes: dayState.thu.barVotes,
        },
        fri: {
          totalVotes: dayState.fri.totalVotes,
          uniqueVoters: dayState.fri.uniqueSet.size,
          barVotes: dayState.fri.barVotes,
        },
        sat: {
          totalVotes: dayState.sat.totalVotes,
          uniqueVoters: dayState.sat.uniqueSet.size,
          barVotes: dayState.sat.barVotes,
        },
      },
    },
  );
}

/**
 * Callable v2: request.auth + request.data._idToken (React Native fallback).
 */
async function getUidFromCallableRequest(request) {
  if (request.auth && request.auth.uid) {
    return request.auth.uid;
  }
  const raw = request.data || {};
  const idToken =
    (typeof raw._idToken === "string" && raw._idToken) ||
    (raw.data && typeof raw.data._idToken === "string" && raw.data._idToken) ||
    null;
  if (!idToken) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (e) {
    console.warn("verifyIdToken failed:", e && e.message);
    throw new HttpsError("unauthenticated", "Invalid or expired sign-in. Please try again.");
  }
}

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
    /** @type {Map<string, { schoolId: string; weekKey: string; dormId: string; floor: number }>} */
    const floorsToRecompute = new Map();

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

      // Remove This Week vote docs for this user and track affected floor aggregates.
      const pollsSnap = await uniRef.collection("this_week_polls").get();
      for (const pollDoc of pollsSnap.docs) {
        const voteRef = pollDoc.ref.collection("votes").doc(uid);
        const voteSnap = await voteRef.get();
        if (!voteSnap.exists) continue;

        const voteData = voteSnap.data() || {};
        const dormId = voteData.voterDormId;
        const floor = voteData.voterFloor;
        if (typeof dormId === "string" && typeof floor === "number") {
          const key = `${uniRef.id}|${pollDoc.id}|${dormId}|${floor}`;
          floorsToRecompute.set(key, {
            schoolId: uniRef.id,
            weekKey: pollDoc.id,
            dormId,
            floor,
          });
        }
        await voteRef.delete();
      }
    }

    // Remove user profile document so active floor population updates correctly.
    await db.collection("users").doc(uid).delete().catch(() => {});

    // Recompute all affected floor aggregates after vote/profile removal.
    for (const item of floorsToRecompute.values()) {
      await recomputeThisWeekFloorAggregate(
        db,
        item.schoolId,
        item.weekKey,
        item.dormId,
        item.floor,
      );
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

/**
 * Recompute floor-level This Week aggregates whenever a vote doc changes.
 * This keeps client reads privacy-safe (no direct users collection query).
 */
exports.onThisWeekVoteWritten = functions.firestore.onDocumentWritten(
  "universities/{schoolId}/this_week_polls/{weekKey}/votes/{uid}",
  async (event) => {
    const { schoolId, weekKey } = event.params;
    const before = event.data.before.exists ? event.data.before.data() : null;
    const after = event.data.after.exists ? event.data.after.data() : null;

    const keysToRecompute = new Map();
    const addKey = (dormId, floor) => {
      if (!dormId || typeof dormId !== "string" || typeof floor !== "number") return;
      keysToRecompute.set(buildFloorKey(dormId, floor), { dormId, floor });
    };

    addKey(before && before.voterDormId, before && before.voterFloor);
    addKey(after && after.voterDormId, after && after.voterFloor);

    const db = admin.firestore();
    for (const entry of keysToRecompute.values()) {
      await recomputeThisWeekFloorAggregate(db, schoolId, weekKey, entry.dormId, entry.floor);
    }
  },
);

/**
 * Per-user feedback on active bar alert icons:
 * - still_here: +1 minute globally, 15-minute per-user cooldown per bar/type
 * - gone: -1 minute globally and hide icon for acting user only
 */
exports.submitBarAlertFeedback = onCall({ region: "us-central1" }, async (request) => {
  const uid = await getUidFromCallableRequest(request);
  const payload = request.data || {};
  const { schoolId, barId, type, action } = payload;
  if (!schoolId || !barId || typeof schoolId !== "string" || typeof barId !== "string") {
    throw new HttpsError("invalid-argument", "Missing or invalid schoolId or barId.");
  }
  if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(ALERT_CONFIG, type)) {
    throw new HttpsError("invalid-argument", "Invalid alert type.");
  }
  if (action !== "still_here" && action !== "gone") {
    throw new HttpsError("invalid-argument", "Invalid action.");
  }

  const db = admin.firestore();
  const nowMs = Date.now();
  const key = `${schoolId}:${barId}:${type}`;
  const cooldownDurationMs = 15 * 60 * 1000;
  const minuteMs = 60 * 1000;
  const barRef = db.collection("universities").doc(schoolId).collection("bars").doc(barId);
  const userRef = db.collection("users").doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const [barSnap, userSnap] = await Promise.all([tx.get(barRef), tx.get(userRef)]);
    if (!barSnap.exists) throw new HttpsError("not-found", "Bar not found.");

    const barData = barSnap.data() || {};
    const existingAlerts = Array.isArray(barData.active_alerts) ? barData.active_alerts : [];
    const freshAlerts = existingAlerts.filter((a) => toMillisSafe(a && a.expiresAt) > nowMs);
    const targetIndex = freshAlerts.findIndex((a) => a && a.type === type);
    if (targetIndex < 0) {
      throw new HttpsError("failed-precondition", "This icon is no longer active.");
    }

    const userData = userSnap.exists ? (userSnap.data() || {}) : {};
    const rawCooldowns = userData.barAlertStillHereCooldowns || {};
    const rawHidden = userData.hiddenBarAlerts || {};
    /** @type {Record<string, admin.firestore.Timestamp>} */
    const cooldowns = {};
    /** @type {Record<string, admin.firestore.Timestamp>} */
    const hidden = {};
    for (const [k, v] of Object.entries(rawCooldowns)) {
      const ms = toMillisSafe(v);
      if (ms > nowMs) cooldowns[k] = admin.firestore.Timestamp.fromMillis(ms);
    }
    for (const [k, v] of Object.entries(rawHidden)) {
      const ms = toMillisSafe(v);
      if (ms > nowMs) hidden[k] = admin.firestore.Timestamp.fromMillis(ms);
    }

    const target = freshAlerts[targetIndex];
    const targetExpMs = toMillisSafe(target.expiresAt);

    let nextExpMs = targetExpMs;
    let removed = false;
    let cooldownUntilMs = null;
    let hiddenUntilMs = null;

    if (action === "still_here") {
      const cooldownUntil = toMillisSafe(cooldowns[key]);
      if (cooldownUntil > nowMs) {
        const mins = Math.ceil((cooldownUntil - nowMs) / minuteMs);
        throw new HttpsError(
          "failed-precondition",
          `You can use Still Here again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
        );
      }
      nextExpMs = targetExpMs + minuteMs;
      target.expiresAt = admin.firestore.Timestamp.fromMillis(nextExpMs);
      cooldownUntilMs = nowMs + cooldownDurationMs;
      cooldowns[key] = admin.firestore.Timestamp.fromMillis(cooldownUntilMs);
      delete hidden[key];
    } else {
      nextExpMs = targetExpMs - minuteMs;
      if (nextExpMs <= nowMs) {
        freshAlerts.splice(targetIndex, 1);
        removed = true;
      } else {
        target.expiresAt = admin.firestore.Timestamp.fromMillis(nextExpMs);
      }
      hiddenUntilMs = Math.max(nowMs, nextExpMs);
      hidden[key] = admin.firestore.Timestamp.fromMillis(hiddenUntilMs);
    }

    tx.update(barRef, { active_alerts: freshAlerts });
    tx.set(
      userRef,
      { barAlertStillHereCooldowns: cooldowns, hiddenBarAlerts: hidden },
      { merge: true },
    );

    return { removed, expiresAtMs: removed ? nowMs : nextExpMs, cooldownUntilMs, hiddenUntilMs };
  });

  return { success: true, action, ...result };
});

/**
 * Admin-only: set timed override for wait minutes and/or bar alert icons (15 min TTL).
 * v2 callable — secret from functions/.env ADMIN_BAR_OVERRIDE_SECRET (quote if value contains #).
 */
exports.setAdminBarOverride = onCall({ region: "us-central1" }, async (request) => {
  await getUidFromCallableRequest(request);
  const payload = request.data || {};
  const { schoolId, barId, adminSecret, waitMinutes, iconTypes, clear } = payload;

  const configuredSecret = adminBarOverrideSecret.value().trim();
  if (!configuredSecret) {
    throw new HttpsError(
      "failed-precondition",
      "Server admin secret is not configured. Add ADMIN_BAR_OVERRIDE_SECRET to functions/.env (quote if it contains #) and run firebase deploy --only functions.",
    );
  }
  if (typeof adminSecret !== "string" || adminSecret !== configuredSecret) {
    throw new HttpsError("permission-denied", "Invalid or missing admin secret.");
  }

  if (!schoolId || !barId || typeof schoolId !== "string" || typeof barId !== "string") {
    throw new HttpsError("invalid-argument", "Missing or invalid schoolId or barId.");
  }

  const db = admin.firestore();
  const barRef = db.collection("universities").doc(schoolId).collection("bars").doc(barId);

  if (clear === true) {
    const snap = await barRef.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Bar not found.");
    }
    await barRef.update({ admin_bar_override: admin.firestore.FieldValue.delete() });
    return { success: true, cleared: true };
  }

  const hasWait = typeof waitMinutes === "number";
  const hasIcons = Array.isArray(iconTypes) && iconTypes.length > 0;
  if (!hasWait && !hasIcons) {
    throw new HttpsError("invalid-argument", "Provide waitMinutes and/or iconTypes, or clear: true.");
  }

  if (hasWait && (waitMinutes < 0 || waitMinutes > 120)) {
    throw new HttpsError("invalid-argument", "waitMinutes must be between 0 and 120.");
  }

  const barSnap = await barRef.get();
  if (!barSnap.exists) {
    throw new HttpsError("not-found", "Bar not found.");
  }

  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 15 * 60 * 1000);
  /** @type {{ expiresAt: admin.firestore.Timestamp; waitMinutes?: number; iconTypes?: string[] }} */
  const override = { expiresAt };
  if (hasWait) override.waitMinutes = waitMinutes;
  if (hasIcons) {
    const filtered = iconTypes.filter(
      (t) => typeof t === "string" && Object.prototype.hasOwnProperty.call(ALERT_CONFIG, t),
    );
    if (filtered.length) override.iconTypes = filtered;
  }

  if (override.waitMinutes === undefined && !override.iconTypes) {
    throw new HttpsError("invalid-argument", "No valid wait or icon types after validation.");
  }

  await barRef.update({ admin_bar_override: override });
  return { success: true };
});

/**
 * Send a test push notification to the currently authenticated user.
 * Reads Expo tokens from users/{uid}/pushTokens and prunes invalid tokens.
 */
exports.sendTestPushToSelf = onCall({ region: "us-central1" }, async (request) => {
  const uid = await getUidFromCallableRequest(request);
  const payload = request.data || {};
  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : "Nyte Notification";
  const body = typeof payload.body === "string" && payload.body.trim()
    ? payload.body.trim()
    : "Push is now configured on this device.";
  const data = payload.data && typeof payload.data === "object" ? payload.data : { type: "test_push" };

  const db = admin.firestore();
  const tokensSnap = await db.collection("users").doc(uid).collection("pushTokens").get();
  const candidateTokens = tokensSnap.docs
    .map((d) => {
      const token = (d.data() || {}).token;
      return typeof token === "string" ? token : null;
    })
    .filter(Boolean);

  if (!candidateTokens.length) {
    throw new HttpsError("failed-precondition", "No push tokens found for this user.");
  }

  const validTokens = [];
  const refsToDelete = [];

  for (const token of candidateTokens) {
    if (Expo.isExpoPushToken(token)) {
      validTokens.push(token);
    } else {
      const badRef = db.collection("users").doc(uid).collection("pushTokens").doc(encodeURIComponent(token));
      refsToDelete.push(badRef);
    }
  }

  if (!validTokens.length) {
    throw new HttpsError("failed-precondition", "No valid Expo push tokens found for this user.");
  }

  const messages = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...chunkTickets);
  }

  // Remove tokens that Expo explicitly marks as unregistered.
  for (let i = 0; i < tickets.length; i += 1) {
    const ticket = tickets[i];
    const token = validTokens[i];
    if (
      ticket &&
      ticket.status === "error" &&
      ticket.details &&
      ticket.details.error === "DeviceNotRegistered"
    ) {
      const staleRef = db.collection("users").doc(uid).collection("pushTokens").doc(encodeURIComponent(token));
      refsToDelete.push(staleRef);
    }
  }

  if (refsToDelete.length) {
    const batch = db.batch();
    for (const ref of refsToDelete) batch.delete(ref);
    await batch.commit();
  }

  return {
    success: true,
    attempted: messages.length,
    ticketCount: tickets.length,
    prunedTokenCount: refsToDelete.length,
  };
});

/**
 * Web-admin: send manual push notifications by school (or single uid).
 * Auth is protected via ADMIN_PUSH_SECRET provided in request payload.
 */
exports.sendAdminPush = onCall({ region: "us-central1" }, async (request) => {
  const payload = request.data || {};
  const {
    adminSecret,
    schoolId,
    targetUid,
    title,
    body,
    data,
  } = payload;

  const configuredSecret = adminPushSecret.value().trim();
  if (!configuredSecret) {
    throw new HttpsError(
      "failed-precondition",
      "ADMIN_PUSH_SECRET is not configured on the server.",
    );
  }
  if (typeof adminSecret !== "string" || adminSecret !== configuredSecret) {
    throw new HttpsError("permission-denied", "Invalid admin secret.");
  }
  if (typeof title !== "string" || !title.trim() || typeof body !== "string" || !body.trim()) {
    throw new HttpsError("invalid-argument", "title and body are required.");
  }

  const db = admin.firestore();
  let userRefs = [];
  if (typeof targetUid === "string" && targetUid.trim()) {
    userRefs = [db.collection("users").doc(targetUid.trim())];
  } else {
    if (typeof schoolId !== "string" || !schoolId.trim()) {
      throw new HttpsError("invalid-argument", "schoolId is required when targetUid is not provided.");
    }
    const usersSnap = await db.collection("users").where("schoolId", "==", schoolId.trim()).get();
    userRefs = usersSnap.docs.map((d) => d.ref);
  }

  const validTokens = [];
  const refsToDelete = [];

  for (const userRef of userRefs) {
    const tokenSnap = await userRef.collection("pushTokens").get();
    for (const d of tokenSnap.docs) {
      const token = (d.data() || {}).token;
      if (typeof token !== "string") continue;
      if (Expo.isExpoPushToken(token)) {
        validTokens.push(token);
      } else {
        refsToDelete.push(d.ref);
      }
    }
  }

  // De-dupe tokens in case multiple docs/devices overlap.
  const uniqueTokens = Array.from(new Set(validTokens));
  if (!uniqueTokens.length) {
    throw new HttpsError("failed-precondition", "No valid Expo push tokens found for this audience.");
  }

  const pushData = data && typeof data === "object" ? data : {};
  const messages = uniqueTokens.map((token) => ({
    to: token,
    sound: "default",
    title: title.trim(),
    body: body.trim(),
    data: pushData,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...chunkTickets);
  }

  for (let i = 0; i < tickets.length; i += 1) {
    const ticket = tickets[i];
    const token = uniqueTokens[i];
    if (
      ticket &&
      ticket.status === "error" &&
      ticket.details &&
      ticket.details.error === "DeviceNotRegistered"
    ) {
      // Try to delete any matching token docs from queried audience.
      for (const userRef of userRefs) {
        refsToDelete.push(userRef.collection("pushTokens").doc(encodeURIComponent(token)));
      }
    }
  }

  if (refsToDelete.length) {
    const batch = db.batch();
    for (const ref of refsToDelete) batch.delete(ref);
    await batch.commit();
  }

  await db.collection("admin_push_sends").add({
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    schoolId: typeof schoolId === "string" ? schoolId : null,
    targetUid: typeof targetUid === "string" ? targetUid : null,
    title: title.trim(),
    body: body.trim(),
    attempted: messages.length,
    ticketCount: tickets.length,
    prunedTokenCount: refsToDelete.length,
  });

  return {
    success: true,
    attempted: messages.length,
    ticketCount: tickets.length,
    prunedTokenCount: refsToDelete.length,
  };
});

// NOTE: All AI-based 'predictVenueWait' triggers have been removed.
// Wait times are now handled by the Mathematical Vouch model in the frontend.