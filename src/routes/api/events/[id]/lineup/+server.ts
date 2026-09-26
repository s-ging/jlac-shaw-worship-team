import { error, json } from '@sveltejs/kit'
import { format, parseISO } from 'date-fns'
import { diffLineup, extractLineup, missingParts, sameLineup, writeLineup, type Lineup, type LineupChange, type LineupSlot } from '$lib/lineup'
import { requireRole } from '$lib/server/auth'
import { getEvent, patchEvent } from '$lib/server/google'
import { appendLog } from '$lib/server/log'
import { requireEnv } from '$lib/server/platform'
import { diffInfo, extractPlaylist, extractTheme, isPlaylistUrl, writePlaylist, writeTheme, type WeekInfo } from '$lib/week-info'
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

function readInfo(value: unknown): WeekInfo {
  const v = value as Partial<WeekInfo> | null
  if (!v || typeof v.theme !== 'string' || typeof v.playlist !== 'string') throw error(400, 'Expected a theme and playlist')
  const theme = v.theme.trim()
  const playlist = v.playlist.trim()
  if (theme.length > 120 || !PLAIN.test(theme)) throw error(400, 'Invalid theme')
  if (playlist && !isPlaylistUrl(playlist)) throw error(400, 'The playlist must be a YouTube link')
  return { theme, playlist }
}

const describe = (c: LineupChange) => `${c.label} ${c.from || '(empty)'} → ${c.to || '(empty)'}`

/**
 * Replaces one Sunday's lineup, theme and playlist in its Calendar event.
 * Admins and superadmins. `info` (theme and playlist) is optional, so a client
 * that only knows the lineup still works.
 *
 * The client sends what it was looking at as `before`. If the calendar no
 * longer matches it, someone changed the week in the meantime, in the app or
 * directly in Google Calendar, and we refuse rather than overwrite their edit.
 * The write itself is also conditional on the etag we just read, which closes
 * the gap between our read and our write.
 */
export const PUT: RequestHandler = async (event) => {
  const user = requireRole(event, 'isWorshipLeader')
  const env = requireEnv(event.platform)

  let body: { before?: unknown; after?: unknown; info?: { before?: unknown; after?: unknown } }
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }
  const before = readLineup(body.before)
  const after = readLineup(body.after)
  const info = body.info === undefined ? null : { before: readInfo(body.info?.before), after: readInfo(body.info?.after) }

  const missing = missingParts(after)
  if (missing.length > 0) throw error(400, `Still needed: ${missing.map((m) => m.text).join(', ')}`)

  const conflict = () =>
    error(409, 'Someone else changed this week while you were editing. Reload to see the latest, then try again.')

  const calendarEvent = await getEvent(env, event.params.id)
  if (!sameLineup(extractLineup(calendarEvent.description), before)) throw conflict()
  const current: WeekInfo = { theme: extractTheme(calendarEvent.summary), playlist: extractPlaylist(calendarEvent.description) }
  if (info && diffInfo(current, info.before).length > 0) throw conflict()

  const lineupChanges = diffLineup(before, after)
  const infoChanges = info ? diffInfo(info.before, info.after) : []
  const changes = [...lineupChanges, ...infoChanges]
  if (changes.length === 0) return json({ changes })

  const date = calendarEvent.start?.date ?? calendarEvent.start?.dateTime?.slice(0, 10)
  const fields: { description?: string; summary?: string } = {}
  const playlistChanged = infoChanges.some((c) => c.label === 'Playlist')
  if (lineupChanges.length > 0 || playlistChanged) {
    const description = writeLineup(calendarEvent.description, after)
    fields.description = playlistChanged ? writePlaylist(description, info!.after.playlist) : description
  }
  if (infoChanges.some((c) => c.label === 'Theme')) fields.summary = writeTheme(info!.after.theme, date ?? '')

  const updated = await patchEvent(env, calendarEvent, fields)
  if (!updated) throw conflict()

  const when = date ? format(parseISO(date), 'EEE, MMM d') : calendarEvent.summary
  const what = infoChanges.length > 0 ? `the week of ${when}` : `the lineup for ${when}`
  await appendLog(env, user, 'lineup.updated', `updated ${what}: ${changes.map(describe).join('; ')}`, {
    eventId: calendarEvent.id,
    date,
    changes
  })

  return json({ changes })
}
