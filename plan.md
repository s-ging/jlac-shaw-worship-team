# Implementation Plan
## Praise Team Scheduler — V1

**Companion to:** Design Document v1.0
**Approach:** Bottom-up, one file per step, testable at every stage
**Guiding rule:** No step ships until the previous one works end-to-end.

---

## 0. How to Read This Plan

Each phase has:
- **Goal** — what's true when the phase is done
- **Steps** — concrete file-level tasks
- **Acceptance** — how you know it works
- **Blocks** — what the next phase is waiting on

Phases are ordered so that **every phase ends with something you can run in a browser**. No phase is "infrastructure only" — you always see progress.

---

## Phase 0 — Foundation Cleanup

**Goal:** A clean slate. Supabase is gone. The app still works exactly as it does today (Phase 1.0 behavior, reading from Google Calendar directly).

### Steps

1. **Remove Supabase**
   - Delete `src/lib/supabase.ts`, `src/lib/supabase-queries.ts`, `src/lib/auth.svelte.ts`, `src/routes/auth/callback/` (if present)
   - Remove `@supabase/supabase-js` from `package.json`
   - Remove Supabase imports from `+layout.svelte` and `+page.svelte`
   - Delete any Supabase-related env vars from Cloudflare

2. **Decide the subdomain**
   - Confirm `jlac.workweek.dev` resolves via Cloudflare
   - Add it to the Pages project as a custom domain
   - Verify HTTPS works

3. **Clean up `+page.svelte`**
   - Remove all Supabase-related `loadMonth` logic
   - Revert to fetching directly from Google Calendar (Phase 1.0 code)
   - Confirm the schedule renders

4. **Create `src/lib/config.ts`**
   ```ts
   export const APP_NAME = 'Praise Team Scheduler'
   export const CALENDAR_ID = '9a716d35...@group.calendar.google.com'
   export const GOOGLE_API_KEY = 'AIzaSy...'  // read-only, public
   ```

### Acceptance
- [ ] `npm run dev` works
- [ ] Schedule renders from Google Calendar
- [ ] No Supabase references anywhere in the codebase
- [ ] `jlac.workweek.dev` (or localhost) loads the app

### Blocks
Nothing. Phase 1 can start immediately.

---

## Phase 1 — KV Plumbing (Read-Only Admin View)

**Goal:** KV namespaces exist, bound to Pages, and you can read a hardcoded user from the app. No auth yet. Just prove the wire works.

### Steps

1. **Create KV namespaces via Wrangler**
   ```bash
   npx wrangler kv namespace create USERS_KV
   npx wrangler kv namespace create SESSIONS_KV
   npx wrangler kv namespace create LOG_KV
   ```
   Note each namespace ID.

2. **Bind namespaces to Pages**
   - Cloudflare Dashboard → Pages → Project → Settings → Functions → KV namespace bindings
   - Add all three for **Production** and **Preview**
   - Variable names must match: `USERS_KV`, `SESSIONS_KV`, `LOG_KV`

3. **Create your first Pages Function**
   - `functions/api/health.ts`:
   ```ts
   interface Env { USERS_KV: KVNamespace }

   export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
     const keys = await env.USERS_KV.list()
     return Response.json({ ok: true, userCount: keys.keys.length })
   }
   ```

4. **Seed one user manually**
   - Via Wrangler:
   ```bash
   npx wrangler kv key put --binding=USERS_KV \
     "user:test@example.com" \
     '{"email":"test@example.com","name":"Test","roles":{"isSuperAdmin":true,"isWorshipLeader":true,"isMedia":false,"isMember":true},"instruments":[],"active":true}' \
     --remote
   ```

5. **Fetch it from the app**
   - Add to `+page.svelte` temporarily: a `fetch('/api/health')` on mount, log the result
   - Verify the KV key count shows up

### Acceptance
- [ ] `/api/health` returns `{ ok: true, userCount: 1 }`
- [ ] Binding works in both Production and Preview
- [ ] You can read/write KV from Wrangler CLI and from a Function

### Blocks
Phase 2 (auth) needs `USERS_KV` bound. Phase 3 needs `SESSIONS_KV`. Phase 4 needs `LOG_KV`.

---

## Phase 2 — Auth Core

**Goal:** A user can log in with email + password, get a session cookie, and hit `/api/auth/me` to see their record. No UI polish yet.

### Steps

1. **Create `functions/lib/crypto.ts`**
   - `hashPassword(password, salt)` — PBKDF2-HMAC-SHA256, 100k iterations
   - `verifyPassword(password, hash, salt)` — constant-time compare
   - `generateToken()` — 32 random bytes as hex
   - `generateSalt()` — 16 random bytes as base64

2. **Create `functions/lib/kv.ts`**
   - `getUser(env, email)` — reads `user:{email}`, returns typed record or null
   - `putUser(env, user)` — writes with `updatedAt` bumped
   - `getSession(env, token)` — reads `session:{token}`
   - `putSession(env, session)` — writes with `expiresAt`
   - `deleteSession(env, token)`

3. **Create `functions/lib/session.ts`**
   - `readSessionCookie(request)` — parse `session_token` from Cookie header
   - `setSessionCookie(response, token)` — HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age=30d
   - `clearSessionCookie(response)`

4. **Create `functions/api/auth/login.ts`**
   - POST only
   - Body: `{ email, password }`
   - Validate → hash → compare → create session → set cookie → return `{ user }` (sans secrets)

5. **Create `functions/api/auth/logout.ts`**
   - POST only
   - Delete session from KV, clear cookie

6. **Create `functions/api/auth/me.ts`**
   - GET only
   - Read cookie → load session → load user → return `{ user }`
   - 401 if missing/invalid/expired

7. **Create `functions/lib/requireAuth.ts`**
   - Middleware-style helper: given `request` + `env`, returns the authenticated user or throws a 401 Response
   - Used by every protected endpoint from here on

### Acceptance
- [ ] `curl -X POST /api/auth/login -d '{"email":"test@example.com","password":"..."}'` returns user + sets cookie
- [ ] `curl /api/auth/me` with cookie returns user; without cookie returns 401
- [ ] `curl -X POST /api/auth/logout` clears the cookie
- [ ] Wrong password returns 401 with generic message (no "user not found" leak)

### Blocks
Phase 3 (UI) needs `/api/auth/me` working.

---

## Phase 3 — Login UI

**Goal:** A real login form in the app. Users can log in, see their name in the header, and log out.

### Steps

1. **Create `src/lib/api.ts`** (client-side fetch wrapper)
   ```ts
   export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
     const res = await fetch(path, { credentials: 'include', ...init })
     if (!res.ok) throw new Error(await res.text())
     return res.json()
   }
   ```

2. **Create `src/lib/stores/auth.svelte.ts`**
   - Reactive user state via `$state`
   - `loadUser()` calls `/api/auth/me`
   - `login(email, password)` posts to `/api/auth/login`
   - `logout()` posts to `/api/auth/logout`
   - Exports `useAuth()` with getters (same shape as before, but no Supabase)

3. **Create `src/lib/components/LoginForm.svelte`**
   - Email + password inputs
   - Submit → `auth.login()`
   - Error display
   - Scoped CSS, matches app style

4. **Update `src/routes/+layout.svelte`**
   - On mount, `auth.loadUser()`
   - If logged in: show nickname + logout button
   - If not: show "Sign In" that opens `LoginForm` (modal or `/login` route)
   - Add footer with Privacy / Terms links (from earlier)

5. **Create `src/routes/login/+page.svelte`** (optional but cleaner)
   - Full-page login
   - Redirects to `/` on success

### Acceptance
- [ ] Visiting `/` when logged out shows a login prompt
- [ ] Logging in with the seeded user works
- [ ] Reloading the page keeps you logged in (cookie persists)
- [ ] Logout clears the session
- [ ] Header shows the user's nickname when authenticated

### Blocks
Phase 4 (admin panel) needs `auth.user` populated and role flags accessible.

---

## Phase 4 — Admin Panel (Users CRUD)

**Goal:** Superadmins can list, create, edit, and deactivate users entirely in-app. No more Wrangler for daily ops.

### Steps

1. **Create `functions/api/users/index.ts`**
   - `GET` — list all users (superAdmin only)
   - `POST` — create user (superAdmin only): validate email, generate salt, hash password, write KV, log

2. **Create `functions/api/users/[email].ts`**
   - `PATCH` — update roles, name, nickname, instruments, password (superAdmin only)
   - `DELETE` — soft delete (`active: false`) (superAdmin only)

3. **Create `functions/lib/requireRole.ts`**
   - Wrapper: `requireRole('isSuperAdmin')`
   - Returns 403 if the authenticated user lacks the flag

4. **Create `src/routes/admin/+page.svelte`**
   - Gated by `auth.user.roles.isSuperAdmin` (redirect otherwise)
   - Tabs: Users | Changelog | Sessions | Sync

5. **Create `src/lib/components/admin/UserTable.svelte`**
   - Rows: email, name, roles (badges), instruments, actions
   - Actions: edit, reset password, deactivate

6. **Create `src/lib/components/admin/UserForm.svelte`**
   - Modal for create/edit
   - Fields: email, name, nickname, password (create only), role checkboxes, instruments (multi-select)

7. **Wire it up**
   - `GET /api/users` on mount
   - Post to `/api/users` for create
   - Patch to `/api/users/:email` for edit
   - Delete for deactivate

### Acceptance
- [ ] Admin can create a new user in-app
- [ ] Admin can change another user's roles
- [ ] Admin can deactivate a user
- [ ] Non-admins get 403 from `/api/users` even if they craft the request manually
- [ ] A new user can immediately log in with the password set by the admin

### Blocks
Phase 5 (changelog) needs the log-write helper, which we'll introduce here.

---

## Phase 5 — Changelog

**Goal:** Every mutation writes an append-only log entry. The admin panel shows the log as a human-readable feed. This is the "sauce."

### Steps

1. **Create `functions/lib/log.ts`**
   - `appendLog(env, entry)` — writes `log:{ISO}:{uuid}` to `LOG_KV`
   - `listLog(env, { from, to, actor, action, limit })` — uses KV `list({ prefix: 'log:' })` + filters
   - Helper to build sentences from entries: `renderLogEntry(entry): string`

2. **Retrofit all mutations to log**
   - `/api/users` POST → `user.created`
   - `/api/users/:email` PATCH → `user.role.changed` (per changed field) or `user.updated`
   - `/api/users/:email` DELETE → `user.deactivated`
   - (Future endpoints will log their own actions)

3. **Create `functions/api/log/index.ts`**
   - `GET` — list log entries (worshipLeader or superAdmin)
   - Query params: `from`, `to`, `actor`, `action`, `limit`

4. **Create `src/routes/admin/log/+page.svelte`** (or tab within admin)
   - Feed of log entries
   - Filter by actor/action/date
   - Group by day

5. **Create `src/lib/components/log/LogEntry.svelte`**
   - Renders one entry as a sentence with timestamp and actor

6. **Add a "Recent changes" widget** on the home page (optional)
   - Last 5 log entries
   - Visible only to logged-in users

### Acceptance
- [ ] Creating a user produces a log entry
- [ ] Changing a role produces a log entry with before/after
- [ ] Log feed renders entries as sentences
- [ ] Filters work
- [ ] Log entries are immutable (KV values are never overwritten)

### Blocks
Phase 6 (schedule editing) will use `appendLog` for assignment changes.

---

## Phase 6 — Schedule Editing (Assignments)

**Goal:** Worship leaders can reassign people to slots. Changes write to Google Calendar description and log the change.

### Steps

1. **Set up Google Service Access (dedicated account)**
   - Create/confirm dedicated Google account (e.g., `jlacmedia@gmail.com`)
   - Share the calendar with it (write access)
   - Do the OAuth flow once, get a refresh token
   - Store in Cloudflare secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ID`

2. **Create `functions/lib/google.ts`**
   - `getAccessToken(env)` — exchanges refresh token for access token
   - `getEvent(env, eventId)` — reads the event
   - `patchEvent(env, eventId, body)` — updates description
   - `listEvents(env, from, to)` — lists events in range (better than API key for the app)

3. **Create `functions/api/weeks/index.ts`**
   - `GET` — list weeks in range (reads Google Calendar, parses descriptions)
   - Server-side parse = single source of truth for the parser

4. **Create `functions/api/weeks/[id]/assignments.ts`**
   - `POST` — assign a user to a slot: parse description, modify, patch event, log
   - Body: `{ instrumentSlot, profileEmail, isPrimary }`

5. **Create `functions/api/weeks/[id]/assignments/[aid].ts`**
   - `PATCH` — reassign or change primary/secondary
   - `DELETE` — remove assignment

6. **Update `+page.svelte` to fetch from `/api/weeks`**
   - No more direct Google Calendar API calls from the client
   - Client only talks to Pages Functions

7. **Update `AssignmentRow.svelte`**
   - Edit button appears if `auth.user.roles.isWorshipLeader || isSuperAdmin`
   - Click opens `AssignmentEdit.svelte` modal (user picker)

8. **Create `src/lib/components/AssignmentEdit.svelte`**
   - Dropdown of users filtered by `instruments` (nice-to-have)
   - Save → PATCH/POST → refetch week → close

### Acceptance
- [ ] Worship leader can reassign an instrument slot
- [ ] Google Calendar description updates correctly
- [ ] Log entry written: `assignment.reassigned`
- [ ] Non-leaders don't see edit buttons; API rejects them anyway
- [ ] Refetch shows the new assignment

### Blocks
Phase 7 (RSVP) builds on this.

---

## Phase 7 — RSVP (V1, Description-Based)

**Goal:** Users can mark their own RSVP (yes/maybe/no). State lives in the Calendar description. Every change is logged.

### Steps

1. **Define RSVP block in description** (§3.5 of design doc)
   ```
   ───
   RSVP
   Raymond: yes
   Kevin: maybe
   ```

2. **Extend parser** in `functions/lib/parser.ts`
   - Parse RSVP block into `Map<name, 'yes'|'maybe'|'no'>`
   - Tolerate missing block

3. **Create `functions/api/weeks/[id]/rsvp.ts`**
   - `PATCH` — user updates own RSVP (or leader updates anyone's)
   - Body: `{ email, status }`
   - Read event, update RSVP block, patch, log

4. **Create `src/lib/components/RsvpButton.svelte`**
   - Three buttons: Yes / Maybe / No
   - Shows current status
   - Disabled if not logged in
   - Only lets you set your own unless you're a leader

5. **Add RSVP to `AssignmentRow.svelte`**
   - Row shows the person's RSVP status icon next to their name
   - If the row is you, show the buttons

6. **Log RSVP changes**
   - `rsvp.updated` with before/after

### Acceptance
- [ ] You can set your own RSVP
- [ ] Status persists across reloads (in Calendar description)
- [ ] Leaders can set anyone's RSVP
- [ ] Non-leaders can't set others' RSVP (server rejects)
- [ ] Log entry appears in changelog
- [ ] Non-logged-in users see current status but can't change

### Blocks
Phase 8 (sync polish) and V2.

---

## Phase 8 — Sync & Polish

**Goal:** The app feels complete. Edge cases handled. Ready for real users.

### Steps

1. **Sync endpoints**
   - `/api/calendar/sync/pull` — force re-read from Google, cache nothing (or into KV for offline)
   - `/api/calendar/sync/push` — no-op for V1 (writes are already immediate)

2. **Sync status UI**
   - Show "Last synced: X minutes ago" in header (for leaders)
   - Manual sync button in admin

3. **Error handling**
   - Standard error response shape: `{ error: string, code?: string }`
   - Client shows toast/banner on failure
   - Retry on network errors (simple exponential backoff)

4. **Rate limiting on `/api/auth/login`**
   - KV-based counter: `ratelimit:login:{ip}` → count + first-seen
   - Max 10 attempts per 15 minutes

5. **CSRF hardening**
   - Check `Origin` header on all POST/PATCH/DELETE
   - Reject if not `https://jlac.workweek.dev` or localhost

6. **Session refresh**
   - On every authenticated request, if session expires within 7 days, extend to 30 days

7. **Empty states & loading states**
   - Polish `LoadingState`, `ErrorState`, empty week views

8. **Mobile QA pass**
   - Test on iPhone Safari and Android Chrome
   - Verify tap targets, cookie behavior, HTTPS

### Acceptance
- [ ] Full happy path works on mobile
- [ ] Full happy path works on desktop
- [ ] Failed logins are rate-limited
- [ ] Cross-origin POSTs are rejected
- [ ] No console errors in any flow

### Blocks
Nothing. V1 is done.

---

## Phase 9 — Deploy & Handoff

**Goal:** The app runs on `jlac.workweek.dev`. Your team can use it. You can maintain it.

### Steps

1. **Production KV namespaces confirmed**
   - Production and Preview bindings both set

2. **Secrets confirmed**
   - All Google secrets set in Production env

3. **Dedicated account OAuth**
   - Refresh token obtained and stored
   - Consent screen set to "Testing" (or "Internal" if applicable)
   - Note: refresh token expires in 7 days in Testing mode → either publish or re-authorize weekly

4. **Deploy**
   - Push to `main`
   - Verify `jlac.workweek.dev` loads

5. **Seed real users**
   - Create all 18 team members in admin panel
   - Assign roles
   - Set aliases for name resolution

6. **Document runbook**
   - `README.md` with:
     - How to add a user
     - How to rotate the Google refresh token
     - How to reset a password
     - Where KV data lives
     - How to roll back a deploy

7. **One week of shadow use**
   - Use it alongside the current workflow
   - Fix what breaks

### Acceptance
- [ ] App is live and usable by the team
- [ ] You can perform all admin tasks without touching Wrangler/Cloudflare dashboard
- [ ] Runbook exists and is accurate

---

## Cross-Phase Notes

### File Layout (Final)

```
functions/
├── api/
│   ├── health.ts
│   ├── auth/
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   └── me.ts
│   ├── users/
│   │   ├── index.ts
│   │   └── [email].ts
│   ├── weeks/
│   │   ├── index.ts
│   │   └── [id]/
│   │       ├── assignments.ts
│   │       ├── assignments/[aid].ts
│   │       └── rsvp.ts
│   ├── log/
│   │   └── index.ts
│   └── calendar/
│       └── sync/
│           ├── pull.ts
│           └── push.ts
└── lib/
    ├── crypto.ts
    ├── kv.ts
    ├── session.ts
    ├── requireAuth.ts
    ├── requireRole.ts
    ├── log.ts
    ├── google.ts
    └── parser.ts
```

```
src/
├── lib/
│   ├── api.ts
│   ├── config.ts
│   ├── stores/
│   │   └── auth.svelte.ts
│   └── components/
│       ├── (existing schedule components)
│       ├── LoginForm.svelte
│       ├── RsvpButton.svelte
│       ├── AssignmentEdit.svelte
│       ├── log/
│       │   └── LogEntry.svelte
│       └── admin/
│           ├── UserTable.svelte
│           └── UserForm.svelte
└── routes/
    ├── +layout.svelte
    ├── +page.svelte
    ├── login/+page.svelte
    ├── privacy/+page.svelte
    ├── terms/+page.svelte
    └── admin/
        ├── +page.svelte
        └── log/+page.svelte
```

### Order Rationale

1. **Foundation first** — nothing works if KV isn't bound
2. **Auth before UI** — you can test with curl before building forms
3. **Users CRUD before log** — log entries need actors
4. **Log before schedule edits** — so assignment changes are attributed
5. **Schedule edits before RSVP** — RSVP builds on the same write path
6. **Polish last** — don't polish what might change
7. **Deploy after polish** — one clean launch

### Time Estimate (Reality, Not Aspiration)

| Phase | Realistic Hours |
|-------|:-:|
| 0 — Foundation Cleanup | 1–2 |
| 1 — KV Plumbing | 2–3 |
| 2 — Auth Core | 4–6 |
| 3 — Login UI | 3–4 |
| 4 — Admin Users CRUD | 4–6 |
| 5 — Changelog | 3–4 |
| 6 — Schedule Editing | 6–8 |
| 7 — RSVP | 4–5 |
| 8 — Sync & Polish | 4–6 |
| 9 — Deploy & Handoff | 3–4 |
| **Total** | **~35–50 hours** |

Spread over evenings and weekends: 3–5 weeks.

### What Could Go Wrong (Pre-Mortem)

| Risk | Response |
|------|----------|
| Google refresh token expires weekly (Testing mode) | Publish the app, or accept weekly re-auth as a runbook step |
| KV write limit hit during sync | Batch writes; upgrade to paid ($5/mo) if chronic |
| Parser breaks on a new description format | Log the raw description; add tolerant parsing; the log makes diagnosis easy |
| User forgets password | Admin resets; no email reset in V1 (documented) |
| Subdomain SSL issue with Porkbun | Move DNS fully to Cloudflare, or use `pages.dev` as fallback |

---

## What to Do Right Now

**Start with Phase 0, Step 1.** Delete Supabase. It's the cleanest possible starting point, and everything after it assumes Supabase is gone.

When Phase 0's acceptance checks pass, come back and we'll write Phase 1 together — actual code, actual files, actual commits.

Fire when ready.