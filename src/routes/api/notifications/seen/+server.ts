import { json } from '@sveltejs/kit'
import { requireAuth } from '$lib/server/auth'
import { markSeen } from '$lib/server/notify'
import { requireEnv } from '$lib/server/platform'
import type { RequestHandler } from './$types'

/** You opened the bell: everything in it now counts as read. */
export const POST: RequestHandler = async (event) => {
  const user = requireAuth(event)
  await markSeen(requireEnv(event.platform), user.email)
  return json({ ok: true })
}
