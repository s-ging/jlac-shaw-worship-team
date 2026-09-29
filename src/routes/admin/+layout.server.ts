import { error, redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

/**
 * The Admin tab: admins (song leaders) and superadmins. Each page narrows it
 * further: Log is for both, People and Analytics for superadmins only.
 */
export const load: LayoutServerLoad = ({ locals }) => {
  if (!locals.user) throw redirect(303, '/login')
  if (!locals.user.roles.isSuperAdmin && !locals.user.roles.isWorshipLeader) {
    throw error(403, 'Only admins can open Admin')
  }
}
