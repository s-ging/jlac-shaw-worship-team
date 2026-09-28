/**
 * Shared by the scripts that work on users straight in PRODUCTION KV:
 * create-user.mjs and import-users.mjs write them, send-welcome.mjs reads them.
 *
 * Hashes are produced here in Node rather than by the app, so the format could
 * in principle drift from src/lib/server/crypto.ts. Each script ends by signing
 * in against the live site, which catches that loudly.
 */
import { execFileSync } from 'node:child_process'
import { webcrypto as crypto } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const SITE = process.env.SITE_URL ?? 'https://jlac-shaw-worship-team.pages.dev'

// Must stay in step with src/lib/server/crypto.ts
const ITERATIONS = 10_000
const KEY_BITS = 256
const SALT_BYTES = 16

const toBase64 = (bytes) => Buffer.from(bytes).toString('base64')

async function derive(plain, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(plain), 'PBKDF2', false, [
    'deriveBits'
  ])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, material, KEY_BITS)
  return new Uint8Array(bits)
}

export async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(plain, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

/** True if `plain` is the password behind a stored hash. */
export async function verifyPassword(plain, stored) {
  const [scheme, iterations, salt, hash] = String(stored).split('$')
  if (scheme !== 'pbkdf2' || !salt || !hash) return false
  const actual = await derive(plain, Buffer.from(salt, 'base64'), Number(iterations))
  return toBase64(actual) === hash
}

/** Access tier + media flag → the role flags the app stores. Mirrors rolesForTier in src/lib/roles.ts. */
export function rolesFor(access, isMedia) {
  return {
    isSuperAdmin: access === 'superadmin',
    isWorshipLeader: access === 'superadmin' || access === 'admin',
    isMedia,
    isMember: true
  }
}

function wrangler(args) {
  return execFileSync('npx', ['wrangler', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: process.platform === 'win32'
  })
}

/** Emails that already have an account in production. */
export function existingEmails() {
  const out = wrangler(['kv', 'key', 'list', '--binding=USERS_KV', '--remote', '--preview', 'false'])
  const keys = JSON.parse(out.slice(out.indexOf('[')))
  return new Set(keys.map((k) => k.name.replace(/^user:/, '')))
}

/** Every user record in production, password hashes included. One read per user. */
export function getUsers() {
  return [...existingEmails()].map((email) =>
    JSON.parse(wrangler(['kv', 'key', 'get', `user:${email}`, '--binding=USERS_KV', '--remote', '--preview', 'false']))
  )
}

/**
 * Writes user records to production in one call. Goes through a JSON file
 * rather than command-line arguments, which Windows' shell would mangle.
 */
export function putUsers(users) {
  const dir = mkdtempSync(join(tmpdir(), 'jlac-users-'))
  const file = join(dir, 'users.json')
  try {
    writeFileSync(file, JSON.stringify(users.map((u) => ({ key: `user:${u.email}`, value: JSON.stringify(u) }))))
    wrangler(['kv', 'bulk', 'put', file, '--binding=USERS_KV', '--remote', '--preview', 'false'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Signs in against the live site. Returns the HTTP status. */
export async function trySignIn(email, password) {
  const res = await fetch(`${SITE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  return res.status
}
