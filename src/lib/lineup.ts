/**
 * Reads and rewrites the lineup block of a Calendar event description: the
 * Vocalists / Instrumentalists / Media lines.
 *
 * This is separate from calendar-parser.ts on purpose. That parser normalizes
 * for display and throws the raw labels away, which is fine for reading but not
 * for writing back. This module round-trips: it keeps each label exactly as the
 * team wrote it ("🎸 L. Guitar"), and when it rewrites the block it leaves every
 * other line (playlist, motif, devotion, rehearsal times) untouched.
 *
 * Shared by the browser (to fill the editor) and the server (to apply an edit),
 * so both sides always agree on what the current lineup is.
 */

export type LineupSection = 'vocalists' | 'instrumentalists'

export interface LineupSlot {
  section: LineupSection
  /** As written in the calendar, emoji included, e.g. "1️⃣ Praise Leader". */
  label: string
  name: string
}

export interface Lineup {
  slots: LineupSlot[]
  /** Free text, as the team writes it: "Sam and Chan". */
  media: string
}

/** The slots every Sunday has, in the team's order. The editor always shows these, even when empty. */
export const STANDARD_SLOTS: ReadonlyArray<Omit<LineupSlot, 'name'>> = [
  { section: 'vocalists', label: '1️⃣ Praise Leader' },
  { section: 'vocalists', label: '2️⃣ Second Praise Leader' },
  { section: 'vocalists', label: '3️⃣ Offering Prayer' },
  { section: 'instrumentalists', label: '🥁 Drums' },
  { section: 'instrumentalists', label: '🎸 L. Guitar' },
  { section: 'instrumentalists', label: '🎸 R. Guitar' },
  { section: 'instrumentalists', label: '🎸 Bass' }
]

/**
 * What an empty week's description starts as: the skeleton the team fills in by
 * hand. Future weeks are bare recurring-event instances with no description at
 * all, so the first edit to one writes this plus the lineup.
 */
const TEMPLATE_HEAD = [
  'YouTube Playlist link: TBA',
  '',
  '',
  '---',
  'Motif: TBA',
  '',
  'Devotion Time: 8:30AM c/o ',
  '',
  'Rehearsals: 9:00AM',
  '',
  'Praise Team Members',
  ''
]

const LABEL_ALIASES: Record<string, string> = {
  lead: 'lguitar',
  leadguitar: 'lguitar',
  rhythm: 'rguitar',
  rhythmguitar: 'rguitar',
  drum: 'drums',
  bassguitar: 'bass'
}

/** "🎸 Lead Guitar" and "L. Guitar" are the same slot: emoji, numbering and punctuation don't count. */
export function labelKey(label: string): string {
  const key = label.replace(/[^a-z0-9]/gi, '').toLowerCase().replace(/^\d+/, '')
  return LABEL_ALIASES[key] ?? key
}

/** A label without its leading emoji or number, for sentences: "L. Guitar". */
export function labelText(label: string): string {
  return label.replace(/^[^\p{L}]+/u, '').trim() || label
}

// ---- Reading ----

function splitLines(description: string): { lines: string[]; html: boolean } {
  // Descriptions edited in the Calendar web UI are HTML; ones typed elsewhere are plain text.
  const html = /<br\s*\/?>|<\/?(?:b|a|p|div|span)\b/i.test(description)
  return { lines: description.split(/<br\s*\/?>|\r?\n/i), html }
}

function toText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim()
}

function parseHeader(text: string): { section: LineupSection | 'media'; rest: string } | null {
  const m = text.match(/^(vocalists|instrumentalists|media)\b\s*:?\s*(.*)$/i)
  if (!m) return null
  const section = m[1].toLowerCase() as LineupSection | 'media'
  // "Media: Sam" is a header with names on it; "Vocalists - ..." is not a header at all.
  if (section !== 'media' && m[2]) return null
  return { section, rest: m[2].trim() }
}

const ENTRY = /^(.*?\S)\s*[-–—]\s*(.*)$/

interface Located {
  /** First and last line index of the block, inclusive. */
  start: number
  end: number
  lineup: Lineup
}

/**
 * Finds the lineup block. It starts at the first section header and ends at
 * the last line it recognizes. A blank line after the media names, or any line
 * it can't read, ends it, and that line and everything after it are left alone.
 */
function locate(lines: string[]): Located | null {
  let start = -1
  let end = -1
  let section: LineupSection | 'media' = 'vocalists'
  const slots: LineupSlot[] = []
  const media: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const text = toText(lines[i])

    const header = parseHeader(text)
    if (header) {
      if (start < 0) start = i
      section = header.section
      if (header.rest) media.push(header.rest)
      end = i
      continue
    }

    if (start < 0) continue

    if (!text) {
      if (section === 'media' && media.length > 0) break
      continue
    }

    if (section === 'media') {
      media.push(text)
      end = i
      continue
    }

    const entry = text.match(ENTRY)
    if (!entry) break
    slots.push({ section, label: entry[1].trim(), name: entry[2].trim() })
    end = i
  }

  if (start < 0) return null
  return { start, end, lineup: { slots, media: media.join(' ') } }
}

export function extractLineup(description: string | null | undefined): Lineup {
  return locate(splitLines(description ?? '').lines)?.lineup ?? { slots: [], media: '' }
}

/** True for the Sunday service event, as opposed to other events on the same date (fellowships, Salu-Salo). */
export function isServiceEvent(event: { summary?: string; description?: string }): boolean {
  if (locate(splitLines(event.description ?? '').lines)) return true
  return /week'?s theme/i.test(event.summary ?? '')
}

// ---- Comparing ----

function slotMap(lineup: Lineup): Map<string, { label: string; name: string }> {
  const map = new Map<string, { label: string; name: string }>()
  for (const slot of lineup.slots) {
    const key = `${slot.section}:${labelKey(slot.label)}`
    // Duplicate labels are rare; number them so neither is lost.
    let unique = key
    for (let n = 2; map.has(unique); n++) unique = `${key}#${n}`
    map.set(unique, { label: slot.label, name: slot.name.trim() })
  }
  return map
}

export interface LineupChange {
  label: string
  from: string
  to: string
}

/** Slots whose name changed. A slot missing on one side counts as empty, so adding blank rows is not a change. */
export function diffLineup(before: Lineup, after: Lineup): LineupChange[] {
  const a = slotMap(before)
  const b = slotMap(after)
  const changes: LineupChange[] = []

  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const from = a.get(key)?.name ?? ''
    const to = b.get(key)?.name ?? ''
    if (from !== to) changes.push({ label: labelText(b.get(key)?.label ?? a.get(key)!.label), from, to })
  }

  const fromMedia = before.media.trim()
  const toMedia = after.media.trim()
  if (fromMedia !== toMedia) changes.push({ label: 'Media', from: fromMedia, to: toMedia })

  return changes
}

export function sameLineup(a: Lineup, b: Lineup): boolean {
  return diffLineup(a, b).length === 0
}

// ---- Editing ----

/**
 * Rows for the editor: the standard slots in order, filled in wherever the
 * lineup has them, followed by any extra slots it has (Keys, a fourth singer).
 */
export function editorSlots(lineup: Lineup): LineupSlot[] {
  const remaining = [...lineup.slots]
  const rows: LineupSlot[] = []

  for (const section of ['vocalists', 'instrumentalists'] as const) {
    for (const std of STANDARD_SLOTS.filter((s) => s.section === section)) {
      const i = remaining.findIndex((s) => s.section === section && labelKey(s.label) === labelKey(std.label))
      rows.push(i >= 0 ? { ...remaining.splice(i, 1)[0] } : { ...std, name: '' })
    }
    for (const extra of remaining.filter((s) => s.section === section)) rows.push({ ...extra })
  }

  return rows
}

function renderBlock(lineup: Lineup, html: boolean, bold: boolean): string[] {
  const esc = (s: string) => (html ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : s)
  const header = (s: string) => (bold ? `<b>${s}</b>` : s)
  const entries = (section: LineupSection) =>
    lineup.slots
      .filter((s) => s.section === section && s.name.trim())
      .map((s) => `${esc(s.label.trim())} - ${esc(s.name.trim())}`)

  const lines = [
    header('Vocalists'),
    ...entries('vocalists'),
    '',
    header('Instrumentalists'),
    ...entries('instrumentalists'),
    '',
    header('Media')
  ]
  if (lineup.media.trim()) lines.push(esc(lineup.media.trim()))
  return lines
}

/**
 * Returns the description with its lineup block replaced by `lineup`. Empty
 * slots are left out. Nothing outside the block changes, apart from line breaks
 * being written in one consistent style.
 */
export function writeLineup(description: string | null | undefined, lineup: Lineup): string {
  const current = description ?? ''
  if (!current.trim()) return [...TEMPLATE_HEAD, ...renderBlock(lineup, false, false)].join('\n')

  const { lines, html } = splitLines(current)
  // Match the week's existing style: bold section headers only if it already had them.
  const bold = html && /<b>\s*vocalists/i.test(current)
  const block = renderBlock(lineup, html, bold)
  const at = locate(lines)
  const next = at
    ? [...lines.slice(0, at.start), ...block, ...lines.slice(at.end + 1)]
    : [...lines, '', ...block]

  return next.join(html ? '<br>' : '\n')
}
