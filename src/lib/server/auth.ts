import { error, type Cookies, type RequestEvent } from '@sveltejs/kit'
import type { UserRecord, UserRoles } from '$lib/types'
import { deleteSession, getSession, getUser, putSession, SESSION_TTL_DAYS } from './kv'
import { requireEnv } from './platform'

export const SESSION_COOKIE = 'session_token'

/** Sessions are extended once they fall inside this window, so active users don't get logged out. */
const REFRESH_WITHIN_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

export function setSessionCookie(cookies: Cookies, token: string): void {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60
  })
}

export function clearSessionCookie(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' })
}

/**
 * Resolves the signed-in user, or null. Clears the cookie when a session is
 * expired, revoked, or points at a user who has since been deactivated, so a
 * dead cookie doesn't keep costing a KV read on every request.
 */
export async function resolveUser(event: RequestEvent): Promise<UserRecord | null> {
  const token = event.cookies.get(SESSION_COOKIE)
  if (!token) return null

  const env = requireEnv(event.platform)
  const session = await getSession(env, token)
  if (!session) {
    clearSessionCookie(event.cookies)
    return null
  }

  const expiresAt = Date.parse(session.expiresAt)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await deleteSession(env, token)
    clearSessionCookie(event.cookies)
    return null
  }

  const user = await getUser(env, session.email)
  if (!user || !user.active) {
    await deleteSession(env, token)
    clearSessionCookie(event.cookies)
    return null
  }

  // Sliding expiry, but only near the end, to avoid a KV write per request.
  if (expiresAt - Date.now() < REFRESH_WITHIN_DAYS * DAY_MS) {
    const extended = { ...session, expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * DAY_MS).toISOString() }
    await putSession(env, extended)
    setSessionCookie(event.cookies, token)
  }

  return user
}

/** Throws 401 unless signed in. */
export function requireAuth(event: RequestEvent): UserRecord {
  const user = event.locals.user
  if (!user) throw error(401, 'Sign in required')
  return user
}

/** Throws 403 unless the user holds the role. Superadmins pass everything. */
export function requireRole(event: RequestEvent, role: keyof UserRoles): UserRecord {
  const user = requireAuth(event)
  if (!user.roles.isSuperAdmin && !user.roles[role]) {
    throw error(403, 'You do not have permission to do that')
  }
  return user
}
