import { rolesForTier, type Tier } from '$lib/roles'
import type { PublicUser } from '$lib/types'

/**
 * scripts/roster.tsv as PublicUsers, for the /dev previews. Served by the dev
 * server only (vite.config.ts), so this returns nothing outside `vite dev`.
 * Same columns as scripts/import-users.mjs, plus an optional `primary`.
 */
export async function loadRoster(fetcher: typeof fetch = fetch): Promise<PublicUser[]> {
  const res = await fetcher('/__dev/roster')
  return res.ok ? parseRoster(await res.text()) : []
}

function parseRoster(text: string): PublicUser[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'))
  const header = (lines.shift() ?? '').split('\t').map((h) => h.trim().toLowerCase())
  return lines.map((line) => {
    const cells = line.split('\t')
    const get = (col: string) => (cells[header.indexOf(col)] ?? '').trim()
    const access = (get('access').toLowerCase() || 'member') as Tier
    return {
      email: get('email').toLowerCase(),
      name: get('name'),
      nickname: get('nickname') || undefined,
      aliases: get('calendar_names').split(';').map((s) => s.trim()).filter(Boolean),
      roles: rolesForTier(access, /^(yes|y|true)$/i.test(get('media'))),
      instruments: get('instruments').split(',').map((s) => s.trim()).filter(Boolean),
      primaryRole: get('primary') || undefined,
      createdAt: '',
      updatedAt: '',
      active: true
    }
  })
}
