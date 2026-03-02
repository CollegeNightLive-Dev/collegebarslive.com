import firebase_admin
from firebase_admin import credentials, firestore

# 1. SETUP
# Make sure your serviceAccountKey.json is in the same directory!
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def import_osu_venue(venue_name, doc_id, display_rank=0.5):
    print(f"🚀 Importing {venue_name} into Ohio State Campus Intelligence...")

    # 2. GENERATE FLAT ZERO BASELINES
    # Ensures every 30-minute block across 7 days is initialized to 0
    days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    baselines = {}
    for day in days:
        for hour in range(24):
            for minute in ["00", "30"]:
                time_key = f"{day}_{hour:02d}{minute}"
                baselines[time_key] = 0

    # 3. DEFINE THE SCALE-READY DATA STRUCTURE
    data = {
        "name": venue_name,
        "display_order": display_rank,  # Higher numbers = higher on the list
        "wait_time": 0,
        "ai_reason": "Open",
        "historical_baselines": baselines,
        "recent_reports": [],
        "last_updated": firestore.SERVER_TIMESTAMP
    }

    # 4. EXECUTE THE UPLOAD
    try:
        # Path: universities -> ohio-state -> food-joints -> [doc_id]
        # Note: If Ugly Tuna is technically a "bar" vs "food", 
        # make sure your frontend points to this 'food-joints' collection.
        doc_ref = db.collection("universities").document("ohio-state").collection("bars").document(doc_id)
        
        doc_ref.set(data)
        print(f"✅ SUCCESS: {venue_name} is now live on the OSU feed!")
        
    except Exception as e:
        print(f"❌ ERROR: Failed to import venue: {e}")

if __name__ == "__main__":
    # Import Mike's Late Night Slice
   

    # Import Ugly Tuna 2
    # Set to 0.7 to place it prominently in the list
    import_osu_venue("Ugly Tuna 2", "ugly-tuna-2", display_rank=4.5)