import type { LogEntry, UserRecord } from '$lib/types'

type Env = App.Platform['env']

/**
 * Append-only changelog in LOG_KV. Entries are never overwritten.
 *
 * KV lists keys in ascending order, so the timestamp in the key is inverted to
 * make the newest entry come first. The display fields ride along as key
 * metadata, so the feed is a single list call instead of one read per entry.
 * The value holds the full entry plus any structured details (before/after).
 */

const MAX_TIME = 9_999_999_999_999
const METADATA_LIMIT = 1000 // KV allows 1024 bytes of metadata per key
const encoder = new TextEncoder()

function fitMetadata(entry: LogEntry): LogEntry {
  let summary = entry.summary
  while (summary && encoder.encode(JSON.stringify({ ...entry, summary })).length > METADATA_LIMIT) {
    summary = summary.slice(0, -20)
  }
  return summary === entry.summary ? entry : { ...entry, summary: `${summary}…` }
}

/**
 * Records a change. Never throws: the change it describes has already happened,
 * and failing the request now would only tell the user it didn't.
 */
export async function appendLog(
  env: Env,
  actor: UserRecord,
  action: string,
  summary: string,
  details?: unknown
): Promise<void> {
  const now = new Date()
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    actorEmail: actor.email,
    actorName: actor.nickname || actor.name,
    action,
    summary
  }
  const key = `log:${String(MAX_TIME - now.getTime()).padStart(13, '0')}:${entry.id}`

  try {
    await env.LOG_KV.put(key, JSON.stringify({ ...entry, details }), { metadata: fitMetadata(entry) })
  } catch (err) {
    console.error('Failed to write changelog entry', action, err)
  }
}

/** Newest first. KV listing is eventually consistent, so a brand-new entry can take a moment to appear. */
export async function listLog(env: Env, limit = 200): Promise<LogEntry[]> {
  const { keys } = await env.LOG_KV.list<LogEntry>({ prefix: 'log:', limit })
  return keys.map((k) => k.metadata).filter((m): m is LogEntry => Boolean(m))
}
