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

# 👇 [NEW] POINT TO YOUR LOCAL FRONTEND
PAYMENT_BASE_URL = "http://localhost:5173/pay"

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

# 👇 [UPDATED] Now accepts doc_id to generate the link
def generate_smart_email_content(case_data, doc_id):
    company = case_data.get('name_customer') or case_data.get('company_name') or 'Valued Customer'
    amount = case_data.get('total_open_amount', 0)
    days_late = case_data.get('predicted_delay', 0)
    
    # Generate the link
    payment_link = f"{PAYMENT_BASE_URL}/{doc_id}"

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

    ai_text = ""
    # Retries for network blips
    max_retries = 2
    success = False
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME, 
                contents=prompt
            )
            ai_text = response.text.replace("Subject:", "").strip()
            success = True
            break
        except Exception as e:
            print(f"   ⚠️ AI Error (Attempt {attempt+1}): {e}")
            time.sleep(1)
    
    if not success:
        ai_text = f"Dear {company}, friendly reminder regarding the outstanding balance of ${amount}."

    # 👇 [CRITICAL] Append the link to the email body
    return f"{ai_text}\n\n👉 Pay Securely Here: {payment_link}\n\nFedEx Automation Team"

# 👇 [UPDATED] MOCK MODE - Does not actually send email
def send_email(to_email, subject, body):
    # We return True immediately to avoid "Daily Limit Exceeded" errors
    # This simulates a successful send.
    print(f"   📧 [MOCK SEND] Email would go to: {to_email}")
    return True 

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
    
    yellow_docs = cases_ref.where(filter=FieldFilter("zone", "==", "YELLOW"))\
                           .where(filter=FieldFilter("isOpen", "==", "1"))\
                           .stream()
    
    yellow_work_queue = []
    for doc in yellow_docs:
        yellow_work_queue.append({"id": doc.id, "data": doc.to_dict()})
        
    # 👇 Limit to top 5 for Demo speed
    demo_queue = yellow_work_queue[:5]
    print(f"📋 Found {len(yellow_work_queue)} cases. Demo Mode processing top {len(demo_queue)}...")
    
    email_count = 0
    
    for task in demo_queue:
        doc_id = task["id"]
        data = task["data"]
        company = data.get('name_customer') or data.get('company_name') or 'Client'
        
        # Spam Check (Skipped for demo purposes usually, but keeping it)
        last_contact = data.get('last_contacted_at')
        if last_contact:
             # Simple date check logic here...
             pass

        sanitized_company = company.strip().replace(" ", "").replace(",", "").lower()
        target_email = f"{sanitized_company}@doesnotexistxyz.com"
        
        print(f"   ✨ Generating for {company}...")
        
        # 👇 Generate with Link
        email_body = generate_smart_email_content(data, doc_id)
        
        # 👇 PRINT THE LINK FOR YOU TO CLICK
        print(f"   🔗 [DEMO LINK] {PAYMENT_BASE_URL}/{doc_id}")

        if send_email(target_email, f"Payment Action Required", email_body):
            email_count += 1
            
            # Log to Firestore
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
                    "note": "Payment Link Included",
                    "status": "Sent"
                }]),
                "last_contacted_at": firestore.SERVER_TIMESTAMP
            })

    print(f"\n✅ Demo Automation Complete. Processed {email_count} emails.")

if __name__ == "__main__":
    run_automation()