#!/usr/bin/env node
/**
 * Seeds a user into LOCAL KV for development.
 *
 * Usage: node scripts/seed-user.mjs <email> [display name]
 *
 * This goes through wrangler's getPlatformProxy — the same code path
 * adapter-cloudflare uses for `npm run dev` — so the record is visible to the
 * dev server. Note that `wrangler kv key put --local` does NOT share storage
 * with the dev server and its writes will appear to vanish.
 *
 * No password is set here; password hashing arrives in Phase 2.
 */
import { getPlatformProxy } from 'wrangler'

const [email, ...nameParts] = process.argv.slice(2)
if (!email) {
  console.error('Usage: node scripts/seed-user.mjs <email> [display name]')
  process.exit(1)
}

const now = new Date().toISOString()
const user = {
  email,
  name: nameParts.join(' ') || email.split('@')[0],
  roles: { isSuperAdmin: true, isWorshipLeader: true, isMedia: false, isMember: true },
  instruments: [],
  aliases: [],
  createdAt: now,
  updatedAt: now,
  active: true
}

const { env, dispose } = await getPlatformProxy()
try {
  await env.USERS_KV.put(`user:${email}`, JSON.stringify(user))
  const { keys } = await env.USERS_KV.list()
  console.log(`Seeded user:${email}`)
  console.log(`USERS_KV now holds ${keys.length} key(s):`)
  for (const k of keys) console.log(`  ${k.name}`)
} finally {
  await dispose()
}
