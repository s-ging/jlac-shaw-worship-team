import { error, redirect } from '@sveltejs/kit'
import { listLog } from '$lib/server/log'
import { requireEnv } from '$lib/server/platform'
import type { PageServerLoad } from './$types'

/** Admins (song leaders) and superadmins. */
export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) throw redirect(303, '/login')
  if (!locals.user.roles.isSuperAdmin && !locals.user.roles.isWorshipLeader) {
    throw error(403, 'Only admins can see the changelog')
  }
  return { entries: await listLog(requireEnv(platform)) }
}
