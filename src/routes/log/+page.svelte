<script lang="ts">
  import { DISPLAY_TIMEZONE } from '$lib/config'
  import type { LogEntry } from '$lib/types'

  let { data } = $props()

  const dayFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TIMEZONE,
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })
  const timeFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit'
  })

  /** Entries arrive newest first; group consecutive ones by day. */
  const days = $derived.by(() => {
    const groups: { day: string; entries: LogEntry[] }[] = []
    for (const entry of data.entries) {
      const day = dayFormat.format(new Date(entry.at))
      const last = groups.at(-1)
      if (last?.day === day) last.entries.push(entry)
      else groups.push({ day, entries: [entry] })
    }
    return groups
  })
</script>

<svelte:head><title>Changelog · Praise Team Scheduler</title></svelte:head>

<div class="page">
  <h1>Changelog</h1>
  {#if days.length === 0}
    <p class="empty">Nothing has changed yet.</p>
  {/if}

  {#each days as group (group.day)}
    <section>
      <h2>{group.day}</h2>
      <ul>
        {#each group.entries as entry (entry.id)}
          <li>
            <span class="time">{timeFormat.format(new Date(entry.at))}</span>
            <span class="text"><strong>{entry.actorName}</strong> {entry.summary}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: 20px 16px 48px;
  }

  h1 {
    font-size: 22px;
  }

  .hint,
  .empty {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 4px 0 18px;
  }

  h2 {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
    margin: 18px 0 6px;
  }

  ul {
    list-style: none;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
  }

  li {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 8px;
    padding: 10px 12px;
    font-size: 14px;
    line-height: 1.4;
    border-bottom: 1px solid #f0f0f0;
  }

  li:last-child {
    border-bottom: none;
  }

  .time {
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .text {
    overflow-wrap: anywhere;
  }
</style>
