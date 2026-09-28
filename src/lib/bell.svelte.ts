/**
 * The bell's unread count, shared by the header badge and the notifications
 * page. Fetched when the app opens and when it comes back to the foreground,
 * at most every few minutes, rather than on every navigation.
 */
export const bell = $state({ unread: 0 })

const EVERY_MS = 5 * 60_000
let checkedAt = 0

export async function refreshBell(force = false): Promise<void> {
  if (!force && Date.now() - checkedAt < EVERY_MS) return
  checkedAt = Date.now()
  try {
    const res = await fetch('/api/notifications')
    if (res.ok) bell.unread = ((await res.json()) as { unread: number }).unread
  } catch {
    // Offline: keep the last count.
  }
}

/** Opening the notifications page reads everything in it. */
export function clearBell(): void {
  bell.unread = 0
  checkedAt = Date.now()
}
