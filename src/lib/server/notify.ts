import { format, parseISO } from 'date-fns'
import { DISPLAY_TIMEZONE } from '$lib/config'
import { labelText, type Lineup, type LineupSection } from '$lib/lineup'
import { matchUser, splitNames } from '$lib/parts'
import type { AssignmentNotice, PublicUser, UserRecord, WeekSnapshot } from '$lib/types'
import { normalizeEmail, toPublicUser } from './kv'
import { greetingName } from './mailer'

type Env = App.Platform['env']

/**
 * Who's been put on which Sunday, in NOTIFY_KV. One record per person per
 * Sunday (see AssignmentNotice) feeds both the bell and the email digest, so
 * however many times a week is edited, each person has one thing to be told.
 *
 * What keeps inboxes quiet:
 * - One record per person per Sunday: re-saving, or removing and re-adding
 *   someone, never queues a second email for the same part.
 * - Digest, not per save: the Apps Script asks for due digests every 15
 *   minutes, and a person's is only due once nobody has touched any of their
 *   Sundays for SETTLE_MINUTES. Planning a month is one email.
 * - At most DAILY_EMAIL_CAP digests per person a day, and only during
 *   SEND_HOURS. The rest waits.
 * - Nothing for whoever made the edit, past Sundays, inactive accounts, or
 *   anyone who turned email off under Me (the bell still shows it).
 */

export const SETTLE_MINUTES = 15
export const DAILY_EMAIL_CAP = 2
/** Manila time. Edits made at night are emailed in the morning. */
export const SEND_HOURS = { from: 7, to: 21 }

const noticeKey = (email: string, date: string) => `notify:${normalizeEmail(email)}:${date}`
const noticePrefix = (email: string) => `notify:${normalizeEmail(email)}:`
const weekKey = (date: string) => `week:${date}`
const seenKey = (email: string) => `seen:${normalizeEmail(email)}`
const sentKey = (email: string, day: string) => `sent:${normalizeEmail(email)}:${day}`

const hereFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23'
})

/** Today's date and the hour, in Manila. */
function here(at = new Date()): { day: string; hour: number } {
  const parts = hereFormat.formatToParts(at)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

/** Two days after that Sunday, in unix seconds, so KV drops old records by itself. Manila has no DST. */
const expiresAfter = (date: string) => Math.floor(Date.parse(`${date}T00:00:00+08:00`) / 1000) + 2 * 86_400

/** The parts `user` has on `lineup`, as sentences say them: ["Bass", "Media"]. */
function partsOf(lineup: Lineup, user: PublicUser, team: PublicUser[]): string[] {
  const parts = lineup.slots.filter((s) => s.name.trim() && matchUser(s.name, team) === user).map((s) => labelText(s.label))
  if (splitNames(lineup.media).some((name) => matchUser(name, team) === user)) parts.push('Media')
  return parts
}

function snapshot(lineup: Lineup, week: { date: string; theme: string; playlist: string }): WeekSnapshot {
  const entries = (section: LineupSection) =>
    lineup.slots.filter((s) => s.section === section && s.name.trim()).map((s) => ({ part: labelText(s.label), name: s.name.trim() }))
  return {
    ...week,
    vocalists: entries('vocalists'),
    instrumentalists: entries('instrumentalists'),
    dancers: entries('dancers'),
    media: lineup.media.trim()
  }
}

async function putNotice(env: Env, notice: AssignmentNotice): Promise<void> {
  // The whole notice rides along as metadata, so the bell and the digest are one list call each.
  await env.NOTIFY_KV.put(noticeKey(notice.email, notice.date), JSON.stringify(notice), {
    expiration: expiresAfter(notice.date),
    metadata: notice
  })
}

// ---- Writing ----

/**
 * Updates the Sunday's snapshot and the notices of everyone whose parts the
 * save changed. Someone who gained a part is (re)marked new; someone who only
 * lost one keeps their record with fewer parts, so putting them back later
 * doesn't email them again. Never throws: the save has already happened.
 */
export async function recordLineupSave(
  env: Env,
  users: UserRecord[],
  before: Lineup,
  after: Lineup,
  week: { date: string | undefined; theme: string; playlist: string },
  actor: UserRecord
): Promise<void> {
  const { date } = week
  if (!date || date < here().day) return

  try {
    const team = users.map(toPublicUser)
    const now = new Date().toISOString()
    const writes: Promise<void>[] = [
      env.NOTIFY_KV.put(weekKey(date), JSON.stringify(snapshot(after, { ...week, date })), { expiration: expiresAfter(date) })
    ]

    for (const user of team) {
      if (!user.active || user.email === normalizeEmail(actor.email)) continue
      const parts = partsOf(after, user, team)
      const had = partsOf(before, user, team)
      const gained = parts.some((p) => !had.includes(p))
      if (!gained && parts.length === had.length) continue

      const existing = await env.NOTIFY_KV.get<AssignmentNotice>(noticeKey(user.email, date), 'json')
      if (gained) {
        writes.push(
          putNotice(env, { email: user.email, date, parts, by: greetingName(actor), updatedAt: now, emailedParts: existing?.emailedParts ?? [] })
        )
      } else if (existing) {
        writes.push(putNotice(env, { ...existing, parts }))
      }
    }

    await Promise.all(writes)
  } catch (err) {
    console.error('Failed to record assignment notices', date, err)
  }
}

// ---- The bell ----

/** Your upcoming Sundays, most recently changed first, and when you last opened the bell. */
export async function noticesFor(env: Env, email: string): Promise<{ notices: AssignmentNotice[]; seenAt: string | null }> {
  const [{ keys }, seenAt] = await Promise.all([
    env.NOTIFY_KV.list<AssignmentNotice>({ prefix: noticePrefix(email) }),
    env.NOTIFY_KV.get(seenKey(email))
  ])
  const today = here().day
  const notices = keys
    .map((k) => k.metadata)
    .filter((n): n is AssignmentNotice => Boolean(n && n.parts.length > 0 && n.date >= today))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return { notices, seenAt }
}

export const isUnread = (notice: AssignmentNotice, seenAt: string | null) => !seenAt || notice.updatedAt > seenAt

export async function markSeen(env: Env, email: string): Promise<void> {
  await env.NOTIFY_KV.put(seenKey(email), new Date().toISOString())
}

// ---- The digest ----

export interface DigestWeek extends WeekSnapshot {
  /** "Sunday, October 4" */
  dateLabel: string
  parts: string[]
  by: string
}

export interface Digest {
  to: string
  name: string
  weeks: DigestWeek[]
}

/**
 * Emails that are due now: one per person, covering every upcoming Sunday
 * with a part they haven't been emailed about. The Apps Script sends them and
 * reports each one back through `markEmailed`.
 */
export async function dueDigests(env: Env, users: UserRecord[], at = new Date()): Promise<Digest[]> {
  const { day, hour } = here(at)
  if (hour < SEND_HOURS.from || hour >= SEND_HOURS.to) return []

  const { keys } = await env.NOTIFY_KV.list<AssignmentNotice>({ prefix: 'notify:' })
  const byEmail = new Map<string, AssignmentNotice[]>()
  for (const notice of keys.map((k) => k.metadata)) {
    if (!notice || notice.date < day) continue
    byEmail.set(notice.email, [...(byEmail.get(notice.email) ?? []), notice])
  }

  const settled = at.getTime() - SETTLE_MINUTES * 60_000
  const digests: Digest[] = []
  for (const user of users) {
    if (!user.active || user.emailAssignments === false) continue
    const mine = byEmail.get(user.email) ?? []
    const due = mine.filter((n) => n.parts.some((p) => !n.emailedParts.includes(p)))
    if (due.length === 0) continue
    // Still being planned: wait until none of their Sundays has changed for a while.
    if (Math.max(...mine.map((n) => Date.parse(n.updatedAt))) > settled) continue
    if (Number((await env.NOTIFY_KV.get(sentKey(user.email, day))) ?? 0) >= DAILY_EMAIL_CAP) continue

    const weeks = await Promise.all(
      due
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(async (n): Promise<DigestWeek> => {
          const week = (await env.NOTIFY_KV.get<WeekSnapshot>(weekKey(n.date), 'json')) ?? {
            date: n.date,
            theme: '',
            playlist: '',
            vocalists: [],
            instrumentalists: [],
            dancers: [],
            media: ''
          }
          return { ...week, dateLabel: format(parseISO(n.date), 'EEEE, MMMM d'), parts: n.parts, by: n.by }
        })
    )
    digests.push({ to: user.email, name: greetingName(user), weeks })
  }
  return digests
}

/** Records that a digest went out: those parts are never emailed again, and it counts toward today's cap. */
export async function markEmailed(
  env: Env,
  email: string,
  weeks: { date: string; parts: string[] }[],
  at = new Date()
): Promise<void> {
  for (const week of weeks) {
    const notice = await env.NOTIFY_KV.get<AssignmentNotice>(noticeKey(email, week.date), 'json')
    if (!notice) continue
    await putNotice(env, { ...notice, emailedParts: [...new Set([...notice.emailedParts, ...week.parts])] })
  }
  const key = sentKey(email, here(at).day)
  const sent = Number((await env.NOTIFY_KV.get(key)) ?? 0)
  await env.NOTIFY_KV.put(key, String(sent + 1), { expirationTtl: 2 * 86_400 })
}
