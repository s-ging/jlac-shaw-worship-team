import { error, json } from '@sveltejs/kit'
import { getRsvp, listRsvpsForWeek, normalizeEmail, putRsvp } from '$lib/server/kv'
import { requireEnv } from '$lib/server/platform'
import { requireAuth } from '$lib/server/auth'
import { appendLog } from '$lib/server/log'
import type { RsvpStatus } from '$lib/types'
import type { RequestHandler } from './$types'

const STATUSES: RsvpStatus[] = ['yes', 'maybe', 'no']

/** Everyone's RSVP for one week. Readable by anyone signed in. */
export const GET: RequestHandler = async (event) => {
  requireAuth(event)
  const rsvps = await listRsvpsForWeek(requireEnv(event.platform), event.params.id)
  return json({ rsvps })
}

/**
 * Sets an RSVP. You may always set your own. Setting someone else's requires
 * worship leader (or superadmin) — leaders are usually the ones taking
 * attendance on behalf of people who haven't opened the app.
 */
export const PATCH: RequestHandler = async (event) => {
  const user = requireAuth(event)
  const env = requireEnv(event.platform)

  let body: { email?: unknown; status?: unknown }
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }

  const status = body.status as RsvpStatus
  if (!STATUSES.includes(status)) {
    throw error(400, `Status must be one of: ${STATUSES.join(', ')}`)
  }

  const target = typeof body.email === 'string' ? normalizeEmail(body.email) : user.email
  const isSelf = target === normalizeEmail(user.email)
  const canSetOthers = user.roles.isSuperAdmin || user.roles.isWorshipLeader
  if (!isSelf && !canSetOthers) {
    throw error(403, 'You can only change your own RSVP')
  }

  const weekId = event.params.id
  const before = await getRsvp(env, weekId, target)
  const record = await putRsvp(env, weekId, target, status, user.email)

  if (before?.status !== status) {
    const who = isSelf ? 'their' : `${target}'s`
    await appendLog(env, user, 'rsvp.updated', `set ${who} RSVP for ${weekId} to ${status}`, {
      weekId,
      email: target,
      before: before?.status ?? null,
      after: status
    })
  }

  return json({ rsvp: record, before: before?.status ?? null })
}
