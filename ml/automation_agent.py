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

# --- NEW GOOGLE GENAI SDK ---
from google import genai
from google.genai import types

# ==========================================
# ⚙️ CONFIGURATION
# ==========================================

# 1. Load Environment Variables
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, ".env")
load_dotenv(env_path)

# 2. Fetch Secrets
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

# 3. Model Selection
MODEL_NAME = "gemma-3-12b-it"

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

# ==========================================
# 🔧 INITIALIZATION
# ==========================================

# Configure Environment for Emulator
if os.getenv("FIRESTORE_EMULATOR_HOST"):
    os.environ["FIRESTORE_EMULATOR_HOST"] = os.getenv("FIRESTORE_EMULATOR_HOST")
if os.getenv("GCLOUD_PROJECT"):
    os.environ["GCLOUD_PROJECT"] = os.getenv("GCLOUD_PROJECT")

# Initialize Firebase
key_path = os.path.join(script_dir, "serviceAccountKey.json")

if not firebase_admin._apps:
    if os.path.exists(key_path):
        cred = credentials.Certificate(key_path)
        firebase_admin.initialize_app(cred, {'projectId': os.environ.get("GCLOUD_PROJECT")})
    else:
        firebase_admin.initialize_app(options={'projectId': os.environ.get("GCLOUD_PROJECT")})

db = firestore.client()

# Initialize Gemini Client
client = genai.Client(api_key=GEMINI_API_KEY)

# ==========================================
# 🧠 AI LOGIC
# ==========================================

def generate_smart_email_content(case_data):
    company = case_data.get('name_customer', 'Valued Customer')
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

    # --- RETRY LOGIC FOR FREE TIER ---
    max_retries = 3
    wait_time = 45 
    
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME, 
                contents=prompt
            )
            # Cleanup common AI artifacts
            return response.text.replace("Subject:", "").strip()
        
        except Exception as e:
            error_msg = str(e)
            # Catch 429 Resource Exhausted
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                print(f"   ⏳ Quota limit hit. Pausing for {wait_time}s (Attempt {attempt+1}/{max_retries})...")
                time.sleep(wait_time)
                wait_time += 10 # Exponential backoff
            else:
                print(f"   ❌ Gemini Error: {e}")
                break
    
    # Fallback if AI fails completely
    return f"Dear {company}, friendly reminder regarding the outstanding balance of ${amount}. Please remit payment."

def send_email(to_email, subject, body):
    if not SENDER_EMAIL or "your-email" in SENDER_EMAIL:
        return True # Fake success for testing

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
    
    # --- 1. Yellow Zone (Emails) ---
    print("\n--- Processing Yellow Zone (Emails) ---")
    
    yellow_cases = cases_ref.where(filter=FieldFilter("zone", "==", "YELLOW"))\
                            .where(filter=FieldFilter("isOpen", "==", "1"))\
                            .stream()
    
    email_count = 0
    
    for case in yellow_cases:
        data = case.to_dict()
        doc_id = case.id
        company = data.get('name_customer', 'Client')
        
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
        
        print(f"   ✨ Gemini Drafting for {company}...")
        email_body = generate_smart_email_content(data)
        
        # Send
        if send_email(target_email, f"Payment Reminder: Invoice #{data.get('invoice_id')}", email_body):
            email_count += 1
            
            # Log Global
            db.collection('ai_logs').add({
                "type": "MAIL",
                "company_name": company,
                "target": target_email,
                "content": email_body,
                "status": "Sent",
                "timestamp": firestore.SERVER_TIMESTAMP,
                "case_id": doc_id
            })
            
            # Log Case
            db.collection('cases').document(doc_id).update({
                "history_logs": firestore.ArrayUnion([{
                    "date": datetime.now().isoformat(),
                    "action": "🤖 AI Email (Gemini)",
                    "note": "Automated reminder sent.",
                    "status": "Sent"
                }]),
                "last_contacted_at": firestore.SERVER_TIMESTAMP
            })
            
            # SLOW DOWN to prevent 429 Errors
            print("   zzz... Cooling down for 10s...")
            time.sleep(10) 

    # --- 2. Orange Zone (Calls) ---
    print("\n--- Processing Orange Zone (Calls) ---")
    
    orange_cases = cases_ref.where(filter=FieldFilter("zone", "==", "ORANGE"))\
                            .where(filter=FieldFilter("isOpen", "==", "1"))\
                            .stream()
    
    call_count = 0
    for case in orange_cases:
        data = case.to_dict()
        doc_id = case.id
        company = data.get('company_name', 'Client')
        
        # Spam Check
        last_contact = data.get('last_contacted_at')
        if last_contact:
            if hasattr(last_contact, 'date'):
                last_date = last_contact.date()
            else:
                last_date = last_contact.today().date()
            if last_date == datetime.now().date():
                print(f"   ⏭️  Skipping {company} (Call already queued)")
                continue

        print(f"   📞 Scheduling Call for {company}")
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

    print(f"\n✅ Gemini Cycle Complete. Sent {email_count} emails, Queued {call_count} calls.")

if __name__ == "__main__":
    run_automation()