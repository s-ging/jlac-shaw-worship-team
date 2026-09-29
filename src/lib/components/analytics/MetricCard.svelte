<script lang="ts">
  import InfoTip from '$lib/components/InfoTip.svelte'
  import type { Metric, MetricResult } from '$lib/analytics'

  /**
   * One dashboard card. What it shows follows `metric.kind`: the hero's big
   * number over one bar per Sunday, a stat's number, or a ranked bar list.
   * Without a result it says so, and never draws placeholder numbers.
   */
  let { metric, result }: { metric: Metric; result?: MetricResult } = $props()

  const rows = $derived(result?.rows ?? [])
  const max = $derived(result?.max ?? Math.max(0, ...rows.map((r) => r.value)))
  const hasNumber = $derived(Boolean(result?.value))
  const showsBars = $derived(metric.kind !== 'stat')
</script>

<section class="card {metric.kind}">
  <header>
    <h2>{metric.title}</h2>
    <InfoTip label="About {metric.title}">
      <p>{metric.question}</p>
      <p class="source">From: {metric.source}</p>
    </InfoTip>
  </header>

  {#if metric.kind !== 'bars'}
    <p class="value" class:empty={!hasNumber}>{result?.value ?? '—'}</p>
    <p class="caption">{result?.caption ?? 'Not measured yet'}</p>
  {/if}

  {#if showsBars}
    {#if rows.length}
      <ul class="bars">
        {#each rows as row, i (i)}
          {#if row.group && row.group !== rows[i - 1]?.group}
            <li class="group">{row.group}</li>
          {/if}
          <li>
            <span class="label">{row.label}</span>
            <span class="track">
              <span class="bar" style:width="{max ? Math.min(row.value / max, 1) * 100 : 0}%"></span>
            </span>
            <span class="num">{row.display}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <div class="empty-plot">
        <span>
          {#if metric.kind === 'bars'}{result?.caption ?? 'Not measured yet'}{:else}Each Sunday will show here{/if}
        </span>
      </div>
    {/if}
  {/if}
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    padding: 16px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    min-height: 24px;
  }

  h2 {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .hero h2 {
    font-size: 15px;
    color: var(--color-text);
  }

  .value {
    font-size: 30px;
    font-weight: 600;
    line-height: 1.1;
    color: var(--color-text);
  }

  .hero .value {
    font-size: 52px;
  }

  .value.empty {
    color: var(--color-text-muted);
  }

  .caption {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .hero .caption {
    margin-bottom: 8px;
  }

  /* Inside the ⓘ bubble. */
  .source {
    margin-top: 6px;
    color: var(--color-text-secondary);
  }

  .bars {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }

  li {
    display: grid;
    grid-template-columns: minmax(64px, 30%) 1fr auto;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  li.group {
    display: block;
    margin-top: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  li.group:first-child {
    margin-top: 0;
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track {
    height: 10px;
  }

  .bar {
    display: block;
    height: 100%;
    min-width: 2px;
    background: var(--color-primary);
    border-radius: 0 4px 4px 0;
  }

  .num {
    font-variant-numeric: tabular-nums;
    color: var(--color-text-secondary);
  }

  .empty-plot {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 120px;
    margin-top: 6px;
    font-size: 13px;
    color: var(--color-text-muted);
    border: 1px dashed var(--color-border);
    border-radius: 8px;
  }
</style>
