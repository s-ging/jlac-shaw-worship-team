import { json } from '@sveltejs/kit'
import { deleteSession } from '$lib/server/kv'
import { requireEnv } from '$lib/server/platform'
import { clearSessionCookie, SESSION_COOKIE } from '$lib/server/auth'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async (event) => {
  const token = event.cookies.get(SESSION_COOKIE)
  if (token) {
    await deleteSession(requireEnv(event.platform), token)
  }
  clearSessionCookie(event.cookies)
  return json({ ok: true })
}
