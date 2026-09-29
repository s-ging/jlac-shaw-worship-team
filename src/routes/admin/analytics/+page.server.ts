import { redirect } from '@sveltejs/kit'
import { parseRange } from '$lib/analytics'
import { loadAnalytics } from '$lib/server/analytics'
import { requireEnv } from '$lib/server/platform'
import type { PageServerLoad } from './$types'

/** Superadmins only; admins (song leaders) go back to the Log. `?range=` scopes every card. */
export const load: PageServerLoad = async ({ locals, platform, url }) => {
  if (!locals.user?.roles.isSuperAdmin) throw redirect(303, '/admin/log')
  const range = parseRange(url.searchParams.get('range'))
  return { range, ...(await loadAnalytics(requireEnv(platform), range)) }
}
