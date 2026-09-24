import { DISPLAY_TIMEZONE } from '$lib/config'

/**
 * The KV namespaces the data console may open. Shared by the route param
 * matcher, the server helpers and the pages, so there is one allowlist.
 * Anything not listed here is a 404.
 */
export const KV_NAMESPACES = ['USERS_KV', 'SESSIONS_KV', 'RSVP_KV', 'LOG_KV'] as const

export type KvNamespaceName = (typeof KV_NAMESPACES)[number]

export interface NamespaceInfo {
  label: string
  hint: string
  /** Key prefix the app writes, offered as the starting point for new keys. */
  prefix: string
  /** The changelog is append-only: no edits or deletes, ever. */
  readOnly: boolean
}

export const NAMESPACE_INFO: Record<KvNamespaceName, NamespaceInfo> = {
  USERS_KV: { label: 'Users', hint: 'user:{email}', prefix: 'user:', readOnly: false },
  SESSIONS_KV: { label: 'Sessions', hint: 'session:{token}, expire on their own', prefix: 'session:', readOnly: false },
  RSVP_KV: { label: 'RSVPs', hint: 'rsvp:{date}:{email}', prefix: 'rsvp:', readOnly: false },
  LOG_KV: { label: 'Changelog', hint: 'log:{time}:{id}, read-only', prefix: 'log:', readOnly: true }
}

/** Stands in for a secret (a password hash, a session token) everywhere the browser sees one. */
export const MASK = '••••'
export const MASK_HINT = `"${MASK}" stands for a stored secret. Leave it as is and the stored value is kept.`

export function isKvNamespace(value: string): value is KvNamespaceName {
  return (KV_NAMESPACES as readonly string[]).includes(value)
}

const expiryFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIMEZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})

/** KV reports expiration in unix seconds. */
export function formatExpiration(seconds: number): string {
  return expiryFormat.format(seconds * 1000)
}

/**
 * What a delete asks you to type: the key's last `:` segment. For a truncated
 * session key (`a1b2…f9d3`) that is the visible tail, so there is no `…` to type.
 */
export function confirmWord(displayKey: string): string {
  const last = displayKey.split(':').at(-1) ?? displayKey
  return last.split('…').at(-1) || last
}
