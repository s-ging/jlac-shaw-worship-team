import { error, json } from '@sveltejs/kit'
import { hashPassword } from '$lib/server/crypto'
import { getUser, listUsers, normalizeEmail, putUser, toPublicUser } from '$lib/server/kv'
import { timingSafeEqualString } from '$lib/server/crypto'
import { appendLog } from '$lib/server/log'
import { requireEnv } from '$lib/server/platform'
import { requireRole } from '$lib/server/auth'
import { PRIMARY_ROLES } from '$lib/parts'
import { TIER_LABELS, tierOf } from '$lib/roles'
import type { UserRecord, UserRoles } from '$lib/types'
import type { RequestHandler } from './$types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Everyone on the team. Admins can read it too: the lineup editor offers these
 * names. Password hashes never leave the server (toPublicUser).
 */
export const GET: RequestHandler = async (event) => {
  requireRole(event, 'isWorshipLeader')
  const users = await listUsers(requireEnv(event.platform))
  users.sort((a, b) => a.name.localeCompare(b.name))
  return json({ users: users.map(toPublicUser) })
}

/**
 * Creates a user. Superadmin-only, except for the one-time bootstrap path.
 *
 * Bootstrap is gated on a BOOTSTRAP_SECRET binding rather than on "are there
 * any users yet". That check is what an earlier version used, and it was
 * unsound: KV list is eventually consistent, so it could still read empty
 * moments after the first user was written and hand out a second unauthorized
 * superadmin. A secret is a deterministic gate — no read, no race. Delete the
 * binding once the first admin exists and this path is closed for good.
 */
export const POST: RequestHandler = async (event) => {
  const env = requireEnv(event.platform)

  const offered = event.request.headers.get('x-bootstrap-secret')
  const expected = env.BOOTSTRAP_SECRET
  const isBootstrap = Boolean(expected && offered && timingSafeEqualString(offered, expected))

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

  const primaryRole = typeof body.primaryRole === 'string' && body.primaryRole ? body.primaryRole : undefined
  if (primaryRole && !PRIMARY_ROLES.some((r) => r.key === primaryRole)) throw error(400, 'Unknown primary role')

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
    nickname: typeof body.nickname === 'string' ? body.nickname.trim() || undefined : undefined,
    passwordHash: await hashPassword(password),
    roles,
    instruments: Array.isArray(body.instruments) ? body.instruments.map(String) : [],
    aliases: Array.isArray(body.aliases) && body.aliases.length
      ? body.aliases.map((a) => String(a).trim()).filter(Boolean)
      : [name.split(' ')[0]],
    primaryRole,
    createdAt: now,
    updatedAt: now,
    active: true,
    // The creator picked this password, so the new user replaces it on first sign-in.
    mustChangePassword: !isBootstrap
  }

  await putUser(env, user)
  // The bootstrap user has no creator to credit, so they are logged as adding themselves.
  const actor = isBootstrap ? user : event.locals.user!
  await appendLog(env, actor, 'user.created', `added ${name} (${email}) as ${TIER_LABELS[tierOf(roles)]}`, { email })
  return json({ user: toPublicUser(user), bootstrap: isBootstrap }, { status: 201 })
}
