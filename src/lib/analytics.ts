/**
 * The Analytics tab (superadmins): what each card measures and how it's shown.
 * The numbers come from $lib/analytics-compute, fed by $lib/server/analytics.
 *
 * Sources:
 * - LOG_KV `lineup.updated` entries carry `details: { date, changes }`, where
 *   each change is `{ label, from, to }` and `at` is when it was saved. The
 *   playlist is the change labelled "Playlist". Only edits saved in the app
 *   are logged; a playlist pasted straight into Google Calendar has no time.
 * - The calendar events are the lineups themselves (who was on which slot).
 * - RSVP_KV holds one RsvpRecord per person per Sunday.
 */

export type MetricKey =
  | 'playlistLateness'
  | 'leadingPerMonth'
  | 'songLeaderPickRate'
  | 'backupVocalPickRate'
  | 'musicianPickRate'
  | 'timesServed'
  | 'noRate'
  | 'responseRate'
  | 'lateChanges'

/** The dashboard's one filter; it scopes every card. */
export type Range = 'month' | 'quarter' | 'year'

export const RANGES: { value: Range; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: '3 months' },
  { value: 'year', label: 'This year' }
]

export function parseRange(value: string | null): Range {
  return value === 'quarter' || value === 'year' ? value : 'month'
}

/**
 * How a card shows its metric. `hero` is the one big number the dashboard
 * leads with, `stat` a number tile, `bars` a ranked list (per person or part).
 */
export type MetricKind = 'hero' | 'stat' | 'bars'

export interface Metric {
  key: MetricKey
  kind: MetricKind
  title: string
  /** The question the card answers, as the team would ask it. */
  question: string
  source: string
}

/** One bar: a person, a part or a Sunday. `display` is the value as written beside it. */
export interface BarRow {
  label: string
  value: number
  display: string
  /** Rows sharing a group are listed under it as a heading ("Drums"). */
  group?: string
}

/**
 * What $lib/server/analytics returns for a metric. Tiles use `value` (already
 * formatted: "4.2 days", "87%") and `caption`; the hero and bar cards use
 * `rows` too. One loose shape on purpose, until the metrics settle.
 */
export interface MetricResult {
  value?: string
  caption?: string
  rows?: BarRow[]
  /** The value a full bar stands for (1 for rates). Defaults to the largest row. */
  max?: number
}

export type MetricResults = Partial<Record<MetricKey, MetricResult>>

/** In the order the dashboard shows them. The playlist leads: it matters most. */
export const METRICS: Metric[] = [
  {
    key: 'playlistLateness',
    kind: 'hero',
    title: 'Playlist submission',
    question: 'On average, how many days before Sunday is the playlist in? The bars show each Sunday.',
    source: 'Changelog: when the "Playlist" change was saved, against the Sunday. Playlists pasted straight into Google Calendar have no time, so they are left out.'
  },
  {
    key: 'responseRate',
    kind: 'stat',
    title: 'Response rate',
    question: 'Of the people on a lineup, how many answered at all?',
    source: 'RSVPs against each lineup'
  },
  {
    key: 'noRate',
    kind: 'stat',
    title: '"No" rate',
    question: 'Of the answers from people on a lineup, how many were ❌ no?',
    source: 'RSVPs for the Sundays they were on'
  },
  {
    key: 'lateChanges',
    kind: 'stat',
    title: 'Late changes',
    question: 'How many lineup edits were made in the last 3 days before a Sunday?',
    source: 'Changelog: lineup edits and their dates'
  },
  {
    key: 'leadingPerMonth',
    kind: 'bars',
    title: 'Leading per month',
    question: 'How many Sundays did each song leader lead? The shortest bar is who led least.',
    source: 'Calendar lineups: the Praise Leader slot'
  },
  {
    key: 'songLeaderPickRate',
    kind: 'bars',
    title: 'Song leader pick rate',
    question: 'Of the Sundays each song leader could lead, how many were they picked for?',
    source: 'Calendar lineups and who is marked for Vocals'
  },
  {
    key: 'backupVocalPickRate',
    kind: 'bars',
    title: 'Backup vocalist pick rate',
    question: 'How often is each vocalist picked for a vocal slot other than Praise Leader?',
    source: 'Calendar lineups: the other vocal slots'
  },
  {
    key: 'musicianPickRate',
    kind: 'bars',
    title: 'Musician pick rate',
    question: 'How often is each musician picked for the parts they play (drums, guitar, bass, keys)?',
    source: 'Calendar lineups and the parts people play'
  },
  {
    key: 'timesServed',
    kind: 'bars',
    title: 'Times served',
    question: 'How many Sundays has each person been on, any part?',
    source: 'Calendar lineups'
  }
]
