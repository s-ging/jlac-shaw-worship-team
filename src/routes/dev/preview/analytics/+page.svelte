<script lang="ts">
  import Dashboard from '$lib/components/analytics/Dashboard.svelte'
  import { fetchMonthEvents } from '$lib/google-calendar'
  import { computeAnalytics, rangeSpan, serviceWeeks } from '$lib/analytics-compute'
  import type { MetricResults, Range } from '$lib/analytics'
  import { loadRoster } from '../../roster'

  /**
   * `npm run dev`, then open /dev/preview/analytics. The lineup cards are
   * computed from the live calendar and scripts/roster.tsv, the same maths as
   * the real tab. RSVPs and the changelog live in the deployed KV only, so
   * their cards (the playlist, response, "no" rate, late changes) stay empty.
   */
  let range = $state<Range>('month')
  let results = $state<MetricResults>({})
  let problem = $state<string | undefined>()

  $effect(() => {
    const span = rangeSpan(range)
    // Each calendar month from the range's start to the coming Sunday.
    const months: [number, number][] = []
    let [year, month] = span.start.split('-').map(Number)
    const last = span.comingSunday.slice(0, 7)
    while (`${year}-${String(month).padStart(2, '0')}` <= last) {
      months.push([year, month])
      ;[year, month] = month === 12 ? [year + 1, 1] : [year, month + 1]
    }
    Promise.all([loadRoster(), ...months.map(([year, month]) => fetchMonthEvents(year, month))]).then(([users, ...events]) => {
      if (!users.length) problem = 'No scripts/roster.tsv, so nobody can be matched.'
      results = computeAnalytics({ span, weeks: serviceWeeks(events.flat()), users, rsvps: null, edits: null })
    })
  })
</script>

<Dashboard {results} {range} {problem} onrange={(r) => (range = r)} />
