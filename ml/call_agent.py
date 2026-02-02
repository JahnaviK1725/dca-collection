import os
import time
from datetime import datetime
import firebase_admin
from firebase_admin import firestore, credentials
from google.cloud.firestore import FieldFilter
from dotenv import load_dotenv
from google import genai
from gtts import gTTS  # The Text-to-Speech library

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================

script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, ".env")
load_dotenv(env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemma-3-12b-it"

# ⚠️ HACKATHON CONFIG: Path to your React App's 'public' folder
# This ensures the audio files are accessible by the frontend immediately.
# Example: "../my-react-app/public/recordings"
REACT_PUBLIC_FOLDER = os.path.join(script_dir, "../frontend2/public/recordings") 

# ==========================================
# 🔧 INITIALIZATION
# ==========================================

if not os.path.exists(REACT_PUBLIC_FOLDER):
    os.makedirs(REACT_PUBLIC_FOLDER)

# Firebase Init (Same as your mail agent)
if os.getenv("FIRESTORE_EMULATOR_HOST"):
    os.environ["FIRESTORE_EMULATOR_HOST"] = os.getenv("FIRESTORE_EMULATOR_HOST")
if os.getenv("GCLOUD_PROJECT"):
    os.environ["GCLOUD_PROJECT"] = os.getenv("GCLOUD_PROJECT")

key_path = os.path.join(script_dir, "serviceAccountKey.json")

if not firebase_admin._apps:
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred, {'projectId': os.environ.get("GCLOUD_PROJECT")})
    else:
        firebase_admin.initialize_app(options={'projectId': os.environ.get("GCLOUD_PROJECT")})

db = firestore.client()
client = genai.Client(api_key=GEMINI_API_KEY)

# ==========================================
# 🧠 AI & AUDIO LOGIC
# ==========================================

def generate_call_script(case_data):
    company = case_data.get('name_customer') or 'the client'
    amount = case_data.get('total_open_amount', 0)
    
    prompt = f"""
    You are an automated voice agent for a debt collection agency.
    Write a VERY short phone script (maximum 2 sentences) to leave a voicemail for "{company}".
    
    Details:
    - Amount owed: ${amount}
    - Tone: Urgent but polite.
    - Start directly with "Hello, this is a message for..."
    - Do NOT include scene descriptions like [pause] or (excited). Just the spoken words.
    """

    try:
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
        return response.text.replace('"', '').strip()
    except Exception as e:
        print(f"   ⚠️ AI Error: {e}")
        return f"Hello, this is a message for {company}. You have an outstanding balance of {amount} dollars. Please contact us immediately."

def create_audio_file(text, doc_id):
    """Generates MP3 and returns the relative path for the frontend"""
    try:
        # 1. Generate Audio Object
        tts = gTTS(text=text, lang='en', tld='com')
        
        # 2. Save to React Public Folder
        filename = f"call_{doc_id}_{int(time.time())}.mp3"
        full_path = os.path.join(REACT_PUBLIC_FOLDER, filename)
        tts.save(full_path)
        
        # 3. Return relative path for React (e.g., /recordings/filename.mp3)
        return f"/recordings/{filename}"
    except Exception as e:
        print(f"   ❌ Audio Gen Failed: {e}")
        return None

# ==========================================
# 🚀 MAIN LOOP
# ==========================================

def run_call_automation():
    print(f"📞 Call Agent Starting (Model: {MODEL_NAME})...")
    
    cases_ref = db.collection('cases')
    
    print("\n--- Fetching Orange Zone Cases (Calls) ---")
    
    # Fetch ORANGE zone cases
    orange_docs = cases_ref.where(filter=FieldFilter("zone", "==", "ORANGE"))\
                           .where(filter=FieldFilter("isOpen", "==", "1"))\
                           .stream()
    
    work_queue = [{"id": d.id, "data": d.to_dict()} for d in orange_docs]
    print(f"📋 Found {len(work_queue)} calls to process...")
    
    processed_count = 0
    
    for task in work_queue:
        doc_id = task["id"]
        data = task["data"]
        company = data.get('name_customer') or 'Client'

        # 🛡️ Date Check
        last_contact = data.get('last_contacted_at')
        if last_contact:
            # (Date check logic same as mail agent)
            today = datetime.now().date()
            if hasattr(last_contact, 'date') and last_contact.date() == today:
                print(f"   ⏭️  Skipping {company} (Already called today)")
                continue

        print(f"   🎙️  Processing Call for {company}...")
        
        # 1. Generate Script
        call_script = generate_call_script(data)
        
        # 2. Generate Audio
        print(f"      ...Synthesizing Audio")
        audio_url = create_audio_file(call_script, doc_id)
        
        if audio_url:
            processed_count += 1
            
            # 3. Log to Firestore
            db.collection('ai_logs').add({
                "type": "CALL",
                "company_name": company,
                "target": data.get('phone_number', 'Unknown'),
                "content": call_script,
                "audio_url":  audio_url, # <--- The key field for the frontend
                "status": "Voicemail Left",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "case_id": doc_id
            })
            
            # 4. Update Case History
            db.collection('cases').document(doc_id).update({
                "history_logs": firestore.ArrayUnion([{
                    "date": datetime.now().isoformat(),
                    "action": "🤖 AI Call",
                    "note": "Voicemail Generated",
                    "status": "Completed"
                }]),
                "last_contacted_at": firestore.SERVER_TIMESTAMP
            })
            print(f"      ✅ Call logged & Audio saved.")
            print(audio_url)

    print(f"\n✅ Call Automation Complete. Processed {processed_count} calls.")

if __name__ == "__main__":
    run_call_automation()