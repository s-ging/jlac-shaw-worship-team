import { error, redirect } from '@sveltejs/kit'
import { listUsers, toPublicUser } from '$lib/server/kv'
import { canUseDataConsole } from '$lib/server/kv-console'
import { requireEnv } from '$lib/server/platform'
import type { PageServerLoad } from './$types'

/** Superadmins only. The API enforces this too; this just keeps others off the page. */
export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) throw redirect(303, '/login')
  if (!locals.user.roles.isSuperAdmin) throw error(403, 'Only superadmins can manage people')

  const users = await listUsers(requireEnv(platform))
  users.sort((a, b) => a.name.localeCompare(b.name))
  return { users: users.map(toPublicUser), canUseDataConsole: canUseDataConsole(locals.user) }
}
