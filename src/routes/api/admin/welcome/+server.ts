import { error, json } from '@sveltejs/kit'
import { requireRole } from '$lib/server/auth'
import { listUsers } from '$lib/server/kv'
import { appendLog } from '$lib/server/log'
import { sendWelcomes, welcomeCandidates } from '$lib/server/mailer'
import { requireEnv } from '$lib/server/platform'
import type { RequestHandler } from './$types'

/**
 * The team send on /admin: emails everyone who hasn't had a welcome yet their
 * link and sign-in. Superadmins only. People already welcomed are skipped, so
 * pressing it twice doesn't email anyone twice.
 */

/** Who would get one, and whether it would carry the starting password. */
export const GET: RequestHandler = async (event) => {
  requireRole(event, 'isSuperAdmin')
  const env = requireEnv(event.platform)
  const people = await welcomeCandidates(env, await listUsers(env))
  return json({
    people,
    ready: Boolean(env.MAILER_URL && env.MAILER_SECRET && env.STARTING_PASSWORD)
  })
}

/** Sends to everyone not welcomed yet. Waits for the sends, so the button can say how it went. */
export const POST: RequestHandler = async (event) => {
  const user = requireRole(event, 'isSuperAdmin')
  const env = requireEnv(event.platform)
  if (!env.MAILER_URL || !env.MAILER_SECRET) throw error(503, 'The mailer is not set up yet (MAILER_URL, MAILER_SECRET)')
  if (!env.STARTING_PASSWORD) throw error(503, 'STARTING_PASSWORD is not set, so the emails could not include it')

  const users = await listUsers(env)
  const due = (await welcomeCandidates(env, users)).filter((p) => !p.welcomedAt)
  if (due.length === 0) return json({ sent: [], failed: [] })

  const result = await sendWelcomes(env, users, due)
  if (result.sent.length > 0) {
    await appendLog(env, user, 'mail.welcome', `emailed sign-in details to ${result.sent.length} people`, result)
  }
  return json(result)
}
