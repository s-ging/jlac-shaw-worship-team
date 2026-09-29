import { redirect } from '@sveltejs/kit'
import { listUsers, toPublicUser } from '$lib/server/kv'
import { canUseDataConsole } from '$lib/server/kv-console'
import { requireEnv } from '$lib/server/platform'
import type { PageServerLoad } from './$types'

/**
 * People, the Admin tab's first page. Superadmins only; admins (song leaders)
 * go on to the Log, the one tab they have. The API enforces this too.
 */
export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) throw redirect(303, '/login')
  if (!locals.user.roles.isSuperAdmin) throw redirect(303, '/admin/log')

  const users = await listUsers(requireEnv(platform))
  users.sort((a, b) => a.name.localeCompare(b.name))
  return { users: users.map(toPublicUser), canUseDataConsole: canUseDataConsole(locals.user) }
}
