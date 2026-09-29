import type { MetricResults, Range } from '$lib/analytics'
import { computeAnalytics, rangeSpan, serviceWeeks } from '$lib/analytics-compute'
import { listEvents } from '$lib/server/google'
import { listUsers, listRsvpsForWeek, toPublicUser } from '$lib/server/kv'
import { listLineupEdits } from '$lib/server/log'

type Env = App.Platform['env']

/** A playlist or lineup edit for a Sunday in range can come this long before it. */
const LEAD_TIME_DAYS = 60

/**
 * Gathers the lineups (Google Calendar), the team, the RSVPs and the logged
 * lineup edits over `range`, and runs $lib/analytics-compute over them.
 * `problem` says why nothing could be shown, if something failed.
 */
export async function loadAnalytics(env: Env, range: Range): Promise<{ results: MetricResults; problem?: string }> {
  const span = rangeSpan(range)
  try {
    const [events, users, edits] = await Promise.all([
      listEvents(env, `${span.start}T00:00:00+08:00`, `${span.comingSunday}T23:59:59+08:00`),
      listUsers(env).then((all) => all.map(toPublicUser)),
      listLineupEdits(env, new Date(Date.parse(`${span.start}T00:00:00+08:00`) - LEAD_TIME_DAYS * 86_400_000).toISOString())
    ])
    const weeks = serviceWeeks(events)
    const past = weeks.filter((w) => w.date >= span.start && w.date <= span.today)
    const rsvps = Object.fromEntries(await Promise.all(past.map(async (w) => [w.date, await listRsvpsForWeek(env, w.date)] as const)))
    return { results: computeAnalytics({ span, weeks, users, rsvps, edits }) }
  } catch (err) {
    console.error('Analytics failed', err)
    const status = (err as { status?: number })?.status
    return {
      results: {},
      problem:
        status === 503
          ? "Analytics reads the calendar through the team's Google account, which is not set up here."
          : "Could not read the calendar or the team's data just now. Try again in a moment."
    }
  }
}
