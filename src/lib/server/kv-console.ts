import { error, type RequestEvent } from '@sveltejs/kit'
import type { KVNamespace, KVNamespaceListKey } from '@cloudflare/workers-types'
import { DISPLAY_TIMEZONE } from '$lib/config'
import { MASK, type KvNamespaceName } from '$lib/kv-namespaces'
import { TIER_LABELS, tierOf } from '$lib/roles'
import type { LogEntry, UserRecord, UserRoles } from '$lib/types'
import { requireRole, SESSION_COOKIE } from './auth'
import { normalizeEmail } from './kv'

// ---- Access ----

/**
 * Who may open the data console, for now. Being a superadmin is not enough on
 * its own: the console bypasses the People page's checks, so it is limited to
 * these accounts, and they must still hold superadmin. Edit and redeploy to change.
 */
const DATA_CONSOLE_EMAILS = new Set(['krischanb.workweek@gmail.com', 'jlacshawmedia01@gmail.com'])

export function canUseDataConsole(user: UserRecord | null | undefined): boolean {
  return Boolean(user?.roles.isSuperAdmin && DATA_CONSOLE_EMAILS.has(normalizeEmail(user.email)))
}

/** Every console endpoint starts here. 401 signed out, 403 for anyone not on the list. */
export function requireDataConsole(event: RequestEvent): UserRecord {
  const user = requireRole(event, 'isSuperAdmin')
  if (!canUseDataConsole(user)) throw error(403, 'The data console is limited to specific accounts')
  return user
}

/**
 * Helpers behind the superadmin data console (/admin/data): the raw view of
 * KV that the People page sits on top of.
 *
 * Two kinds of secret never leave the server in the clear:
 * - secret fields inside values (`passwordHash`, a session's `token`), which
 *   are replaced by MASK and restored from the stored record on write;
 * - session keys, which *are* the token. The browser only ever sees them
 *   truncated, and refers to them by `ref`, a hash the server resolves back.
 */

type Env = App.Platform['env']

export const PAGE_SIZE = 50

const COUNT_CAP = 1000
const KEY_BYTES_LIMIT = 512
const METADATA_BYTES_LIMIT = 1024
const MIN_TTL_SECONDS = 60 // KV refuses anything shorter
/** Workers allow 1000 KV operations per request; an export spends one per key. */
const EXPORT_KEY_LIMIT = 950

const SECRET_FIELDS: Partial<Record<KvNamespaceName, string[]>> = {
  USERS_KV: ['passwordHash'],
  SESSIONS_KV: ['token']
}

const encoder = new TextEncoder()
const byteLength = (s: string) => encoder.encode(s).length

type Json = Record<string, unknown>
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/** One line of the table view. `ref` is what the API takes as `?key=`. */
export interface ConsoleRow {
  ref: string
  key: string
  /** Unix seconds, as KV reports it. */
  expiration: number | null
  metadata: string | null
  title: string
  fields: { label: string; value: string }[]
}

/** One record as the browser sees it: secrets masked, session key truncated. */
export interface ConsoleRecord {
  ref: string
  key: string
  value: unknown
  /** False when the stored value is not JSON; `value` is then the raw text. */
  isJson: boolean
  expiration: number | null
  metadata: unknown
}

export interface ExportRow {
  key: string
  value: unknown
  metadata: unknown
  expiration: number | null
}

// ---- Keys and refs ----

const isSessionKey = (ns: KvNamespaceName, key: string) => ns === 'SESSIONS_KV' && key.startsWith('session:')

/** `session:a1b2…f9d3` for session keys; every other key as it is. */
export function displayKey(ns: KvNamespaceName, key: string): string {
  if (!isSessionKey(ns, key)) return key
  const token = key.slice('session:'.length)
  return token.length > 12 ? `session:${token.slice(0, 4)}…${token.slice(-4)}` : 'session:…'
}

async function hashRef(key: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(key)))
  return 'h:' + Array.from(digest.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function refFor(ns: KvNamespaceName, key: string): Promise<string> {
  return isSessionKey(ns, key) ? hashRef(key) : key
}

/**
 * Turns a `?key=` back into the real key. Session refs are found by hashing
 * every session key, which is a single list call at our size.
 */
export async function resolveRef(env: Env, ns: KvNamespaceName, ref: string | null): Promise<string> {
  if (!ref) throw error(400, 'A key is required')
  if (ns !== 'SESSIONS_KV' || !ref.startsWith('h:')) return ref

  for (const key of await listAllKeys(env[ns], 'session:')) {
    if ((await hashRef(key.name)) === ref) return key.name
  }
  throw error(404, 'That session no longer exists')
}

/** The caller's own session key, so it can't be deleted from under them. */
export function currentSessionKey(event: RequestEvent): string | null {
  const token = event.cookies.get(SESSION_COOKIE)
  return token ? `session:${token}` : null
}

/** Rejects keys KV itself would refuse, with a readable message instead of a 500. */
export function checkNewKey(key: string): void {
  if (!key.trim() || key !== key.trim()) throw error(400, 'Keys cannot be blank or start or end with spaces')
  if (key === '.' || key === '..') throw error(400, 'That key is reserved by KV')
  if (byteLength(key) > KEY_BYTES_LIMIT) throw error(400, `Keys are limited to ${KEY_BYTES_LIMIT} bytes`)
}

// ---- Reading ----

async function listAllKeys(kv: KVNamespace, prefix?: string): Promise<KVNamespaceListKey<unknown>[]> {
  const keys: KVNamespaceListKey<unknown>[] = []
  let cursor: string | undefined
  do {
    const page = await kv.list({ prefix, cursor })
    keys.push(...page.keys)
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)
  return keys
}

/** Key count, stopping at one full list page. `more` means "1000+". */
export async function countKeys(kv: KVNamespace): Promise<{ count: number; more: boolean }> {
  const page = await kv.list({ limit: COUNT_CAP })
  return { count: page.keys.length, more: !page.list_complete }
}

function parseValue(text: string | null): { value: unknown; isJson: boolean } {
  if (text === null) return { value: null, isJson: false }
  try {
    return { value: JSON.parse(text), isJson: true }
  } catch {
    return { value: text, isJson: false }
  }
}

/** Expiration is only reported by list. The exact key sorts first under its own prefix. */
async function findExpiration(kv: KVNamespace, key: string): Promise<number | null> {
  const { keys } = await kv.list({ prefix: key, limit: 1 })
  return keys[0]?.name === key ? (keys[0].expiration ?? null) : null
}

/** The stored record, unmasked. Server-side only; see toConsoleRecord. */
export async function readRecord(env: Env, ns: KvNamespaceName, key: string) {
  const kv = env[ns]
  const [{ value, metadata }, expiration] = await Promise.all([
    kv.getWithMetadata(key, 'text'),
    findExpiration(kv, key)
  ])
  if (value === null) return null
  return { key, ...parseValue(value), metadata: metadata ?? null, expiration }
}

export type StoredRecord = NonNullable<Awaited<ReturnType<typeof readRecord>>>

export async function toConsoleRecord(ns: KvNamespaceName, record: StoredRecord): Promise<ConsoleRecord> {
  return {
    ref: await refFor(ns, record.key),
    key: displayKey(ns, record.key),
    value: maskValue(ns, record.value),
    isJson: record.isJson,
    expiration: record.expiration,
    metadata: record.metadata
  }
}

export async function listRows(
  env: Env,
  ns: KvNamespaceName,
  { prefix, cursor }: { prefix?: string | null; cursor?: string | null }
): Promise<{ rows: ConsoleRow[]; cursor: string | null }> {
  const kv = env[ns]
  let page
  try {
    page = await kv.list({ prefix: prefix || undefined, cursor: cursor || undefined, limit: PAGE_SIZE })
  } catch {
    throw error(400, 'That page of results has expired. Search again.')
  }

  // The log's display fields ride in key metadata; everything else needs its value.
  const texts = ns === 'LOG_KV' ? [] : await Promise.all(page.keys.map((k) => kv.get(k.name, 'text')))

  const rows = await Promise.all(
    page.keys.map(async (k, i): Promise<ConsoleRow> => {
      const { value } = parseValue(texts[i] ?? null)
      const isLog = k.name.startsWith('log:')
      return {
        ref: await refFor(ns, k.name),
        key: displayKey(ns, k.name),
        expiration: k.expiration ?? null,
        metadata: k.metadata == null || isLog ? null : truncate(JSON.stringify(k.metadata), 80),
        ...describeRow(k.name, value, k.metadata, texts[i] ?? null)
      }
    })
  )
  return { rows, cursor: page.list_complete ? null : page.cursor }
}

// ---- Row summaries ----

const dateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIMEZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})

function formatTime(value: unknown): string {
  if (typeof value !== 'string') return '—'
  const time = Date.parse(value)
  return Number.isFinite(time) ? dateTime.format(time) : value
}

const text = (value: unknown) => (value === undefined || value === null || value === '' ? '—' : String(value))
const yesNo = (value: unknown) => (value === true ? 'yes' : value === false ? 'no' : '—')

function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length)}…` : value
}

/** Schema-aware summary for the prefixes the app writes; key plus a peek at the value otherwise. */
function describeRow(
  key: string,
  value: unknown,
  metadata: unknown,
  raw: string | null
): Pick<ConsoleRow, 'title' | 'fields'> {
  if (key.startsWith('log:') && isObject(metadata)) {
    const entry = metadata as Partial<LogEntry>
    return {
      title: text(entry.summary),
      fields: [
        { label: 'Time', value: formatTime(entry.at) },
        { label: 'Actor', value: text(entry.actorName) }
      ]
    }
  }

  if (!isObject(value)) return { title: truncate(raw ?? '', 120) || '—', fields: [] }

  if (key.startsWith('user:')) {
    const roles = isObject(value.roles) ? (value.roles as unknown as UserRoles) : null
    return {
      title: text(value.name),
      fields: [
        { label: 'Email', value: text(value.email) },
        { label: 'Access', value: roles ? TIER_LABELS[tierOf(roles)] : '—' },
        { label: 'Active', value: yesNo(value.active) },
        { label: 'Must change password', value: yesNo(value.mustChangePassword ?? false) }
      ]
    }
  }

  if (key.startsWith('session:')) {
    return {
      title: text(value.email),
      fields: [
        { label: 'Created', value: formatTime(value.createdAt) },
        { label: 'Expires', value: formatTime(value.expiresAt) },
        { label: 'Device', value: truncate(text(value.userAgent), 60) }
      ]
    }
  }

  if (key.startsWith('rsvp:')) {
    return {
      title: text(value.email),
      fields: [
        { label: 'Date', value: text(value.weekId ?? key.split(':')[1]) },
        { label: 'Status', value: text(value.status) },
        { label: 'Updated by', value: text(value.updatedBy) }
      ]
    }
  }

  return { title: truncate(raw ?? '', 120), fields: [] }
}

// ---- Secrets ----

export function maskValue(ns: KvNamespaceName, value: unknown): unknown {
  const secrets = SECRET_FIELDS[ns]
  if (!secrets || !isObject(value)) return value
  const masked = { ...value }
  for (const field of secrets) if (field in masked) masked[field] = MASK
  return masked
}

/** Puts the stored secret back wherever the edit left the mask. The mask itself is never written. */
function unmaskValue(ns: KvNamespaceName, next: unknown, stored: unknown): unknown {
  const secrets = SECRET_FIELDS[ns]
  if (!secrets || !isObject(next)) return next
  const restored = { ...next }
  for (const field of secrets) {
    if (restored[field] !== MASK) continue
    const kept = isObject(stored) ? stored[field] : undefined
    if (typeof kept !== 'string') throw error(400, `${field} is masked, but there is no stored value to keep`)
    restored[field] = kept
  }
  return restored
}

/** Field names that changed, for the log. Never values: some of them are secret. */
function changedFields(before: unknown, after: unknown): string[] {
  if (!isObject(before) || !isObject(after)) {
    return JSON.stringify(before) === JSON.stringify(after) ? [] : ['value']
  }
  const fields = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...fields].filter((f) => f !== 'updatedAt' && JSON.stringify(before[f]) !== JSON.stringify(after[f]))
}

// ---- Validation ----

type Check = [test: (v: unknown) => boolean, expected: string, optional?: boolean]

const isString = (v: unknown) => typeof v === 'string'
const isFilledString = (v: unknown) => typeof v === 'string' && v.trim() !== ''
const isTimestamp = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v))
const isStringList = (v: unknown) => Array.isArray(v) && v.every(isString)
/** The format $lib/server/crypto writes. Anything else (a mangled mask, a typo) would lock them out. */
const isPasswordHash = (v: unknown) => typeof v === 'string' && /^pbkdf2\$\d+\$[^$]+\$[^$]+$/.test(v)
const ROLE_FLAGS = ['isSuperAdmin', 'isWorshipLeader', 'isMedia', 'isMember']
const isRoles = (v: unknown) =>
  isObject(v) &&
  Object.keys(v).every((k) => ROLE_FLAGS.includes(k)) &&
  ROLE_FLAGS.every((k) => typeof v[k] === 'boolean')

/** Mirrors UserRecord in $lib/types. Keep the two in step. */
const USER_FIELDS: Record<keyof UserRecord, Check> = {
  email: [isString, 'a string'],
  name: [isFilledString, 'a non-empty string'],
  nickname: [isString, 'a string', true],
  passwordHash: [isPasswordHash, `a pbkdf2$… hash, or "${MASK}" to keep the stored one`],
  roles: [isRoles, `an object with exactly these true/false flags: ${ROLE_FLAGS.join(', ')}`],
  instruments: [isStringList, 'a list of strings'],
  aliases: [isStringList, 'a list of strings'],
  createdAt: [isTimestamp, 'an ISO timestamp'],
  updatedAt: [isTimestamp, 'an ISO timestamp'],
  active: [(v) => typeof v === 'boolean', 'true or false'],
  mustChangePassword: [(v) => typeof v === 'boolean', 'true or false', true]
}

function checkUserKey(key: string): string {
  const email = key.slice('user:'.length)
  if (!email || email !== normalizeEmail(email)) {
    throw error(400, 'User keys are user:{email}, with the email in lowercase')
  }
  return email
}

function validateUserRecord(key: string, value: unknown): UserRecord {
  const email = checkUserKey(key)
  if (!isObject(value)) throw error(400, 'A user record must be a JSON object')

  const unknown = Object.keys(value).filter((f) => !(f in USER_FIELDS))
  if (unknown.length) throw error(400, `Unknown field${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`)

  for (const [field, [test, expected, optional]] of Object.entries(USER_FIELDS)) {
    if (!(field in value)) {
      if (optional) continue
      throw error(400, `${field} is required`)
    }
    if (!test(value[field])) throw error(400, `${field} should be ${expected}`)
  }
  if (value.email !== email) throw error(400, `email must match the key (${email})`)
  return value as unknown as UserRecord
}

// ---- Writing ----

export interface WriteBody {
  value?: unknown
  /** Omitted keeps the stored metadata; null clears it. */
  metadata?: unknown
  /** Omitted keeps the stored expiration; null removes it. */
  expirationTtl?: unknown
  /** Refuse to overwrite: this is a new record. */
  create?: boolean
}

export interface PreparedWrite {
  text: string
  options: { metadata?: unknown; expiration?: number; expirationTtl?: number }
  /** Changed field names, plus `metadata` / `expiration` when those were changed. */
  changed: string[]
}

/**
 * Works out exactly what a console write puts into KV: secrets restored,
 * `user:` records validated, `updatedAt` bumped, and the existing expiration
 * and metadata carried over unless the request changes them.
 */
export function prepareWrite(
  ns: KvNamespaceName,
  key: string,
  body: WriteBody,
  stored: StoredRecord | null,
  actor: UserRecord
): PreparedWrite {
  if (!('value' in body)) throw error(400, 'A value is required')

  const isUser = ns === 'USERS_KV' && key.startsWith('user:')
  if (isUser) checkUserKey(key)

  let value = unmaskValue(ns, body.value, stored?.value)

  if (isUser) {
    const user = validateUserRecord(key, value)
    // Same guard as the People page: a superadmin locking themselves out could leave nobody able to fix it.
    if (user.email === normalizeEmail(actor.email) && (!user.roles.isSuperAdmin || !user.active)) {
      throw error(400, "You can't remove your own superadmin access or deactivate yourself. Ask another superadmin.")
    }
  }

  if (isSessionKey(ns, key) && isObject(value) && value.token !== key.slice('session:'.length)) {
    throw error(400, `token must match the key (leave it as "${MASK}")`)
  }

  const changed = stored ? changedFields(stored.value, value) : []

  if (isObject(value) && typeof value.updatedAt === 'string' && (!stored || changed.length)) {
    value = { ...value, updatedAt: new Date().toISOString() }
  }

  const options: PreparedWrite['options'] = {}

  if (body.metadata === undefined) {
    if (stored?.metadata != null) options.metadata = stored.metadata
  } else if (body.metadata !== null) {
    if (byteLength(JSON.stringify(body.metadata)) > METADATA_BYTES_LIMIT) {
      throw error(400, `Metadata is limited to ${METADATA_BYTES_LIMIT} bytes`)
    }
    options.metadata = body.metadata
  }
  if (stored && JSON.stringify(options.metadata ?? null) !== JSON.stringify(stored.metadata ?? null)) {
    changed.push('metadata')
  }

  if (body.expirationTtl === undefined) {
    // KV takes an absolute expiration, but not one less than a minute away.
    if (stored?.expiration) {
      options.expiration = Math.max(stored.expiration, Math.ceil(Date.now() / 1000) + MIN_TTL_SECONDS)
    }
  } else if (body.expirationTtl !== null) {
    const ttl = body.expirationTtl
    if (typeof ttl !== 'number' || !Number.isInteger(ttl) || ttl < MIN_TTL_SECONDS) {
      throw error(400, `expirationTtl must be a whole number of seconds, at least ${MIN_TTL_SECONDS}`)
    }
    options.expirationTtl = ttl
    if (stored) changed.push('expiration')
  } else if (stored?.expiration) {
    changed.push('expiration')
  }

  return { text: JSON.stringify(value), options, changed }
}

// ---- Export ----

/** Every record in the namespace, for a backup file. Secrets masked unless asked for. */
export async function exportNamespace(env: Env, ns: KvNamespaceName, includeSecrets: boolean): Promise<ExportRow[]> {
  const kv = env[ns]
  const keys = await listAllKeys(kv)
  if (keys.length > EXPORT_KEY_LIMIT) {
    throw error(413, `${keys.length} keys is more than one request can read. Use \`wrangler kv key list\` instead.`)
  }

  return Promise.all(
    keys.map(async (k) => {
      const { value, metadata } = await kv.getWithMetadata(k.name, 'text')
      const parsed = parseValue(value).value
      return {
        key: includeSecrets ? k.name : displayKey(ns, k.name),
        value: includeSecrets ? parsed : maskValue(ns, parsed),
        metadata: metadata ?? null,
        expiration: k.expiration ?? null
      }
    })
  )
}
