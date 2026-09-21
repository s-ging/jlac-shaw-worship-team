import type { Handle } from '@sveltejs/kit'
import { resolveUser } from '$lib/server/auth'

/**
 * Resolves the session once per request and hangs the user off `locals`, so
 * both server loads and endpoints see the same answer. Doing it here means the
 * page renders already knowing who you are — no logged-out flash on first paint.
 */
export const handle: Handle = async ({ event, resolve }) => {
  // Bindings are absent for prerendering and for static asset requests; those
  // simply have no user rather than failing the request.
  try {
    event.locals.user = (await resolveUser(event)) ?? null
  } catch {
    event.locals.user = null
  }

  return resolve(event)
}
