/* eslint-disable indent */
/* eslint-disable max-len */
// functions/index.js

const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const axios = require("axios");
const csv = require("csv-parser");
const crypto = require("crypto");

admin.initializeApp();
const db = getFirestore();

const CSV_URL = "https://raw.githubusercontent.com/coutdarknight/dataset/main/dataset.csv";
const BATCH_SIZE = 500;

exports.dailyFedexIngestion = functions
  .runWith({
    timeoutSeconds: 300, // ⏱ max for HTTP functions (60 minutes)
    memory: "1GB", // 💾 good for large CSV ingestion
  })
  .https.onRequest(async (req, res) => {
  try {
    // 1️⃣ Fetch CSV from GitHub
    const response = await axios.get(CSV_URL, {responseType: "stream"});

    const rows = [];

    // 2️⃣ Parse CSV safely (NO async here)
    response.data
      .pipe(csv())
      .on("data", (row) => {
        rows.push(row);
      })
      .on("end", async () => {
        console.log(`CSV loaded: ${rows.length} rows`);

        let batch = db.batch();
        let processed = 0;
        let skipped = 0;

        // 3️⃣ Process rows sequentially
        for (const row of rows) {
          const checksum = crypto
            .createHash("md5")
            .update(JSON.stringify(row))
            .digest("hex");

          const docId = row.invoice_id || row.doc_id;
          if (!docId) continue;

          const ref = db.collection("cases").doc(docId);
          const snap = await ref.get();

          if (snap.exists && snap.data().checksum === checksum) {
            skipped++;
            continue;
          }

          batch.set(
            ref,
            {
              business_code: row.business_code || "",
              cust_number: row.cust_number || "",
              name_customer: row.name_customer || "",
              clear_date: row.clear_date || "",
              buisness_year: row.buisness_year || "",
              doc_id: row.doc_id || "",
              posting_date: row.posting_date || "",
              document_create_date: row.document_create_date || "",
              document_create_date_1: row["document_create_date.1"] || "",
              due_in_date: row.due_in_date || "",
              invoice_currency: row.invoice_currency || "",
              document_type: row["document type"] || "",
              posting_id: row.posting_id || "",
              area_business: row.area_business || "",
              total_open_amount: Number(row.total_open_amount) || 0,
              baseline_create_date: row.baseline_create_date || "",
              cust_payment_terms: row.cust_payment_terms || "",
              invoice_id: row.invoice_id || "",
              isOpen: row.isOpen || "",
              checksum,
              updatedAt: new Date(),

            },
            {merge: true},
          );

          processed++;

          // 4️⃣ Commit batch every 500 docs
          if (processed % BATCH_SIZE === 0) {
            await batch.commit();
            batch = db.batch();
            console.log(`${processed} rows processed...`);
          }
        }

        // 5️⃣ Commit remaining docs
        if (processed % BATCH_SIZE !== 0) {
          await batch.commit();
        }

        console.log("FedEx ingestion completed successfully");

        res.status(200).json({
          success: true,
          processed,
          skipped,
        });
      })
      .on("error", (err) => {
        console.error("CSV parsing error:", err);
        res.status(500).send(err.message);
      });
  } catch (err) {
    console.error("Ingestion failed:", err);
    res.status(500).send(err.message);
  }
});
