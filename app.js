// College Night Live - Main Application Brain
// Handles: Auth Listeners, Vouch Cooldowns, and UI States

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, updateDoc, increment } from "firebase/firestore";

const auth = getAuth();
const db = getFirestore();

/**
 * 1. THE AUTH OBSERVER (Kills the "Ghost Login" button)
 */
onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById('google-login-btn');
    const navProfile = document.getElementById('nav-profile');

    if (user) {
        if(loginBtn) loginBtn.style.display = 'none';
        if(navProfile) navProfile.style.display = 'block';
        console.log("Sovereign Auth: Secure");
    } else {
        if(loginBtn) loginBtn.style.display = 'block';
        if(navProfile) navProfile.style.display = 'none';
    }
});

/**
 * 2. THE VOUCH ENGINE (The 5-Minute Cool-down & Instant Feedback)
 */
window.submitVouch = async (venueId, waitMins) => {
    // Check for cooldown first
    const lastVouch = localStorage.getItem('vouch_timestamp');
    const now = Date.now();
    
    if (lastVouch && (now - lastVouch) < (5 * 60 * 1000)) {
        alert("Integrity Lock: You can vouch again in a few minutes.");
        return;
    }

    // INSTANT FEEDBACK: Hide buttons, show "Thank You"
    document.getElementById('vouch-actions').style.display = 'none';
    document.getElementById('vouch-success').style.display = 'block';
    
    // Start Visual Reset Timer
    startCooldownTimer(300); // 300 seconds = 5 mins

    try {
        // BACKEND UPDATE: Trigger the Sovereign Refinery
        const venueRef = doc(db, "universities", "osu", "bars", venueId);
        await updateDoc(venueRef, {
            wait_time: waitMins,
            total_historical_reports: increment(1)
        });
        
        localStorage.setItem('vouch_timestamp', now);
    } catch (e) {
        console.error("Refinery Connection Lost:", e);
        // Revert UI if it fails
        document.getElementById('vouch-actions').style.display = 'block';
        document.getElementById('vouch-success').style.display = 'none';
    }
};

/**
 * 3. THE VISUAL RESET (Timer Logic)
 */
function startCooldownTimer(seconds) {
    const display = document.getElementById('cooldown-timer');
    let timer = seconds;
    
    const interval = setInterval(() => {
        let mins = Math.floor(timer / 60);
        let secs = timer % 60;
        display.innerHTML = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        if (--timer < 0) {
            clearInterval(interval);
            // RESET: Bring buttons back
            document.getElementById('vouch-actions').style.display = 'block';
            document.getElementById('vouch-success').style.display = 'none';
        }
    }, 1000);
}