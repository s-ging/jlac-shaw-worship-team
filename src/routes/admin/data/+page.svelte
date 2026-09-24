<script lang="ts">
  import { NAMESPACE_INFO } from '$lib/kv-namespaces'

  let { data } = $props()
</script>

<svelte:head><title>Data · Praise Team Scheduler</title></svelte:head>

<div class="page">
  <a class="back" href="/admin">← People</a>
  <h1>Data</h1>
  <p class="hint">The raw records behind the app. Edits here skip the People page's checks, so prefer that for day-to-day changes.</p>

  <ul class="tables">
    {#each data.namespaces as table (table.ns)}
      {@const info = NAMESPACE_INFO[table.ns]}
      <li>
        <a class="card" href="/admin/data/{table.ns}">
          <span class="who">
            <span class="name">{info.label}</span>
            <span class="sub"><code>{table.ns}</code> · {info.hint}</span>
          </span>
          <span class="count">{table.count}{table.more ? '+' : ''}</span>
        </a>
      </li>
    {/each}
  </ul>
</div>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: 20px 16px 48px;
  }

  .back {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: 14px;
    color: var(--color-primary);
    text-decoration: none;
  }

  h1 {
    font-size: 22px;
  }

  .hint {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 4px 0 16px;
  }

  .tables {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 60px;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 12px 14px;
    color: inherit;
    text-decoration: none;
  }

  .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .name {
    font-weight: 600;
    font-size: 15px;
  }

  .sub {
    font-size: 13px;
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }

  .count {
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
