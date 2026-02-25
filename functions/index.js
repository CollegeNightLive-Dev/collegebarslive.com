const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

/**
 * SAFETY BEACON SYSTEM
 * This handles the emergency alerts sent by students.
 * It is NOT connected to Gemini and does not cost AI fees.
 */
exports.sendSafetyBeacon = functions.https.onCall(async (data, context) => {
    // 1. Security Check: Must be logged in
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated', 
            'Only authenticated students can trigger beacons.'
        );
    }

    const { type, location, battery } = data;
    const uid = context.auth.uid;
    const userName = context.auth.token.name || "A Student";

    console.log(`Safety Beacon [${type}] triggered by ${userName} (${uid})`);

    try {
        // 2. Log the beacon to Firestore for audit/emergency tracking
        await admin.firestore().collection("safety_beacons").add({
            uid: uid,
            userName: userName,
            type: type,
            location: location,
            battery: battery,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: "active"
        });

        return { success: true, message: "Beacon successfully broadcasted to your circle." };
    } catch (error) {
        console.error("Beacon Failure:", error);
        throw new functions.https.HttpsError('internal', 'Failed to send beacon.');
    }
});

// NOTE: All AI-based 'predictVenueWait' triggers have been removed.
// Wait times are now handled by the Mathematical Vouch model in the frontend.