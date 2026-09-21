import { json } from '@sveltejs/kit'
import { requireAuth } from '$lib/server/auth'
import { toPublicUser } from '$lib/server/kv'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = (event) => {
  return json({ user: toPublicUser(requireAuth(event)) })
}
