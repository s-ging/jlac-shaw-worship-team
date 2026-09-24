#!/usr/bin/env node
/**
 * Creates a user directly in PRODUCTION KV, then proves it worked by signing in
 * as them against the live site.
 *
 * Usage:
 *   node scripts/create-user.mjs <email> "<Full Name>" <password> [--roles=superadmin,admin,media]
 *
 * Roles: superadmin (manages people), admin (song leader: edits lineups), media.
 * Omit --roles for a regular member.
 *
 * This writes to KV rather than calling POST /api/users, so it works with no
 * existing admin account. It is the break-glass way to get a superadmin back.
 * The password you give is kept (no forced change), since you chose it yourself.
 * For the whole team at once, use import-users.mjs.
 */
import { hashPassword, putUsers, rolesFor, SITE, trySignIn } from './lib/users.mjs'

const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
const [email, name, password] = args.filter((a) => !a.startsWith('--'))

if (!email || !name || !password) {
  console.error('Usage: node scripts/create-user.mjs <email> "<Full Name>" <password> [--roles=superadmin,admin,media]')
  process.exit(1)
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.')
  process.exit(1)
}

const roleList = (flags.find((f) => f.startsWith('--roles='))?.slice('--roles='.length) ?? '')
  .split(',')
  .map((r) => r.trim().toLowerCase())
  .filter(Boolean)

// 'leader' is the old name for admin, still accepted.
const access = roleList.includes('superadmin')
  ? 'superadmin'
  : roleList.includes('admin') || roleList.includes('leader')
    ? 'admin'
    : 'member'

const normalized = email.trim().toLowerCase()
const now = new Date().toISOString()

const user = {
  email: normalized,
  name: name.trim(),
  passwordHash: await hashPassword(password),
  roles: rolesFor(access, roleList.includes('media')),
  instruments: [],
  aliases: [name.trim().split(' ')[0]],
  createdAt: now,
  updatedAt: now,
  active: true
}

console.log(`Writing user:${normalized} to production USERS_KV...`)
putUsers([user])

console.log(`Verifying by signing in at ${SITE} ...`)
const status = await trySignIn(normalized, password)
if (status === 200) {
  console.log(`\nOK: ${user.name} <${normalized}> can sign in as ${access}.`)
} else {
  console.error(`\nFAILED: user written but login returned ${status}.`)
  console.error('   If the site has not deployed the current code yet, retry in a minute.')
  console.error('   If it persists, the hash format in scripts/lib/users.mjs has drifted from src/lib/server/crypto.ts.')
  process.exit(1)
}
