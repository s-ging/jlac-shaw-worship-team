#!/usr/bin/env node
/**
 * Puts event descriptions back exactly as a backup file has them. The undo for
 * lineup edits: Google Calendar keeps no history of event descriptions.
 *
 * Usage:
 *   node scripts/restore-calendar.mjs <backup.json>                       # show what differs
 *   node scripts/restore-calendar.mjs <backup.json> <eventId> --yes       # restore one event
 *   node scripts/restore-calendar.mjs <backup.json> --all --yes           # restore every changed event
 *
 * Backups live in scripts/backups/ (gitignored). Uses the calendar account's
 * refresh token from .env, the one `npm run google:auth` saved.
 */
import { readFileSync } from 'node:fs'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const args = process.argv.slice(2)
const file = args.find((a) => a.endsWith('.json'))
const eventId = args.find((a) => !a.startsWith('--') && a !== file)
const all = args.includes('--all')
const confirmed = args.includes('--yes')

if (!file) {
  console.error('Usage: node scripts/restore-calendar.mjs <backup.json> [<eventId> | --all] [--yes]')
  process.exit(1)
}

const backup = JSON.parse(readFileSync(file, 'utf8'))
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.error('Google credentials missing from .env. Run `npm run google:auth` first.')
  process.exit(1)
}

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    refresh_token: GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  })
})
const { access_token: token } = await tokenRes.json()
if (!token) {
  console.error('Could not get a Google access token. Rerun `npm run google:auth`.')
  process.exit(1)
}

const eventUrl = (id) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(backup.calendarId)}/events/${encodeURIComponent(id)}`
const auth = { authorization: `Bearer ${token}` }

const changed = []
for (const saved of backup.events) {
  const current = await (await fetch(eventUrl(saved.id), { headers: auth })).json()
  if ((current.description ?? null) !== saved.description) changed.push({ saved, current })
}

console.log(`Backup from ${backup.savedAt}: ${backup.events.length} events, ${changed.length} changed since.`)
for (const { saved } of changed) {
  console.log(`  ${(saved.start.date ?? saved.start.dateTime).slice(0, 10)}  ${saved.id}  ${saved.summary}`)
}

const targets = all ? changed : changed.filter((c) => c.saved.id === eventId)
if (eventId && targets.length === 0) console.log(`\n${eventId} matches the backup already (or isn't in it). Nothing to do.`)
if (targets.length === 0) process.exit(0)
if (!confirmed) {
  console.log(`\nDry run. Add --yes to restore ${targets.length} event(s).`)
  process.exit(0)
}

for (const { saved, current } of targets) {
  // Conditional on the version we just read, so a concurrent edit isn't clobbered.
  const res = await fetch(eventUrl(saved.id), {
    method: 'PATCH',
    headers: { ...auth, 'content-type': 'application/json', 'if-match': current.etag },
    body: JSON.stringify({ description: saved.description ?? '' })
  })
  console.log(`${res.ok ? 'Restored' : `FAILED (${res.status})`}: ${saved.summary}`)
}
