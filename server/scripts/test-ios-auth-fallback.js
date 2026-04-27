/**
 * Verifies iOS auth fallback when cookies are not persisted.
 *
 * Usage:
 *   node scripts/test-ios-auth-fallback.js
 *   BACKEND_URL=https://budget-management-backend-mm6p.onrender.com node scripts/test-ios-auth-fallback.js
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const base = (process.env.BACKEND_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 5000}`).replace(
  /\/$/,
  "",
);
const email = process.env.ADMIN_EMAIL || "admin@company.com";
const password = process.env.ADMIN_PASSWORD || "admin123";
const origin = process.env.FRONTEND_URL || "https://budget-hub-pro.onrender.com";

async function main() {
  console.log("[test] base:", base);
  console.log("[test] login email:", email);

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Referer: `${origin}/`,
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1",
    },
    body: JSON.stringify({ email, password }),
  });

  const loginBody = await login.json().catch(() => ({}));
  const setCookie = login.headers.get("set-cookie");
  const token = loginBody?.authToken;

  console.log("[test] login status:", login.status);
  console.log("[test] set-cookie present:", Boolean(setCookie));
  console.log("[test] authToken present:", Boolean(token));
  if (!login.ok || !token) {
    throw new Error(`Login/token failed: status=${login.status} body=${JSON.stringify(loginBody)}`);
  }

  const meWithToken = await fetch(`${base}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: origin,
      Referer: `${origin}/`,
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1",
    },
  });
  const meBody = await meWithToken.json().catch(() => ({}));
  console.log("[test] /api/auth/me (token) status:", meWithToken.status, "body:", meBody);
  if (!meWithToken.ok || meBody?.role !== "admin") {
    throw new Error(`/api/auth/me via token failed: status=${meWithToken.status} body=${JSON.stringify(meBody)}`);
  }

  const dashboardWithToken = await fetch(`${base}/api/admin/dashboard`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Origin: origin,
      Referer: `${origin}/`,
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1",
    },
  });
  const dashboardBody = await dashboardWithToken.json().catch(() => ({}));
  console.log("[test] /api/admin/dashboard (token) status:", dashboardWithToken.status);
  if (!dashboardWithToken.ok) {
    throw new Error(`/api/admin/dashboard via token failed: status=${dashboardWithToken.status} body=${JSON.stringify(dashboardBody)}`);
  }

  console.log("[test] PASS: iOS token fallback works without cookie persistence.");
}

main().catch((err) => {
  console.error("[test] FAIL:", err?.message || err);
  process.exit(1);
});
