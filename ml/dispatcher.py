import firebase_admin
from firebase_admin import firestore
import random
import time
import os

# ----------------------------------
# 1. EMULATOR CONFIGURATION
# ----------------------------------
os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8085"
os.environ["GCLOUD_PROJECT"] = "fedex-dca"

if not firebase_admin._apps:
    firebase_admin.initialize_app(options={"projectId": "fedex-dca"})

db = firestore.client()

# ----------------------------------
# 2. AGENT ROSTER (INDIAN NAMES + PHOTOS)
# ----------------------------------
AGENTS = [
    {
        "id": "agent_001",
        "name": "Aarav Mehta",
        "email": "aarav.mehta@fedex.com",
        "photo_url": "https://randomuser.me/api/portraits/men/32.jpg"
    },
    {
        "id": "agent_002",
        "name": "Priya Sharma",
        "email": "priya.sharma@fedex.com",
        "photo_url": "https://randomuser.me/api/portraits/women/44.jpg"
    },
    {
        "id": "agent_003",
        "name": "Rohit Verma",
        "email": "rohit.verma@fedex.com",
        "photo_url": "https://randomuser.me/api/portraits/men/65.jpg"
    },
    {
        "id": "agent_004",
        "name": "Neha Iyer",
        "email": "neha.iyer@fedex.com",
        "photo_url": "https://randomuser.me/api/portraits/women/68.jpg"
    },
    {
        "id": "agent_005",
        "name": "Karan Malhotra",
        "email": "karan.malhotra@fedex.com",
        "photo_url": "https://randomuser.me/api/portraits/men/75.jpg"
    },
    {
        "id": "agent_006",
        "name": "Ananya Gupta",
        "email": "ananya.gupta@fedex.com",
        "photo_url": "https://randomuser.me/api/portraits/women/12.jpg"
    }
]

# ----------------------------------
# 3. DISPATCHER LOGIC
# ----------------------------------
def run_dispatcher():
    print("🔎 Scanning for unassigned RED cases...")

    cases_ref = db.collection("cases")
    query = cases_ref.where("zone", "==", "RED").stream()

    batch = db.batch()
    count = 0

    for doc in query:
        data = doc.to_dict()

        # Skip already assigned cases
        if data.get("assigned_to"):
            continue

        selected_agent = random.choice(AGENTS)

        print(f"👉 Assigning Case {doc.id} → {selected_agent['name']}")

        doc_ref = cases_ref.document(doc.id)

        update_data = {
            "assigned_to": selected_agent["id"],
            "assigned_agent_name": selected_agent["name"],
            "assigned_agent_email": selected_agent["email"],
            "assigned_agent_photo": selected_agent["photo_url"],
            "queue_status": "PENDING",
            "action": "ESCALATE",
            "escalated_at": firestore.SERVER_TIMESTAMP
        }

        batch.update(doc_ref, update_data)
        count += 1

    if count > 0:
        batch.commit()
        print(f"✅ Assigned {count} cases.")
    else:
        print("💤 No new unassigned cases found.")

# ----------------------------------
# 4. RUN LOOP
# ----------------------------------
if __name__ == "__main__":
    print(f"🤖 Dispatcher Service Started on {os.environ['FIRESTORE_EMULATOR_HOST']}")
    print("   (Press Ctrl+C to stop)")
    while True:
        run_dispatcher()
        time.sleep(5)
