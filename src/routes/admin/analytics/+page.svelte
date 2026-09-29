<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Dashboard from '$lib/components/analytics/Dashboard.svelte'
  import type { Range } from '$lib/analytics'

  let { data } = $props()

  // The range lives in the URL, so a view can be shared or reloaded as it is.
  function chooseRange(range: Range) {
    const url = new URL(page.url)
    if (range === 'month') url.searchParams.delete('range')
    else url.searchParams.set('range', range)
    goto(url, { replaceState: true, noScroll: true, keepFocus: true })
  }
</script>

<svelte:head><title>Analytics · Praise Team Scheduler</title></svelte:head>

<Dashboard results={data.results} range={data.range} problem={data.problem} onrange={chooseRange} />
