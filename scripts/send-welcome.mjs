#!/usr/bin/env node
/**
 * Emails the team their link to the app and how to sign in, through the Apps
 * Script mailer (apps-script/Mailer.gs). New accounts made in the app get this
 * on their own; this is for everyone who was added before, or by import-users.
 *
 * Usage:
 *   node scripts/send-welcome.mjs --password=<starting password>                     # dry run
 *   node scripts/send-welcome.mjs --password=<starting password> --yes               # send
 *   node scripts/send-welcome.mjs --password=<starting password> --only=a@x.com,b@y.com --yes
 *
 * Anyone whose password is still the starting one gets it in the email. Anyone
 * who already chose their own gets the link and "the password you chose".
 * Inactive accounts get nothing. The password is checked against each stored
 * hash here, and is never written anywhere.
 *
 * Needs MAILER_URL and MAILER_SECRET in .env (see README, "Email").
 */
import dotenv from 'dotenv'
import { getUsers, verifyPassword } from './lib/users.mjs'

dotenv.config({ quiet: true })

const args = process.argv.slice(2)
const password = args.find((a) => a.startsWith('--password='))?.slice('--password='.length)
const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length).toLowerCase().split(',').map((e) => e.trim())
const confirmed = args.includes('--yes')
const { MAILER_URL, MAILER_SECRET } = process.env

if (!password) {
  console.error('Usage: node scripts/send-welcome.mjs --password=<starting password> [--only=email,...] [--yes]')
  process.exit(1)
}
if (!MAILER_URL || !MAILER_SECRET) {
  console.error('MAILER_URL and MAILER_SECRET must be set in .env first.')
  process.exit(1)
}

console.log('Reading accounts from production...')
const users = getUsers()
  .filter((u) => u.active && (!only || only.includes(u.email)))
  .sort((a, b) => a.name.localeCompare(b.name))

if (only) {
  const missing = only.filter((e) => !users.some((u) => u.email === e))
  if (missing.length) console.log(`No active account for: ${missing.join(', ')}`)
}

const mails = []
for (const u of users) {
  const onStarting = await verifyPassword(password, u.passwordHash)
  mails.push({ kind: 'welcome', to: u.email, name: u.nickname || u.name.split(' ')[0], password: onStarting ? password : undefined })
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n${pad('Name', 24)}${pad('Email', 36)}Password in email`)
for (const [i, m] of mails.entries()) console.log(`${pad(users[i].name, 24)}${pad(m.to, 36)}${m.password ? 'starting' : 'no, chose their own'}`)
console.log(`\n${mails.length} to send.`)

if (mails.length === 0) process.exit(0)
if (!confirmed) {
  console.log('Dry run: nothing sent. Rerun with --yes to send these.')
  process.exit(0)
}

let failed = 0
for (const m of mails) {
  const res = await fetch(MAILER_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...m, secret: MAILER_SECRET })
  })
  const body = await res.json().catch(() => null)
  if (body?.ok) {
    console.log(`sent  ${m.to}`)
  } else {
    failed++
    console.error(`FAIL  ${m.to}: ${body?.error ?? `HTTP ${res.status}`}`)
  }
}

console.log(failed ? `\n${failed} of ${mails.length} failed. Rerun with --only=... for those.` : `\nOK: sent ${mails.length}.`)
process.exit(failed ? 1 : 0)
