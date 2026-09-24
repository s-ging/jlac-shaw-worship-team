import { error, redirect } from '@sveltejs/kit'
import { KV_NAMESPACES } from '$lib/kv-namespaces'
import { canUseDataConsole, countKeys } from '$lib/server/kv-console'
import { requireEnv } from '$lib/server/platform'
import type { PageServerLoad } from './$types'

/** Only the data console accounts. The API enforces this too; this just keeps others off the page. */
export const load: PageServerLoad = async ({ locals, platform }) => {
  if (!locals.user) throw redirect(303, '/login')
  if (!canUseDataConsole(locals.user)) throw error(403, 'The data console is limited to specific accounts')

  const env = requireEnv(platform)
  const counts = await Promise.all(KV_NAMESPACES.map((ns) => countKeys(env[ns])))
  return { namespaces: KV_NAMESPACES.map((ns, i) => ({ ns, ...counts[i] })) }
}
