"""
Update bar documents in Firestore with lat/lng coordinates.
Run from the directory containing serviceAccountKey.json:
  python ethyl_baseline.py
"""
import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# (school_id, bar_doc_id, lat, lng)
BARS_COORDS = [
    # Ohio State (doc IDs must match Firestore exactly)
    ("ohio-state", "big-bar", 40.00062, -83.00941),
    ("ohio-state", "ethyl-and-tank", 40.00018, -83.00912),
    ("ohio-state", "library-bar", 40.01053, -83.01131),
    ("ohio-state", "midway", 39.99772, -83.00741),
    ("ohio-state", "mikes-late-night-slice", 39.99841, -83.00714),
    ("ohio-state", "out-r-inn", 40.01041, -83.01252),
    ("ohio-state", "sky-bar", 39.99541, -83.00642),
    ("ohio-state", "standard", 39.98412, -83.00351),
    ("ohio-state", "the-little-bar", 40.01021, -83.01183),
    ("ohio-state", "threes-above-high", 40.00406, -83.00843),
    ("ohio-state", "ugly-tuna-2", 39.99872, -83.00698),
    # Purdue
    ("purdue", "harrys-chocolate-shop", 40.42377, -86.90900),
    ("purdue", "brothers-bar-grill", 40.42405, -86.90842),
    ("purdue", "neon-cactus", 40.42326, -86.90051),
    ("purdue", "the-where-else", 40.42424, -86.90854),
    ("purdue", "twisted-hammer", 40.42251, -86.90812),
    ("purdue", "pint-n-slice", 40.42352, -86.90881),
    # Cincinnati
    ("cincinnati", "murphys-pub", 39.12572, -84.51861),
    ("cincinnati", "dive-bar", 39.13021, -84.51012),
    ("cincinnati", "ladder-19", 39.13054, -84.51152),
    ("cincinnati", "top-cats", 39.13082, -84.50981),
    ("cincinnati", "macs-pizza-pub", 39.13012, -84.51052),
    ("cincinnati", "martinos-on-vine", 39.13091, -84.50952),
    ("cincinnati", "omalleys-in-the-alley", 39.10052, -84.51281),
    ("cincinnati", "woodys-tavern", 39.12981, -84.51182),
    # Miami (Oxford)
    ("miami-oh", "brick-street", 39.50972, -84.74121),
    ("miami-oh", "circle-bar", 39.50941, -84.74152),
    ("miami-oh", "mac-and-joes", 39.50982, -84.74181),
    ("miami-oh", "steinkeller", 39.50912, -84.74113),
    ("miami-oh", "skippers-pub", 39.50951, -84.74212),
    ("miami-oh", "oxvegas-bar", 39.50921, -84.74192),
    ("miami-oh", "shanks", 39.50882, -84.74251),
    # Ohio University
    ("ohio-university", "the-crystal", 39.32941, -82.10152),
    ("ohio-university", "the-union", 39.32912, -82.10221),
    ("ohio-university", "the-overhang", 39.32881, -82.10092),
    ("ohio-university", "luckys-sports-tavern", 39.32952, -82.10111),
    ("ohio-university", "the-pub-bar-grill", 39.32921, -82.10182),
    ("ohio-university", "the-j-bar", 39.32961, -82.10052),
    ("ohio-university", "tonys-tavern", 39.32852, -82.10251),
]


def update_bar_coordinates(school_id: str, bar_doc_id: str, lat: float, lng: float) -> None:
    doc_ref = (
        db.collection("universities")
        .document(school_id)
        .collection("bars")
        .document(bar_doc_id)
    )
    try:
        doc_ref.set({"lat": lat, "lng": lng}, merge=True)
        print(f"  Updated {school_id}/bars/{bar_doc_id} -> lat={lat}, lng={lng}")
    except Exception as e:
        print(f"  ERROR {school_id}/bars/{bar_doc_id}: {e}")


if __name__ == "__main__":
    print("Updating bar coordinates in Firestore...")
    for school_id, bar_doc_id, lat, lng in BARS_COORDS:
        update_bar_coordinates(school_id, bar_doc_id, lat, lng)
    print("Done.")
