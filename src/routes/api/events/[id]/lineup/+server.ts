import { error, json } from '@sveltejs/kit'
import { format, parseISO } from 'date-fns'
import { diffLineup, extractLineup, missingParts, sameLineup, writeLineup, type Lineup, type LineupChange, type LineupSlot } from '$lib/lineup'
import { requireRole } from '$lib/server/auth'
import { getEvent, patchDescription } from '$lib/server/google'
import { appendLog } from '$lib/server/log'
import { requireEnv } from '$lib/server/platform'
import type { RequestHandler } from './$types'

// Names and labels go into the calendar verbatim, one per line.
const PLAIN = /^[^<>\r\n]*$/

function readLineup(value: unknown): Lineup {
  const v = value as Partial<Lineup> | null
  if (!v || !Array.isArray(v.slots) || typeof v.media !== 'string') throw error(400, 'Expected a lineup')

  const slots = v.slots.map((raw): LineupSlot => {
    const { section, label, name } = (raw ?? {}) as Partial<LineupSlot>
    if (section !== 'vocalists' && section !== 'instrumentalists') throw error(400, 'Unknown lineup section')
    if (typeof label !== 'string' || !label.trim() || label.length > 40 || !PLAIN.test(label)) {
      throw error(400, 'Invalid slot name')
    }
    if (typeof name !== 'string' || name.length > 60 || !PLAIN.test(name)) {
      throw error(400, `Invalid name for ${label}`)
    }
    return { section, label: label.trim(), name: name.trim() }
  })

  if (v.media.length > 120 || !PLAIN.test(v.media)) throw error(400, 'Invalid media names')
  return { slots, media: v.media.trim() }
}

const describe = (c: LineupChange) => `${c.label} ${c.from || '(empty)'} → ${c.to || '(empty)'}`

/**
 * Replaces one Sunday's lineup in its Calendar event. Admins and superadmins.
 *
 * The client sends the lineup it was looking at as `before`. If the calendar no
 * longer matches it, someone changed the week in the meantime, in the app or
 * directly in Google Calendar, and we refuse rather than overwrite their edit.
 * The write itself is also conditional on the etag we just read, which closes
 * the gap between our read and our write.
 */
export const PUT: RequestHandler = async (event) => {
  const user = requireRole(event, 'isWorshipLeader')
  const env = requireEnv(event.platform)

  let body: { before?: unknown; after?: unknown }
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }
  const before = readLineup(body.before)
  const after = readLineup(body.after)

  const missing = missingParts(after)
  if (missing.length > 0) throw error(400, `Still needed: ${missing.map((m) => m.text).join(', ')}`)

  const conflict = () =>
    error(409, 'Someone else changed this week while you were editing. Reload to see the latest, then try again.')

  const calendarEvent = await getEvent(env, event.params.id)
  if (!sameLineup(extractLineup(calendarEvent.description), before)) throw conflict()

  const changes = diffLineup(before, after)
  if (changes.length === 0) return json({ changes })

  const updated = await patchDescription(env, calendarEvent, writeLineup(calendarEvent.description, after))
  if (!updated) throw conflict()

  const date = calendarEvent.start?.date ?? calendarEvent.start?.dateTime?.slice(0, 10)
  const when = date ? format(parseISO(date), 'EEE, MMM d') : calendarEvent.summary
  await appendLog(env, user, 'lineup.updated', `updated the lineup for ${when}: ${changes.map(describe).join('; ')}`, {
    eventId: calendarEvent.id,
    date,
    changes
  })

  return json({ changes })
}
