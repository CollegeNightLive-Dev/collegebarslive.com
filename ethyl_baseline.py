import firebase_admin
from firebase_admin import credentials, firestore

# 1. SETUP
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def rank_all_expansion_schools():
    print("🚀 Initializing Popularity Ranking Intelligence for 2026...")

    # 2. DEFINE POPULARITY MAP (Based on Campus Intel)
    # The order of the list determines the display_order (1, 2, 3...)
    rankings = {
        "cincinnati": {
            "bars": ["murphys-pub", "dive-bar", "ladder-19", "top-cats", "macs-pizza-pub"],
            "food-joints": ["skyline-chili", "raising-canes", "adriaticos", "dp-dough", "swensons-drive-in"]
        },
        "miami-oh": {
            "bars": ["brick-street", "circle-bar", "mac-and-joes", "steinkeller", "skippers-pub"],
            "food-joints": ["bagel-and-deli", "brunos-pizza", "fiesta-charra", "doughbys", "el-burrito-loco"]
        },
        "ohio-university": {
            "bars": ["the-crystal", "the-union", "the-overhang", "luckys-sports-tavern", "the-pub-bar-grill"],
            "food-joints": ["bagel-street-deli", "goodfellas-pizza", "union-street-diner", "keystones-mac-shack", "obettys-red-hot"]
        },
        "purdue": {
            "bars": ["harrys-chocolate-shop", "brothers-bar-grill", "neon-cactus", "the-where-else", "twisted-hammer"],
            "food-joints": ["triple-xxx-family-restaurant", "mad-mushroom-pizza", "famous-franks", "ajs-burgers-beef", "taste-of-india"]
        }
    }

    # 3. EXECUTE BATCH UPDATES
    for uni_id, collections in rankings.items():
        print(f"\n🏫 Processing {uni_id.upper()}...")
        
        for col_name, venue_list in collections.items():
            # First, set a default of 99 to ALL venues in this collection
            # This ensures any 'extra' venues don't disappear but stay at the bottom
            try:
                all_venues = db.collection("universities").document(uni_id).collection(col_name).get()
                for v in all_venues:
                    v.reference.update({"display_order": 99})
                
                # Now, apply specific rankings (1, 2, 3...)
                for index, venue_id in enumerate(venue_list):
                    doc_ref = db.collection("universities").document(uni_id).collection(col_name).document(venue_id)
                    
                    if doc_ref.get().exists:
                        doc_ref.update({"display_order": index + 1})
                        print(f"   ⭐ {col_name.title()} Rank {index + 1}: {venue_id}")
                    else:
                        print(f"   ⚠️ Skipping {venue_id} (Document not found in {uni_id})")
            
            except Exception as e:
                print(f"   ❌ Error processing {col_name} for {uni_id}: {e}")

    print("\n🔥 ALL SCHOOLS UPDATED. Your app will now display venues by popularity.")

if __name__ == "__main__":
    rank_all_expansion_schools()