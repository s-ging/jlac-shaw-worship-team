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
 * existing admin account — it is how the first superadmin is created. The
 * password hash is produced here, in Node, which means it could in principle
 * drift from the Workers implementation in $lib/server/crypto. That is why the
 * script finishes by actually logging in: if the formats ever diverge, this
 * fails loudly instead of leaving you with an account that cannot sign in.
 */
import { execFileSync } from 'node:child_process'
import { webcrypto as crypto } from 'node:crypto'

const SITE = process.env.SITE_URL ?? 'https://jlac-shaw-worship-team.pages.dev'

// Must stay in step with src/lib/server/crypto.ts
const ITERATIONS = 10_000
const KEY_BITS = 256
const SALT_BYTES = 16

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

const toBase64 = (bytes) => Buffer.from(bytes).toString('base64')

async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(plain), 'PBKDF2', false, [
    'deriveBits'
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    KEY_BITS
  )
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`
}

const normalized = email.trim().toLowerCase()
const now = new Date().toISOString()

const user = {
  email: normalized,
  name: name.trim(),
  passwordHash: await hashPassword(password),
  roles: {
    isSuperAdmin: roleList.includes('superadmin'),
    // 'leader' is the old name for admin, still accepted.
    isWorshipLeader: ['superadmin', 'admin', 'leader'].some((r) => roleList.includes(r)),
    isMedia: roleList.includes('media'),
    isMember: true
  },
  instruments: [],
  aliases: [name.trim().split(' ')[0]],
  createdAt: now,
  updatedAt: now,
  active: true
}

console.log(`Writing user:${normalized} to production USERS_KV...`)
execFileSync(
  'npx',
  [
    'wrangler', 'kv', 'key', 'put',
    '--binding=USERS_KV',
    `user:${normalized}`,
    JSON.stringify(user),
    '--remote',
    '--preview', 'false'
  ],
  { stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' }
)

console.log(`Verifying by signing in at ${SITE} ...`)
const res = await fetch(`${SITE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: normalized, password })
})

if (res.ok) {
  const body = await res.json()
  console.log(`\nOK — ${body.user.name} <${body.user.email}> can sign in.`)
  console.log(`   roles: ${Object.entries(body.user.roles).filter(([, v]) => v).map(([k]) => k).join(', ')}`)
} else {
  console.error(`\nFAILED — user written but login returned ${res.status}.`)
  console.error('   If the site has not deployed the current code yet, retry in a minute.')
  console.error('   If it persists, the hash format here has drifted from src/lib/server/crypto.ts.')
  process.exit(1)
}
