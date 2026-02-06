import pandas as pd
import numpy as np
import lightgbm as lgb
from datetime import timedelta
import math
import os
import sys
import json
import time
import random
from tqdm import tqdm

import firebase_admin
from firebase_admin import firestore
from google.cloud import firestore as google_firestore
from google.api_core import exceptions

# --------------------
# CONFIG
# --------------------
os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8085"
os.environ["GCLOUD_PROJECT"] = "fedex-dca"

MODEL_PATH = "model/payment_delay_lgb_model.txt"
BATCH_COMMIT_SIZE = 50 

MODEL_FEATURES = [
    "total_open_amount", "due_days", "avg_due_days", "avg_payment_delay",
    "std_payment_delay", "avg_days_to_clear", "avg_invoice_amount",
    "transaction_count", "late_payment_ratio"
]

# --------------------
# 1. INITIALIZATION
# --------------------
print(f"⚠️  Running in EMULATOR mode at {os.environ['FIRESTORE_EMULATOR_HOST']}")

if not firebase_admin._apps:
    firebase_admin.initialize_app(options={'projectId': 'fedex-dca'})

db = google_firestore.Client(project="fedex-dca")

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
model = lgb.Booster(model_file=MODEL_PATH)

# --------------------
# 2. UTILITIES
# --------------------
def safe_to_datetime(series, fmt=None):
    if fmt is not None:
        return pd.to_datetime(series, format=fmt, errors="coerce")
    return pd.to_datetime(series, errors="coerce")

def assign_zone(pred_delay, sla_days, sla_date, due_date, today=None, predicted_payment_date=None):
    """
    Assigns a risk zone based on Due Date, SLA, and AI predictions.
    
    Logic:
    1. RED:    Today >= SLA Date (Escalation)
    2. GREEN:  Due Date is in the future (No Action)
    3. YELLOW: Predicted Delay <= SLA AND Today <= Predicted Payment Date (Mail)
    4. ORANGE: Predicted Delay > SLA OR Today > Predicted Payment Date (Call)
    """
    if today is None:
        today = pd.Timestamp.today().normalize()
    
    if pd.isna(sla_date): sla_date = None
    if pd.isna(due_date): due_date = None
    if pd.isna(predicted_payment_date): predicted_payment_date = None

    # --- PRIORITY 1: CRITICAL BREACH (RED) ---
    if sla_date is not None and today >= sla_date:
        return "RED"

    # --- PRIORITY 2: NOT DUE YET (GREEN) ---
    # If the invoice hasn't reached its due date yet, no action is needed.
    if due_date is not None and today < due_date:
        return "GREEN"

    # Handle missing prediction data (Safety Fallback)
    if pred_delay is None or pd.isna(pred_delay) or predicted_payment_date is None:
        return "ORANGE"

    # --- PRIORITY 3: WATCH LIST (YELLOW) ---
    # We are past due, but:
    # 1. The delay is within the SLA grace period.
    # 2. The AI predicts they will pay in the future (we haven't passed the predicted date yet).
    if pred_delay <= sla_days and today <= predicted_payment_date:
        return "YELLOW"

    # --- PRIORITY 4: HIGH RISK (ORANGE) ---
    # We are past due, and:
    # 1. The predicted delay is longer than the SLA allowed.
    # 2. OR The AI predicted they would pay by now, but they haven't (Missed Prediction).
    return "ORANGE"

def derive_sla_days(late_ratio):
    try:
        if late_ratio >= 0.8: return 3
        elif late_ratio >= 0.5: return 5
        elif late_ratio >= 0.2: return 10
        else: return 15
    except Exception:
        return 15

def commit_batch_safe(batch):
    max_retries = 5
    for attempt in range(max_retries):
        try:
            batch.commit()
            time.sleep(0.05) 
            return
        except exceptions.Aborted as e:
            wait = (2 ** attempt) + random.uniform(0, 1)
            print(f"   ⚠️ Transaction lock timeout. Retrying in {wait:.1f}s...")
            time.sleep(wait)
        except Exception as e:
            print(f"   ❌ Batch commit failed: {e}")
            raise e
    print("   ❌ Max retries reached for batch. Skipping.")

# --------------------
# 3. MAIN JOB
# --------------------
def run_ml_job():
    print("Starting ML job...")
    start_ts = time.time()

    # 3.1 Fetch all cases
    print("Fetching cases collection from Emulator...")
    docs = db.collection("cases").stream()

    rows = []
    
    # Init batch for backfilling original_amount
    batch = db.batch()
    batch_count = 0
    backfill_counter = 0

    for doc in tqdm(docs, desc="Fetching & Backfilling"):
        d = doc.to_dict()
        d["_doc_id"] = doc.id
        
        if "original_amount" not in d:
            current_total = d.get("total_open_amount", d.get("invoice_amount", 0))
            d["original_amount"] = current_total
            
            doc_ref = db.collection("cases").document(doc.id)
            batch.update(doc_ref, {"original_amount": current_total})
            batch_count += 1
            backfill_counter += 1

        rows.append(d)

        if batch_count >= BATCH_COMMIT_SIZE:
            commit_batch_safe(batch)
            batch = db.batch()
            batch_count = 0
    
    if batch_count > 0:
        commit_batch_safe(batch)
        print(f"✅ Backfilled 'original_amount' for {backfill_counter} cases.")

    if not rows:
        print("No cases found. Exiting.")
        return

    df = pd.DataFrame(rows)
    print(f"Total cases fetched: {len(df)}")

    # 3.2 Parse Dates
    if "document_create_date" in df.columns:
        df["invoice_date"] = safe_to_datetime(df["document_create_date"], fmt="%Y%m%d")
    else:
        df["invoice_date"] = safe_to_datetime(df.get("invoice_date"))

    if "due_in_date" in df.columns:
        due_col = df["due_in_date"].astype("Int64").astype(str)
        df["due_date"] = safe_to_datetime(due_col, fmt="%Y%m%d")
    else:
        df["due_date"] = safe_to_datetime(df.get("due_date"))

    df["clear_date"] = safe_to_datetime(df.get("clear_date"))

    # 3.3 Normalize amounts
    if "invoice_amount" in df.columns:
        df["total_open_amount"] = df["invoice_amount"].astype(float)
    else:
        df["total_open_amount"] = pd.to_numeric(df.get("total_open_amount", 0), errors="coerce").fillna(0.0)

    df["invoice_currency"] = df.get("invoice_currency", "USD").fillna("USD")
    df["total_open_amount"] = np.where(df["invoice_currency"] == "CAD", df["total_open_amount"] * 0.75, df["total_open_amount"])

    # 3.4 Metrics
    df["payment_delay"] = (df["clear_date"] - df["due_date"]).dt.days
    df["due_days"] = (df["due_date"] - df["invoice_date"]).dt.days
    df["invoice_age_at_clearing"] = (df["clear_date"] - df["invoice_date"]).dt.days

    if "cust_number" not in df.columns:
        df["cust_number"] = df.get("customer_id", "").astype(str)
    df["cust_number"] = df["cust_number"].astype(str)

    if "name_customer" not in df.columns:
        df["name_customer"] = df.get("company_name", "")

    # 3.5 Flags
    if "isOpen" in df.columns:
        df["is_open_flag"] = df["isOpen"].astype(str).isin(["1", "true", "True"])
    elif "is_open" in df.columns:
        df["is_open_flag"] = df["is_open"] == 1
    else:
        df["is_open_flag"] = df["clear_date"].isna()

    history_df = df[~df["is_open_flag"]].copy()
    open_df = df[df["is_open_flag"]].copy()

    # 3.6 Build Company Features
    print("Building Company Profile Features...")

    all_customers = df.groupby("cust_number")["name_customer"].agg(
        lambda x: x.mode().iat[0] if not x.mode().empty else x.iloc[0]
    ).reset_index().rename(columns={"name_customer": "company_name"})

    if not history_df.empty:
        grp = history_df.groupby("cust_number")
        agg = grp.agg({
            "payment_delay": ["mean", "std", "min", "max"],
            "invoice_age_at_clearing": ["mean"],
            "due_days": ["mean"],
            "total_open_amount": ["mean", "sum", "count"]
        })
        agg.columns = [
            "avg_payment_delay", "std_payment_delay", "min_delay", "max_delay",
            "avg_days_to_clear", "avg_due_days",
            "avg_invoice_amount", "total_lifetime_value", "transaction_count"
        ]
        historical_stats = agg.reset_index()

        late_counts = history_df[history_df["payment_delay"] > 0].groupby("cust_number").size()
        total_counts = history_df.groupby("cust_number").size()
        late_ratio = (late_counts / total_counts).fillna(0).rename("late_payment_ratio").reset_index()
        
        historical_stats = historical_stats.merge(late_ratio, on="cust_number", how="left")
    else:
        historical_stats = pd.DataFrame(columns=["cust_number"])

    company_features = all_customers.merge(historical_stats, on="cust_number", how="left")

    defaults = {
        "avg_payment_delay": 0.0, "std_payment_delay": 0.0,
        "min_delay": 0.0, "max_delay": 0.0,
        "avg_days_to_clear": 30.0, "avg_due_days": 30.0,
        "avg_invoice_amount": 0.0, "total_lifetime_value": 0.0,
        "transaction_count": 0, "late_payment_ratio": 0.0
    }
    company_features.fillna(defaults, inplace=True)

    print(f"Persisting {len(company_features)} company feature docs...")
    batch = db.batch()
    commit_count = 0
    
    for _, row in tqdm(company_features.iterrows(), total=len(company_features), desc="Saving Profiles"):
        doc_ref = db.collection("company_features").document(str(row["cust_number"]))
        payload = {
            "cust_number": str(row["cust_number"]),
            "company_name": row.get("company_name", "") if not pd.isna(row.get("company_name", "")) else "Unknown",
            "avg_payment_delay": float(row["avg_payment_delay"]),
            "std_payment_delay": float(row["std_payment_delay"]),
            "min_delay": float(row["min_delay"]),
            "max_delay": float(row["max_delay"]),
            "avg_days_to_clear": float(row["avg_days_to_clear"]),
            "avg_due_days": float(row["avg_due_days"]),
            "avg_invoice_amount": float(row["avg_invoice_amount"]),
            "total_lifetime_value": float(row["total_lifetime_value"]),
            "transaction_count": int(row["transaction_count"]),
            "late_payment_ratio": float(row["late_payment_ratio"]),
            "last_updated_at": firestore.SERVER_TIMESTAMP
        }
        batch.set(doc_ref, payload, merge=True)
        commit_count += 1
        if commit_count >= BATCH_COMMIT_SIZE:
            commit_batch_safe(batch)
            batch = db.batch()
            commit_count = 0
    if commit_count > 0:
        commit_batch_safe(batch)

    # 4. Enrich open invoices
    if open_df.empty:
        print("No open invoices to score.")
        return

    print(f"Preparing {len(open_df)} open invoices for scoring...")
    open_df = open_df.merge(company_features, on="cust_number", how="left", suffixes=("", "_cf"))

    for k, v in defaults.items():
        if k not in open_df.columns: open_df[k] = v
        else: open_df[k] = open_df[k].fillna(v)

    if "total_open_amount" not in open_df.columns and "invoice_amount" in open_df.columns:
        open_df["total_open_amount"] = open_df["invoice_amount"].astype(float)
    open_df["total_open_amount"] = pd.to_numeric(open_df.get("total_open_amount", 0), errors="coerce").fillna(0.0)
    open_df["due_days"] = (open_df["due_date"] - open_df["invoice_date"]).dt.days

    for feat in MODEL_FEATURES:
        if feat not in open_df.columns: open_df[feat] = 0
        open_df[feat] = pd.to_numeric(open_df[feat], errors="coerce").fillna(0)

    # 6. Predict
    X = open_df[MODEL_FEATURES]
    print("Running predictions...")
    try:
        preds = model.predict(X)
        open_df["predicted_delay"] = preds.astype(float)
        open_df["predicted_payment_date"] = open_df.apply(
            lambda r: (r["due_date"] + timedelta(days=float(r["predicted_delay"]))) if pd.notna(r["due_date"]) else pd.NaT,
            axis=1
        )
    except Exception as e:
        print("Model prediction failed:", e)
        return

    # 7. Update Cases
    today = pd.Timestamp.today().normalize()
    batch = db.batch()
    commit_count = 0
    total_updates = 0

    print("Updating Firestore documents...")
    
    for idx, row in tqdm(open_df.iterrows(), total=len(open_df), desc="Processing Predictions"):
        cust = row["cust_number"]
        late_ratio = float(row.get("late_payment_ratio", 0) or 0)
        sla_days = derive_sla_days(late_ratio)
        pred_delay = float(row.get("predicted_delay", 0) or 0)
        try:
            if pd.notna(row["due_date"]):
                sla_date = row["due_date"] + timedelta(days=sla_days)
                escalated = today >= sla_date
            else:
                sla_date = None
                escalated = False
        except Exception:
            sla_date = None
            escalated = False
            
        # 🟢 UPDATED FUNCTION CALL: Now passing due_date
        zone = assign_zone(
            pred_delay, 
            sla_days, 
            sla_date, 
            row["due_date"], # <--- NEW PARAMETER
            today=today, 
            predicted_payment_date=row["predicted_payment_date"]
        )

        if zone == "GREEN": action = "NO_ACTION"
        elif zone == "YELLOW": action = "MAIL"
        elif zone == "RED": action = "ESCALATE"
        else: action = "CALL"

        update_payload = {
            "predicted_delay": float(pred_delay),
            "predicted_payment_date": row["predicted_payment_date"].strftime("%Y-%m-%d") if pd.notna(row["predicted_payment_date"]) else None,
            "sla_days": int(sla_days),
            "sla_date": sla_date.strftime("%Y-%m-%d") if sla_date is not None else None,
            "zone": zone,
            "action": action,
            "escalated": bool(escalated),
            "late_payment_ratio": float(late_ratio),
            "last_predicted_at": firestore.SERVER_TIMESTAMP
        }

        doc_ref = db.collection("cases").document(row["_doc_id"])
        batch.update(doc_ref, update_payload)
        commit_count += 1
        total_updates += 1

        if commit_count >= BATCH_COMMIT_SIZE:
            commit_batch_safe(batch)
            batch = db.batch()
            commit_count = 0

    if commit_count > 0:
        commit_batch_safe(batch)

    elapsed = time.time() - start_ts
    print(f"Updated {total_updates} open invoices. Elapsed: {elapsed:.1f}s")

# --------------------
# 4. RUN
# --------------------
if __name__ == "__main__":
    run_ml_job()