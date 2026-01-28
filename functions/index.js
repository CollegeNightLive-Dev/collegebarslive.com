const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("firebase-functions/logger");

admin.initializeApp();

// Link the secret key you set in the terminal [cite: 2026-01-25]
const geminiKey = defineSecret('GEMINI_API_KEY');

exports.processintel = onDocumentCreated({
    document: "reports/{reportId}",
    secrets: [geminiKey] 
}, async (event) => {
    const newReport = event.data.data();
    const barId = newReport.bar_id;

    logger.info(`Processing report for: ${barId}`);

    try {
        // Initialize Gemini inside the trigger [cite: 2026-01-25]
        const genAI = new GoogleGenerativeAI(geminiKey.value());
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 1. Fetch the last 10 reports to give Gemini context
        const snapshot = await admin.firestore().collection('reports')
            .where('bar_id', '==', barId)
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();

        if (snapshot.empty) {
            logger.info("No reports found for this bar.");
            return null;
        }

        let history = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            const time = data.timestamp ? data.timestamp.toDate().toLocaleTimeString() : "Now";
            history += `- ${data.wait_time} min report at ${time}\n`;
        });

        // 2. The AI prompt that prevents trolling [cite: 2026-01-25]
        const prompt = `You are an AI bar analyst for Ohio State. 
        Current reports for ${barId}:
        ${history}
        
        Analyze these reports. Ignore obvious outliers (trolls). 
        Based on recency and consistency, determine the most accurate wait time.
        Return ONLY the integer (number) and nothing else.`;

        // 3. Get the decision from Gemini
        const result = await model.generateContent(prompt);
        const aiResponse = result.response.text().trim();
        const finalWaitTime = parseInt(aiResponse);

        if (isNaN(finalWaitTime)) {
            logger.error(`Gemini returned an invalid value: ${aiResponse}`);
            return null;
        }

        logger.info(`Gemini Analysis Complete: ${barId} is now ${finalWaitTime}m.`);

        // 4. Update the LIVE bar in the universities collection
        // Check both 'bars' and 'food-joints' subcollections
        const barRef = admin.firestore().collection('universities').doc('ohio-state').collection('bars').doc(barId);
        const foodRef = admin.firestore().collection('universities').doc('ohio-state').collection('food-joints').doc(barId);

        const barDoc = await barRef.get();
        const targetRef = barDoc.exists ? barRef : foodRef;

        return await targetRef.update({
            wait_time: finalWaitTime,
            verified_reports: snapshot.size,
            last_updated: admin.firestore.FieldValue.serverTimestamp()
        });

    } catch (error) {
        logger.error("Error in Gemini Brain:", error);
        return null;
    }
});