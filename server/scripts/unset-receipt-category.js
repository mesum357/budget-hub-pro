/**
 * One-time cleanup: remove legacy `category` field from receipts.
 *
 * Usage (PowerShell):
 *   cd server
 *   node scripts/unset-receipt-category.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Receipt } from "../models.js";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }

  await mongoose.connect(uri);
  const res = await Receipt.updateMany({ category: { $exists: true } }, { $unset: { category: "" } });

  // eslint-disable-next-line no-console
  console.log(
    `[unset-receipt-category] matched=${res.matchedCount ?? res.n ?? 0} modified=${res.modifiedCount ?? res.nModified ?? 0}`,
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[unset-receipt-category] failed", e);
  process.exit(1);
});

