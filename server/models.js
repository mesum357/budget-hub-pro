import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
});

const subAdminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  roleLabel: { type: String, default: "Sub Admin" },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  allottedBudget: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },
  avatarDataUrl: { type: String },
  /** When set, the sub-admin is removed from the app UI but the document remains in MongoDB. */
  deletedAt: { type: Date, default: null },
  /** Original login email stored when soft-deleting (current `email` is replaced with a tombstone to satisfy uniqueness). */
  deletedEmailOriginal: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const receiptSchema = new mongoose.Schema({
  subAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "SubAdmin", required: true },
  amount: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  attachmentFilename: { type: String },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

const topUpSchema = new mongoose.Schema({
  subAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "SubAdmin", required: true },
  amount: { type: Number, required: true, min: 0 },
  note: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

/** Logged when allotted budget is set at create or changed via PATCH (delta per effective month for reporting). */
const allotmentChangeSchema = new mongoose.Schema({
  subAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "SubAdmin", required: true },
  delta: { type: Number, required: true },
  effectiveAt: { type: Date, required: true, default: Date.now },
});

export const Admin = mongoose.models.Admin || mongoose.model("Admin", adminSchema);
export const SubAdmin = mongoose.models.SubAdmin || mongoose.model("SubAdmin", subAdminSchema);
export const Receipt = mongoose.models.Receipt || mongoose.model("Receipt", receiptSchema);
export const TopUp = mongoose.models.TopUp || mongoose.model("TopUp", topUpSchema);
export const AllotmentChange =
  mongoose.models.AllotmentChange || mongoose.model("AllotmentChange", allotmentChangeSchema);

/** Sum of receipt amounts counting toward the spending cap (pending + approved). */
export async function sumCommittedSpending(subAdminId) {
  const id = typeof subAdminId === "string" ? new mongoose.Types.ObjectId(subAdminId) : subAdminId;
  const res = await Receipt.aggregate([
    { $match: { subAdminId: id, status: { $in: ["pending", "approved"] } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return res[0]?.total ?? 0;
}
``