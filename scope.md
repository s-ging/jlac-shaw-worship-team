Perfect. Locked in. Here's the design document.

---

# Praise Team Scheduler
## Design Document v1.0

**Project:** JLAC Shaw Church Worship Team Scheduler
**Domain:** `jlac.workweek.dev`
**Owner:** JLAC Shaw Church
**Author:** Project maintainer
**Status:** Draft for implementation
**Date:** September 2026

---

## 1. Purpose & Principles

### 1.1 Purpose

A mobile-first web application that displays and manages worship team scheduling for JLAC Shaw Church. Google Calendar is the event source of truth. The app provides a friendlier interface, role-based editing, and a visible audit trail of changes.

### 1.2 Principles

| # | Principle | Meaning |
|---|-----------|---------|
| 1 | **Google Calendar is the source of truth for events** | Themes, playlists, and assignments live there. The app mirrors and edits it — never replaces it. |
| 2 | **The app owns user identity, roles, and history** | Google doesn't know who's a worship leader. We do. We store it in KV. |
| 3 | **Edge-native, Cloudflare-only** | Pages + Functions + KV. No external SaaS. One bill, one dashboard, one mental model. |
| 4 | **Append-only history** | Every change is recorded. State is derived from events, not overwritten silently. |
| 5 | **Read for everyone, write for the trusted few** | Public schedule, gated editing. Roles enforced server-side. |
| 6 | **No unnecessary abstraction** | No ORM, no state library, no auth vendor. Web Crypto, KV, and fetch. |
| 7 | **Mobile-first, ugly-fast** | One-handed use on a phone in a church lobby beats a desktop dashboard. |
| 8 | **V1 ships. V2 earns its complexity.** | Description-based RSVP now. Per-user OAuth only when the pain is real. |

### 1.3 Non-Goals (Explicit)

- Replacing Google Calendar as the event system
- Supporting multiple churches or tenants
- Native mobile apps
- Offline-first sync
- Real-time collaboration
- Any AI features

---

## 2. System Architecture

### 2.1 High-Level Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                  User (browser, mobile-first)                 │
└──────────────────────────────┬────────────────────────────────┘
                               │ HTTPS
                               ▼
┌───────────────────────────────────────────────────────────────┐
│            Cloudflare Pages — jlac.workweek.dev               │
│                                                               │
│   ┌─────────────────────────┐   ┌───────────────────────────┐ │
│   │  SvelteKit 5 (Runes)    │   │  Pages Functions (/api/*) │ │
│   │  Static + SSR Frontend  │──▶│  - /api/auth/*            │ │
│   │                         │   │  - /api/users/*           │ │
│   │  • Schedule view        │   │  - /api/weeks/*           │ │
│   │  • Login                │   │  - /api/log/*             │ │
│   │  • Admin panel          │   │  - /api/calendar/*        │ │
│   │  • Changelog viewer     │   └─────────────┬─────────────┘ │
│   └─────────────────────────┘                 │               │
└───────────────────────────────────────────────┼───────────────┘
                                                │
                       ┌────────────────────────┼────────────────────────┐
                       ▼                        ▼                        ▼
              ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
              │   KV: USERS     │      │   KV: LOG       │      │  KV: SESSIONS   │
              │                 │      │                 │      │                 │
              │  user records   │      │  append-only    │      │  active         │
              │  + roles        │      │  change events  │      │  sessions       │
              └─────────────────┘      └─────────────────┘      └─────────────────┘
                                                │
                                                │  (server-side only)
                                                ▼
                                    ┌─────────────────────────┐
                                    │   Google Calendar API   │
                                    │   (dedicated account)   │
                                    │                         │
                                    │   refresh token stored  │
                                    │   as CF secret          │
                                    └─────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility | Owns |
|-----------|----------------|------|
| **SvelteKit frontend** | UI, routing, client state | Presentation only |
| **Pages Functions** | Business logic, auth, Calendar API calls | All trust decisions |
| **KV: USERS** | User records, roles, flags | Identity |
| **KV: SESSIONS** | Active session tokens | Auth state |
| **KV: LOG** | Append-only change history | Audit trail |
| **Google Calendar** | Event source of truth | Themes, playlists, assignments |
| **Cloudflare Secrets** | Google credentials, signing keys | Machine secrets |

### 2.3 Why Cloudflare-Only

- **Latency**: KV reads are ~ms from any edge location
- **Cost**: Free tier covers this project indefinitely (KV: 100k reads/day, 1k writes/day)
- **Simplicity**: One platform, one deploy, one set of logs
- **Ownership**: No vendor lock-in beyond Cloudflare itself (and KV data is exportable)

**Known trade-off**: KV is eventually consistent (~60s global propagation). For this app's write volume, irrelevant.

---

## 3. Data Model

### 3.1 KV Namespaces

Three namespaces, bound to the Pages project:

| Binding | Purpose | Key Pattern |
|---------|---------|-------------|
| `USERS_KV` | User records | `user:{email}` |
| `SESSIONS_KV` | Active sessions | `session:{token}` |
| `LOG_KV` | Change log | `log:{timestamp}:{uuid}` |

### 3.2 User Record Schema

```typescript
interface UserRecord {
  email: string                 // primary key (also in key name)
  name: string                  // display name
  nickname?: string             // optional short name
  passwordHash: string          // PBKDF2 hash, base64
  passwordSalt: string          // random salt, base64
  roles: {
    isSuperAdmin: boolean
    isWorshipLeader: boolean
    isMedia: boolean
    isMember: boolean           // default true
  }
  instruments: string[]         // e.g., ["Lead Vocal", "Drums"]
  createdAt: string             // ISO 8601
  updatedAt: string             // ISO 8601
  active: boolean               // soft delete flag
}
```

**Key:** `user:raymond@example.com`

**Why email as key:** Email is the login identity. Google Calendar references people by name in the description, but the app resolves those names to user records via a manual mapping table (see §3.6).

### 3.3 Session Record Schema

```typescript
interface SessionRecord {
  token: string                 // random 32-byte hex, in key name
  email: string                 // user this session belongs to
  createdAt: string
  expiresAt: string             // e.g., +30 days
  userAgent?: string            // for admin panel: "logged in from iPhone"
  ip?: string                   // optional
}
```

**Key:** `session:{token}`

**Session lifetime:** 30 days sliding. Refreshed on each authenticated request.

**Revocation:** Delete the KV key. All sessions for a user can be revoked by listing `session:*` and deleting matches (KV list is paginated; acceptable for <100 sessions).

### 3.4 Change Log Schema

Append-only. Every write action produces one or more log entries.

```typescript
interface LogEntry {
  id: string                    // uuid
  timestamp: string             // ISO 8601
  actor: string                 // email of user who made the change
  actorName: string             // display name at time of change
  action: LogAction             // see below
  target: {
    type: 'week' | 'assignment' | 'user' | 'rsvp'
    id: string                  // week id, assignment id, user email
    label?: string              // human-readable, e.g., "Sep 13 - Lead Vocal"
  }
  before?: unknown              // previous value (optional)
  after?: unknown               // new value (optional)
  meta?: Record<string, string> // free-form context
}

type LogAction =
  | 'week.theme.updated'
  | 'week.playlist.updated'
  | 'assignment.created'
  | 'assignment.removed'
  | 'assignment.reassigned'
  | 'assignment.confirmed'
  | 'rsvp.updated'
  | 'user.created'
  | 'user.role.changed'
  | 'user.deactivated'
  | 'sync.calendar.pulled'
  | 'sync.calendar.pushed'
```

**Key:** `log:{timestamp}:{uuid}` — this makes range queries natural (`log:2026-09:*` lists all September logs, sorted).

**Rendering in the UI:** The changelog viewer parses entries into human sentences. E.g.:

> **Raymond** reassigned *Sep 13 · Lead Guitar* from Kevin to CJ — 6:07 AM, Sep 15

### 3.5 Google Calendar Description Format (V1)

The description field is a **mirror** of assignment state — not the source of truth for the app, but the canonical interface to Google Calendar.

**Current format (Phase 1.0 parser input):**

```
YouTube Playlist link:
https://youtube.com/playlist?list=...

Theme: Green

Vocalists
1️⃣ Praise Leader - Marian
2️⃣ Second Praise Leader - Ezra
3️⃣ Offering Prayer - Miah

Instrumentalists
🥁 Drums - CJ
🎸 L. Guitar - Raymond
🎸 Bass - Kevin

Media
Sam and Chan
```

**V1 extension (RSVP block, appended):**

```
───
RSVP
CJ: yes
Kevin: maybe
Raymond: yes
```

The `───` separator keeps the RSVP block visually distinct and parser-friendly. The parser becomes tolerant: if the RSVP section is absent, no RSVPs are shown.

**Why description and not attendees:**
- Attendees require per-user OAuth (V2)
- Description is writable by a single dedicated account (V1)
- Description is visible to anyone with calendar access
- Description is diffable — the changelog can literally show the before/after text

### 3.6 Name → User Resolution

Google Calendar descriptions use **first names** ("Raymond", "CJ"). The app uses **emails** as identity. A mapping layer is required.

**Option 1 (chosen for V1):** A `name_aliases` field on the user record:

```typescript
interface UserRecord {
  // ...
  aliases: string[]   // e.g., ["Raymond", "Ray", "R. Santos"]
}
```

When the parser encounters a name, it searches all users for a case-insensitive alias match. Ambiguity (two users named "Kevin") triggers a UI prompt in the admin panel to disambiguate — once.

**Option 2 (V2+):** A dedicated `aliases` KV namespace, mapping name → email directly. More flexible, more complex.

---

## 4. Authentication

### 4.1 V1: Email + Password (Self-Managed)

**Login flow:**

```
1. User submits email + password to POST /api/auth/login
2. Function reads user:{email} from USERS_KV
3. If missing or inactive → 401
4. Derive PBKDF2 hash from submitted password + stored salt
5. Constant-time compare with stored hash
6. If match:
   a. Generate 32-byte random token
   b. Write session:{token} to SESSIONS_KV with 30-day expiry
   c. Set HttpOnly, Secure, SameSite=Lax cookie "session_token"
   d. Return user record (sans secrets)
7. If mismatch → 401
```

**Password hashing:**

- **Algorithm**: PBKDF2-HMAC-SHA256
- **Iterations**: 100,000 (Cloudflare Workers runtime supports this comfortably)
- **Salt**: 16 random bytes per user, stored alongside hash
- **Output**: 32-byte derived key, base64-encoded

**User creation (V1):**

Admin panel form → POST `/api/users` → server generates salt, hashes password, writes `user:{email}` to KV, and logs `user.created`.

There is no self-registration. Only superadmins create users.

### 4.2 V2: Per-User Google OAuth (RSVP Only)

Added only when RSVP needs to be native. Scope: `https://www.googleapis.com/auth/calendar.events`.

**Flow:**

```
1. User clicks "Connect Google for RSVP"
2. App redirects to Google OAuth consent
3. Callback at /auth/google/callback
4. Function exchanges code for refresh token
5. Store refresh token at user:{email}.googleRefreshToken (KV, encrypted-at-rest by CF)
6. App now writes RSVPs directly to Google attendees
```

**Key point:** V2 OAuth is *additive*. It doesn't replace V1 login. Users still authenticate to the app with email + password; Google OAuth only grants Calendar RSVP write permission.

### 4.3 Threat Model (What We're Defending Against)

| Threat | Mitigation |
|--------|------------|
| Password guessing | Rate-limit `/api/auth/login` per IP (KV counter) |
| Session hijacking | HttpOnly + Secure + SameSite cookies; token is 256-bit random |
| CSRF on mutations | SameSite=Lax + `Origin` header check on POST/PUT/DELETE |
| XSS stealing session | HttpOnly cookie; no token in localStorage |
| Privilege escalation | Roles read from KV server-side, never trusted from client |
| Refresh token leak | Stored as CF secret; only accessible in Function runtime |
| KV enumeration | UUIDs for log entries; emails are guesses but password-gated |
| Malicious insider | Append-only log; every action attributed |

We're not defending against nation-states. We're defending against a curious teenager with the WiFi password.

---

## 5. Authorization

### 5.1 Roles

Four boolean flags per user:

| Role | Can view schedule | Can edit assignments | Can edit users | Can sync calendar |
|------|:-:|:-:|:-:|:-:|
| `isMember` | ✅ | ❌ | ❌ | ❌ |
| `isMedia` | ✅ | ❌ | ❌ | ❌ |
| `isWorshipLeader` | ✅ | ✅ | ❌ | ✅ |
| `isSuperAdmin` | ✅ | ✅ | ✅ | ✅ |

Flags are **additive**. A superadmin also has all worship leader permissions. Every user has `isMember: true` by default.

### 5.2 Enforcement Points

- **Frontend**: Hides UI based on role (UX only, never trust)
- **Pages Functions**: Every mutating endpoint checks the session, loads the user, and asserts the required role. This is the **only** real enforcement.
- **KV Writes**: Only Functions can write. Client never touches KV directly.

### 5.3 Permission Matrix (Endpoint-Level)

| Endpoint | Method | Required Role |
|----------|--------|---------------|
| `/api/auth/login` | POST | none |
| `/api/auth/logout` | POST | any session |
| `/api/auth/me` | GET | any session |
| `/api/weeks` | GET | any session |
| `/api/weeks/:id/assignments` | POST | worshipLeader or superAdmin |
| `/api/weeks/:id/assignments/:aid` | PATCH | worshipLeader or superAdmin |
| `/api/weeks/:id/assignments/:aid` | DELETE | worshipLeader or superAdmin |
| `/api/weeks/:id/rsvp` | PATCH | any session (own RSVP only) |
| `/api/users` | GET | superAdmin |
| `/api/users` | POST | superAdmin |
| `/api/users/:email` | PATCH | superAdmin |
| `/api/users/:email` | DELETE | superAdmin |
| `/api/log` | GET | worshipLeader or superAdmin |
| `/api/calendar/sync/pull` | POST | worshipLeader or superAdmin |
| `/api/calendar/sync/push` | POST | superAdmin |

---

## 6. The RSVP Evolution (V1 → V2)

This is the roadmap you asked about. Same UI, same log, different backend.

### 6.1 V1 — Description-Mirrored RSVP

**Where RSVP state lives:** the Calendar event description.

**Who can set it:** Anyone logged in can set their **own** RSVP. Worship leaders can set anyone's RSVP (they're often the ones taking attendance).

**Flow:**

```
1. User taps "Yes" on their own RSVP in the app
2. App POSTs to /api/weeks/:id/rsvp { email: self, status: 'yes' }
3. Function:
   a. Fetches current event from Google Calendar
   b. Parses description, extracts existing RSVP block
   c. Updates the RSVP block with the new status
   d. Patches the event description via Google Calendar API
   e. Writes log entry: rsvp.updated
4. App refetches the week, shows updated status
```

**Limitations (accepted):**
- The RSVP is visible but not "native" — it's text, not Google's attendee RSVP field
- Only one account (dedicated) shows as editor in Calendar history
- Race conditions possible if two users update simultaneously (mitigated by refetch-after-write)

**Why this is fine:** The audience is your worship team. They'll see the RSVP in the app. Nobody cares that Google Calendar shows it as text.

### 6.2 V2 — Native Attendee RSVP

**Where RSVP state lives:** Google Calendar attendees' `responseStatus`.

**Who can set it:** Each user, for themselves only. Google enforces this.

**Flow:**

```
1. User has already connected Google (one-time, §4.2)
2. User taps "Yes" in the app
3. App POSTs to /api/weeks/:id/rsvp { email: self, status: 'yes' }
4. Function:
   a. Loads the user's googleRefreshToken from KV
   b. Exchanges for access token
   c. Finds the event's attendee entry for the user's email
   d. Updates responseStatus to 'accepted' / 'declined' / 'tentative'
   e. Writes log entry
5. Google Calendar now shows the RSVP natively in the calendar UI
```

**What changes between V1 and V2:**
- Backend implementation of `/api/weeks/:id/rsvp`
- Adds a "Connect Google" button in user profile
- Adds refresh token storage
- Everything else — UI, log, roles — unchanged

**Migration path:** When V2 ships, run a one-time job that reads all V1 RSVP blocks from descriptions and writes them as native attendee responses. Then drop the description block from the parser.

### 6.3 The "Sauce" — Audit Log

Every RSVP change (V1 or V2) is logged identically:

```json
{
  "action": "rsvp.updated",
  "actor": "raymond@example.com",
  "actorName": "Raymond",
  "target": { "type": "rsvp", "id": "2026-09-13", "label": "Sep 13 - Raymond" },
  "before": { "status": "maybe" },
  "after": { "status": "yes" }
}
```

Rendered in the changelog as:

> **Raymond** changed RSVP to **yes** for Sep 13 — 6:07 AM, Sep 15

This exists in V1. It exists in V2. It is the app's memory.

---

## 7. API Surface (Pages Functions)

All endpoints live under `/functions/api/`. All return JSON. All mutations are gated by role + session.

### 7.1 Auth

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | Email + password → session cookie |
| `/api/auth/logout` | POST | Revoke session |
| `/api/auth/me` | GET | Current user record |

### 7.2 Weeks & Assignments

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/weeks?from=&to=` | GET | List weeks in range |
| `/api/weeks/:id` | GET | Single week with assignments |
| `/api/weeks/:id/assignments` | POST | Create assignment |
| `/api/weeks/:id/assignments/:aid` | PATCH | Update assignment |
| `/api/weeks/:id/assignments/:aid` | DELETE | Remove assignment |
| `/api/weeks/:id/rsvp` | PATCH | Update RSVP status |

### 7.3 Users

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/users` | GET | List all users (superAdmin) |
| `/api/users` | POST | Create user (superAdmin) |
| `/api/users/:email` | PATCH | Update user (superAdmin) |
| `/api/users/:email` | DELETE | Deactivate user (superAdmin) |

### 7.4 Log

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/log?from=&to=&actor=&action=` | GET | Query changelog |

### 7.5 Calendar Sync

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/calendar/sync/pull` | POST | Google → App |
| `/api/calendar/sync/push` | POST | App → Google |

---

## 8. Admin Panel Scope

A single SvelteKit route at `/admin`, gated by `isSuperAdmin`.

### 8.1 Sections

1. **Users** — list, create, edit roles, deactivate, reset password
2. **Changelog** — filterable feed (§9)
3. **Calendar sync** — manual pull/push buttons, last sync timestamp
4. **Sessions** — list active sessions, revoke all for a user
5. **Aliases** — map name aliases to users (for parser resolution)

### 8.2 Why In-App, Not Cloudflare Dashboard

- KV in the Cloudflare dashboard is a raw key-value viewer — unusable for daily ops
- In-app admin means you manage users from your phone at church
- In-app admin means the changelog is one tap away
- In-app admin means you own the UX

---

## 9. Changelog Format

### 9.1 Storage

Append-only in `LOG_KV`. Each entry keyed by `log:{ISO-timestamp}:{uuid}`.

### 9.2 Rendering

The UI parses each entry's `action` + `before` + `after` into a human sentence. Examples:

| Action | Rendered |
|--------|----------|
| `rsvp.updated` | **Raymond** changed RSVP to **yes** for Sep 13 |
| `assignment.reassigned` | **Raymond** moved *Lead Guitar* on Sep 13 from **Kevin** to **CJ** |
| `week.theme.updated` | **Marian** updated theme for Sep 13 from "Green" to "Faithful" |
| `user.role.changed` | **JLAC Media** promoted **Kevin** to worship leader |
| `sync.calendar.pulled` | **JLAC Media** pulled 4 weeks from Google Calendar |

### 9.3 Grouping

- **Feed view**: reverse-chronological, infinite scroll
- **Week view**: all entries for a given week, chronological
- **User view**: all entries by a given user, reverse-chronological

### 9.4 Filters

- By actor
- By action type
- By date range
- By week

---

## 10. Deployment Topology

### 10.1 Environments

| Environment | Domain | KV Namespaces | Google Account |
|-------------|--------|---------------|----------------|
| **Local dev** | `localhost:5173` | Preview KV | Test calendar (optional) |
| **Preview** | `*.pages.dev` | Preview KV | Production calendar (read-only) |
| **Production** | `jlac.workweek.dev` | Production KV | Production calendar (read+write) |

### 10.2 DNS

- `workweek.dev` registered at Porkbun
- Nameservers delegated to Cloudflare
- `jlac.workweek.dev` is a CNAME to the Pages project
- Cloudflare manages TLS automatically

### 10.3 Secrets (Cloudflare Pages environment variables)

| Name | Type | Purpose |
|------|------|---------|
| `GOOGLE_CLIENT_ID` | Secret | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Secret | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Secret | Dedicated account's refresh token |
| `GOOGLE_CALENDAR_ID` | Var | Target calendar ID |
| `SESSION_SIGNING_KEY` | Secret | (If sessions become stateless later) |

### 10.4 KV Bindings

```
USERS_KV      → namespace_id: ...
SESSIONS_KV   → namespace_id: ...
LOG_KV        → namespace_id: ...
```

Bound in Cloudflare Pages → Settings → Functions → KV namespace bindings. Separate bindings for Production and Preview.

### 10.5 Deploy

- Push to `main` → Production deploy
- Push to any other branch → Preview deploy
- Zero-config; Cloudflare Pages handles it

---

## 11. Scope Boundaries

### 11.1 V1 — This Design Document

**In scope:**
- Email + password login
- KV-backed users, sessions, changelog
- In-app admin panel (users, changelog, sessions, aliases)
- Read schedule from Google Calendar via dedicated account
- Write assignments back to Google Calendar (description only)
- RSVP via description block
- Calendar pull/push sync endpoints
- Changelog feed, week view, user view
- Role-based UI gating
- Deploy to `jlac.workweek.dev`

**Out of scope:**
- Per-user Google OAuth
- Native attendee RSVP
- Self-registration
- Password reset via email
- Email notifications
- Push notifications
- Native mobile app
- Analytics

### 11.2 V2 — Per-User RSVP

Adds:
- Google OAuth for RSVP scope (additive, not replacement)
- Refresh token storage per user
- Native attendee RSVP writes
- "Connect Google" in user profile
- Migration of V1 RSVPs to native

### 11.3 V3 — Dream Scope

Ideas to revisit later:
- Email/SMS reminders (Cloudflare Email Routing + Workers)
- Calendar subscription feeds per user
- Setlist lyrics integration
- Rehearsal scheduling
- Availability polling before assignments are made
- Mobile PWA with offline read
- D1 migration for log if query complexity demands it

---

## 12. Open Questions & Risks

### 12.1 Open Questions

1. **Password reset** — V1 has no self-serve reset. Superadmin resets manually. Acceptable?
2. **Alias ambiguity** — If two users share a name alias, how does the UI resolve? (Proposed: admin prompt once, store in `name_aliases`.)
3. **Time zone** — All timestamps UTC. Display in Asia/Manila. Confirm?
4. **Session expiry** — 30 days sliding. Should admins have shorter sessions?
5. **KV write limits** — 1,000 writes/day on free tier. Sync operations could burst this if pulling many weeks. Mitigate by batching or upgrading to paid ($5/mo).

### 12.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|:-:|:-:|------------|
| Refresh token expires (Testing mode) | High | High | Move to Published / Internal consent screen |
| KV eventual consistency causes stale reads | Medium | Low | Refetch-after-write on the client |
| Google Calendar API rate limits | Low | Medium | Cache, batch, backoff |
| Description format drift | Medium | Medium | Parser is tolerant; changelog exposes drift |
| Single dedicated account compromise | Low | High | Rotate refresh token; audit log shows all writes |
| Cloudflare KV outage | Very Low | High | Read-only fallback to public ICS (if made public again) |

---

## 13. Summary

This app does three things:

1. **Shows** the worship schedule beautifully on a phone.
2. **Lets trusted people edit** assignments, with every change attributed.
3. **Evolves** from a simple description-mirror RSVP to native Google Calendar RSVP without rewriting the app.

The stack is deliberately small: SvelteKit, Cloudflare Pages, Pages Functions, and three KV namespaces. Google Calendar remains the event source of truth. The app is the scheduling layer, the identity layer, and the memory.

**No Supabase. No ORM. No auth vendor. Just the edge.**

---

*End of document. Next step: implementation plan, one file at a time.*