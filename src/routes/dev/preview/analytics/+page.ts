import { dev } from '$app/environment'
import { error } from '@sveltejs/kit'

// Local-only: the Analytics dashboard with no sign-in.
export const ssr = false

export function load() {
  if (!dev) throw error(404, 'Not found')
}
