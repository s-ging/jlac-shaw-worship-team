<script lang="ts">
  import { goto } from '$app/navigation'
  import RecordEditor from '$lib/components/admin/RecordEditor.svelte'
  import { formatExpiration, NAMESPACE_INFO } from '$lib/kv-namespaces'

  let { data } = $props()

  const info = $derived(NAMESPACE_INFO[data.ns])
  const hasSecrets = $derived(data.ns === 'USERS_KV' || data.ns === 'SESSIONS_KV')

  // Reset whenever a search loads a new first page; "Load more" appends.
  let rows = $derived(data.rows)
  let cursor = $derived(data.cursor)

  let creating = $state(false)
  let includeSecrets = $state(false)
  let loadingMore = $state(false)
  let error = $state<string | null>(null)

  const recordHref = (ref: string) => `/admin/data/${data.ns}/record?key=${encodeURIComponent(ref)}`

  async function loadMore() {
    if (!cursor || loadingMore) return
    loadingMore = true
    error = null
    try {
      const params = new URLSearchParams({ prefix: data.prefix, cursor })
      const res = await fetch(`/api/admin/kv/${data.ns}?${params}`)
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        error = body?.message ?? 'Could not load more. Please try again.'
        return
      }
      rows = [...rows, ...body.rows]
      cursor = body.cursor
    } catch {
      error = 'Network error. Check your connection and try again.'
    } finally {
      loadingMore = false
    }
  }
</script>

<svelte:head><title>{info.label} · Data · Praise Team Scheduler</title></svelte:head>

<div class="page">
  <a class="back" href="/admin/data">← Data</a>
  <div class="heading">
    <h1>{info.label} <code>{data.ns}</code></h1>
    {#if !info.readOnly && !creating}
      <button class="add" onclick={() => (creating = true)}>+ New</button>
    {/if}
  </div>

  {#if creating}
    <section class="card">
      <h2>New record</h2>
      {#if data.ns === 'USERS_KV'}
        <p class="hint">To add a person, use the People page: it sets their password for you.</p>
      {/if}
      <RecordEditor
        ns={data.ns}
        keyPrefix={info.prefix}
        onSaved={(ref) => goto(recordHref(ref))}
        onCancel={() => (creating = false)}
      />
    </section>
  {/if}

  <form class="search" method="GET" data-sveltekit-keepfocus>
    <input
      name="prefix"
      value={data.prefix}
      placeholder="Key starts with… e.g. {info.prefix}"
      aria-label="Key prefix"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
    <button type="submit">Search</button>
  </form>
  {#if data.prefix}
    <p class="hint">Keys starting with <code>{data.prefix}</code> · <a href="/admin/data/{data.ns}">clear</a></p>
  {/if}

  {#if rows.length === 0}
    <p class="empty">No keys{data.prefix ? ' with that prefix' : ''}.</p>
  {/if}

  <ul class="rows">
    {#each rows as row (row.ref)}
      <li>
        <a class="card row" href={recordHref(row.ref)}>
          <span class="title">{row.title}</span>
          <code class="key">{row.key}</code>
          {#if row.fields.length || row.expiration || row.metadata}
            <dl>
              {#each row.fields as field (field.label)}
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              {/each}
              {#if row.expiration}
                <dt>Expires</dt>
                <dd>{formatExpiration(row.expiration)}</dd>
              {/if}
              {#if row.metadata}
                <dt>Metadata</dt>
                <dd><code>{row.metadata}</code></dd>
              {/if}
            </dl>
          {/if}
        </a>
      </li>
    {/each}
  </ul>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if cursor}
    <button class="more" onclick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</button>
  {/if}

  <section class="card export">
    <h2>Export</h2>
    <p class="hint">Every record in {data.ns} as a JSON file, for a backup.</p>
    {#if hasSecrets}
      <label class="choice">
        <input type="checkbox" bind:checked={includeSecrets} />
        <span>Include secrets (password hashes, session tokens)</span>
      </label>
    {/if}
    <a class="download" href="/api/admin/kv/{data.ns}/export{includeSecrets ? '?secrets=1' : ''}" download>
      Download JSON
    </a>
  </section>
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

  .heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  h1 {
    font-size: 22px;
  }

  h1 code {
    font-size: 13px;
    font-weight: 400;
    color: var(--color-text-secondary);
  }

  h2 {
    font-size: 16px;
  }

  .add {
    font-size: 14px;
    font-weight: 600;
    color: white;
    background: var(--color-primary);
    border: none;
    border-radius: var(--radius);
    padding: 10px 14px;
    min-height: 44px;
    flex-shrink: 0;
  }

  .card {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 12px 14px;
  }

  section.card {
    margin-bottom: 12px;
  }

  .hint,
  .empty {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 4px 0 10px;
    overflow-wrap: anywhere;
  }

  .search {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .search input {
    flex: 1;
    min-width: 0;
    font-size: 16px; /* 16px stops iOS Safari zooming on focus */
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: white;
  }

  .search button,
  .more {
    font-size: 14px;
    font-weight: 600;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 8px 14px;
    min-height: 44px;
  }

  .rows {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: inherit;
    text-decoration: none;
  }

  .title {
    font-weight: 600;
    font-size: 15px;
    overflow-wrap: anywhere;
  }

  .key {
    font-size: 12px;
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    margin-top: 6px;
    font-size: 13px;
  }

  dt {
    color: var(--color-text-secondary);
  }

  dd {
    overflow-wrap: anywhere;
  }

  .more {
    width: 100%;
    margin-top: 12px;
  }

  .error {
    font-size: 14px;
    color: #b42318;
    background: #fef3f2;
    border: 1px solid #fecdca;
    border-radius: var(--radius);
    padding: 10px 12px;
    margin-top: 12px;
  }

  .export {
    margin-top: 24px;
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    min-height: 44px;
  }

  .choice input {
    width: 18px;
    height: 18px;
  }

  .download {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    text-decoration: none;
    margin-top: 4px;
  }
</style>
