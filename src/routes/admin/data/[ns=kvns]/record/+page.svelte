<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation'
  import RecordEditor from '$lib/components/admin/RecordEditor.svelte'
  import { confirmWord, formatExpiration, NAMESPACE_INFO } from '$lib/kv-namespaces'

  let { data } = $props()

  const info = $derived(NAMESPACE_INFO[data.ns])
  const record = $derived(data.record)
  const tableHref = $derived(`/admin/data/${data.ns}`)
  const apiUrl = $derived(`/api/admin/kv/${data.ns}?key=${encodeURIComponent(record.ref)}`)
  const word = $derived(confirmWord(record.key))
  const value = $derived(record.value as Record<string, unknown> | null)
  const isSession = $derived(data.ns === 'SESSIONS_KV' && record.key.startsWith('session:'))
  const isActiveUser = $derived(Boolean(data.userEmail && value?.active === true))

  let editing = $state(false)
  let typed = $state('')
  let busy = $state(false)
  let error = $state<string | null>(null)
  let notice = $state<string | null>(null)

  /** Runs one action, surfacing the server's message on failure. Returns the parsed body on success. */
  async function send(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    busy = true
    error = null
    notice = null
    try {
      const res = await fetch(url, init)
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        error = body?.message ?? 'That did not work. Please try again.'
        return null
      }
      return body ?? {}
    } catch {
      error = 'Network error. Check your connection and try again.'
      return null
    } finally {
      busy = false
    }
  }

  async function saved() {
    editing = false
    notice = 'Saved.'
    await invalidateAll()
  }

  async function remove() {
    if (typed !== word) return
    if (await send(apiUrl, { method: 'DELETE' })) await goto(tableHref)
  }

  async function revokeSession() {
    if (!confirm('Revoke this session? That device is signed out immediately.')) return
    if (await send(apiUrl, { method: 'DELETE' })) await goto(tableHref)
  }

  async function revokeAllSessions() {
    if (!confirm(`Sign ${data.userEmail} out on every device?`)) return
    const body = await send(`/api/admin/kv/SESSIONS_KV/revoke-user-sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: data.userEmail })
    })
    if (!body) return
    const count = Number(body.revoked)
    notice = `Revoked ${count} ${count === 1 ? 'session' : 'sessions'}.${body.keptCurrent ? ' Kept the one you are using now.' : ''}`
  }

  /** The safer alternative to deleting a person: same as unchecking Active on the People page. */
  async function deactivate() {
    const body = await send(apiUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: { ...value, active: false } })
    })
    if (!body) return
    notice = 'Deactivated. They are signed out and can no longer sign in.'
    await invalidateAll()
  }
</script>

<svelte:head><title>Record · {info.label} · Praise Team Scheduler</title></svelte:head>

<div class="page">
  <a class="back" href={tableHref}>← {info.label}</a>
  <h1><code>{record.key}</code></h1>

  <dl class="facts">
    <dt>Namespace</dt>
    <dd><code>{data.ns}</code></dd>
    <dt>Expires</dt>
    <dd>{record.expiration ? formatExpiration(record.expiration) : 'Never'}</dd>
  </dl>

  {#if notice}<p class="notice" role="status">{notice}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <section class="card">
    <div class="section-head">
      <h2>Value</h2>
      {#if !info.readOnly && !editing}
        <button class="edit" onclick={() => (editing = true)} disabled={busy}>Edit</button>
      {/if}
    </div>
    {#if editing}
      <RecordEditor
        ns={data.ns}
        recordRef={record.ref}
        value={record.value}
        metadata={record.metadata}
        hasExpiration={Boolean(record.expiration)}
        onSaved={saved}
        onCancel={() => (editing = false)}
      />
    {:else}
      {#if !record.isJson}<p class="hint">Not JSON; shown as stored text.</p>{/if}
      <pre>{record.isJson ? JSON.stringify(record.value, null, 2) : record.value}</pre>
    {/if}
  </section>

  {#if !editing}
    <section class="card">
      <h2>Metadata</h2>
      {#if record.metadata == null}
        <p class="hint">None.</p>
      {:else}
        <pre>{JSON.stringify(record.metadata, null, 2)}</pre>
      {/if}
    </section>
  {/if}

  {#if info.readOnly}
    <p class="hint">The changelog is append-only. Entries can't be edited or deleted.</p>
  {:else}
    {#if isSession || data.userEmail}
      <section class="card">
        <h2>Shortcuts</h2>
        <div class="buttons">
          {#if isSession && !data.undeletable}
            <button onclick={revokeSession} disabled={busy}>Revoke this session</button>
          {/if}
          {#if data.userEmail}
            <button onclick={revokeAllSessions} disabled={busy}>Revoke all sessions for this user</button>
          {/if}
        </div>
      </section>
    {/if}

    <section class="card danger">
      <h2>Delete</h2>
      {#if data.undeletable}
        <p class="hint">{data.undeletable}</p>
      {:else}
        {#if data.userEmail}
          <p class="hint">
            Deleting erases this person's account. Deactivating is safer: they are signed out and can't sign
            in, and their history in the log still points at a real record.
          </p>
          {#if isActiveUser}
            <button class="wide" onclick={deactivate} disabled={busy}>Deactivate instead</button>
          {/if}
        {/if}
        <label>
          Type <code>{word}</code> to confirm
          <input
            bind:value={typed}
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            disabled={busy}
          />
        </label>
        <button class="delete" onclick={remove} disabled={busy || typed !== word}>Delete permanently</button>
      {/if}
    </section>
  {/if}
</div>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: 20px 16px 48px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .back {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: 14px;
    color: var(--color-primary);
    text-decoration: none;
    align-self: flex-start;
  }

  h1 {
    font-size: 17px;
    overflow-wrap: anywhere;
  }

  h2 {
    font-size: 16px;
  }

  .facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 10px;
    font-size: 13px;
  }

  .facts dt {
    color: var(--color-text-secondary);
  }

  .card {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .danger {
    border-color: #fecdca;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  pre {
    font-size: 13px;
    line-height: 1.45;
    background: var(--color-bg);
    border-radius: var(--radius);
    padding: 10px;
    overflow-x: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .hint {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .notice,
  .error {
    font-size: 14px;
    border-radius: var(--radius);
    padding: 10px 12px;
  }

  .notice {
    color: #067647;
    background: #ecfdf3;
    border: 1px solid #abefc6;
  }

  .error {
    color: #b42318;
    background: #fef3f2;
    border: 1px solid #fecdca;
  }

  .edit {
    font-size: 14px;
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 8px 12px;
    min-height: 44px;
  }

  .buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .buttons button,
  .wide,
  .delete {
    min-height: 44px;
    font-size: 15px;
    font-weight: 600;
    border-radius: var(--radius);
    background: white;
    border: 1px solid var(--color-border);
  }

  .delete {
    background: #d92d20;
    border: none;
    color: white;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 13px;
    font-weight: 600;
  }

  label input {
    font-size: 16px; /* 16px stops iOS Safari zooming on focus */
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: white;
  }

  button:disabled {
    opacity: 0.55;
  }
</style>
