#!/usr/bin/env node
/**
 * One-time setup for calendar editing. Signs in as the team's calendar account,
 * gets a long-lived refresh token, and stores it where the app looks for it.
 *
 * Usage: npm run google:auth
 *
 * Prerequisites:
 *   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (the OAuth client from
 *     Google Cloud console). For a "Web application" client, add
 *     http://localhost:53682/callback to its Authorized redirect URIs.
 *   - The calendar shared with the account below, with "Make changes to events".
 *   - The OAuth consent screen PUBLISHED ("In production"). While it is still in
 *     "Testing", Google expires refresh tokens after 7 days and editing breaks
 *     every week. Publishing without verification is fine here: only this one
 *     account ever signs in, and it just clicks through the "unverified app"
 *     warning once.
 *
 * What it writes:
 *   - GOOGLE_REFRESH_TOKEN into .env, for `npm run dev`
 *   - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN as
 *     production secrets on the Pages project. These apply from the next
 *     deploy, so push (or redeploy) afterwards.
 *
 * Rerun it any time editing reports that the refresh token was revoked.
 */
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const ACCOUNT = 'jlacshawmedia01@gmail.com'
const PROJECT = 'jlac-shaw-worship-team'
const CALENDAR_ID = '9a716d356291248887be20bd495e2f774cf2f47953825b06787fe831744e3709@group.calendar.google.com'
const PORT = 53682
const REDIRECT_URI = `http://localhost:${PORT}/callback`
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = process.env
if (!clientId || !clientSecret) {
  console.error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env first.')
  process.exit(1)
}

const state = randomBytes(16).toString('hex')
const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent', // forces Google to issue a refresh token even on a repeat sign-in
    login_hint: ACCOUNT,
    state
  })

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
  } catch {
    // The URL is printed too.
  }
}

/** Waits for Google to redirect back with the authorization code. */
function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const finish = (message, result) => {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(message)
        server.close()
        result instanceof Error ? reject(result) : resolve(result)
      }
      if (url.searchParams.get('state') !== state) return finish('State mismatch. Rerun the script.', new Error('state mismatch'))
      const err = url.searchParams.get('error')
      if (err) return finish(`Google said: ${err}. You can close this tab.`, new Error(err))
      finish('Signed in. You can close this tab and return to the terminal.', url.searchParams.get('code'))
    })
    server.on('error', reject)
    server.listen(PORT)
  })
}

console.log(`\nSign in as ${ACCOUNT} in the browser window that just opened.`)
console.log(`If it didn't open, visit:\n\n  ${authUrl}\n`)
console.log(`If Google shows "redirect_uri_mismatch", add ${REDIRECT_URI} to the OAuth client's`)
console.log('Authorized redirect URIs in Google Cloud console, then rerun.\n')
openBrowser(authUrl)

const code = await waitForCode()

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code'
  })
})
const tokens = await tokenRes.json()
if (!tokenRes.ok || !tokens.refresh_token) {
  console.error('Token exchange failed:', tokens.error_description ?? tokens.error ?? 'no refresh token returned')
  process.exit(1)
}

// Confirm the account can actually edit the calendar before storing anything.
const calRes = await fetch(
  `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(CALENDAR_ID)}`,
  { headers: { authorization: `Bearer ${tokens.access_token}` } }
)
const cal = calRes.ok ? await calRes.json() : null
if (cal && !['writer', 'owner'].includes(cal.accessRole)) {
  console.error(`This account only has "${cal.accessRole}" access to the calendar.`)
  console.error('Share the calendar with it using "Make changes to events", then rerun.')
  process.exit(1)
}
console.log(cal ? `Calendar access confirmed: ${cal.accessRole}.` : 'Could not confirm calendar access; if edits fail, check the calendar is shared with this account.')

// Local dev: keep .env's other lines as they are, replace or add the token line.
const envFile = existsSync('.env') ? readFileSync('.env', 'utf8') : ''
const line = `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
const updated = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(envFile)
  ? envFile.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line)
  : `${envFile.replace(/\s*$/, '')}\n${line}\n`
writeFileSync('.env', updated)
console.log('Saved GOOGLE_REFRESH_TOKEN to .env for local dev.')

// Production: Pages secrets, passed on stdin so they never appear in a process listing.
for (const [name, value] of [
  ['GOOGLE_CLIENT_ID', clientId],
  ['GOOGLE_CLIENT_SECRET', clientSecret],
  ['GOOGLE_REFRESH_TOKEN', tokens.refresh_token]
]) {
  execFileSync('npx', ['wrangler', 'pages', 'secret', 'put', name, '--project-name', PROJECT], {
    input: value,
    stdio: ['pipe', 'ignore', 'inherit'],
    shell: process.platform === 'win32'
  })
  console.log(`Set ${name} on the ${PROJECT} Pages project.`)
}

console.log('\nDone. The secrets take effect on the next deploy.')
