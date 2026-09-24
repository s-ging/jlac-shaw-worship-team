import { dev } from '$app/environment'
import { error } from '@sveltejs/kit'

// Local-only: a sandbox for the lineup and RSVP UI with fake people and no sign-in.
export const ssr = false

export function load() {
  if (!dev) throw error(404, 'Not found')
}
