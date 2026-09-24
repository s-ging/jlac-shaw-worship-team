import { error, json } from '@sveltejs/kit'
import { NAMESPACE_INFO, type KvNamespaceName } from '$lib/kv-namespaces'
import { normalizeEmail } from '$lib/server/kv'
import {
  checkNewKey,
  currentSessionKey,
  displayKey,
  listRows,
  prepareWrite,
  readRecord,
  requireDataConsole,
  resolveRef,
  toConsoleRecord,
  type WriteBody
} from '$lib/server/kv-console'
import { appendLog } from '$lib/server/log'
import { requireEnv } from '$lib/server/platform'
import type { RequestHandler } from './$types'

/**
 * The data console's raw KV access, for the accounts in
 * requireDataConsole only. The namespace is the
 * binding name (the route matcher allows only the four); the key is a query
 * param because keys contain `:` and `@`. Session keys arrive as a `ref`,
 * never the token itself — see $lib/server/kv-console.
 */

function refuseReadOnly(ns: KvNamespaceName) {
  if (NAMESPACE_INFO[ns].readOnly) throw error(403, 'The changelog is append-only; it cannot be edited or deleted')
}

/** `?key=` returns one record; otherwise a page of keys, filtered by `?prefix=`, continued by `?cursor=`. */
export const GET: RequestHandler = async (event) => {
  requireDataConsole(event)
  const env = requireEnv(event.platform)
  const ns = event.params.ns as KvNamespaceName
  const query = event.url.searchParams

  if (query.has('key')) {
    const key = await resolveRef(env, ns, query.get('key'))
    const record = await readRecord(env, ns, key)
    if (!record) throw error(404, `${displayKey(ns, key)} not found`)
    return json({ record: await toConsoleRecord(ns, record) })
  }

  return json(await listRows(env, ns, { prefix: query.get('prefix'), cursor: query.get('cursor') }))
}

/**
 * Writes one record: `{ value, metadata?, expirationTtl?, create? }`. Existing
 * expiration and metadata are kept unless the body changes them, and masked
 * secrets are restored from the stored record, so an edit can't blank them.
 */
export const PUT: RequestHandler = async (event) => {
  const actor = requireDataConsole(event)
  const env = requireEnv(event.platform)
  const ns = event.params.ns as KvNamespaceName
  refuseReadOnly(ns)

  let body: WriteBody
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }
  if (typeof body !== 'object' || body === null) throw error(400, 'Expected a JSON object')

  const key = await resolveRef(env, ns, event.url.searchParams.get('key'))
  const creating = body.create === true
  if (creating) checkNewKey(key)

  const stored = await readRecord(env, ns, key)
  if (creating && stored) throw error(409, `${displayKey(ns, key)} already exists`)
  if (!creating && !stored) throw error(404, `${displayKey(ns, key)} not found`)

  const write = prepareWrite(ns, key, body, stored, actor)
  if (!creating && write.changed.length === 0) {
    return json({ record: await toConsoleRecord(ns, stored!), changed: [] })
  }

  await env[ns].put(key, write.text, write.options)

  const shown = displayKey(ns, key)
  if (creating) {
    await appendLog(env, actor, 'data.created', `created ${shown} in the data console`, { ns, key: shown })
  } else {
    await appendLog(env, actor, 'data.edited', `edited ${shown} (${write.changed.join(', ')})`, {
      ns,
      key: shown,
      fields: write.changed
    })
  }

  const record = await readRecord(env, ns, key)
  return json(
    { record: record && (await toConsoleRecord(ns, record)), changed: write.changed },
    { status: creating ? 201 : 200 }
  )
}

/** Deletes one record. Deleting a session is revoking it. Your own user record and session are off limits. */
export const DELETE: RequestHandler = async (event) => {
  const actor = requireDataConsole(event)
  const env = requireEnv(event.platform)
  const ns = event.params.ns as KvNamespaceName
  refuseReadOnly(ns)

  const key = await resolveRef(env, ns, event.url.searchParams.get('key'))
  if (ns === 'USERS_KV' && key === `user:${normalizeEmail(actor.email)}`) {
    throw error(400, "You can't delete your own user record")
  }
  if (ns === 'SESSIONS_KV' && key === currentSessionKey(event)) {
    throw error(400, "That's your current session. Sign out instead.")
  }

  const stored = await readRecord(env, ns, key)
  if (!stored) throw error(404, `${displayKey(ns, key)} not found`)

  await env[ns].delete(key)

  const shown = displayKey(ns, key)
  const owner = stored.value && typeof stored.value === 'object' ? (stored.value as { email?: unknown }).email : null
  if (ns === 'SESSIONS_KV' && typeof owner === 'string') {
    await appendLog(env, actor, 'data.session_revoked', `revoked ${shown} for ${owner}`, { ns, key: shown })
  } else {
    await appendLog(env, actor, 'data.deleted', `deleted ${shown}`, { ns, key: shown })
  }
  return json({ deleted: shown })
}
