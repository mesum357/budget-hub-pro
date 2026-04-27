# iOS Auth Session Test Script and Checklist

## Objective

Validate that iOS users (Safari and Chrome on iPhone) can:

- login successfully
- load dashboard/protected pages without API failures
- refresh repeatedly without loading loops or forced relogin
- keep a stable session until explicit logout/expiry

This script focuses on the iOS issues reported for auth/session reliability.

---

## Scope

- **In scope:** Auth bootstrap, session persistence, protected-route access, refresh behavior, error handling.
- **Out of scope:** Budget business logic, receipt approval logic, analytics accuracy (unless blocked by auth/session failure).

---

## Test Environment

- **Deployment:** Production Render deployment (same-origin frontend + API).
- **Device:** iPhone 12 Pro Max (primary), optionally one more iOS device.
- **Browsers:** Safari iOS and Chrome iOS.
- **Network modes:** Stable Wi-Fi and unstable network (switch Wi-Fi/data briefly).

---

## Test Data

- Admin account (valid credentials)
- Active sub-admin account (valid credentials)
- Invalid credential pair (wrong password)
- Optional: soft-deleted sub-admin account (for negative auth check)

---

## Pre-Test Checklist

- [ ] Backend deployed with latest iOS auth/session fixes
- [ ] Frontend deployed with latest auth bootstrap changes
- [ ] iPhone battery/data saver modes not blocking network
- [ ] Browser cache cleared once before first run
- [ ] Tester has valid admin and sub-admin credentials

---

## Execution Script (Manual)

### TC-01: Admin Login and Initial Data Load (Safari)

1. Open app URL in Safari.
2. Login with valid admin credentials.
3. Wait for redirect to admin dashboard.
4. Verify dashboard cards/charts/data sections render.

**Expected:**

- Login succeeds.
- No infinite loading screen.
- No immediate redirect back to login.
- API-backed sections load.

**Checklist:**

- [ ] Pass
- [ ] Fail
- Notes:

---

### TC-02: Admin Route Navigation + Refresh Stability (Safari)

1. While logged in as admin, navigate to:
   - `/dashboard`
   - `/users`
   - `/budgets`
   - `/spendings`
   - `/analytics`
   - `/settings`
2. On each route, perform one browser refresh.
3. On dashboard, perform 3 extra refreshes in a row.

**Expected:**

- Session remains active.
- No loading deadlock.
- No route bounce to login unless session truly expired.

**Checklist:**

- [ ] Pass
- [ ] Fail
- Notes:

---

### TC-03: Sub-Admin Login and Data Load (Safari)

1. Logout admin.
2. Login as sub-admin.
3. Verify each page loads:
   - `/sub/dashboard`
   - `/sub/spending`
   - `/sub/wallet`
   - `/sub/analytics`
4. Refresh each page once.

**Expected:**

- Sub-admin can access all sub routes.
- Data loads after refresh.
- No loading loop.

**Checklist:**

- [ ] Pass
- [ ] Fail
- Notes:

---

### TC-04: Browser Parity on iOS (Chrome)

Repeat TC-01, TC-02, and TC-03 in Chrome iOS.

**Expected:**

- Same successful behavior as Safari.
- No iOS browser-specific regression.

**Checklist:**

- [ ] Pass
- [ ] Fail
- Notes:

---

### TC-05: Refresh Stress Test

1. Login as admin.
2. Refresh dashboard 10 times with 2-3 second intervals.
3. Navigate to users, refresh 5 times.
4. Close tab, reopen URL, verify session state.

**Expected:**

- No stuck loading state.
- Either valid session resumes or cleanly returns to login (never looping).

**Checklist:**

- [ ] Pass
- [ ] Fail
- Notes:

---

### TC-06: Network Interruption Recovery

1. Start login attempt.
2. Briefly disable network (airplane mode for ~3 seconds), then restore.
3. Retry login.
4. While on dashboard, toggle network off/on and refresh once.

**Expected:**

- Graceful error when offline.
- Successful recovery after network returns.
- No persistent loading deadlock.

**Checklist:**

- [ ] Pass
- [ ] Fail
- Notes:

---

### TC-07: Invalid Credentials Handling

1. Attempt login with wrong password.
2. Verify error handling.
3. Retry with valid credentials.

**Expected:**

- Invalid login rejected with clear message.
- Valid retry succeeds immediately.

**Checklist:**

- [ ] Pass
- [ ] Fail
- Notes:

---

### TC-08: Logout and Back-Button Security

1. Login as admin and open dashboard.
2. Logout.
3. Tap browser back button.
4. Try direct navigation to `/dashboard`.

**Expected:**

- Logged-out state preserved.
- Protected routes redirect to login.
- No accidental re-entry from browser history.

**Checklist:**

- [ ] Pass
- [ ] Fail
- Notes:

---

### TC-09: Soft-Deleted Sub-Admin (Optional Negative Test)

1. Use account previously soft-deleted by admin.
2. Attempt login.

**Expected:**

- Login blocked (invalid credentials/unauthorized).
- No access to sub-admin pages.

**Checklist:**

- [ ] Pass
- [ ] Fail
- Notes:

---

## Quick API Observation Guide (Optional)

If using browser network inspector:

- `POST /api/auth/login` should return 200 on valid credentials.
- `GET /api/auth/me` should return:
  - `{ role: "admin" }` for admin
  - `{ role: "subadmin", user: ... }` for sub-admin
  - `{ role: null }` only when unauthenticated/expired
- Protected API calls should not repeatedly return 401 after successful login.

---

## Final Acceptance Criteria

Mark release **PASS** only if all conditions hold:

- [ ] No reproducible loading deadlock on iOS Safari
- [ ] No reproducible loading deadlock on iOS Chrome
- [ ] Refresh does not cause auth loop for valid active users
- [ ] Admin pages load data consistently after login and refresh
- [ ] Sub-admin pages load data consistently after login and refresh
- [ ] Logout behavior is correct and secure

If any item fails, mark release **FAIL** and attach bug details.

---

## Bug Report Template

Use this format for each failure:

- Device:
- iOS version:
- Browser:
- Test case ID:
- Steps to reproduce:
- Expected result:
- Actual result:
- Frequency (always/intermittent):
- Timestamp:
- Network condition:
- Screenshot/screen recording:
- API status notes (`/api/auth/login`, `/api/auth/me`, failing endpoint):
