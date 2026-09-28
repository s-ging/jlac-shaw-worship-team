/**
 * The team's mailer: a Google Apps Script project, deployed as the team's
 * Google account (jlacshawmedia01@gmail.com), so mail comes from that inbox.
 * The app decides who gets what; this holds the wording and does the sending.
 *
 *   welcome   pushed by the app (doPost) when an account is created
 *   digest    pulled from the app every 15 minutes (sendDigests): one email
 *             per person covering every Sunday they were put on
 *
 * The app does the holding back (see src/lib/server/notify.ts): a digest is
 * only due once edits have settled, never repeats a part, is capped per person
 * per day and waits for daytime. This side also stops short of Gmail's daily
 * quota.
 *
 * Script Properties:
 *   MAILER_SECRET  shared with the app. Without it anyone who found the URL
 *                  could send mail as the team.
 *   APP_URL        optional; defaults to the constant below.
 *
 * Setup is in the README ("Email").
 */

const DEFAULT_APP_URL = 'https://jlac.workweek.dev'
const FROM_NAME = 'JLAC Shaw Praise Team'
/** Gmail allows ~100 emails a day. Keep a few for welcomes. */
const QUOTA_RESERVE = 5

const prop = (name) => PropertiesService.getScriptProperties().getProperty(name)
const appUrl = () => (prop('APP_URL') || DEFAULT_APP_URL).replace(/\/$/, '')

// ---- Welcome (pushed) ----

function doPost(e) {
  let body
  try {
    body = JSON.parse(e.postData.contents)
  } catch (err) {
    return reply({ ok: false, error: 'Expected a JSON body' })
  }

  const secret = prop('MAILER_SECRET')
  if (!secret || body.secret !== secret) return reply({ ok: false, error: 'Wrong secret' })
  if (body.kind !== 'welcome') return reply({ ok: false, error: 'Unknown kind: ' + body.kind })

  try {
    sendWelcome(body)
    return reply({ ok: true })
  } catch (err) {
    console.error(err)
    return reply({ ok: false, error: String(err) })
  }
}

/** Apps Script can't set a status code, so success or failure travels in the body. */
function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON)
}

/**
 * { to, name, password? }. `password` is only sent while they're still on the
 * one someone else chose; the app makes them replace it on first sign-in.
 */
function sendWelcome(m) {
  const signIn = m.password
    ? `<p style="margin:0 0 4px">Email: <b>${esc(m.to)}</b></p>
       <p style="margin:0 0 16px">Password: <b style="font-family:monospace;font-size:15px">${esc(m.password)}</b></p>
       <p>You'll choose your own password the first time you sign in.</p>`
    : `<p>Sign in with <b>${esc(m.to)}</b> and the password you chose.</p>`

  send(m.to, 'Your Praise Team Scheduler account', `
    <p>Hi ${esc(m.name)},</p>
    <p>The team's schedule, lineups and RSVPs now live in one place:</p>
    ${button(appUrl(), 'Open the Praise Team Scheduler')}
    ${signIn}
    <p>When you're put on a Sunday lineup, you'll see it under 🔔 in the app and get one email about it.</p>`)
}

// ---- Digests (pulled) ----

/** Runs every 15 minutes (see installTrigger). Asks the app what's due, sends it, and reports each one back. */
function sendDigests() {
  const headers = { authorization: 'Bearer ' + prop('MAILER_SECRET') }
  const res = UrlFetchApp.fetch(appUrl() + '/api/mailer/digests', { headers: headers, muteHttpExceptions: true })
  if (res.getResponseCode() !== 200) {
    console.error('Could not fetch digests', res.getResponseCode(), res.getContentText().slice(0, 300))
    return
  }

  const digests = JSON.parse(res.getContentText()).digests
  for (const d of digests) {
    if (MailApp.getRemainingDailyQuota() <= QUOTA_RESERVE) {
      console.warn('Near the Gmail daily limit; the rest go out tomorrow.')
      return
    }
    sendDigest(d)
    // If this report fails, the same digest comes back next run. Rare, and
    // better than silently dropping it.
    const done = UrlFetchApp.fetch(appUrl() + '/api/mailer/digests', {
      method: 'post',
      contentType: 'application/json',
      headers: headers,
      payload: JSON.stringify({ to: d.to, weeks: d.weeks.map((w) => ({ date: w.date, parts: w.parts })) }),
      muteHttpExceptions: true
    })
    if (done.getResponseCode() !== 200) console.error('Could not report digest for', d.to, done.getContentText().slice(0, 300))
  }
}

/**
 * { to, name, weeks: [{ date, dateLabel, parts, by, theme, playlist,
 *   vocalists: [{ part, name }], instrumentalists: [...], media }] }
 */
function sendDigest(d) {
  const weeks = d.weeks
  const subject =
    weeks.length === 1
      ? `You're on for ${weeks[0].dateLabel}: ${joinNames(weeks[0].parts)}`
      : `You're on ${weeks.length} Sundays: ${joinNames(weeks.map((w) => w.dateLabel.replace(/^\w+, /, '')))}`

  const rows = (entries) =>
    entries.map((e) => `<tr><td style="padding:2px 16px 2px 0;color:#666">${esc(e.part)}</td><td>${esc(e.name)}</td></tr>`).join('')
  const section = (title, body) =>
    body ? `<p style="margin:10px 0 2px;font-weight:bold;font-size:13px">${title}</p><table cellpadding="0" cellspacing="0" style="font-size:13px">${body}</table>` : ''

  const blocks = weeks.map((w) => `
    <div style="border:1px solid #e5e5e5;border-radius:10px;padding:14px 16px;margin:14px 0">
      <p style="margin:0 0 2px;font-size:16px"><b>${esc(w.dateLabel)}</b></p>
      <p style="margin:0 0 8px">You: <b style="color:#2563eb">${esc(joinNames(w.parts))}</b> <span style="color:#888">· from ${esc(w.by)}</span></p>
      ${w.theme ? `<p style="margin:0 0 4px">Theme: ${esc(w.theme)}</p>` : ''}
      ${w.playlist ? `<p style="margin:0 0 4px"><a href="${esc(w.playlist)}">YouTube playlist</a></p>` : ''}
      ${section('Vocalists', rows(w.vocalists))}
      ${section('Instrumentalists', rows(w.instrumentalists))}
      ${section('Media', w.media ? `<tr><td>${esc(w.media)}</td></tr>` : '')}
      ${button(appUrl() + '/?week=' + w.date, 'Open this week and RSVP')}
    </div>`).join('')

  send(d.to, subject, `
    <p>Hi ${esc(d.name)},</p>
    <p>You've been put on ${weeks.length === 1 ? 'a Sunday lineup' : 'these Sunday lineups'}. Please RSVP so the team knows whether you can make it.</p>
    ${blocks}
    <p style="color:#888;font-size:12px">Too many emails? Turn them off under <a href="${appUrl()}/me" style="color:#888">Me</a>. You'll still see them under 🔔 in the app.</p>`)
}

/** Run once from the editor. Safe to rerun: it replaces any earlier trigger. */
function installTrigger() {
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === 'sendDigests') ScriptApp.deleteTrigger(t)
  }
  ScriptApp.newTrigger('sendDigests').timeBased().everyMinutes(15).create()
}

// ---- Shared ----

function send(to, subject, html) {
  MailApp.sendEmail({
    to: to,
    subject: subject,
    name: FROM_NAME,
    htmlBody: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222;max-width:520px">${html}
      <p style="margin-top:24px;color:#888;font-size:12px">${esc(FROM_NAME)} · <a href="${appUrl()}" style="color:#888">${appUrl().replace('https://', '')}</a></p></div>`
  })
}

function button(href, text) {
  return `<p style="margin:14px 0 0"><a href="${esc(href)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">${esc(text)}</a></p>`
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** ["Drums", "Media"] → "Drums and Media". */
function joinNames(names) {
  if (names.length <= 1) return names[0] || ''
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
}

/**
 * Run from the editor once after pasting this in: it asks for permission, then
 * sends a welcome and a two-Sunday digest to the team account so you can see them.
 */
function sendTestEmails() {
  const me = Session.getEffectiveUser().getEmail()
  sendWelcome({ to: me, name: 'Tester', password: 'starting-password' })
  const week = (date, dateLabel, parts) => ({
    date: date,
    dateLabel: dateLabel,
    parts: parts,
    by: 'Kevin',
    theme: '"Called to Reap Souls" (Matt. 9:35-38)',
    playlist: '',
    vocalists: [{ part: 'Praise Leader', name: 'Jean' }, { part: 'Second Praise Leader', name: 'Ezra' }],
    instrumentalists: [{ part: 'Drums', name: 'Mark' }, { part: 'Bass', name: 'Tester' }],
    media: 'Sam and Chan'
  })
  sendDigest({
    to: me,
    name: 'Tester',
    weeks: [week('2026-10-04', 'Sunday, October 4', ['Bass']), week('2026-10-18', 'Sunday, October 18', ['Bass', 'Media'])]
  })
}
