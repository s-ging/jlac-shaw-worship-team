import type { PublicUser, RsvpRecord, RsvpStatus, SessionRecord, UserRecord } from '$lib/types'

type Env = App.Platform['env']

export const SESSION_TTL_DAYS = 30

const userKey = (email: string) => `user:${normalizeEmail(email)}`
const sessionKey = (token: string) => `session:${token}`
const rsvpKey = (weekId: string, email: string) => `rsvp:${weekId}:${normalizeEmail(email)}`

/** Emails are case-insensitive identifiers; store and look them up in one form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Strips the password hash. Use this on everything crossing the wire. */
export function toPublicUser(user: UserRecord): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user
  return rest
}

// ---- Users ----

export async function getUser(env: Env, email: string): Promise<UserRecord | null> {
  return env.USERS_KV.get<UserRecord>(userKey(email), 'json')
}

export async function putUser(env: Env, user: UserRecord): Promise<void> {
  const record: UserRecord = { ...user, email: normalizeEmail(user.email), updatedAt: new Date().toISOString() }
  await env.USERS_KV.put(userKey(record.email), JSON.stringify(record))
}

export async function listUsers(env: Env): Promise<UserRecord[]> {
  const { keys } = await env.USERS_KV.list({ prefix: 'user:' })
  const users = await Promise.all(keys.map((k) => env.USERS_KV.get<UserRecord>(k.name, 'json')))
  return users.filter((u): u is UserRecord => u !== null)
}

// ---- Sessions ----

export async function getSession(env: Env, token: string): Promise<SessionRecord | null> {
  return env.SESSIONS_KV.get<SessionRecord>(sessionKey(token), 'json')
}

export async function putSession(env: Env, session: SessionRecord): Promise<void> {
  // Let KV expire the key itself, so dead sessions can't pile up unbounded.
  const ttlSeconds = Math.max(60, Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000))
  await env.SESSIONS_KV.put(sessionKey(session.token), JSON.stringify(session), {
    expirationTtl: ttlSeconds
  })
}

export async function deleteSession(env: Env, token: string): Promise<void> {
  await env.SESSIONS_KV.delete(sessionKey(token))
}

export function newSession(email: string, userAgent?: string): SessionRecord {
  const now = new Date()
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  return {
    token: '', // caller fills this from generateToken()
    email: normalizeEmail(email),
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    userAgent
  }
}

// ---- RSVPs ----

export async function getRsvp(env: Env, weekId: string, email: string): Promise<RsvpRecord | null> {
  return env.RSVP_KV.get<RsvpRecord>(rsvpKey(weekId, email), 'json')
}

export async function putRsvp(
  env: Env,
  weekId: string,
  email: string,
  status: RsvpStatus,
  updatedBy: string
): Promise<RsvpRecord> {
  const record: RsvpRecord = {
    weekId,
    email: normalizeEmail(email),
    status,
    updatedAt: new Date().toISOString(),
    updatedBy: normalizeEmail(updatedBy)
  }
  await env.RSVP_KV.put(rsvpKey(weekId, email), JSON.stringify(record))
  return record
}

/** Every RSVP for one week, keyed by email. */
export async function listRsvpsForWeek(env: Env, weekId: string): Promise<Record<string, RsvpRecord>> {
  const { keys } = await env.RSVP_KV.list({ prefix: `rsvp:${weekId}:` })
  const records = await Promise.all(keys.map((k) => env.RSVP_KV.get<RsvpRecord>(k.name, 'json')))

  const byEmail: Record<string, RsvpRecord> = {}
  for (const record of records) {
    if (record) byEmail[record.email] = record
  }
  return byEmail
}
