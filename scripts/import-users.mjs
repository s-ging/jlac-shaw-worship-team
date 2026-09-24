#!/usr/bin/env node
/**
 * Creates the team's accounts in PRODUCTION KV from a roster file, all on one
 * shared starting password. Everyone is asked to choose their own password the
 * first time they sign in.
 *
 * Usage:
 *   node scripts/import-users.mjs <roster.tsv> --password=<starting password>          # dry run
 *   node scripts/import-users.mjs <roster.tsv> --password=<starting password> --yes    # write
 *
 * The roster is tab-separated with a header row:
 *   name  nickname  email  calendar_names  access  media  instruments
 *
 *   calendar_names  how the schedule writes them, several separated by ";"
 *   access          member | admin | superadmin
 *   media           yes | no
 *   instruments     comma-separated, free text
 *   primary         optional column: leadvocal, backup, drums, lguitar, rguitar, bass, keys or media
 *                   (PRIMARY_ROLES in src/lib/parts.ts)
 *
 * Lines starting with # are ignored. Emails that already have an account are
 * skipped, never overwritten, so it is safe to rerun after adding rows.
 *
 * Rosters hold people's emails, so they are gitignored (scripts/roster*.tsv).
 * The starting password is a flag rather than in the file so neither ends up
 * committed.
 */
import { readFileSync } from 'node:fs'
import { existingEmails, hashPassword, putUsers, rolesFor, SITE, trySignIn } from './lib/users.mjs'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const password = args.find((a) => a.startsWith('--password='))?.slice('--password='.length)
const confirmed = args.includes('--yes')

if (!file || !password) {
  console.error('Usage: node scripts/import-users.mjs <roster.tsv> --password=<starting password> [--yes]')
  process.exit(1)
}
if (password.length < 8) {
  console.error('The starting password must be at least 8 characters.')
  process.exit(1)
}

const COLUMNS = ['name', 'nickname', 'email', 'calendar_names', 'access', 'media', 'instruments']
const ACCESS = ['member', 'admin', 'superadmin']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Mirrors PRIMARY_ROLES in src/lib/parts.ts.
const PRIMARY = ['leadvocal', 'backup', 'drums', 'lguitar', 'rguitar', 'bass', 'keys', 'media']

const lines = readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .map((line, i) => ({ line, number: i + 1 }))
  .filter(({ line }) => line.trim() && !line.trim().startsWith('#'))

const header = lines.shift()?.line.split('\t').map((h) => h.trim().toLowerCase()) ?? []
const missing = COLUMNS.filter((c) => !header.includes(c))
if (missing.length) {
  console.error(`Roster is missing column(s): ${missing.join(', ')}`)
  process.exit(1)
}

const problems = []
const seen = new Set()
const rows = lines.map(({ line, number }) => {
  const cells = line.split('\t')
  const get = (col) => (cells[header.indexOf(col)] ?? '').trim()
  const row = {
    number,
    name: get('name'),
    nickname: get('nickname'),
    email: get('email').toLowerCase(),
    aliases: get('calendar_names').split(';').map((s) => s.trim()).filter(Boolean),
    access: get('access').toLowerCase() || 'member',
    media: /^(yes|y|true)$/i.test(get('media')),
    instruments: get('instruments').split(',').map((s) => s.trim()).filter(Boolean),
    primary: get('primary').toLowerCase()
  }
  if (row.primary && !PRIMARY.includes(row.primary)) problems.push(`line ${number}: primary must be one of ${PRIMARY.join(', ')}`)
  if (!row.name) problems.push(`line ${number}: missing name`)
  if (!EMAIL_RE.test(row.email)) problems.push(`line ${number}: invalid email "${row.email}"`)
  if (!ACCESS.includes(row.access)) problems.push(`line ${number}: access must be ${ACCESS.join(' / ')}`)
  if (seen.has(row.email)) problems.push(`line ${number}: ${row.email} appears twice (emails are the sign-in name)`)
  seen.add(row.email)
  return row
})

if (problems.length) {
  console.error('Fix these in the roster first:\n  ' + problems.join('\n  '))
  process.exit(1)
}

console.log('Checking which accounts already exist in production...')
const existing = existingEmails()
const toCreate = rows.filter((r) => !existing.has(r.email))
const skipped = rows.filter((r) => existing.has(r.email))

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n${pad('Name', 24)}${pad('Access', 12)}${pad('Media', 7)}Calendar name(s)`)
for (const r of toCreate) {
  console.log(`${pad(r.name, 24)}${pad(r.access, 12)}${pad(r.media ? 'yes' : '', 7)}${r.aliases.join(', ')}`)
}
if (skipped.length) console.log(`\nAlready have accounts, skipping: ${skipped.map((r) => r.email).join(', ')}`)
console.log(`\n${toCreate.length} to create.`)

if (toCreate.length === 0) process.exit(0)
if (!confirmed) {
  console.log('Dry run: nothing written. Rerun with --yes to create these accounts.')
  process.exit(0)
}

const now = new Date().toISOString()
const users = []
for (const r of toCreate) {
  users.push({
    email: r.email,
    name: r.name,
    nickname: r.nickname || undefined,
    passwordHash: await hashPassword(password),
    roles: rolesFor(r.access, r.media),
    instruments: r.instruments,
    aliases: r.aliases.length ? r.aliases : [r.name.split(' ')[0]],
    primaryRole: r.primary || undefined,
    createdAt: now,
    updatedAt: now,
    active: true,
    mustChangePassword: true
  })
}

console.log('Writing to production USERS_KV...')
putUsers(users)

// Signing in proves the hash format matches the app. It doesn't change anything
// for them: they're still asked to pick a password on their own first sign-in.
console.log(`Verifying one account by signing in at ${SITE} ...`)
const status = await trySignIn(users[0].email, password)
if (status === 200) {
  console.log(`\nOK: created ${users.length} accounts. Starting password works.`)
} else {
  console.error(`\nAccounts written, but a test sign-in returned ${status}.`)
  console.error('If it persists, the hash format in scripts/lib/users.mjs has drifted from src/lib/server/crypto.ts.')
  process.exit(1)
}
