import { json } from '@sveltejs/kit'
import { requireAuth } from '$lib/server/auth'
import { isUnread, noticesFor } from '$lib/server/notify'
import { requireEnv } from '$lib/server/platform'
import type { RequestHandler } from './$types'

/** How many of your notices are new, for the bell's badge. */
export const GET: RequestHandler = async (event) => {
  const user = requireAuth(event)
  const { notices, seenAt } = await noticesFor(requireEnv(event.platform), user.email)
  return json({ unread: notices.filter((n) => isUnread(n, seenAt)).length })
}
