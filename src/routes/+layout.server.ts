import { redirect } from '@sveltejs/kit'
import { toPublicUser } from '$lib/server/kv'
import type { LayoutServerLoad } from './$types'

/** Resolved in hooks.server.ts, so the first paint already knows who you are. */
export const load: LayoutServerLoad = ({ locals, url }) => {
  // Someone else chose this password (the shared starting one, or a reset).
  // Nothing else in the app until they pick their own.
  if (locals.user?.mustChangePassword && url.pathname !== '/me') throw redirect(303, '/me')

  return { user: locals.user ? toPublicUser(locals.user) : null }
}
