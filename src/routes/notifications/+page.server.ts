import { redirect } from '@sveltejs/kit'
import { isUnread, noticesFor } from '$lib/server/notify'
import { requireEnv } from '$lib/server/platform'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) throw redirect(303, '/login')
  const { notices, seenAt } = await noticesFor(requireEnv(platform), locals.user.email)
  return {
    notices: notices.map((n) => ({ ...n, unread: isUnread(n, seenAt) })),
    emailOn: locals.user.emailAssignments !== false
  }
}
