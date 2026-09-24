import { exportNamespace, requireDataConsole } from '$lib/server/kv-console'
import { appendLog } from '$lib/server/log'
import { requireEnv } from '$lib/server/platform'
import type { KvNamespaceName } from '$lib/kv-namespaces'
import type { RequestHandler } from './$types'

/**
 * A namespace as a JSON backup: `[{ key, value, metadata, expiration }]`.
 * Password hashes and session tokens are masked unless `?secrets=1`, and an
 * export that includes them is logged.
 */
export const GET: RequestHandler = async (event) => {
  const actor = requireDataConsole(event)
  const env = requireEnv(event.platform)
  const ns = event.params.ns as KvNamespaceName
  const includeSecrets = event.url.searchParams.get('secrets') === '1'

  const rows = await exportNamespace(env, ns, includeSecrets)
  if (includeSecrets) {
    await appendLog(env, actor, 'data.exported', `exported ${ns} including secrets`, { ns, count: rows.length })
  }

  const date = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify(rows, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${ns}-${date}${includeSecrets ? '-with-secrets' : ''}.json"`,
      'cache-control': 'no-store'
    }
  })
}
