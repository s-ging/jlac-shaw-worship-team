import { toPublicUser } from '$lib/server/kv'
import type { LayoutServerLoad } from './$types'

/** Resolved in hooks.server.ts, so the first paint already knows who you are. */
export const load: LayoutServerLoad = ({ locals }) => {
  return { user: locals.user ? toPublicUser(locals.user) : null }
}
