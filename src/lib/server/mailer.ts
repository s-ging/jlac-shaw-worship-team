import type { UserRecord, WelcomeCandidate } from '$lib/types'
import { verifyPassword } from './crypto'
import { normalizeEmail } from './kv'

type Env = App.Platform['env']

/**
 * Email, sent by the Apps Script web app in apps-script/Mailer.gs as the team's
 * Google account. The script holds the wording.
 *
 * Two ways mail goes out:
 * - Welcomes are pushed from here: the moment an account is created, and from
 *   the team send on /admin for everyone who hasn't had one.
 * - Assignment emails are pulled: the script asks /api/mailer/digests every 15
 *   minutes for what's due ($lib/server/notify), which is what lets them be
 *   batched and capped.
 *
 * Mail is best effort. A failure is logged, never reported: the save it
 * follows has already happened.
 */

export interface WelcomeMail {
  kind: 'welcome'
  to: string
  name: string
  /** Only while they're still on a password someone else chose. */
  password?: string
}

/** What an email calls someone: "Hi Chan". */
export const greetingName = (user: Pick<UserRecord, 'name' | 'nickname'>) => user.nickname || user.name.split(' ')[0]

/** Sends one email. True if the script says it went out. */
async function post(env: Env, mail: WelcomeMail): Promise<boolean> {
  const { MAILER_URL, MAILER_SECRET } = env
  if (!MAILER_URL || !MAILER_SECRET) {
    console.warn(`Mailer not set up; skipped ${mail.kind} email to ${mail.to}`)
    return false
  }
  try {
    const res = await fetch(MAILER_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...mail, secret: MAILER_SECRET })
    })
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (res.ok && body?.ok) return true
    console.error(`Mailer refused ${mail.kind} email to ${mail.to}`, res.status, body?.error)
  } catch (err) {
    console.error(`Mailer unreachable for ${mail.kind} email to ${mail.to}`, err)
  }
  return false
}

// ---- Welcome ----

const welcomedKey = (email: string) => `welcomed:${normalizeEmail(email)}`

/** Sends a welcome and remembers it, so the team send on /admin skips them. */
async function welcome(env: Env, mail: Omit<WelcomeMail, 'kind'>): Promise<boolean> {
  const ok = await post(env, { kind: 'welcome', ...mail })
  if (ok) await env.NOTIFY_KV.put(welcomedKey(mail.to), new Date().toISOString())
  return ok
}

/** A new account's welcome, sent after the response. */
export function sendWelcome(platform: App.Platform | undefined, env: Env, mail: Omit<WelcomeMail, 'kind'>): Promise<void> {
  return afterResponse(platform, welcome(env, mail))
}

/**
 * Everyone active, with whether their welcome would carry the starting
 * password and whether they've had one. Checking the password is a hash per
 * person, which is fine for a team this size.
 */
export async function welcomeCandidates(env: Env, users: UserRecord[]): Promise<WelcomeCandidate[]> {
  const starting = env.STARTING_PASSWORD ?? ''
  const { keys } = await env.NOTIFY_KV.list({ prefix: 'welcomed:' })
  const welcomed = new Set(keys.map((k) => k.name.slice('welcomed:'.length)))
  const active = users.filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name))
  return Promise.all(
    active.map(async (u) => ({
      email: u.email,
      name: u.name,
      withPassword: Boolean(starting) && (await verifyPassword(starting, u.passwordHash)),
      welcomedAt: welcomed.has(u.email) ? ((await env.NOTIFY_KV.get(welcomedKey(u.email))) ?? null) : null
    }))
  )
}

/** Sends these welcomes a few at a time. Returns who got one and who didn't. */
export async function sendWelcomes(
  env: Env,
  users: UserRecord[],
  people: WelcomeCandidate[]
): Promise<{ sent: string[]; failed: string[] }> {
  const byEmail = new Map(users.map((u) => [u.email, u]))
  const sent: string[] = []
  const failed: string[] = []
  const queue = [...people]
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const user = byEmail.get(p.email)
      if (!user) continue
      const ok = await welcome(env, {
        to: p.email,
        name: greetingName(user),
        password: p.withPassword ? env.STARTING_PASSWORD : undefined
      })
      ;(ok ? sent : failed).push(p.email)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return { sent, failed }
}

/** Lets `work` finish after the response goes out. Outside the Workers runtime there's no waitUntil, so it waits instead. */
export async function afterResponse(platform: App.Platform | undefined, work: Promise<unknown>): Promise<void> {
  if (platform?.ctx) platform.ctx.waitUntil(work)
  else await work
}
