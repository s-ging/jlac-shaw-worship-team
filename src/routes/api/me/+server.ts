import { error, json } from '@sveltejs/kit'
import { requireAuth } from '$lib/server/auth'
import { hashPassword, verifyPassword } from '$lib/server/crypto'
import { putUser, toPublicUser } from '$lib/server/kv'
import { appendLog } from '$lib/server/log'
import { requireEnv } from '$lib/server/platform'
import type { UserRecord } from '$lib/types'
import type { RequestHandler } from './$types'

/**
 * Changes your own nickname and/or password. Anyone signed in.
 *
 * A password change needs the current password, even on first sign-in (it's
 * the starting password they were given), so a phone left signed in can't be
 * used to lock its owner out.
 */
export const PATCH: RequestHandler = async (event) => {
  const user = requireAuth(event)
  const env = requireEnv(event.platform)

  let body: { nickname?: unknown; currentPassword?: unknown; newPassword?: unknown }
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }

  const next: UserRecord = { ...user }
  const changes: string[] = []

  if (typeof body.nickname === 'string') {
    const nickname = body.nickname.trim() || undefined
    if (nickname && nickname.length > 40) throw error(400, 'Nickname is too long')
    if (nickname !== user.nickname) {
      next.nickname = nickname
      changes.push(nickname ? `set their nickname to ${nickname}` : 'cleared their nickname')
    }
  }

  if (typeof body.newPassword === 'string' && body.newPassword) {
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    if (!(await verifyPassword(current, user.passwordHash))) throw error(400, 'Your current password is incorrect')
    if (body.newPassword.length < 8) throw error(400, 'Password must be at least 8 characters')
    if (body.newPassword === current) throw error(400, 'Choose a password different from your current one')

    next.passwordHash = await hashPassword(body.newPassword)
    next.mustChangePassword = false
    changes.push('changed their password')
  }

  if (changes.length === 0) return json({ user: toPublicUser(user) })

  await putUser(env, next)
  await appendLog(env, next, 'user.self.updated', changes.join(', '))
  return json({ user: toPublicUser(next) })
}
