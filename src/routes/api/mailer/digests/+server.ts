import { error, json, type RequestEvent } from '@sveltejs/kit'
import { timingSafeEqualString } from '$lib/server/crypto'
import { listUsers, normalizeEmail } from '$lib/server/kv'
import { dueDigests, markEmailed } from '$lib/server/notify'
import { requireEnv } from '$lib/server/platform'
import type { RequestHandler } from './$types'

/**
 * The Apps Script mailer's side door. It has no session, so it proves itself
 * with MAILER_SECRET as a bearer token instead.
 */
function requireMailer(event: RequestEvent) {
  const env = requireEnv(event.platform)
  const offered = event.request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!env.MAILER_SECRET) throw error(503, 'The mailer is not set up')
  if (!offered || !timingSafeEqualString(offered, env.MAILER_SECRET)) throw error(401, 'Wrong secret')
  return env
}

/** Assignment emails due now. See dueDigests for when someone's is due. */
export const GET: RequestHandler = async (event) => {
  const env = requireMailer(event)
  return json({ digests: await dueDigests(env, await listUsers(env)) })
}

/** One digest was sent: `{ to, weeks: [{ date, parts }] }`. */
export const POST: RequestHandler = async (event) => {
  const env = requireMailer(event)
  let body: { to?: unknown; weeks?: unknown }
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }
  if (typeof body.to !== 'string' || !Array.isArray(body.weeks)) throw error(400, 'Expected { to, weeks }')

  const weeks = body.weeks.map((w) => {
    const { date, parts } = (w ?? {}) as { date?: unknown; parts?: unknown }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(parts)) {
      throw error(400, 'Each week needs a date and parts')
    }
    return { date, parts: parts.map(String) }
  })
  await markEmailed(env, normalizeEmail(body.to), weeks)
  return json({ ok: true })
}
