// final index.js - jan 30 (Always-Warm Multi-Campus Refinery)
// © 2026 Srikar Konda & Jackson Stevenson 

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require('firebase-functions/params'); 
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!admin.apps.length) { admin.initializeApp(); }

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

let genAI;
let model;

const initializeAI = () => {
    if (!genAI) {
        const apiValue = GEMINI_API_KEY.value();
        genAI = new GoogleGenerativeAI(apiValue);
        // --- 🚀 SPEED OPTIMIZATION: REMOVED SEARCH TOOL ---
        model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash" 
        });
    }
};

const getRecentIntelCount = (timestamps) => {
    if (!timestamps || !Array.isArray(timestamps)) return 0;
    const tenMinsAgo = Date.now() - (10 * 60 * 1000);
    return timestamps.filter(ts => {
        const ms = ts.toMillis ? ts.toMillis() : ts;
        return ms > tenMinsAgo;
    }).length;
};

// --- 🏗️ THE RANGE ROVER CONFIGURATION ---
exports.predictVenueWait = onDocumentUpdated({ 
    document: "universities/{uniId}/{collectionId}/{venueId}",
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
    memory: "256MiB",
    minInstances: 1, // THE PILOT LIGHT: Keeps it "Hot" 24/7 for instant updates
    maxInstances: 10 // THE GOVERNOR: Prevents runaway costs
}, async (event) => {
    const newData = event.data.after.data();
    if (newData.status !== "Refining") return null;

    const venueRef = event.data.after.ref;

    try {
        // --- 🏗️ THE BUFFER TANK (CACHING) ---
        const lastRefined = newData.ai_last_refined?.toMillis() || 0;
        const cacheWindow = 5 * 60 * 1000; 
        
        if (Date.now() - lastRefined < cacheWindow) {
            return venueRef.update({
                status: "AI-Verified",
                ai_reason: (newData.ai_reason || "Intel remains steady.") + " (Buffered)"
            });
        }

        initializeAI();
        const { uniId, collectionId } = event.params; 
        const rollingIntelCount = getRecentIntelCount(newData.verification_timestamps);
        const currentTime = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
        
        const lastUpdated = newData.last_updated?.toMillis() || Date.now();
        const minutesSinceUpdate = (Date.now() - lastUpdated) / (1000 * 60);
        const gravityFactor = Math.floor(minutesSinceUpdate / 15) * 10;
        const decayedWait = Math.max(0, (newData.wait_time || 0) - gravityFactor);

        // --- 🚀 SPEED OPTIMIZATION: REMOVED "SEARCH TASK" FROM PROMPT ---
        const prompt = `
        ACT AS: Expert analyst for ${uniId.toUpperCase()}. 
        CONTEXT: ${newData.name} at ${currentTime}.
        
        DATA:
        - Input: ${newData.wait_time}m
        - Decay: ${decayedWait}m
        - Verifications: ${rollingIntelCount} (10m)

        TASK: Refine wait time based on decay and volume. Do not search. 
        Return ONLY JSON: {"prediction": number, "reason": "string"}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().replace(/```json|```/g, "").trim();
        
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Invalid Signal: No JSON found");
        const aiData = JSON.parse(jsonMatch[0]);

        await venueRef.update({
            predicted_wait: aiData.prediction ?? 0,
            ai_reason: aiData.reason || "Internal logic refinement.",
            status: "AI-Verified",
            ai_last_refined: admin.firestore.FieldValue.serverTimestamp()
        });

    } catch (error) {
        console.error("Refinery Process Error:", error);
        await venueRef.update({ 
            status: "AI-Error", 
            ai_reason: "Refinery throughput limit reached. Displaying user intel."
        });
    }
    return null;
});