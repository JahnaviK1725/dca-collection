import pandas as pd
import numpy as np
import lightgbm as lgb
from datetime import timedelta
import math
import os
import sys
import json
import time
from tqdm import tqdm  # <--- IMPORT ADDED

import firebase_admin
from firebase_admin import firestore
from google.cloud import firestore as google_firestore

# --------------------
# CONFIG
# --------------------
# 1. Force connection to Local Emulator
os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8085"
os.environ["GCLOUD_PROJECT"] = "fedex-dca"

MODEL_PATH = "model/payment_delay_lgb_model.txt"       # your saved LightGBM model
BATCH_COMMIT_SIZE = 400

# Features that the model expects
MODEL_FEATURES = [
    "total_open_amount", "due_days", "avg_due_days", "avg_payment_delay",
    "std_payment_delay", "avg_days_to_clear", "avg_invoice_amount",
    "transaction_count", "late_payment_ratio"
]

# --------------------
# 1. INITIALIZATION (EMULATOR ONLY)
# --------------------
print(f"⚠️  Running in EMULATOR mode at {os.environ['FIRESTORE_EMULATOR_HOST']}")

# Initialize Firebase Admin with a dummy project ID (no credentials needed for emulator)
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={'projectId': 'fedex-dca'})

# Connect directly to the emulator project
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

def assign_zone(pred_delay, sla_days):
    if pred_delay is None or (isinstance(pred_delay, float) and math.isnan(pred_delay)):
        return "UNKNOWN"
    if pred_delay <= 0:
        return "GREEN"
    elif pred_delay <= sla_days:
        return "YELLOW"
    else:
        return "ORANGE"

def derive_sla_days(late_ratio):
    try:
        if late_ratio >= 0.8: return 3
        elif late_ratio >= 0.5: return 5
        elif late_ratio >= 0.2: return 10
        else: return 15
    except Exception:
        return 15

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
    for doc in docs:
        d = doc.to_dict()
        d["_doc_id"] = doc.id
        rows.append(d)

    if not rows:
        print("No cases found in Firestore Emulator. Exiting.")
        return

    df = pd.DataFrame(rows)
    print(f"Total cases fetched: {len(df)}")

    # 3.2 Parse dates robustly
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

    # currency normalization
    df["invoice_currency"] = df.get("invoice_currency", "USD").fillna("USD")
    df["total_open_amount"] = np.where(df["invoice_currency"] == "CAD", df["total_open_amount"] * 0.75, df["total_open_amount"])

    # 3.4 Create base metrics
    df["payment_delay"] = (df["clear_date"] - df["due_date"]).dt.days
    df["due_days"] = (df["due_date"] - df["invoice_date"]).dt.days
    df["invoice_age_at_clearing"] = (df["clear_date"] - df["invoice_date"]).dt.days

    if "cust_number" not in df.columns:
        df["cust_number"] = df.get("customer_id", "").astype(str)
    df["cust_number"] = df["cust_number"].astype(str)

    if "name_customer" not in df.columns:
        df["name_customer"] = df.get("company_name", "")

    # 3.5 Determine open vs closed flags
    if "is_open" in df.columns:
        df["is_open_flag"] = df["is_open"].astype(bool)
    elif "isOpen" in df.columns:
        df["is_open_flag"] = df["isOpen"].astype(bool)
    else:
        df["is_open_flag"] = df["clear_date"].isna()

    history_df = df[~df["is_open_flag"]].copy()
    open_df = df[df["is_open_flag"]].copy()

    # 3.6 Build company_features
    if history_df.empty:
        print("No historical closed invoices found. Cold starts.")
        company_features = pd.DataFrame(columns=[
            "cust_number", "avg_payment_delay", "std_payment_delay", "min_delay", "max_delay",
            "avg_days_to_clear", "avg_due_days", "avg_invoice_amount",
            "total_lifetime_value", "transaction_count", "company_name"
        ])
    else:
        grp = history_df.groupby("cust_number")
        agg = grp.agg({
            "payment_delay": ["mean", "std", "min", "max"],
            "invoice_age_at_clearing": ["mean"],
            "due_days": ["mean"],
            "total_open_amount": ["mean", "sum", "count"],
            "name_customer": lambda x: x.mode().iat[0] if not x.mode().empty else x.iloc[0]
        })
        agg.columns = [
            "avg_payment_delay", "std_payment_delay", "min_delay", "max_delay",
            "avg_days_to_clear", "avg_due_days",
            "avg_invoice_amount", "total_lifetime_value", "transaction_count",
            "company_name"
        ]
        company_features = agg.reset_index()

        late_counts = history_df[history_df["payment_delay"] > 0].groupby("cust_number").size()
        total_counts = history_df.groupby("cust_number").size()
        late_ratio = (late_counts / total_counts).fillna(0).rename("late_payment_ratio").reset_index()

        company_features = company_features.merge(late_ratio, on="cust_number", how="left")
        company_features["late_payment_ratio"] = company_features["late_payment_ratio"].fillna(0)
        company_features["std_payment_delay"] = company_features["std_payment_delay"].fillna(0)

    # Persist company_features
    print(f"Persisting {len(company_features)} company feature docs to Emulator...")
    batch = db.batch()
    commit_count = 0
    
    # Optional: You can add tqdm here too if this step is slow
    for _, row in company_features.iterrows():
        doc_ref = db.collection("company_features").document(str(row["cust_number"]))
        payload = {
            "cust_number": str(row["cust_number"]),
            "company_name": row.get("company_name", "") if not pd.isna(row.get("company_name", "")) else "",
            "avg_payment_delay": float(row.get("avg_payment_delay") or 0.0),
            "std_payment_delay": float(row.get("std_payment_delay") or 0.0),
            "min_delay": float(row.get("min_delay") or 0.0),
            "max_delay": float(row.get("max_delay") or 0.0),
            "avg_days_to_clear": float(row.get("avg_days_to_clear") or 0.0),
            "avg_due_days": float(row.get("avg_due_days") or 0.0),
            "avg_invoice_amount": float(row.get("avg_invoice_amount") or 0.0),
            "total_lifetime_value": float(row.get("total_lifetime_value") or 0.0),
            "transaction_count": int(row.get("transaction_count") or 0),
            "late_payment_ratio": float(row.get("late_payment_ratio") or 0.0),
            "last_updated_at": firestore.SERVER_TIMESTAMP
        }
        batch.set(doc_ref, payload, merge=True)
        commit_count += 1
        if commit_count >= BATCH_COMMIT_SIZE:
            batch.commit()
            batch = db.batch()
            commit_count = 0
    if commit_count > 0:
        batch.commit()

    # 4. Enrich open invoices
    if open_df.empty:
        print("No open invoices to score. Exiting.")
        return

    print(f"Preparing {len(open_df)} open invoices for scoring...")
    open_df = open_df.merge(company_features, on="cust_number", how="left", suffixes=("", "_cf"))

    # 5. Fill cold-start defaults
    default_company = {
        "avg_due_days": 30, "avg_payment_delay": 0, "std_payment_delay": 0,
        "avg_days_to_clear": 30, "avg_invoice_amount": 0, "transaction_count": 0, "late_payment_ratio": 0
    }
    for k, v in default_company.items():
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
    print("Running predictions with model...")
    try:
        preds = model.predict(X)
    except Exception as e:
        print("Model prediction failed:", e)
        return
    print("Predictions completed.")
    open_df["predicted_delay"] = preds.astype(float)
    open_df["predicted_payment_date"] = open_df.apply(
        lambda r: (r["due_date"] + timedelta(days=float(r["predicted_delay"]))) if pd.notna(r["due_date"]) else pd.NaT,
        axis=1
    )

    # 7. SLA and Updates
    today = pd.Timestamp.today().normalize()
    batch = db.batch()
    commit_count = 0
    total_updates = 0

    print("Updating Firestore documents...")
    
    # ---------------------------------------------------------
    # TQDM ADDED HERE
    # ---------------------------------------------------------
    for idx, row in tqdm(open_df.iterrows(), total=len(open_df), desc="Processing Updates"):
        cust = row["cust_number"]
        late_ratio = float(row.get("late_payment_ratio", 0) or 0)
        sla_days = derive_sla_days(late_ratio)
        pred_delay = float(row.get("predicted_delay", 0) or 0)
        zone = assign_zone(pred_delay, sla_days)

        if zone == "GREEN": action = "NO_ACTION"
        elif zone == "YELLOW": action = "MAIL"
        else: action = "CALL"

        escalated = False
        try:
            if pd.notna(row["due_date"]):
                sla_date = row["due_date"] + timedelta(days=sla_days)
                escalated = today >= sla_date
            else:
                sla_date = None
        except Exception:
            sla_date = None

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
            batch.commit()
            batch = db.batch()
            commit_count = 0

    if commit_count > 0:
        batch.commit()

    elapsed = time.time() - start_ts
    print(f"Updated {total_updates} open invoices. Elapsed: {elapsed:.1f}s")

# --------------------
# 4. RUN
# --------------------
if __name__ == "__main__":
    run_ml_job()