# Praise Team Scheduler

The JLAC Shaw worship team's schedule, RSVPs and lineups. Google Calendar is the
source of truth for the schedule; the app adds sign-in, RSVPs, in-app lineup
editing and a changelog.

- **Live:** https://jlac-shaw-worship-team.pages.dev (custom domain `jlac.workweek.dev` planned)
- **Hosting:** Cloudflare Pages. **Pushing `main` deploys to production.**
- **Data:** Cloudflare KV (users, sessions, RSVPs, log). The schedule itself lives in Google Calendar.

## Access levels

| Level | Can |
|---|---|
| Member | See the schedule, RSVP for themselves |
| Admin (song leader) | Also edit lineups, RSVP for others, read the changelog (`/log`) |
| Superadmin | Also add people, change access, reset passwords (`/admin`) |

## Runbook

**Add a person.** Sign in as a superadmin → **Admin** → **+ Add person**. Set a
temporary password and send it to them yourself. "Name in the calendar" must match
how the schedule writes their name (e.g. `Kevin`).

**Add many people at once.** Put them in `scripts/roster.tsv` (gitignored; the
column format is at the top of `scripts/import-users.mjs`), then:

```sh
node scripts/import-users.mjs scripts/roster.tsv --password=<starting password>        # dry run
node scripts/import-users.mjs scripts/roster.tsv --password=<starting password> --yes  # create
```

Existing accounts are skipped, never overwritten, so rerun it after adding rows.

**First sign-in.** Anyone whose password someone else set (new accounts, resets)
is sent to **Me** to choose their own before they can use the app. Everyone can
change their password and nickname under **Me** any time.

**Reset a password.** **Admin** → **Edit** on the person → type a new password → Save.
There is no self-serve reset.

**Remove someone.** **Admin** → **Edit** → uncheck **Active**. They are signed out
immediately and can't sign in; their history stays in the log.

**Create a user without the app** (e.g. if no superadmin can sign in):

```sh
node scripts/create-user.mjs <email> "<Full Name>" <password> --roles=superadmin
```

Roles: `superadmin`, `admin`, `media` (comma-separated), or omit for a member.

**Calendar editing stopped working** ("refresh token may have been revoked").
Rerun `npm run google:auth`, sign in as `jlacshawmedia01@gmail.com`, then redeploy.
The token only expires if that account's access is revoked, its password changes,
or the OAuth app goes back to "Testing" in Google Cloud console.

**Who changed what?** `/log`, newest first. Lineup edits made directly in Google
Calendar are not logged, only ones made in the app.

**Roll back a deploy.** Cloudflare dashboard → Workers & Pages →
`jlac-shaw-worship-team` → Deployments → pick the previous one → **Rollback**.
Or revert the commit and push.

**Where the data is.** Cloudflare dashboard → Storage → KV. Production namespaces
are the `id`s in `wrangler.jsonc`; the `preview_id`s are for local dev and
preview deployments, so testing never touches real data.

## Developing

```sh
npm install
npm run dev          # local KV lives under .wrangler/ and starts empty
npm run check        # type check
```

`.env` holds local secrets (never committed): `BOOTSTRAP_SECRET`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Production
secrets are set on the Pages project (`npm run google:auth` sets the Google ones).

`wrangler.jsonc` is the source of truth for bindings: Cloudflare ignores the
dashboard's binding settings once it exists.
