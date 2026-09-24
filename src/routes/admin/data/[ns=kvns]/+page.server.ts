import { error, redirect } from '@sveltejs/kit'
import type { KvNamespaceName } from '$lib/kv-namespaces'
import { canUseDataConsole, listRows } from '$lib/server/kv-console'
import { requireEnv } from '$lib/server/platform'
import type { PageServerLoad } from './$types'

/** First page of one namespace. "Load more" continues through the API with the cursor. */
export const load: PageServerLoad = async ({ locals, platform, params, url }) => {
  if (!locals.user) throw redirect(303, '/login')
  if (!canUseDataConsole(locals.user)) throw error(403, 'The data console is limited to specific accounts')

  const ns = params.ns as KvNamespaceName
  const prefix = url.searchParams.get('prefix') ?? ''
  const page = await listRows(requireEnv(platform), ns, { prefix })
  return { ns, prefix, ...page }
}
