import os
from dotenv import load_dotenv
from google import genai

# 1. Load your API Key
script_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(script_dir, ".env"))

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("❌ Error: No API Key found in .env file.")
    exit()

print(f"🔑 Authenticating with key: {api_key[:5]}...")

# 2. Connect
client = genai.Client(api_key=api_key)

# 3. List Models
print("\n--- Available Models ---")
try:
    # Fetch all models
    pager = client.models.list()
    
    for model in pager:
        # Just print the name directly to avoid attribute errors
        print(f"✅ {model.name}")

except Exception as e:
    print(f"❌ Error fetching models: {e}")