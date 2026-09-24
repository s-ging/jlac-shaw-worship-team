import { error, json } from '@sveltejs/kit'
import { normalizeEmail } from '$lib/server/kv'
import { currentSessionKey, requireDataConsole } from '$lib/server/kv-console'
import { appendLog } from '$lib/server/log'
import { requireEnv } from '$lib/server/platform'
import type { SessionRecord } from '$lib/types'
import type { RequestHandler } from './$types'

/**
 * Signs someone out everywhere: `{ email }`. Scans every session key, which
 * is fine at our size. Your own current session is kept, so revoking
 * yourself signs out your other devices rather than this one.
 */
export const POST: RequestHandler = async (event) => {
  const actor = requireDataConsole(event)
  const env = requireEnv(event.platform)
  if (event.params.ns !== 'SESSIONS_KV') throw error(404, 'Sessions live in SESSIONS_KV')

  let body: { email?: unknown }
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : ''
  if (!email) throw error(400, 'An email is required')

  const keys: string[] = []
  let cursor: string | undefined
  do {
    const page = await env.SESSIONS_KV.list({ prefix: 'session:', cursor })
    keys.push(...page.keys.map((k) => k.name))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor)

  const sessions = await Promise.all(keys.map((key) => env.SESSIONS_KV.get<SessionRecord>(key, 'json')))
  const current = currentSessionKey(event)
  const theirs = keys.filter((key, i) => sessions[i]?.email === email)
  const revoke = theirs.filter((key) => key !== current)

  await Promise.all(revoke.map((key) => env.SESSIONS_KV.delete(key)))

  if (revoke.length > 0) {
    const plural = revoke.length === 1 ? 'session' : 'sessions'
    await appendLog(env, actor, 'data.sessions_revoked', `revoked ${revoke.length} ${plural} for ${email}`, {
      email,
      count: revoke.length
    })
  }
  return json({ revoked: revoke.length, keptCurrent: theirs.length > revoke.length })
}
