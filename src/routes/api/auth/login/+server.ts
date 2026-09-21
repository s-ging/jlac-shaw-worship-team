import { error, json } from '@sveltejs/kit'
import { generateToken, verifyPassword } from '$lib/server/crypto'
import { getUser, newSession, putSession, toPublicUser } from '$lib/server/kv'
import { requireEnv } from '$lib/server/platform'
import { setSessionCookie } from '$lib/server/auth'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async (event) => {
  const env = requireEnv(event.platform)

  let body: { email?: unknown; password?: unknown }
  try {
    body = await event.request.json()
  } catch {
    throw error(400, 'Expected a JSON body')
  }

  const email = typeof body.email === 'string' ? body.email : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) throw error(400, 'Email and password are required')

  const user = await getUser(env, email)

  // One message for every failure mode. Distinguishing "no such user" from
  // "wrong password" would let anyone enumerate who is on the team.
  const invalid = () => error(401, 'Incorrect email or password')
  if (!user || !user.active) throw invalid()
  if (!(await verifyPassword(password, user.passwordHash))) throw invalid()

  const token = generateToken()
  await putSession(env, {
    ...newSession(user.email, event.request.headers.get('user-agent') ?? undefined),
    token
  })
  setSessionCookie(event.cookies, token)

  return json({ user: toPublicUser(user) })
}
