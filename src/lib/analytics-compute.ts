/**
 * The Analytics numbers, from plain inputs: the Sundays' lineups, the team,
 * the RSVPs and the logged lineup edits. No I/O here, so the server
 * ($lib/server/analytics) and the /dev/preview page run the same maths.
 *
 * Rules:
 * - Only past Sundays in the range count (today included), except for the
 *   playlist, where the coming Sunday counts once its playlist is in.
 * - People are matched from calendar names the way the bell does (matchUser).
 *   A name that matches nobody, or two people, is left out.
 * - Rates are out of the Sundays in the range: there's no availability data,
 *   so "could have been picked" means every Sunday.
 * - Days are Manila calendar days: a playlist saved Friday is 2 days early.
 * - People go by their calendar name, or their full name when two share one.
 */

import { DISPLAY_TIMEZONE } from './config'
import { extractLineup, isServiceEvent, labelKey, type Lineup, type LineupChange } from './lineup'
import { calendarName, matchUser, PARTS, slotParts, splitNames, userParts } from './parts'
import { extractPlaylist } from './week-info'
import type { BarRow, MetricResults, Range } from './analytics'
import type { PublicUser, RsvpRecord } from './types'

export interface ServiceWeek {
  /** The Sunday, yyyy-MM-dd. */
  date: string
  lineup: Lineup
  playlist: string
}

/** One `lineup.updated` changelog entry. */
export interface LineupEdit {
  at: string
  date: string
  changes: LineupChange[]
}

export interface RangeSpan {
  /** First day counted, yyyy-MM-dd. */
  start: string
  today: string
  /** Today if it's Sunday, else the next one. */
  comingSunday: string
}

export interface AnalyticsInput {
  span: RangeSpan
  weeks: ServiceWeek[]
  users: PublicUser[]
  /** By Sunday, then email. null where they couldn't be read (the preview). */
  rsvps: Record<string, Record<string, RsvpRecord>> | null
  edits: LineupEdit[] | null
}

/** Late means within this many days of the Sunday. */
export const LATE_DAYS = 3

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** The Manila date of an instant, yyyy-MM-dd. */
export function manilaDay(at: Date | string): string {
  return dayFormat.format(typeof at === 'string' ? new Date(at) : at)
}

const utc = (day: string) => Date.parse(`${day}T00:00:00Z`)
const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000)
const addDays = (day: string, n: number) => new Date(utc(day) + n * 86_400_000).toISOString().slice(0, 10)

export function rangeSpan(range: Range, now = new Date()): RangeSpan {
  const today = manilaDay(now)
  const [y, m] = today.split('-').map(Number)
  const first = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
  const start = range === 'year' ? `${y}-01-01` : range === 'quarter' ? first(y, m - 2) : first(y, m)
  const weekday = new Date(utc(today)).getUTCDay()
  return { start, today, comingSunday: addDays(today, (7 - weekday) % 7) }
}

/** The Sunday service events among raw calendar events, one per date. */
export function serviceWeeks(events: { summary?: string; description?: string; start?: { date?: string; dateTime?: string } }[]): ServiceWeek[] {
  const byDate = new Map<string, ServiceWeek>()
  for (const event of events) {
    const date = event.start?.date ?? event.start?.dateTime?.slice(0, 10)
    if (!date || byDate.has(date) || new Date(utc(date)).getUTCDay() !== 0 || !isServiceEvent(event)) continue
    byDate.set(date, { date, lineup: extractLineup(event.description), playlist: extractPlaylist(event.description) })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

const pct = (n: number, of: number) => `${Math.round((n / of) * 100)}%`
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const byValue = (a: BarRow, b: BarRow) => b.value - a.value || a.label.localeCompare(b.label)

interface Seat {
  user: PublicUser
  /** labelKey of the slot, or 'media'. */
  key: string
  label: string
  section: 'vocalists' | 'instrumentalists' | 'media'
}

function seatsOf(week: ServiceWeek, users: PublicUser[]): Seat[] {
  const seats: Seat[] = []
  for (const slot of week.lineup.slots) {
    const user = slot.name.trim() ? matchUser(slot.name, users) : null
    if (user) seats.push({ user, key: labelKey(slot.label), label: slot.label, section: slot.section })
  }
  for (const name of splitNames(week.lineup.media)) {
    const user = matchUser(name, users)
    if (user) seats.push({ user, key: 'media', label: 'Media', section: 'media' })
  }
  return seats
}

const MUSICIAN_PARTS = ['drums', 'lguitar', 'rguitar', 'bass', 'keys']

export function computeAnalytics({ span, weeks, users, rsvps, edits }: AnalyticsInput): MetricResults {
  const team = users.filter((u) => u.active !== false)
  const past = weeks.filter((w) => w.date >= span.start && w.date <= span.today)
  const seats = new Map(past.map((w) => [w.date, seatsOf(w, team)]))
  const sundays = past.length
  const results: MetricResults = {}

  const shortNames = team.map(calendarName)
  const nameOf = (u: PublicUser) => {
    const short = calendarName(u)
    return shortNames.filter((n) => n === short).length > 1 ? u.name : short
  }
  const none = { rows: [], caption: 'No Sundays in this range yet' }

  /** Per person, the Sundays on which `test` held for one of their seats. */
  const countSundays = (test: (seat: Seat) => boolean) => {
    const counts = new Map<PublicUser, number>()
    for (const list of seats.values()) {
      for (const user of new Set(list.filter(test).map((s) => s.user))) counts.set(user, (counts.get(user) ?? 0) + 1)
    }
    return counts
  }
  const rateRows = (people: PublicUser[], counts: Map<PublicUser, number>): BarRow[] =>
    people.map((u) => {
      const n = counts.get(u) ?? 0
      return { label: nameOf(u), value: n / sundays, display: `${pct(n, sundays)} · ${n}` }
    })

  // ---- Lineups ----

  if (!sundays) {
    for (const key of ['leadingPerMonth', 'songLeaderPickRate', 'backupVocalPickRate', 'musicianPickRate', 'timesServed'] as const) {
      results[key] = none
    }
  } else {
    const leading = countSundays((s) => s.key === 'praiseleader')
    const leaders = team.filter((u) => userParts(u).has('leadvocal') || leading.has(u))
    const months = new Set(past.map((w) => w.date.slice(0, 7))).size
    results.leadingPerMonth = {
      max: Math.max(1, ...leading.values()),
      rows: leaders
        .map((u) => {
          const n = leading.get(u) ?? 0
          const perMonth = months > 1 ? ` · ${(n / months).toFixed(1)}/mo` : ''
          return { label: nameOf(u), value: n, display: `${n}${perMonth}` }
        })
        .sort(byValue)
    }
    results.songLeaderPickRate = { max: 1, rows: rateRows(leaders, leading).sort(byValue) }

    const backing = countSundays((s) => s.section === 'vocalists' && s.key !== 'praiseleader')
    const vocalists = team.filter((u) => {
      const parts = userParts(u)
      return parts.has('leadvocal') || parts.has('backup') || backing.has(u)
    })
    results.backupVocalPickRate = { max: 1, rows: rateRows(vocalists, backing).sort(byValue) }

    const musicianRows: BarRow[] = []
    for (const part of PARTS.filter((p) => MUSICIAN_PARTS.includes(p.key))) {
      const counts = countSundays((s) => s.section === 'instrumentalists' && slotParts(s.label).includes(part.key))
      const players = team.filter((u) => userParts(u).has(part.key) || counts.has(u))
      musicianRows.push(...rateRows(players, counts).sort(byValue).map((row) => ({ ...row, group: part.label })))
    }
    results.musicianPickRate = { max: 1, rows: musicianRows }

    const served = countSundays(() => true)
    results.timesServed = {
      max: sundays,
      rows: team
        .map((u) => {
          const n = served.get(u) ?? 0
          return { label: nameOf(u), value: n, display: `${n} of ${sundays}` }
        })
        .sort(byValue)
    }
  }

  // ---- RSVPs ----

  if (rsvps) {
    let assigned = 0
    let answered = 0
    let no = 0
    for (const week of past) {
      const answers = rsvps[week.date] ?? {}
      for (const user of new Set(seats.get(week.date)!.map((s) => s.user))) {
        assigned++
        const answer = answers[user.email.toLowerCase()]
        if (!answer) continue
        answered++
        if (answer.status === 'no') no++
      }
    }
    results.responseRate = assigned
      ? { value: pct(answered, assigned), caption: `${answered} of ${assigned} answered · ${plural(sundays, 'Sunday')}` }
      : { caption: sundays ? 'No one on these lineups is in the app' : none.caption }
    results.noRate = answered
      ? { value: pct(no, answered), caption: `${no} of ${plural(answered, 'answer')}` }
      : { caption: 'No answers yet' }
  }

  // ---- The changelog ----

  if (edits) {
    const pastDates = new Set(past.map((w) => w.date))
    const late = edits.filter((e) => {
      if (!pastDates.has(e.date) || !e.changes.some((c) => c.label !== 'Theme' && c.label !== 'Playlist')) return false
      const before = daysBetween(manilaDay(e.at), e.date)
      return before >= 0 && before <= LATE_DAYS
    })
    results.lateChanges = sundays
      ? {
          value: String(late.length),
          caption: `in the ${LATE_DAYS} days before a Sunday, over ${plural(sundays, 'Sunday')}`
        }
      : { caption: none.caption }

    // When each Sunday's playlist first went in through the app.
    const firstSet = new Map<string, string>()
    for (const e of edits) {
      if (!e.changes.some((c) => c.label === 'Playlist' && c.to.trim())) continue
      const seen = firstSet.get(e.date)
      if (!seen || e.at < seen) firstSet.set(e.date, e.at)
    }
    const rows: BarRow[] = []
    let untracked = 0
    let missing = 0
    for (const week of weeks.filter((w) => w.date >= span.start && w.date <= span.comingSunday)) {
      const at = firstSet.get(week.date)
      if (!at) {
        if (week.playlist) untracked++
        else if (week.date <= span.today) missing++
        continue
      }
      const early = daysBetween(manilaDay(at), week.date)
      const display = early > 0 ? plural(early, 'day') + ' early' : early === 0 ? 'Same day' : `${plural(-early, 'day')} late`
      rows.push({ label: shortDate.format(new Date(utc(week.date))), value: Math.max(early, 0), display })
    }
    const notes = [
      untracked && `${untracked} set outside the app`,
      missing && `${missing} with no playlist`
    ].filter(Boolean)
    if (rows.length) {
      const average = rows.reduce((sum, r) => sum + r.value, 0) / rows.length
      results.playlistLateness = {
        value: `${average.toFixed(1)} days`,
        caption: [`early on average, over ${plural(rows.length, 'Sunday')}`, ...notes].join(' · '),
        rows,
        max: Math.max(1, ...rows.map((r) => r.value))
      }
    } else {
      results.playlistLateness = { caption: ['No playlists saved in the app yet', ...notes].join(' · '), rows: [] }
    }
  }

  return results
}
