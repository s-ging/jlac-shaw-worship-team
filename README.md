# Praise Team Scheduler

The JLAC Shaw worship team's schedule, RSVPs and lineups. Google Calendar is the
source of truth for the schedule; the app adds sign-in, RSVPs, in-app lineup
editing and a changelog.

- **Live:** https://jlac-shaw-worship-team.pages.dev (custom domain `jlac.workweek.dev` planned)
- **Hosting:** Cloudflare Pages. **Pushing `main` deploys to production.**
- **Data:** Cloudflare KV (users, sessions, RSVPs, log, notifications). The schedule itself lives in Google Calendar.

## Access levels

| Level | Can |
|---|---|
| Member | See the schedule, RSVP for themselves |
| Admin (song leader) | Also edit lineups, RSVP for others, read the changelog (`/log`) |
| Superadmin | Also add people, change access, reset passwords (`/admin`) |

## Runbook

**Add a person.** Sign in as a superadmin → **Admin** → **+ Add person**. Set a
temporary password (usually the team's starting one). They're emailed the link and
that password automatically. "Name in the calendar" must match how the schedule
writes their name (e.g. `Kevin`).

**Add many people at once.** Put them in `scripts/roster.tsv` (gitignored; the
column format is at the top of `scripts/import-users.mjs`), then:

```sh
node scripts/import-users.mjs scripts/roster.tsv --password=<starting password>        # dry run
node scripts/import-users.mjs scripts/roster.tsv --password=<starting password> --yes  # create
```

Existing accounts are skipped, never overwritten, so rerun it after adding rows.
Imported accounts aren't emailed; send them their welcome afterwards (see **Email**).

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

**Notifications.** When a lineup saved in the app puts someone on a Sunday or
gives them a new part, it shows under **🔔** in the header (red badge = new) and
they get an email about it. Not for whoever made the edit, past Sundays, or names
the app can't match to one person. Edits made directly in Google Calendar send
nothing. Each person can turn the emails off under **Me**; the bell always works.

Emails are held back so nobody gets flooded (rules in `src/lib/server/notify.ts`):

- **One digest, not one per save.** A person's email waits until none of their
  Sundays has changed for 15 minutes, then covers all of them. Planning a month
  is one email.
- **Never twice for the same thing.** Re-saving, or taking someone off and
  putting them back, doesn't email again. Moving them to a new part does.
- **At most 2 a day per person, only 7am to 9pm** Manila time. The rest waits.
- The Apps Script also stops short of Gmail's ~100-a-day limit.

**Email.** Sent by a Google Apps Script project,
[apps-script/Mailer.gs](apps-script/Mailer.gs), as `jlacshawmedia01@gmail.com`:

- **Welcome**, pushed the moment an account is created in the app: the link to
  the app, their email, and the password that was set.
- **Lineup digests**, pulled: every 15 minutes the script asks
  `/api/mailer/digests` what's due, sends it and reports back.

**Email the whole team their sign-in.** **Admin** → **Sign-in email** → **Email N
people** → confirm. It goes to every active person who hasn't had one yet; anyone
already emailed is skipped, so pressing it again only reaches new or failed ones.
**Show who** lists each person as starting password / link only / emailed. People
still on the starting password get it in the email; people who chose their own get
the link only. That check needs the `STARTING_PASSWORD` Pages secret (set). Every
send is in `/log`.

The same from a terminal, for a few people with `--only` (it doesn't mark anyone
as emailed for the button):

```sh
node scripts/send-welcome.mjs --password=<starting password>        # dry run: who gets what
node scripts/send-welcome.mjs --password=<starting password> --yes  # send
```

Setting up the mailer (once, or again after changing the script):

1. Signed in as `jlacshawmedia01@gmail.com`, create a project at script.google.com.
   Paste in `Mailer.gs`. Under **Project Settings**, tick "Show appsscript.json" and
   paste `appsscript.json` over it.
2. **Project Settings → Script Properties**: add `MAILER_SECRET`, a long random
   string (`node -e "console.log(crypto.randomUUID())"`). Add `APP_URL` too if the
   app isn't live at https://jlac.workweek.dev yet (e.g. the pages.dev address).
3. Run `sendTestEmails` from the editor and allow what it asks. A welcome and a
   two-Sunday digest arrive in the team inbox.
4. **Deploy → New deployment → Web app**, execute as **Me**, access **Anyone**.
   Copy the web app URL. After editing the script later, use **Manage deployments
   → Edit → New version** so the URL stays the same.
5. Give the app both values, then redeploy (push `main`):

   ```sh
   npx wrangler pages secret put MAILER_URL --project-name=jlac-shaw-worship-team
   npx wrangler pages secret put MAILER_SECRET --project-name=jlac-shaw-worship-team
   ```

   Add the same two to `.env` for `send-welcome.mjs` and local testing.
6. Once the deploy is live, run `installTrigger` from the editor. That starts the
   15-minute digest run. **Triggers** (clock icon) shows it and any failures.

Without the secrets the app works as before: the bell fills in, nothing is emailed.
Failed sends show in the Pages function logs and the script's **Executions**, never
to the person saving.

**Install on a phone.** The app is a PWA: open it in the phone's browser, then
Android Chrome → menu → **Install app**, or iPhone Safari → Share → **Add to Home
Screen**. It opens full screen, and without signal it shows the last schedule you
loaded (`src/service-worker.ts`). Saving and RSVPs need a connection.
There's no app icon yet: add `static/icons/icon-192.png` and `icon-512.png` (square
PNGs) plus `static/apple-touch-icon.png` (180×180), list the first two under `icons`
in `static/manifest.webmanifest`, and add `<link rel="apple-touch-icon"
href="/apple-touch-icon.png" />` to `src/app.html`. Until then Android won't offer
**Install app** by itself (the menu's **Add to Home screen** still works), and
iPhone uses a screenshot as the icon.

**Who changed what?** `/log`, newest first. Lineup edits made directly in Google
Calendar are not logged, only ones made in the app.

**Roll back a deploy.** Cloudflare dashboard → Workers & Pages →
`jlac-shaw-worship-team` → Deployments → pick the previous one → **Rollback**.
Or revert the commit and push.

**Data console.** **Admin** → **Data** (`/admin/data`). Limited to
`krischanb.workweek@gmail.com` and `jlacshawmedia01@gmail.com`, and they must also
be superadmins; other superadmins don't see the link and get a 403. The list is
`DATA_CONSOLE_EMAILS` in `src/lib/server/kv-console.ts`; edit and redeploy to change it. The raw
KV records behind the app, one "table" per namespace: browse, search by key
prefix, open a record, and edit, create or delete it. Works on a phone. Use the
People page for everyday changes; this console is for fixing things it can't.

- Secrets stay hidden. `passwordHash` and a session's `token` show as `••••`;
  leave them like that and the stored value is kept. Session keys are the
  token itself, so they only ever appear truncated (`session:a1b2…f9d3`).
  Change passwords on the People page, not here.
- `user:` records are checked against the `UserRecord` shape (no unknown
  fields, `email` must match the key). Edits keep the key's expiration and
  metadata unless you change them under **Metadata and expiry**.
- Deletes ask you to type the last part of the key. You can't delete your own
  user record or the session you're using. For people, **Deactivate instead**
  is safer and keeps their history.
- **Sign someone out everywhere:** open their `user:` record → **Revoke all
  sessions for this user**. To end one device's session, open it under
  Sessions → **Revoke this session**.
- The changelog (`LOG_KV`) is read-only here, always.
- **Export** at the bottom of each table downloads it as JSON. Secrets are
  masked unless you tick **Include secrets**; that export is logged, so store
  the file somewhere private. Very large namespaces (over ~950 keys) are
  refused: use `wrangler kv key list` for those.
- Every change made here shows up in `/log`, naming the key and which fields
  changed, never secret values.

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
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `MAILER_URL`,
`MAILER_SECRET`, `STARTING_PASSWORD`. Production secrets are set on the Pages project (`npm run
google:auth` sets the Google ones). Local dev with the mailer set up sends real email.

`wrangler.jsonc` is the source of truth for bindings: Cloudflare ignores the
dashboard's binding settings once it exists.
