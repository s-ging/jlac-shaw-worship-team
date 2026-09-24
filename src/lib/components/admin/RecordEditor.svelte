<script lang="ts">
  import { MASK_HINT } from '$lib/kv-namespaces'
  import type { KvNamespaceName } from '$lib/kv-namespaces'

  /** Without `recordRef` this creates a record; with it, it edits that one. */
  let {
    ns,
    recordRef = null,
    keyPrefix = '',
    value = {},
    metadata = null,
    hasExpiration = false,
    onSaved,
    onCancel
  } = $props<{
    ns: KvNamespaceName
    recordRef?: string | null
    keyPrefix?: string
    value?: unknown
    metadata?: unknown
    hasExpiration?: boolean
    onSaved: (ref: string) => void | Promise<void>
    onCancel: () => void
  }>()

  // The form edits a copy. The props are only read once, when the form opens.
  // svelte-ignore state_referenced_locally
  const creating = !recordRef
  // svelte-ignore state_referenced_locally
  const initialMetadata = metadata == null ? '' : JSON.stringify(metadata, null, 2)

  // svelte-ignore state_referenced_locally
  let key = $state(keyPrefix)
  // svelte-ignore state_referenced_locally
  let valueText = $state(JSON.stringify(value, null, 2))
  let metadataText = $state(initialMetadata)
  let ttl = $state('')
  let clearExpiration = $state(false)

  let saving = $state(false)
  let error = $state<string | null>(null)

  function parseError(text: string): string | null {
    try {
      JSON.parse(text)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : 'Invalid JSON'
    }
  }

  const valueError = $derived(parseError(valueText))
  const metadataError = $derived(metadataText.trim() ? parseError(metadataText) : null)

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (saving) return
    if (valueError || metadataError) {
      error = 'Fix the JSON before saving.'
      return
    }

    const payload: Record<string, unknown> = { value: JSON.parse(valueText) }
    // Only sent when changed, so the server keeps what is stored otherwise.
    if (metadataText.trim() !== initialMetadata.trim()) {
      payload.metadata = metadataText.trim() ? JSON.parse(metadataText) : null
    }
    if (clearExpiration) payload.expirationTtl = null
    else if (ttl) payload.expirationTtl = Number(ttl)
    if (creating) payload.create = true

    const target = creating ? key : recordRef!
    saving = true
    error = null
    try {
      const res = await fetch(`/api/admin/kv/${ns}?key=${encodeURIComponent(target)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        error = body?.message ?? 'Could not save. Please try again.'
        return
      }
      await onSaved(body?.record?.ref ?? target)
    } catch {
      error = 'Network error. Check your connection and try again.'
    } finally {
      saving = false
    }
  }
</script>

<form class="editor" onsubmit={submit}>
  {#if creating}
    <label>
      Key
      <input bind:value={key} required autocomplete="off" autocapitalize="off" spellcheck="false" disabled={saving} />
    </label>
  {/if}

  <label>
    Value (JSON)
    <textarea
      bind:value={valueText}
      rows="14"
      autocapitalize="off"
      spellcheck="false"
      disabled={saving}
      class:invalid={valueError}
    ></textarea>
    {#if valueError}
      <span class="help bad">{valueError}</span>
    {:else}
      <span class="help">{MASK_HINT}</span>
    {/if}
  </label>

  <details>
    <summary>Metadata and expiry</summary>
    <label>
      Metadata (JSON) <span class="optional">(empty for none)</span>
      <textarea
        bind:value={metadataText}
        rows="4"
        autocapitalize="off"
        spellcheck="false"
        disabled={saving}
        class:invalid={metadataError}
      ></textarea>
      {#if metadataError}<span class="help bad">{metadataError}</span>{/if}
    </label>
    <label>
      Expire in (seconds) <span class="optional">(blank to {creating ? 'never expire' : 'keep as is'})</span>
      <input type="number" min="60" step="1" inputmode="numeric" bind:value={ttl} disabled={saving || clearExpiration} />
    </label>
    {#if hasExpiration}
      <label class="choice">
        <input type="checkbox" bind:checked={clearExpiration} disabled={saving} />
        <span>Remove the expiry</span>
      </label>
    {/if}
  </details>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <div class="actions">
    <button type="button" class="cancel" onclick={onCancel} disabled={saving}>Cancel</button>
    <button type="submit" class="save" disabled={saving || Boolean(valueError)}>
      {saving ? 'Saving…' : creating ? 'Create' : 'Save'}
    </button>
  </div>
</form>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-top: 12px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 13px;
    font-weight: 600;
  }

  .optional,
  .help {
    font-weight: 400;
    color: var(--color-text-secondary);
  }

  .help {
    font-size: 12px;
  }

  .help.bad {
    color: #b42318;
  }

  input:not([type='checkbox']),
  textarea {
    font-size: 16px; /* 16px stops iOS Safari zooming on focus */
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: white;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  textarea {
    resize: vertical;
    line-height: 1.4;
  }

  .invalid {
    border-color: #fda29b;
  }

  details[open] > summary {
    margin-bottom: 12px;
  }

  details > label + label {
    margin-top: 12px;
  }

  summary {
    font-size: 14px;
    min-height: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--color-text-secondary);
  }

  .choice {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    font-weight: 400;
    font-size: 14px;
    min-height: 44px;
  }

  .choice input {
    width: 18px;
    height: 18px;
  }

  .error {
    font-size: 14px;
    color: #b42318;
    background: #fef3f2;
    border: 1px solid #fecdca;
    border-radius: var(--radius);
    padding: 10px 12px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .actions button {
    flex: 1;
    min-height: 44px;
    font-size: 15px;
    font-weight: 600;
    border-radius: var(--radius);
  }

  .cancel {
    background: white;
    border: 1px solid var(--color-border);
  }

  .save {
    background: var(--color-primary);
    border: none;
    color: white;
  }

  button:disabled {
    opacity: 0.55;
  }
</style>
