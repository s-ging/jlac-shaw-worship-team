import { error, redirect } from '@sveltejs/kit'
import type { KvNamespaceName } from '$lib/kv-namespaces'
import { normalizeEmail } from '$lib/server/kv'
import { canUseDataConsole, currentSessionKey, displayKey, readRecord, resolveRef, toConsoleRecord } from '$lib/server/kv-console'
import { requireEnv } from '$lib/server/platform'
import type { PageServerLoad } from './$types'

/** One record, by `?key=` (a session's ref, for session keys). */
export const load: PageServerLoad = async (event) => {
  const { locals, platform, params, url } = event
  if (!locals.user) throw redirect(303, '/login')
  if (!canUseDataConsole(locals.user)) throw error(403, 'The data console is limited to specific accounts')

  const env = requireEnv(platform)
  const ns = params.ns as KvNamespaceName
  const key = await resolveRef(env, ns, url.searchParams.get('key'))
  const stored = await readRecord(env, ns, key)
  if (!stored) throw error(404, `${displayKey(ns, key)} not found`)

  // The API refuses these deletes too; this just explains why before you try.
  let undeletable: string | null = null
  if (ns === 'USERS_KV' && key === `user:${normalizeEmail(locals.user.email)}`) {
    undeletable = "This is your own user record, so it can't be deleted."
  } else if (ns === 'SESSIONS_KV' && key === currentSessionKey(event)) {
    undeletable = "This is your current session. Sign out instead."
  }

  return {
    ns,
    record: await toConsoleRecord(ns, stored),
    /** The person this record belongs to, for the user shortcuts. */
    userEmail: ns === 'USERS_KV' && key.startsWith('user:') ? key.slice('user:'.length) : null,
    undeletable
  }
}
