import { error, json } from '@sveltejs/kit'
import { hashPassword } from '$lib/server/crypto'
import { getUser, listUsers, normalizeEmail, putUser, toPublicUser } from '$lib/server/kv'
import { requireEnv } from '$lib/server/platform'
import { requireRole } from '$lib/server/auth'
import type { UserRecord, UserRoles } from '$lib/types'
import type { RequestHandler } from './$types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const GET: RequestHandler = async (event) => {
  requireRole(event, 'isSuperAdmin')
  const users = await listUsers(requireEnv(event.platform))
  users.sort((a, b) => a.name.localeCompare(b.name))
  return json({ users: users.map(toPublicUser) })
}

/**
 * Creates a user.
 *
 * Normally superadmin-only. The exception is first run: while USERS_KV holds no
 * users at all there is nobody who could authorize anything, so the first
 * request is allowed through and is forced to be a superadmin. The window shuts
 * permanently the moment that user exists.
 */
export const POST: RequestHandler = async (event) => {
  const env = requireEnv(event.platform)
  const existing = await listUsers(env)
  const isBootstrap = existing.length === 0

  if (!isBootstrap) requireRole(event, 'isSuperAdmin')

  let body: Record<string, unknown>
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }

  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!EMAIL_RE.test(email)) throw error(400, 'A valid email is required')
  if (!name) throw error(400, 'Name is required')
  if (password.length < 8) throw error(400, 'Password must be at least 8 characters')
  if (await getUser(env, email)) throw error(409, `${email} already exists`)

  const requested = (body.roles ?? {}) as Partial<UserRoles>
  const roles: UserRoles = {
    isSuperAdmin: isBootstrap || requested.isSuperAdmin === true,
    isWorshipLeader: isBootstrap || requested.isWorshipLeader === true,
    isMedia: requested.isMedia === true,
    isMember: requested.isMember !== false
  }

  const now = new Date().toISOString()
  const user: UserRecord = {
    email,
    name,
    nickname: typeof body.nickname === 'string' ? body.nickname.trim() : undefined,
    passwordHash: await hashPassword(password),
    roles,
    instruments: Array.isArray(body.instruments) ? body.instruments.map(String) : [],
    aliases: Array.isArray(body.aliases) ? body.aliases.map(String) : [name.split(' ')[0]],
    createdAt: now,
    updatedAt: now,
    active: true
  }

  await putUser(env, user)
  return json({ user: toPublicUser(user), bootstrap: isBootstrap }, { status: 201 })
}
