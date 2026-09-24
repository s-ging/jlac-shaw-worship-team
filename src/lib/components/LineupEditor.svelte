<script lang="ts">
  import { editorSlots, extractLineup, labelText, type Lineup, type LineupSection, type LineupSlot } from '$lib/lineup'
  import type { PublicUser } from '$lib/types'

  let { eventId, description, onSaved } = $props<{
    eventId: string
    description: string
    onSaved: () => void | Promise<void>
  }>()

  const SECTIONS: { key: LineupSection; title: string; addLabel: string }[] = [
    { key: 'vocalists', title: '🎤 Vocalists', addLabel: '+ Add vocal part' },
    { key: 'instrumentalists', title: '🎸 Instrumentalists', addLabel: '+ Add instrument' }
  ]

  let open = $state(false)
  let saving = $state(false)
  let error = $state<string | null>(null)

  /** The lineup as it was when editing started. Sent back so the server can spot a conflicting edit. */
  let original: Lineup = { slots: [], media: '' }
  let rows = $state<(LineupSlot & { custom: boolean })[]>([])
  let media = $state('')
  let people = $state<string[]>([])

  // An open editor belongs to one week. If the selected week changes, drop it.
  $effect(() => {
    void eventId
    open = false
  })

  function start() {
    original = extractLineup(description)
    rows = editorSlots(original).map((slot) => ({ ...slot, custom: false }))
    media = original.media
    error = null
    open = true
    if (people.length === 0) loadPeople()
  }

  /** Names as the calendar writes them, offered as suggestions. Typing any other name still works. */
  async function loadPeople() {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) return
      const body: { users: PublicUser[] } = await res.json()
      const names = body.users
        .filter((u) => u.active)
        .map((u) => u.aliases[0] || u.nickname || u.name.split(' ')[0])
      people = [...new Set(names)].sort((a, b) => a.localeCompare(b))
    } catch {
      // Suggestions are a convenience; the form works without them.
    }
  }

  function addRow(section: LineupSection) {
    rows.push({ section, label: '', name: '', custom: true })
  }

  async function save() {
    if (saving) return
    saving = true
    error = null

    const after: Lineup = {
      slots: rows
        .filter((r) => r.label.trim())
        .map(({ section, label, name }) => ({ section, label: label.trim(), name: name.trim() })),
      media: media.trim()
    }

    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/lineup`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ before: original, after })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        error = body?.message ?? 'Could not save the lineup. Please try again.'
        return
      }
      open = false
      await onSaved()
    } catch {
      error = 'Network error. Check your connection and try again.'
    } finally {
      saving = false
    }
  }
</script>

{#if !open}
  <button class="edit-lineup" onclick={start}>✏️ Edit lineup</button>
{:else}
  <form
    class="editor"
    onsubmit={(e) => {
      e.preventDefault()
      save()
    }}
  >
    <h3 class="title">Edit lineup</h3>
    <p class="hint">Saves straight to Google Calendar. Leave a slot blank to remove it.</p>

    <datalist id="team-names">
      {#each people as person (person)}
        <option value={person}></option>
      {/each}
    </datalist>

    {#each SECTIONS as section (section.key)}
      <fieldset>
        <legend>{section.title}</legend>
        {#each rows as row, i (i)}
          {#if row.section === section.key}
            <div class="slot">
              {#if row.custom}
                <input class="label-input" bind:value={row.label} placeholder="Part, e.g. 🎹 Keys" maxlength="40" aria-label="Part" />
              {:else}
                <label class="label" for="slot-{i}">{labelText(row.label)}</label>
              {/if}
              <input
                id="slot-{i}"
                bind:value={row.name}
                list="team-names"
                placeholder="—"
                maxlength="60"
                autocomplete="off"
                disabled={saving}
              />
            </div>
          {/if}
        {/each}
        <button type="button" class="add" onclick={() => addRow(section.key)} disabled={saving}>{section.addLabel}</button>
      </fieldset>
    {/each}

    <fieldset>
      <legend>📹 Media</legend>
      <input bind:value={media} placeholder="e.g. Sam and Chan" maxlength="120" aria-label="Media" disabled={saving} />
    </fieldset>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" class="cancel" onclick={() => (open = false)} disabled={saving}>Cancel</button>
      <button type="submit" class="save" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  </form>
{/if}

<style>
  .edit-lineup {
    width: 100%;
    min-height: 44px;
    margin: 4px 0 20px;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-primary);
    background: white;
    border: 1px dashed var(--color-primary);
    border-radius: var(--radius);
  }

  .editor {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    margin: 4px 0 20px;
  }

  .title {
    font-size: 16px;
    margin: 0 0 2px;
  }

  .hint {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0 0 12px;
  }

  fieldset {
    border: none;
    margin: 0 0 14px;
  }

  legend {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .slot {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .label {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  input {
    width: 100%;
    font-size: 16px; /* 16px stops iOS Safari zooming on focus */
    padding: 9px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: white;
  }

  .add {
    background: none;
    border: none;
    padding: 6px 0;
    font-size: 13px;
    color: var(--color-primary);
  }

  .error {
    font-size: 14px;
    color: #b42318;
    background: #fef3f2;
    border: 1px solid #fecdca;
    border-radius: var(--radius);
    padding: 10px 12px;
    margin: 0 0 12px;
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
    color: var(--color-text);
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
