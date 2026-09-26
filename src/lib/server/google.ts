import { error } from '@sveltejs/kit'
import { CALENDAR_ID } from '$lib/config'

type Env = App.Platform['env']

/**
 * Google Calendar writes, made as the team's dedicated Google account.
 *
 * Reads still go straight from the browser with the public API key; only edits
 * come through here. Auth is an OAuth refresh token for that account, minted
 * once with `npm run google:auth` and stored as a Pages secret.
 */

export interface CalendarEvent {
  id: string
  etag: string
  summary?: string
  description?: string
  start?: { date?: string; dateTime?: string }
}

// Access tokens last an hour. Keep one per isolate instead of minting one per request.
let cached: { token: string; expiresAt: number } | null = null

async function accessToken(env: Env): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw error(503, 'Calendar editing is not set up yet. Run `npm run google:auth`.')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  })
  if (!res.ok) {
    console.error('Google token refresh failed', res.status, await res.text())
    throw error(502, 'Could not sign in to Google Calendar. The refresh token may have been revoked; rerun `npm run google:auth`.')
  }

  const body = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
  return cached.token
}

const eventUrl = (id: string) =>
  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(id)}`

async function call(
  env: Env,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<Response> {
  const token = await accessToken(env)
  return fetch(url, { ...init, headers: { ...init.headers, authorization: `Bearer ${token}` } })
}

async function failed(res: Response, what: string): Promise<never> {
  console.error(`Google Calendar ${what} failed`, res.status, await res.text())
  if (res.status === 403) {
    throw error(502, 'The calendar account does not have permission to edit this calendar.')
  }
  throw error(502, 'Google Calendar did not respond as expected. Try again in a moment.')
}

export async function getEvent(env: Env, id: string): Promise<CalendarEvent> {
  const res = await call(env, eventUrl(id))
  if (res.status === 404 || res.status === 410) throw error(404, 'That event no longer exists in the calendar')
  if (!res.ok) return failed(res, 'read')
  return res.json()
}

/**
 * Writes a new description and/or title, conditional on the event still being
 * the version that was read. Returns null if it changed in between; the caller
 * reports that as a conflict. Patching one instance of a recurring event only
 * changes that one Sunday.
 */
export async function patchEvent(
  env: Env,
  event: CalendarEvent,
  fields: { description?: string; summary?: string }
): Promise<CalendarEvent | null> {
  const res = await call(env, eventUrl(event.id), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'if-match': event.etag },
    body: JSON.stringify(fields)
  })
  if (res.status === 412) return null
  if (!res.ok) return failed(res, 'update')
  return res.json()
}
