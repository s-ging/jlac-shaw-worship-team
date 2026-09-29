<script lang="ts">
  import Segmented from '$lib/components/Segmented.svelte'
  import MetricCard from './MetricCard.svelte'
  import { METRICS, RANGES, type MetricResults, type Range } from '$lib/analytics'

  /** The Analytics tab: the range filter over the hero, the stats and the bar cards. */
  let {
    results,
    range,
    onrange,
    problem
  }: { results: MetricResults; range: Range; onrange: (range: Range) => void; problem?: string } = $props()

  const hero = METRICS.filter((m) => m.kind === 'hero')
  const stats = METRICS.filter((m) => m.kind === 'stat')
  const bars = METRICS.filter((m) => m.kind === 'bars')
</script>

<div class="page">
  <div class="heading">
    <h1>Analytics</h1>
    <div class="range">
      <Segmented options={RANGES} value={range} label="Range" onchange={onrange} />
    </div>
  </div>

  {#if problem}<p class="problem" role="alert">{problem}</p>{/if}

  <div class="dashboard">
    <div class="lead">
      {#each hero as metric (metric.key)}
        <MetricCard {metric} result={results[metric.key]} />
      {/each}
      <div class="stats">
        {#each stats as metric (metric.key)}
          <MetricCard {metric} result={results[metric.key]} />
        {/each}
      </div>
    </div>

    <div class="grid">
      {#each bars as metric (metric.key)}
        <MetricCard {metric} result={results[metric.key]} />
      {/each}
    </div>
  </div>
</div>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: 20px 16px 48px;
  }

  .heading {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  h1 {
    font-size: 22px;
  }

  .problem {
    margin-bottom: 16px;
    padding: 10px 12px;
    font-size: 14px;
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border: 1px solid var(--color-danger-border);
    border-radius: var(--radius);
  }

  .range {
    flex: 1 1 280px;
    max-width: 360px;
  }

  .dashboard,
  .lead,
  .grid {
    display: grid;
    gap: 12px;
  }

  /* Phones: the three stats in a row would crush the numbers. */
  .stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  /* An odd one out takes the whole row rather than leaving a hole. */
  .stats > :global(:last-child:nth-child(odd)) {
    grid-column: 1 / -1;
  }

  @media (min-width: 640px) {
    .stats {
      grid-template-columns: repeat(3, 1fr);
    }

    .stats > :global(:last-child:nth-child(odd)) {
      grid-column: auto;
    }

    .grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  /* PC: the hero beside a column of stats, then the bars three across. */
  @media (min-width: 900px) {
    .page {
      max-width: 1120px;
      padding: 28px 24px 64px;
    }

    .lead {
      grid-template-columns: 3fr 2fr;
    }

    .stats {
      grid-template-columns: 1fr;
    }

    .grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
