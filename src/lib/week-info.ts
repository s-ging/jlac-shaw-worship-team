/**
 * Reads and rewrites a Sunday's theme and YouTube playlist, the two things the
 * week editor changes besides the lineup.
 *
 * - Theme is the event's title: `"Called to Reap Souls" (Matt. 9:35-38)`.
 *   Weeks not planned yet carry the placeholder `20260927 - "Week's Theme"`,
 *   which counts as no theme.
 * - Playlist is the link on the description's "YouTube Playlist link:" line.
 *   Only that link is rewritten; the rest of the description is left alone.
 *
 * Shared by the browser and the server, like $lib/lineup.
 */

import { isHtml, type LineupChange } from './lineup'

export interface WeekInfo {
  theme: string
  playlist: string
}

const PLACEHOLDER = /week'?s theme/i

/** The theme in an event title, or '' for the placeholder. A leading date ("20260927 - ") isn't part of it. */
export function extractTheme(summary: string | null | undefined): string {
  const title = (summary ?? '').trim()
  if (PLACEHOLDER.test(title)) return ''
  return title.replace(/^\d{8}\s*[-–—]\s*/, '').trim()
}

/** The event title for a theme. Clearing it puts the placeholder back, as the team writes it. */
export function writeTheme(theme: string, date: string): string {
  return theme.trim() || `${date.replace(/-/g, '')} - "Week's Theme"`
}

const YOUTUBE = /https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\/[^\s"'<>]+/i
const YOUTUBE_ONLY = new RegExp(`^${YOUTUBE.source}$`, 'i')
const YOUTUBE_ANCHOR = /<a\b[^>]*href="[^"]*(?:youtube\.com|youtu\.be)[^"]*"[^>]*>[\s\S]*?<\/a>/i
const LABEL = /(youtube playlist link:)[ \t]*(?:TBA\b)?/i

/** A YouTube link (playlist, video or youtu.be), nothing else. */
export function isPlaylistUrl(url: string): boolean {
  return url.length <= 300 && YOUTUBE_ONLY.test(url)
}

export function extractPlaylist(description: string | null | undefined): string {
  const m = (description ?? '').match(YOUTUBE)
  return m ? m[0].replace(/&amp;/g, '&') : ''
}

/**
 * Returns the description with its playlist link replaced by `url`, or by
 * "TBA" when `url` is empty. The link goes where the old one was, else after
 * the "YouTube Playlist link:" label, else on a new first line.
 */
export function writePlaylist(description: string, url: string): string {
  const html = isHtml(description)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const link = url.trim()
  const value = !link ? 'TBA' : html ? `<a href="${esc(link)}">${esc(link)}</a>` : link

  if (html && YOUTUBE_ANCHOR.test(description)) return description.replace(YOUTUBE_ANCHOR, () => value)
  if (YOUTUBE.test(description)) return description.replace(YOUTUBE, () => value)
  if (LABEL.test(description)) return description.replace(LABEL, (_, label: string) => `${label} ${value}`)
  const line = `YouTube Playlist link: ${value}`
  return description ? `${line}${html ? '<br>' : '\n'}${description}` : line
}

/** Fields that changed, in the same shape as lineup changes, for the changelog. */
export function diffInfo(before: WeekInfo, after: WeekInfo): LineupChange[] {
  const changes: LineupChange[] = []
  if (before.theme.trim() !== after.theme.trim()) changes.push({ label: 'Theme', from: before.theme.trim(), to: after.theme.trim() })
  if (before.playlist.trim() !== after.playlist.trim()) {
    changes.push({ label: 'Playlist', from: before.playlist.trim(), to: after.playlist.trim() })
  }
  return changes
}
