import { labelKey, labelText, type Lineup } from '$lib/lineup'
import type { PublicUser } from '$lib/types'

/**
 * The parts people play, and which lineup slots each one qualifies them for.
 * Drives the lineup editor's dropdowns, which list only qualified people.
 * Anyone can still be typed in with "Someone else…", so this filters the list
 * without ever blocking a pick.
 *
 * `UserRecord.instruments` is free text, since the roster was typed by hand
 * ("lead vocal, backup", "drum"). `partOf` maps those strings onto these parts.
 * Media isn't here: that's the `isMedia` role flag.
 */
export interface Part {
  key: string
  label: string
  /** Normalized spellings that mean this part. */
  aliases: string[]
}

export const PARTS: Part[] = [
  { key: 'leadvocal', label: 'Lead vocal', aliases: ['leadvocal', 'leadvocals', 'praiseleader', 'worshipleader'] },
  { key: 'backup', label: 'Backup vocal', aliases: ['backup', 'backupvocal', 'backupvocals', 'backing'] },
  { key: 'drums', label: 'Drums', aliases: ['drums', 'drum'] },
  { key: 'lguitar', label: 'Lead guitar', aliases: ['lead', 'leadguitar', 'lguitar'] },
  { key: 'rguitar', label: 'Rhythm guitar', aliases: ['rhythm', 'rhythmguitar', 'rguitar'] },
  { key: 'bass', label: 'Bass', aliases: ['bass', 'bassguitar'] },
  { key: 'keys', label: 'Keys', aliases: ['keys', 'keyboard', 'keyboards', 'piano'] }
]

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

/** The part an instrument string means, or null. "lead" is lead guitar; "lead vocal" is lead vocal. */
export function partOf(instrument: string): Part | null {
  const n = normalize(instrument)
  return PARTS.find((p) => p.key === n || p.aliases.includes(n) || normalize(p.label) === n) ?? null
}

export function userParts(user: Pick<PublicUser, 'instruments'>): Set<string> {
  const keys = new Set<string>()
  for (const instrument of user.instruments) {
    const part = partOf(instrument)
    if (part) keys.add(part.key)
  }
  return keys
}

/**
 * What someone mainly does in the ministry: one of their parts, or Media.
 * Stored as `UserRecord.primaryRole`; set by a superadmin on the People page.
 */
export const PRIMARY_ROLES: { key: string; label: string }[] = [
  ...PARTS.map(({ key, label }) => ({ key, label })),
  { key: 'media', label: 'Media' }
]

export function primaryRoleLabel(user: Pick<PublicUser, 'primaryRole'>): string | null {
  return PRIMARY_ROLES.find((r) => r.key === user.primaryRole)?.label ?? null
}

/** Roles someone can have as primary: the parts they play, plus Media if they're on it. */
export function primaryChoices(parts: string[], isMedia: boolean): { key: string; label: string }[] {
  return PRIMARY_ROLES.filter((r) => (r.key === 'media' ? isMedia : parts.includes(r.key)))
}

/** The People page's ministry filter: what someone does on a Sunday, grouped the way the team talks. */
export const MINISTRY_FILTERS: { key: string; label: string; parts: string[] }[] = [
  { key: 'vocals', label: 'Vocals', parts: ['leadvocal', 'backup'] },
  { key: 'drums', label: 'Drums', parts: ['drums'] },
  { key: 'guitar', label: 'Guitar', parts: ['lguitar', 'rguitar'] },
  { key: 'bass', label: 'Bass', parts: ['bass'] },
  { key: 'keys', label: 'Keys', parts: ['keys'] },
  { key: 'media', label: 'Media', parts: [] }
]

export function inMinistry(user: Pick<PublicUser, 'instruments' | 'roles'>, filterKey: string): boolean {
  const filter = MINISTRY_FILTERS.find((f) => f.key === filterKey)
  if (!filter) return true
  if (filter.key === 'media') return user.roles.isMedia
  const parts = userParts(user)
  return filter.parts.some((p) => parts.has(p))
}

/** Which parts qualify someone for a lineup slot, by the slot's label. */
const SLOT_PARTS: Record<string, string[]> = {
  praiseleader: ['leadvocal'],
  secondpraiseleader: ['leadvocal', 'backup'],
  offeringprayer: ['leadvocal', 'backup']
}

export function slotParts(label: string): string[] {
  const fixed = SLOT_PARTS[labelKey(label)]
  if (fixed) return fixed
  const part = partOf(labelText(label))
  return part ? [part.key] : []
}

/** How the calendar writes this person: their first calendar name. */
export function calendarName(user: PublicUser): string {
  return user.aliases[0] || user.nickname || user.name.split(' ')[0]
}

/** Names that identify a person in the calendar, lowercased: calendar names, nickname, first name. */
export function namesOf(user: PublicUser): string[] {
  return [...user.aliases, user.nickname ?? '', user.name.split(' ')[0]].map((n) => n.trim().toLowerCase()).filter(Boolean)
}

/**
 * The team member a calendar name refers to, or null. Notes in parentheses
 * don't count: "Ezra (1st Worship Song)" is Ezra. Ambiguous names (two people
 * answering to "Kevin") resolve to nobody rather than to a guess.
 */
export function matchUser(name: string, users: PublicUser[]): PublicUser | null {
  return matchByNames(name, users, namesOf)
}

/** A calendar name as matched against `namesOf`: notes in parentheses dropped, lowercased. */
export function nameKey(name: string): string {
  return name.replace(/\([^)]*\)/g, '').trim().toLowerCase()
}

/** `matchUser` for anything that knows its names. The one unambiguous hit, or null. */
export function matchByNames<T>(name: string, candidates: T[], names: (c: T) => string[]): T | null {
  const wanted = nameKey(name)
  if (!wanted) return null
  const hits = candidates.filter((c) => names(c).includes(wanted))
  return hits.length === 1 ? hits[0] : null
}

/** True if any of these calendar names means `user`. */
export function isNamed(user: PublicUser, names: string[]): boolean {
  return names.some((name) => matchByNames(name, [user], namesOf) !== null)
}

/** Every name on a lineup: each slot's person, then media. */
export function lineupNames(lineup: Lineup): string[] {
  return [...lineup.slots.map((s) => s.name.trim()).filter(Boolean), ...splitNames(lineup.media)]
}

/** "Sam and Chan", "Sam, Chan & Jo" → ["Sam", "Chan", "Jo"]. */
export function splitNames(text: string): string[] {
  return text
    .split(/,|&|\band\b/i)
    .map((n) => n.trim())
    .filter(Boolean)
}

/** ["Sam", "Chan", "Jo"] → "Sam, Chan and Jo", matching how the team writes it. */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
