import { json } from '@sveltejs/kit'
import { requireEnv } from '$lib/server/platform'
import type { RequestHandler } from './$types'

/**
 * Liveness check for the KV wiring. Confirms all three namespaces are bound and
 * readable. Intentionally unauthenticated — it returns counts, never contents.
 */
export const GET: RequestHandler = async ({ platform }) => {
  const env = requireEnv(platform)

  const [users, sessions, log] = await Promise.all([
    env.USERS_KV.list({ limit: 1000 }),
    env.SESSIONS_KV.list({ limit: 1000 }),
    env.LOG_KV.list({ limit: 1000 })
  ])

  return json({
    ok: true,
    time: new Date().toISOString(),
    kv: {
      users: users.keys.length,
      sessions: sessions.keys.length,
      log: log.keys.length
    }
  })
}
