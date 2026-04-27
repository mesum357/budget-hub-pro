import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import cors from "cors";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Admin, SubAdmin, Receipt, TopUp, AllotmentChange, sumCommittedSpending } from "./models.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Backend reads environment only from `server/.env` (not the repo root — keeps secrets out of the Vite app tree). */
const serverEnv = path.join(__dirname, ".env");
if (!fs.existsSync(serverEnv)) {
  console.warn(`[env] No file at ${serverEnv} — create it (copy server/.env.example) for MONGODB_URI and secrets.`);
}
dotenv.config({ path: serverEnv });

const PORT = Number(process.env.PORT) || 5000;

/** URL-encode username/password in mongodb:// or mongodb+srv:// URIs (Atlas passwords with @, :, #, etc.). */
function sanitizeMongoUri(uri) {
  const trimmed = String(uri || "").trim();
  if (!trimmed) return trimmed;
  const m = trimmed.match(/^(mongodb(?:\+srv)?:\/\/)([^\/?#]+)@(.*)$/);
  if (!m) return trimmed;
  const [, proto, authPart, tail] = m;
  const colon = authPart.indexOf(":");
  if (colon === -1) return trimmed;
  let user = authPart.slice(0, colon);
  let pass = authPart.slice(colon + 1);
  try {
    user = decodeURIComponent(user);
    pass = decodeURIComponent(pass);
  } catch {
    /* keep as-is */
  }
  return `${proto}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${tail}`;
}

function redactMongoUri(uri) {
  return String(uri).replace(/(mongodb(?:\+srv)?:\/\/)([^:]+):[^@]+@/, "$1$2:***@");
}

async function remainingBudgetForUser(subAdminId) {
  const u = await SubAdmin.findById(subAdminId).select("walletBalance deletedAt").lean();
  if (!u || u.deletedAt) return 0;
  return Math.max(0, u.walletBalance ?? 0);
}

/** Single connection string (Atlas: Project → Connect → Drivers → copy `mongodb+srv://...`). */
const MONGODB_URI_RAW = (process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/budget-hub-pro").trim();
const MONGODB_URI = sanitizeMongoUri(MONGODB_URI_RAW);
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@company.com").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    cb(null, safe);
  },
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

function requireAdmin(req, res, next) {
  if (req.session?.role === "admin") return next();
  return res.status(401).json({ error: "Unauthorized" });
}

function requireSub(req, res, next) {
  if (req.session?.role !== "subadmin" || !req.session.subAdminId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  SubAdmin.findById(req.session.subAdminId)
    .select("deletedAt status")
    .lean()
    .then((u) => {
      if (!u || u.deletedAt || u.status !== "active") {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "Unauthorized" });
      }
      next();
    })
    .catch(() => res.status(500).json({ error: "Unauthorized" }));
}

/** Sub-admins shown in the admin app (soft-deleted rows stay in MongoDB with `deletedAt` set). */
const ACTIVE_SUBADMIN = { deletedAt: null };

async function ensureAdminUser() {
  const existing = await Admin.findOne({ email: ADMIN_EMAIL });
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  if (!existing) {
    await Admin.create({ email: ADMIN_EMAIL, passwordHash: hash });
    console.log(`Seeded admin: ${ADMIN_EMAIL}`);
  } else if (process.env.ADMIN_RESET === "1") {
    existing.passwordHash = hash;
    await existing.save();
    console.log(`Reset admin password for ${ADMIN_EMAIL}`);
  }
}

/** First instant of the oldest month included in the admin monthly chart (UTC). */
function chartWindowStartUtc(monthsBack = 6) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthsBack - 1), 1));
}

/** When sum(AllotmentChange.delta) for a user ≠ allottedBudget, monthly charts show 0. Insert one baseline row. */
async function backfillMissingAllotmentChanges() {
  const monthsBack = 6;
  const chartStart = chartWindowStartUtc(monthsBack);
  const subs = await SubAdmin.find({ ...ACTIVE_SUBADMIN, allottedBudget: { $gt: 0 } })
    .select("_id allottedBudget createdAt")
    .lean();
  let added = 0;
  for (const u of subs) {
    const agg = await AllotmentChange.aggregate([
      { $match: { subAdminId: u._id } },
      { $group: { _id: null, t: { $sum: "$delta" } } },
    ]);
    const sumDeltas = agg[0]?.t ?? 0;
    const cap = u.allottedBudget ?? 0;
    const missing = cap - sumDeltas;
    if (Math.abs(missing) < 0.005) continue;
    const created = u.createdAt ? new Date(u.createdAt) : chartStart;
    const effectiveAt = created >= chartStart ? created : chartStart;
    await AllotmentChange.create({
      subAdminId: u._id,
      delta: Math.round(missing * 100) / 100,
      effectiveAt,
    });
    added += 1;
  }
  if (added > 0) {
    console.log(`[allotment] Added ${added} baseline AllotmentChange row(s) so “allocated per month” matches current caps.`);
  }
}

function startOfWeek(d) {
  const x = new Date(d);
  const day = x.getUTCDay();
  const diff = (day + 6) % 7;
  x.setUTCDate(x.getUTCDate() - diff);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d) {
  const x = new Date(d);
  x.setUTCDate(1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function monthKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function buildMonthlySeries(monthsBack = 6) {
  const now = new Date();
  const keys = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  const start = chartWindowStartUtc(monthsBack);
  const agg = await Receipt.aggregate([
    {
      $match: {
        status: { $in: ["pending", "approved"] },
        date: { $gte: start },
      },
    },
    {
      $group: {
        _id: {
          y: { $year: "$date" },
          m: { $month: "$date" },
        },
        spending: { $sum: "$amount" },
      },
    },
  ]);
  const spendMap = new Map();
  for (const row of agg) {
    const k = `${row._id.y}-${String(row._id.m).padStart(2, "0")}`;
    spendMap.set(k, row.spending);
  }

  const topupAgg = await TopUp.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
        credited: { $sum: "$amount" },
      },
    },
  ]);
  const allotMap = new Map(
    topupAgg.map((row) => [`${row._id.y}-${String(row._id.m).padStart(2, "0")}`, row.credited]),
  );

  return keys.map((k) => ({
    month: monthLabelFromKey(k),
    monthKey: k,
    spending: Math.round((spendMap.get(k) ?? 0) * 100) / 100,
    budget: Math.round((allotMap.get(k) ?? 0) * 100) / 100,
  }));
}

async function buildSubMonthlySeries(subAdminId, monthsBack = 6) {
  const oid = new mongoose.Types.ObjectId(subAdminId);
  const now = new Date();
  const keys = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  const start = chartWindowStartUtc(monthsBack);
  const agg = await Receipt.aggregate([
    {
      $match: {
        subAdminId: oid,
        status: { $in: ["pending", "approved"] },
        date: { $gte: start },
      },
    },
    {
      $group: {
        _id: { y: { $year: "$date" }, m: { $month: "$date" } },
        spending: { $sum: "$amount" },
      },
    },
  ]);
  const map = new Map();
  for (const row of agg) {
    const k = `${row._id.y}-${String(row._id.m).padStart(2, "0")}`;
    map.set(k, row.spending);
  }
  const topupAgg = await TopUp.aggregate([
    { $match: { subAdminId: oid, createdAt: { $gte: start } } },
    {
      $group: {
        _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
        credited: { $sum: "$amount" },
      },
    },
  ]);
  const topupMap = new Map(
    topupAgg.map((row) => [`${row._id.y}-${String(row._id.m).padStart(2, "0")}`, row.credited]),
  );
  return keys.map((k) => ({
    month: monthLabelFromKey(k),
    monthKey: k,
    spending: Math.round((map.get(k) ?? 0) * 100) / 100,
    budget: Math.round((topupMap.get(k) ?? 0) * 100) / 100,
  }));
}

async function main() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 12000 });
    const dbName = mongoose.connection.db?.databaseName ?? "(unknown)";
    console.log("[mongodb] Connected successfully.");
    console.log("[mongodb]   Database:", dbName);
    console.log("[mongodb]   URI (redacted):", redactMongoUri(MONGODB_URI));
  } catch (e) {
    console.error("MongoDB connection failed. URI (redacted):", redactMongoUri(MONGODB_URI));
    const code = e?.code ?? e?.cause?.code;
    const msg = String(e?.message || e);
    if (code === 8000 || /bad auth|authentication failed/i.test(msg)) {
      console.error(
        [
          "Atlas rejected the username/password in MONGODB_URI.",
          "- Atlas → Database Access: use that database user’s password (replace <password> in the copied connection string).",
          "- If the password contains @ : # / ? etc., URL-encode it inside the URI, or reset the DB user to a simpler password.",
          "- Atlas → Network Access: allow your IP (or 0.0.0.0/0 for development).",
        ].join("\n"),
      );
    } else if (/ECONNREFUSED|ENOTFOUND/i.test(msg)) {
      console.error(
        [
          "Could not reach MongoDB on that host/port.",
          "- Check MONGODB_URI in server/.env (Atlas → Connect → Drivers).",
          "- For local Mongo: ensure mongod is running if using mongodb://127.0.0.1:...",
          `- Env file: ${serverEnv}`,
        ].join("\n"),
      );
    }
    console.error(e);
    process.exit(1);
  }
  await ensureAdminUser();

  const app = express();
  app.set("trust proxy", 1);

  /** Collect allowed browser origins (comma-separated in each var). */
  function parseOriginList() {
    const parts = [process.env.CORS_ORIGIN, process.env.FRONTEND_URL, process.env.WEB_APP_URL]
      .filter(Boolean)
      .join(",");
    const list = parts
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set(list)];
  }

  /**
   * Never pass a single string to cors({ origin }) — it always echoes that value and breaks other sites.
   * Use a Set + callback so Access-Control-Allow-Origin matches the request only when allowed.
   */
  function corsMiddleware() {
    const origins = parseOriginList();
    if (origins.length > 0) {
      const allow = new Set(origins);
      console.log("[cors] Allowed origins:", [...allow].join(", "));
      if (
        process.env.RENDER === "true" &&
        [...allow].every((o) => /localhost|127\.0\.0\.1/i.test(o))
      ) {
        console.warn(
          "[cors] RENDER=true but only localhost origins. Set FRONTEND_URL (or WEB_APP_URL) to your live SPA, e.g. https://budget-hub-pro.onrender.com",
        );
      }
      return cors({
        credentials: true,
        origin(originHeader, cb) {
          if (!originHeader) return cb(null, true);
          if (allow.has(originHeader)) return cb(null, true);
          return cb(null, false);
        },
      });
    }
    console.log("[cors] CORS_ORIGIN / FRONTEND_URL / WEB_APP_URL unset — only localhost / 127.0.0.1 allowed");
    return cors({
      credentials: true,
      origin(originHeader, cb) {
        if (!originHeader) return cb(null, true);
        try {
          const u = new URL(originHeader);
          if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return cb(null, true);
        } catch {
          /* ignore */
        }
        return cb(null, false);
      },
    });
  }
  app.use(corsMiddleware());
  app.use(express.json({ limit: "6mb" }));
  app.use("/uploads", express.static(UPLOAD_DIR));

  /**
   * SPA on another host (e.g. two Render URLs) needs SameSite=None; Secure or the session cookie
   * is not sent on fetch(..., { credentials: "include" }) → every /api/admin/* returns 401.
   * SESSION_SAME_SITE=lax forces Lax. SESSION_SAME_SITE=none forces cross-site.
   * On Render, if unset, we enable cross-site cookies when RENDER_EXTERNAL_URL and a deployed https frontend differ.
   */
  function useCrossSiteSessionCookie() {
    const explicit = process.env.SESSION_SAME_SITE?.trim().toLowerCase();
    if (explicit === "lax") return false;
    if (explicit === "none") return true;
    if (process.env.RENDER !== "true") return false;
    const backendUrl = process.env.RENDER_EXTERNAL_URL?.trim();
    if (!backendUrl) return false;

    let feOrigin = null;
    for (const o of parseOriginList()) {
      if (o.startsWith("https://") && !/localhost|127\.0\.0\.1/i.test(o)) {
        try {
          feOrigin = new URL(o).origin;
          break;
        } catch {
          /* skip */
        }
      }
    }
    if (!feOrigin) {
      const raw = (process.env.FRONTEND_URL || process.env.WEB_APP_URL || "").split(",")[0]?.trim();
      if (raw) {
        try {
          feOrigin = new URL(raw).origin;
        } catch {
          /* skip */
        }
      }
    }
    if (!feOrigin) return false;
    try {
      const beOrigin = new URL(backendUrl).origin;
      return feOrigin !== beOrigin;
    } catch {
      return false;
    }
  }

  const crossSiteSession = useCrossSiteSessionCookie();
  const explicitSameSite = process.env.SESSION_SAME_SITE?.trim().toLowerCase();
  // iOS WebKit can behave inconsistently with Lax in production app shells;
  // on Render, prefer None+Secure unless explicitly forced to lax.
  const preferNoneCookie = process.env.RENDER === "true" && explicitSameSite !== "lax";
  if (crossSiteSession) {
    console.log("[session] SameSite=None; Secure (cross-origin SPA ↔ API)");
  }

  const cookieSecure =
    crossSiteSession ||
    process.env.COOKIE_SECURE === "1" ||
    process.env.RENDER === "true" ||
    String(process.env.RENDER_EXTERNAL_URL || "").startsWith("https://");

  app.use(
    session({
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      proxy: true,
      store: MongoStore.create({ mongoUrl: MONGODB_URI, ttl: 60 * 60 * 24 * 7 }),
      cookie: {
        httpOnly: true,
        sameSite: crossSiteSession || preferNoneCookie ? "none" : "lax",
        secure: cookieSecure,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.post("/api/auth/login", async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const email = String(req.body?.email || "").toLowerCase().trim();
      const password = String(req.body?.password || "");
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });

      const admin = await Admin.findOne({ email });
      if (admin && (await bcrypt.compare(password, admin.passwordHash))) {
        req.session.role = "admin";
        req.session.adminId = String(admin._id);
        delete req.session.subAdminId;
        return res.json({ role: "admin" });
      }

      const user = await SubAdmin.findOne({ email, status: "active", ...ACTIVE_SUBADMIN });
      if (user && (await bcrypt.compare(password, user.passwordHash))) {
        req.session.role = "subadmin";
        req.session.subAdminId = String(user._id);
        delete req.session.adminId;
        return res.json({
          role: "subadmin",
          user: { id: String(user._id), name: user.name, email: user.email },
        });
      }

      return res.status(401).json({ error: "Invalid credentials" });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (req.session?.role === "admin") return res.json({ role: "admin" });
    if (req.session?.role === "subadmin" && req.session.subAdminId) {
      const u = await SubAdmin.findById(req.session.subAdminId).lean();
      if (!u || u.status !== "active" || u.deletedAt) {
        req.session.destroy(() => {});
        return res.json({ role: null });
      }
      return res.json({
        role: "subadmin",
        user: { id: String(u._id), name: u.name, email: u.email },
      });
    }
    return res.json({ role: null });
  });

  /* ---------- Admin ---------- */
  app.post("/api/admin/verify-password", requireAdmin, async (req, res) => {
    const password = String(req.body?.password || "");
    if (!password) return res.status(400).json({ error: "Password is required" });
    const admin = await Admin.findById(req.session.adminId);
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid password" });
    return res.json({ ok: true });
  });

  app.patch("/api/admin/password", requireAdmin, async (req, res) => {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from your current password" });
    }
    const admin = await Admin.findById(req.session.adminId);
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();
    return res.json({ ok: true });
  });

  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    const list = await SubAdmin.find(ACTIVE_SUBADMIN).sort({ createdAt: -1 }).lean();
    const rows = await Promise.all(
      list.map(async (u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.roleLabel,
        status: u.status,
        createdAt: u.createdAt?.toISOString?.().split("T")[0] ?? "",
        // For UI compatibility, "allottedBudget" now means total credited (top-ups) = wallet + committed spend.
        allottedBudget: (u.walletBalance ?? 0) + (await sumCommittedSpending(u._id)),
        walletBalance: await remainingBudgetForUser(u._id),
        avatar: u.avatarDataUrl || undefined,
      })),
    );
    res.json(rows);
  });

  app.get("/api/admin/users/:id/profile", requireAdmin, async (req, res) => {
    const u = await SubAdmin.findById(req.params.id).lean();
    if (!u || u.deletedAt) return res.status(404).json({ error: "User not found" });
    const oid = u._id;
    const receipts = await Receipt.find({ subAdminId: oid }).sort({ date: -1, createdAt: -1 }).limit(250).lean();

    const now = new Date();
    const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const byMonth = await Receipt.aggregate([
      {
        $match: {
          subAdminId: oid,
          status: { $in: ["pending", "approved"] },
          date: { $gte: startMonth },
        },
      },
      {
        $group: {
          _id: { y: { $year: "$date" }, m: { $month: "$date" } },
          spent: { $sum: "$amount" },
        },
      },
    ]);
    const spentMap = new Map(
      byMonth.map((row) => [`${row._id.y}-${String(row._id.m).padStart(2, "0")}`, row.spent]),
    );

    const byTopUpMonth = await TopUp.aggregate([
      {
        $match: {
          subAdminId: oid,
          createdAt: { $gte: startMonth },
        },
      },
      {
        $group: {
          _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
          credited: { $sum: "$amount" },
        },
      },
    ]);
    const creditedMonthMap = new Map(
      byTopUpMonth.map((row) => [`${row._id.y}-${String(row._id.m).padStart(2, "0")}`, row.credited]),
    );

    const creditedTotal = [...creditedMonthMap.values()].reduce((a, b) => a + b, 0);
    const monthly = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const raw = spentMap.get(key) ?? 0;
      const allotInMonth = creditedMonthMap.get(key) ?? 0;
      monthly.push({
        monthKey: key,
        monthLabel: d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
        allotted: Math.round(allotInMonth * 100) / 100,
        spent: Math.round(raw * 100) / 100,
      });
    }

    const firstAllotIdx = monthly.findIndex((row) => row.allotted > 0);
    let monthlyForChart = monthly;
    if (firstAllotIdx > 0) {
      monthlyForChart = monthly.slice(firstAllotIdx);
    } else if (firstAllotIdx === -1) {
      const firstSpendIdx = monthly.findIndex((row) => row.spent > 0);
      if (firstSpendIdx > 0) monthlyForChart = monthly.slice(firstSpendIdx);
    }

    res.json({
      user: {
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.roleLabel,
        status: u.status,
        createdAt: u.createdAt?.toISOString?.().split("T")[0] ?? "",
        allottedBudget: Math.round(((u.walletBalance ?? 0) + (await sumCommittedSpending(u._id))) * 100) / 100,
        walletBalance: await remainingBudgetForUser(u._id),
        avatar: u.avatarDataUrl || undefined,
      },
      spendingHistory: receipts.map((r) => ({
        id: String(r._id),
        amount: r.amount,
        reason: r.reason,
        date: r.date?.toISOString?.().split("T")[0] ?? "",
        status: r.status,
        attachment: r.attachmentFilename || undefined,
      })),
      monthly: monthlyForChart,
    });
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { name, email, password, role, avatar } = req.body || {};
      if (!name?.trim() || !email?.trim() || !password || String(password).length < 6) {
        return res.status(400).json({ error: "Name, email, and password (min 6 chars) required" });
      }
      const hash = await bcrypt.hash(String(password), 10);
      const doc = await SubAdmin.create({
        name: String(name).trim(),
        email: String(email).toLowerCase().trim(),
        passwordHash: hash,
        roleLabel: role ? String(role) : "Sub Admin",
        // Budget is wallet/top-ups only. New users start at 0 and must be topped up by admin.
        allottedBudget: 0,
        walletBalance: 0,
        avatarDataUrl: typeof avatar === "string" && avatar.startsWith("data:") ? avatar.slice(0, 400000) : undefined,
      });
      res.status(201).json({
        id: String(doc._id),
        name: doc.name,
        email: doc.email,
        role: doc.roleLabel,
        status: doc.status,
        createdAt: doc.createdAt.toISOString().split("T")[0],
      });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: "Email already exists" });
      console.error(e);
      res.status(500).json({ error: "Could not create user" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }
      const oid = new mongoose.Types.ObjectId(req.params.id);
      const prev = await SubAdmin.findById(oid).lean();
      if (!prev || prev.deletedAt) return res.status(404).json({ error: "Not found" });

      const { name, email, role, roleLabel, status, password, avatar } = req.body || {};
      const setDoc = {};

      if (name !== undefined) {
        const n = String(name).trim();
        if (!n) return res.status(400).json({ error: "Name cannot be empty" });
        setDoc.name = n;
      }
      if (email !== undefined) {
        const em = String(email).toLowerCase().trim();
        if (!em) return res.status(400).json({ error: "Email cannot be empty" });
        const clash = await SubAdmin.findOne({ email: em, _id: { $ne: oid }, ...ACTIVE_SUBADMIN }).lean();
        if (clash) return res.status(409).json({ error: "Email already in use" });
        setDoc.email = em;
      }
      const rLabel = role !== undefined ? role : roleLabel;
      if (rLabel !== undefined) {
        const rl = String(rLabel).trim();
        setDoc.roleLabel = rl || "Sub Admin";
      }
      if (status !== undefined) {
        if (status !== "active" && status !== "inactive") {
          return res.status(400).json({ error: "Status must be active or inactive" });
        }
        setDoc.status = status;
      }
      if (typeof password === "string" && password.length > 0) {
        if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
        setDoc.passwordHash = await bcrypt.hash(password, 10);
      }
      if (typeof avatar === "string" && avatar.startsWith("data:")) {
        setDoc.avatarDataUrl = avatar.slice(0, 400000);
      }

      const unsetAvatar = avatar === null;
      if (Object.keys(setDoc).length === 0 && !unsetAvatar) {
        return res.status(400).json({ error: "No updates provided" });
      }

      const mongoUpdate = {};
      if (Object.keys(setDoc).length) mongoUpdate.$set = setDoc;
      if (unsetAvatar) mongoUpdate.$unset = { avatarDataUrl: "" };

      let u = Object.keys(mongoUpdate).length
        ? await SubAdmin.findByIdAndUpdate(oid, mongoUpdate, { new: true, runValidators: true }).lean()
        : await SubAdmin.findById(oid).lean();
      if (!u) return res.status(404).json({ error: "Not found" });
      if ((u.walletBalance ?? 0) < 0) {
        u = await SubAdmin.findByIdAndUpdate(oid, { $set: { walletBalance: 0 } }, { new: true }).lean();
      }
      res.json({
        id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.roleLabel,
        status: u.status,
        createdAt: u.createdAt?.toISOString?.().split("T")[0] ?? "",
        allottedBudget: (u.walletBalance ?? 0) + (await sumCommittedSpending(u._id)),
        walletBalance: u.walletBalance,
        avatar: u.avatarDataUrl || undefined,
      });
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: "Email already in use" });
      console.error(e);
      res.status(500).json({ error: "Could not update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "Invalid user id" });
      }
      const oid = new mongoose.Types.ObjectId(req.params.id);
      const existing = await SubAdmin.findById(oid).lean();
      if (!existing) return res.status(404).json({ error: "Not found" });
      if (existing.deletedAt) return res.status(404).json({ error: "Not found" });

      const tombstoneEmail = `removed-${oid.toString()}@account-removed.invalid`;
      await SubAdmin.findByIdAndUpdate(oid, {
        $set: {
          deletedAt: new Date(),
          deletedEmailOriginal: existing.deletedEmailOriginal || existing.email,
          email: tombstoneEmail,
          status: "inactive",
        },
      });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not delete user" });
    }
  });

  app.patch("/api/admin/users/:id/allotment", requireAdmin, async (req, res) => {
    return res.status(410).json({ error: "Allotted budget is deprecated. Use Top Ups to credit wallet balance." });
  });

  app.post("/api/admin/users/:id/topup", requireAdmin, async (req, res) => {
    const amount = Number(req.body?.amount);
    const note = String(req.body?.note || "");
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
    const u = await SubAdmin.findOne({ _id: req.params.id, ...ACTIVE_SUBADMIN });
    if (!u) return res.status(404).json({ error: "User not found" });
    u.walletBalance += amount;
    await u.save();
    await TopUp.create({ subAdminId: u._id, amount, note });
    res.json({
      walletBalance: u.walletBalance,
      topUp: { amount, note, createdAt: new Date().toISOString() },
    });
  });

  app.get("/api/admin/budgets", requireAdmin, async (_req, res) => {
    const users = await SubAdmin.find(ACTIVE_SUBADMIN).lean();
    const out = [];
    for (const u of users) {
      const spent = await sumCommittedSpending(u._id);
      const wallet = Math.max(0, u.walletBalance ?? 0);
      const credited = wallet + spent;
      const util = credited > 0 ? Math.min(100, Math.round((spent / credited) * 100)) : 0;
      out.push({
        userId: String(u._id),
        userName: u.name,
        budgetAvailable: wallet,
        budgetAllotted: credited,
        spent,
        utilizationPct: util,
      });
    }
    res.json(out);
  });

  app.get("/api/admin/receipts", requireAdmin, async (_req, res) => {
    const rows = await Receipt.find()
      .sort({ createdAt: -1 })
      .populate({ path: "subAdminId", match: ACTIVE_SUBADMIN, select: "name" })
      .lean();
    res.json(
      rows
        .filter((r) => r.subAdminId)
        .map((r) => ({
        id: String(r._id),
        userId: String(r.subAdminId?._id || r.subAdminId),
        userName: r.subAdminId?.name || "User",
        amount: r.amount,
        reason: r.reason,
        date: r.date?.toISOString?.().split("T")[0] ?? "",
        status: r.status,
        attachment: r.attachmentFilename || undefined,
      })),
    );
  });

  app.patch("/api/admin/receipts/:id", requireAdmin, async (req, res) => {
    const status = req.body?.status;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const r = await Receipt.findById(req.params.id);
    if (!r) return res.status(404).json({ error: "Not found" });
    if (r.status !== "pending") return res.status(400).json({ error: "Receipt already finalized" });

    r.status = status;
    await r.save();
    if (status === "rejected") {
      await SubAdmin.findByIdAndUpdate(r.subAdminId, { $inc: { walletBalance: r.amount } });
    }
    res.json({
      id: String(r._id),
      status: r.status,
    });
  });

  app.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
    const userCount = await SubAdmin.countDocuments(ACTIVE_SUBADMIN);
    const spentAgg = await Receipt.aggregate([
      {
        $lookup: {
          from: SubAdmin.collection.collectionName,
          let: { sid: "$subAdminId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$sid"] }, deletedAt: null } },
          ],
          as: "sub",
        },
      },
      { $match: { "sub.0": { $exists: true }, status: { $in: ["pending", "approved"] } } },
      { $group: { _id: null, t: { $sum: "$amount" } } },
    ]);
    const totalSpent = spentAgg[0]?.t ?? 0;
    const walletAgg = await SubAdmin.aggregate([
      { $match: ACTIVE_SUBADMIN },
      { $group: { _id: null, t: { $sum: "$walletBalance" } } },
    ]);
    const totalWallet = walletAgg[0]?.t ?? 0;
    const totalAllotted = Math.round((totalWallet + totalSpent) * 100) / 100;
    const utilizationPct = totalAllotted > 0 ? Math.round((totalSpent / totalAllotted) * 100) : 0;
    const monthly = await buildMonthlySeries(6);
    const recent = await Receipt.find({ status: { $in: ["pending", "approved"] } })
      .sort({ createdAt: -1 })
      .limit(16)
      .populate({ path: "subAdminId", match: ACTIVE_SUBADMIN, select: "name" })
      .lean();
    const recentActivity = recent
      .filter((item) => item.subAdminId)
      .slice(0, 8)
      .map((item) => ({
        id: String(item._id),
        userName: item.subAdminId?.name || "User",
        reason: item.reason,
        amount: item.amount,
      }));
    res.json({
      totalUsers: userCount,
      totalAllotted,
      totalSpent,
      utilizationPct,
      monthlySpendingData: monthly,
      recentActivity,
    });
  });

  app.get("/api/admin/analytics", requireAdmin, async (_req, res) => {
    const byUser = await Receipt.aggregate([
      { $match: { status: { $in: ["pending", "approved"] } } },
      {
        $lookup: {
          from: SubAdmin.collection.collectionName,
          let: { sid: "$subAdminId" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$sid"] }, deletedAt: null } },
          ],
          as: "u",
        },
      },
      { $unwind: "$u" },
      {
        $group: {
          _id: "$subAdminId",
          name: { $first: "$u.name" },
          spent: { $sum: "$amount" },
        },
      },
    ]);
    const chartUserLabel = (fullName) => {
      const p = String(fullName || "").trim().split(/\s+/);
      if (p.length === 0) return "User";
      if (p.length === 1) return p[0].slice(0, 12);
      return `${p[0]} ${p[1].charAt(0)}.`;
    };
    const spendingByUser = byUser.map((x) => ({
      name: chartUserLabel(x.name),
      fullName: x.name,
      spent: Math.round(x.spent * 100) / 100,
    }));

    const monthlySpendingData = await buildMonthlySeries(6);
    const totalSpent = spendingByUser.reduce((a, b) => a + b.spent, 0);
    const avgSpend =
      spendingByUser.length > 0 ? Math.round((totalSpent / spendingByUser.length) * 100) / 100 : 0;
    const topSpender =
      spendingByUser.length > 0
        ? spendingByUser.reduce((a, b) => (b.spent > a.spent ? b : a))
        : { name: "—", fullName: "—", spent: 0 };

    res.json({
      spendingByUser,
      monthlySpendingData,
      totalSpent: Math.round(totalSpent * 100) / 100,
      avgSpend,
      topSpender: { name: topSpender.fullName || topSpender.name, spent: topSpender.spent },
    });
  });

  /* ---------- Sub admin ---------- */
  app.get("/api/sub/dashboard", requireSub, async (req, res) => {
    const id = req.session.subAdminId;
    const u = await SubAdmin.findById(id).lean();
    if (!u) return res.status(404).json({ error: "Not found" });
    const spent = await sumCommittedSpending(id);
    const remaining = Math.max(0, u.walletBalance ?? 0);
    const credited = remaining + spent;
    const now = new Date();
    const w0 = startOfWeek(now);
    const m0 = startOfMonth(now);
    const weekAgg = await Receipt.aggregate([
      {
        $match: {
          subAdminId: new mongoose.Types.ObjectId(id),
          status: { $in: ["pending", "approved"] },
          date: { $gte: w0 },
        },
      },
      { $group: { _id: null, t: { $sum: "$amount" } } },
    ]);
    const monthAgg = await Receipt.aggregate([
      {
        $match: {
          subAdminId: new mongoose.Types.ObjectId(id),
          status: { $in: ["pending", "approved"] },
          date: { $gte: m0 },
        },
      },
      { $group: { _id: null, t: { $sum: "$amount" } } },
    ]);
    const weekSpend = weekAgg[0]?.t ?? 0;
    const monthSpend = monthAgg[0]?.t ?? 0;
    const monthlySpendingData = await buildSubMonthlySeries(id, 6);
    const recent = await Receipt.find({ subAdminId: id })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
    res.json({
      name: u.name,
      // For UI compatibility, allottedBudget now represents total credited via top-ups.
      allottedBudget: credited,
      walletBalance: remaining,
      spentCommitted: spent,
      remainingVsAllotment: remaining,
      spendingThisWeek: weekSpend,
      spendingThisMonth: monthSpend,
      monthlySpendingData,
      recentActivity: recent.map((r) => ({
        id: String(r._id),
        reason: r.reason,
        amount: r.amount,
        date: r.date?.toISOString?.().split("T")[0] ?? "",
        status: r.status,
      })),
    });
  });

  app.post("/api/sub/receipts", requireSub, upload.single("attachment"), async (req, res) => {
    try {
      const id = req.session.subAdminId;
      const amount = Number(req.body?.amount);
      const reason = String(req.body?.reason || "").trim();
      const dateStr = req.body?.date;
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Invalid amount" });
      if (!reason) return res.status(400).json({ error: "Reason is required" });
      const date = dateStr ? new Date(dateStr) : new Date();
      if (Number.isNaN(date.getTime())) return res.status(400).json({ error: "Invalid date" });

      const u = await SubAdmin.findById(id);
      if (!u) return res.status(404).json({ error: "Not found" });
      if ((u.walletBalance ?? 0) < amount) {
        if (req.file?.filename) fs.unlink(path.join(UPLOAD_DIR, req.file.filename), () => {});
        return res.status(400).json({ error: "Insufficient wallet balance. Ask your admin for a top-up." });
      }
      u.walletBalance = Math.max(0, (u.walletBalance ?? 0) - amount);
      await u.save();
      const r = await Receipt.create({
        subAdminId: u._id,
        amount,
        reason,
        date,
        attachmentFilename: req.file?.filename,
        status: "pending",
      });
      res.status(201).json({
        id: String(r._id),
        amount: r.amount,
        reason: r.reason,
        date: r.date.toISOString().split("T")[0],
        status: r.status,
        attachment: r.attachmentFilename,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Could not save receipt" });
    }
  });

  app.get("/api/sub/receipts", requireSub, async (req, res) => {
    const id = req.session.subAdminId;
    const rows = await Receipt.find({ subAdminId: id }).sort({ createdAt: -1 }).lean();
    res.json(
      rows.map((r) => ({
        id: String(r._id),
        amount: r.amount,
        reason: r.reason,
        date: r.date?.toISOString?.().split("T")[0] ?? "",
        status: r.status,
        attachment: r.attachmentFilename || undefined,
      })),
    );
  });

  app.get("/api/sub/wallet", requireSub, async (req, res) => {
    const id = req.session.subAdminId;
    const u = await SubAdmin.findById(id).lean();
    if (!u) return res.status(404).json({ error: "Not found" });
    const tops = await TopUp.find({ subAdminId: id }).sort({ createdAt: -1 }).limit(100).lean();
    const spent = await sumCommittedSpending(id);
    const remaining = await remainingBudgetForUser(u._id);
    res.json({
      balance: remaining,
      allottedBudget: remaining + spent,
      history: tops.map((t) => ({
        id: String(t._id),
        amount: t.amount,
        note: t.note,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  });

  app.get("/api/sub/analytics", requireSub, async (req, res) => {
    const id = req.session.subAdminId;
    const oid = new mongoose.Types.ObjectId(id);
    const u = await SubAdmin.findById(id).lean();
    const spentAgg = await Receipt.aggregate([
      { $match: { subAdminId: oid, status: { $in: ["pending", "approved"] } } },
      { $group: { _id: null, t: { $sum: "$amount" } } },
    ]);
    const totalSpent = spentAgg[0]?.t ?? 0;
    const monthlySpendingData = await buildSubMonthlySeries(id, 6);
    res.json({
      name: u?.name,
      allottedBudget: u?.allottedBudget ?? 0,
      totalSpent: Math.round(totalSpent * 100) / 100,
      monthlySpendingData,
      spendingByUser: [{ name: "You", spent: Math.round(totalSpent * 100) / 100 }],
    });
  });
  app.get("/", (req, res) => {
    res.send("Budget Hub Server is running");
  });

  app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT} (MongoDB already connected)`);
  });
}



main().catch((e) => {
  console.error(e);
  process.exit(1);
});
