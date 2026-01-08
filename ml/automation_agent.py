import os
import time
import smtplib
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import firebase_admin
from firebase_admin import firestore, credentials
from google.cloud.firestore import FieldFilter
from dotenv import load_dotenv

from google import genai

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================

script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, ".env")
load_dotenv(env_path)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

# Using the high-limit Gemma model
MODEL_NAME = "gemma-3-12b-it"

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

# ==========================================
# 🔧 INITIALIZATION
# ==========================================

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
# 🧠 AI LOGIC
# ==========================================

def generate_smart_email_content(case_data):
    # Using 'name_customer' as per your data schema
    company = case_data.get('name_customer') or case_data.get('company_name') or 'Valued Customer'
    amount = case_data.get('total_open_amount', 0)
    days_late = case_data.get('predicted_delay', 0)
    
    tone = "friendly and helpful"
    if days_late > 7:
        tone = "firm but professional urgency"
    
    prompt = f"""
    You are an accounts receivable agent for FedEx. 
    Write a short email body to a customer named "{company}".
    
    Context:
    - They owe ${amount}.
    - Our system flags they are {int(days_late)} days late.
    - Tone needed: {tone}.
    
    Guidelines:
    - Do NOT include a subject line.
    - Do NOT use placeholders.
    - Keep it under 100 words.
    """

    # Retries for network blips (not rate limits)
    max_retries = 2
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME, 
                contents=prompt
            )
            return response.text.replace("Subject:", "").strip()
        except Exception as e:
            print(f"   ⚠️ AI Error (Attempt {attempt+1}): {e}")
            time.sleep(1) # Short pause on error
    
    # Fallback
    return f"Dear {company}, friendly reminder regarding the outstanding balance of ${amount}. Please remit payment."

def send_email(to_email, subject, body):
    if not SENDER_EMAIL or "your-email" in SENDER_EMAIL:
        return True 

    try:
        msg = MIMEMultipart()
        msg['From'] = SENDER_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        text = msg.as_string()
        server.sendmail(SENDER_EMAIL, to_email, text)
        server.quit()
        return True
    except Exception as e:
        print(f"   ❌ Email Send Failed: {e}")
        return False

# ==========================================
# 🚀 MAIN LOOP
# ==========================================

def run_automation():
    print(f"🤖 Gemini Agent Starting (Model: {MODEL_NAME})...")
    
    cases_ref = db.collection('cases')
    
    # ----------------------------------------------------
    # 1. Yellow Zone (Emails)
    # ----------------------------------------------------
    print("\n--- Fetching Yellow Zone Cases (Emails) ---")
    
    # STEP 1: FAST FETCH (Prevent DeadlineExceeded)
    # We load all IDs into memory instantly, then close the stream.
    yellow_docs = cases_ref.where(filter=FieldFilter("zone", "==", "YELLOW"))\
                           .where(filter=FieldFilter("isOpen", "==", "1"))\
                           .stream()
    
    # Convert stream to list immediately
    yellow_work_queue = []
    for doc in yellow_docs:
        yellow_work_queue.append({"id": doc.id, "data": doc.to_dict()})
        
    print(f"📋 Found {len(yellow_work_queue)} cases. Processing at max speed...")
    
    email_count = 0
    
    # STEP 2: PROCESS LOCALLY (No Sleep)
    for task in yellow_work_queue:
        doc_id = task["id"]
        data = task["data"]
        company = data.get('name_customer') or data.get('company_name') or 'Client'
        
        # Spam Check
        last_contact = data.get('last_contacted_at')
        if last_contact:
            if hasattr(last_contact, 'date'):
                last_date = last_contact.date()
            else:
                last_date = last_contact.today().date()
            if last_date == datetime.now().date():
                print(f"   ⏭️  Skipping {company} (Already contacted today)")
                continue

        sanitized_company = company.strip().replace(" ", "").replace(",", "").lower()
        target_email = f"{sanitized_company}@doesnotexistxyz.com"
        
        print(f"   ✨ Generating for {company}...")
        
        # 1. Generate (Fast)
        email_body = generate_smart_email_content(data)
        
        # 2. Send (Fast)
        if send_email(target_email, f"Payment Reminder: Invoice #{data.get('invoice_id')}", email_body):
            email_count += 1
            
            # 3. Log (Async-ish)
            db.collection('ai_logs').add({
                "type": "MAIL",
                "company_name": company,
                "target": target_email,
                "content": email_body,
                "status": "Sent",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "case_id": doc_id
            })
            
            db.collection('cases').document(doc_id).update({
                "history_logs": firestore.ArrayUnion([{
                    "date": datetime.now().isoformat(),
                    "action": "🤖 AI Email",
                    "note": f"Model: {MODEL_NAME}",
                    "status": "Sent"
                }]),
                "last_contacted_at": firestore.SERVER_TIMESTAMP
            })
            # NO SLEEP HERE! 🚀

    # ----------------------------------------------------
    # 2. Orange Zone (Calls)
    # ----------------------------------------------------
    print("\n--- Fetching Orange Zone Cases (Calls) ---")
    
    # STEP 1: Fast Fetch
    orange_docs = cases_ref.where(filter=FieldFilter("zone", "==", "ORANGE"))\
                           .where(filter=FieldFilter("isOpen", "==", "1"))\
                           .stream()
                           
    orange_work_queue = []
    for doc in orange_docs:
        orange_work_queue.append({"id": doc.id, "data": doc.to_dict()})

    print(f"📋 Found {len(orange_work_queue)} cases to queue calls for.")

    call_count = 0
    
    # STEP 2: Process
    for task in orange_work_queue:
        doc_id = task["id"]
        data = task["data"]
        company = data.get('name_customer') or data.get('company_name') or 'Client'
        
        last_contact = data.get('last_contacted_at')
        if last_contact:
            if hasattr(last_contact, 'date'):
                last_date = last_contact.date()
            else:
                last_date = last_contact.today().date()
            if last_date == datetime.now().date():
                continue

        print(f"   📞 Queuing Call: {company}")
        db.collection('ai_logs').add({
            "type": "CALL",
            "company_name": company,
            "target": "Phone",
            "content": f"High Priority. Predicted Delay: {data.get('predicted_delay', 0)} days.",
            "status": "Scheduled",
            "timestamp": firestore.SERVER_TIMESTAMP,
            "case_id": doc_id
        })
        db.collection('cases').document(doc_id).update({
            "last_contacted_at": firestore.SERVER_TIMESTAMP,
            "action": "CALL_QUEUED" 
        })
        call_count += 1

    print(f"\n✅ Automation Complete. Sent {email_count} emails, Queued {call_count} calls.")

if __name__ == "__main__":
    run_automation()