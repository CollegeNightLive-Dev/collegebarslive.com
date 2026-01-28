import firebase_admin
from firebase_admin import credentials, firestore

# I am using the external service account key file to avoid leaking credentials.
# This file must be in your .gitignore so it never touches GitHub.
cred = credentials.Certificate("serviceAccountKey.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

def seed_ohio_state():
    """
    Initializes the Ohio State data structure for bars and food joints.
    """
    university_ref = db.collection("universities").doc("ohio-state")

    # Intel data for local bars
    bars = [
        {"name": "Sky", "wait_time": 0, "verified_reports": 1},
        {"name": "Ethyl & Tank", "wait_time": 0, "verified_reports": 1},
        {"name": "Midway", "wait_time": 0, "verified_reports": 1},
        {"name": "Big Bar", "wait_time": 0, "verified_reports": 1},
        {"name": "Threes Above High", "wait_time": 0, "verified_reports": 1},
        {"name": "Library Bar", "wait_time": 0, "verified_reports": 1},
        {"name": "The Little Bar", "wait_time": 0, "verified_reports": 1},
        {"name": "Standard", "wait_time": 0, "verified_reports": 1}
    ]

    # Intel data for food joints
    food = [
        {"name": "Raising Cane’s", "wait_time": 0, "verified_reports": 1},
        {"name": "Buckeye Donuts", "wait_time": 0, "verified_reports": 1},
        {"name": "McDonald's", "wait_time": 0, "verified_reports": 1},
        {"name": "Taco Bell", "wait_time": 0, "verified_reports": 1},
        {"name": "Apollo’s Greek Kitchen", "wait_time": 0, "verified_reports": 1},
        {"name": "Adriatico’s Pizza", "wait_time": 0, "verified_reports": 1},
        {"name": "Insomnia Cookies", "wait_time": 0, "verified_reports": 1},
        {"name": "Mikey's Late Night Slice", "wait_time": 0, "verified_reports": 1}
    ]

    # Batching the uploads
    for bar in bars:
        university_ref.collection("bars").add(bar)
    
    for joint in food:
        university_ref.collection("food-joints").add(joint)

    print("Successfully seeded OSU Intel Feed.")

if __name__ == "__main__":
    seed_ohio_state()