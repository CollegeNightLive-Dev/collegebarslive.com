const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();

// This is the new v2 way to trigger a function
exports.processintel = onDocumentCreated("reports/{reportId}", async (event) => {
    const newReport = event.data.data(); // Note: 'event.data' replaces 'snap'
    const barId = newReport.bar_id;

    const reportsRef = admin.firestore().collection('reports');
    const snapshot = await reportsRef
        .where('bar_id', '==', barId)
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    if (snapshot.empty) return null;

    let totalWait = 0;
    snapshot.forEach(doc => {
        totalWait += doc.data().wait_time;
    });

    const calculatedWait = Math.round(totalWait / snapshot.size);
    console.log(`Updating ${barId} to ${calculatedWait} minutes.`);

    return admin.firestore()
        .collection('universities')
        .doc('ohio-state')
        .collection('bars')
        .doc(barId)
        .update({
            wait_time: calculatedWait,
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        });
});