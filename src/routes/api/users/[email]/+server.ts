import { error, json } from '@sveltejs/kit'
import { hashPassword } from '$lib/server/crypto'
import { getUser, normalizeEmail, putUser, toPublicUser } from '$lib/server/kv'
import { appendLog } from '$lib/server/log'
import { requireEnv } from '$lib/server/platform'
import { requireRole } from '$lib/server/auth'
import { TIER_LABELS, tierOf } from '$lib/roles'
import type { UserRecord, UserRoles } from '$lib/types'
import type { RequestHandler } from './$types'

const cleanList = (value: unknown[]) => value.map((v) => String(v).trim()).filter(Boolean)

/**
 * Updates a user. Superadmin-only. Every field is optional; only what is sent
 * changes. Deactivating (`active: false`) is how people are removed, so their
 * history in the log still points at a real record.
 */
export const PATCH: RequestHandler = async (event) => {
  const actor = requireRole(event, 'isSuperAdmin')
  const env = requireEnv(event.platform)

  const email = normalizeEmail(event.params.email)
  const user = await getUser(env, email)
  if (!user) throw error(404, `${email} not found`)

  let body: Record<string, unknown>
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }

  const next: UserRecord = { ...user, roles: { ...user.roles } }
  const changes: string[] = []

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (!name) throw error(400, 'Name is required')
    if (name !== user.name) {
      next.name = name
      changes.push(`name → ${name}`)
    }
  }

  if (typeof body.nickname === 'string') {
    const nickname = body.nickname.trim() || undefined
    if (nickname !== user.nickname) {
      next.nickname = nickname
      changes.push(nickname ? `nickname → ${nickname}` : 'cleared nickname')
    }
  }

  if (Array.isArray(body.aliases)) {
    const aliases = cleanList(body.aliases)
    if (aliases.join('\n') !== user.aliases.join('\n')) {
      next.aliases = aliases
      changes.push(`calendar name → ${aliases.join(', ') || 'none'}`)
    }
  }

  if (Array.isArray(body.instruments)) {
    const instruments = cleanList(body.instruments)
    if (instruments.join('\n') !== user.instruments.join('\n')) {
      next.instruments = instruments
      changes.push(`instruments → ${instruments.join(', ') || 'none'}`)
    }
  }

  if (body.roles && typeof body.roles === 'object') {
    const requested = body.roles as Partial<UserRoles>
    for (const key of ['isSuperAdmin', 'isWorshipLeader', 'isMedia'] as const) {
      if (typeof requested[key] === 'boolean') next.roles[key] = requested[key]
    }
    if (tierOf(next.roles) !== tierOf(user.roles)) changes.push(`access → ${TIER_LABELS[tierOf(next.roles)]}`)
    if (next.roles.isMedia !== user.roles.isMedia) changes.push(next.roles.isMedia ? 'added to media' : 'removed from media')
  }

  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < 8) throw error(400, 'Password must be at least 8 characters')
    next.passwordHash = await hashPassword(body.password)
    changes.push('reset password')
  }

  if (typeof body.active === 'boolean' && body.active !== user.active) {
    next.active = body.active
    changes.push(body.active ? 'reactivated' : 'deactivated')
  }

  // A superadmin who demotes or deactivates themselves could leave nobody able to fix it.
  if (email === normalizeEmail(actor.email) && (!next.roles.isSuperAdmin || !next.active)) {
    throw error(400, "You can't remove your own superadmin access or deactivate yourself. Ask another superadmin.")
  }

  if (changes.length === 0) return json({ user: toPublicUser(user) })

  await putUser(env, next)
  await appendLog(env, actor, 'user.updated', `updated ${next.name}: ${changes.join(', ')}`, { email })
  return json({ user: toPublicUser(next) })
}
