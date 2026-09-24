<script lang="ts">
  import { editorSlots, extractLineup, labelText, type Lineup, type LineupSection, type LineupSlot } from '$lib/lineup'
  import { calendarName, joinNames, matchUser, PARTS, slotParts, splitNames, userParts } from '$lib/parts'
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

  // Special dropdown values; real options are team members' emails.
  const KEEP = '__keep'
  const OTHER = '__other'

  type Row = LineupSlot & {
    /** Added in this edit, so its label is editable. */
    custom: boolean
    /** Showing a text box instead of the dropdown, for someone not on the team list. */
    typing: boolean
  }

  let open = $state(false)
  let saving = $state(false)
  let error = $state<string | null>(null)

  /** The lineup as it was when editing started. Sent back so the server can spot a conflicting edit. */
  let original: Lineup = { slots: [], media: '' }
  let rows = $state<Row[]>([])

  /** Active team members. Until they load (or if loading fails) every slot is a plain text box. */
  let team = $state<PublicUser[]>([])
  let teamLoaded = $state(false)

  let mediaPicked = $state<string[]>([])
  let mediaOthers = $state('')
  let mediaFree = $state('')
  let mediaTouched = $state(false)

  const mediaTeam = $derived(team.filter((u) => u.roles.isMedia))
  const mediaAsChecklist = $derived(teamLoaded && mediaTeam.length > 0)

  // An open editor belongs to one week. If the selected week changes, drop it.
  $effect(() => {
    void eventId
    open = false
  })

  function start() {
    original = extractLineup(description)
    rows = editorSlots(original).map((slot) => ({ ...slot, custom: false, typing: false }))
    mediaFree = original.media
    mediaTouched = false
    splitMedia()
    error = null
    open = true
    if (!teamLoaded) loadTeam()
  }

  async function loadTeam() {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) return
      const body: { users: PublicUser[] } = await res.json()
      team = body.users
        .filter((u) => u.active)
        .sort((a, b) => calendarName(a).localeCompare(calendarName(b)))
      teamLoaded = true
      if (!mediaTouched) splitMedia()
    } catch {
      // Text boxes still work without the list.
    }
  }

  /** Media names the checklist recognizes get ticked; the rest go in the "others" box. */
  function splitMedia() {
    const picked: string[] = []
    const others: string[] = []
    for (const name of splitNames(original.media)) {
      const member = matchUser(name, mediaTeam)
      if (member) picked.push(calendarName(member))
      else others.push(name)
    }
    mediaPicked = picked
    mediaOthers = others.join(', ')
  }

  function toggleMedia(name: string) {
    mediaTouched = true
    mediaPicked = mediaPicked.includes(name) ? mediaPicked.filter((n) => n !== name) : [...mediaPicked, name]
  }

  function mediaText(): string {
    if (!mediaAsChecklist) return mediaFree
    // Untouched keeps the calendar's own wording ("Sam and Chan") exactly.
    if (!mediaTouched) return original.media
    return joinNames([...mediaPicked, ...splitNames(mediaOthers)])
  }

  function selectValue(row: Row): string {
    if (!row.name.trim()) return ''
    return matchUser(row.name, team)?.email ?? KEEP
  }

  function choose(row: Row, value: string) {
    if (value === OTHER) row.typing = true
    else if (value === '') row.name = ''
    else if (value !== KEEP) {
      const member = team.find((u) => u.email === value)
      if (member) row.name = calendarName(member)
    }
  }

  /** People who play this slot's part first, then everyone else. */
  function groupsFor(row: Row): { label: string; people: PublicUser[] }[] {
    const wanted = slotParts(row.label)
    const qualified = team.filter((u) => wanted.some((p) => userParts(u).has(p)))
    if (qualified.length === 0) return [{ label: 'Team', people: team }]

    const partNames = PARTS.filter((p) => wanted.includes(p.key)).map((p) => p.label.toLowerCase())
    return [
      { label: `Plays ${partNames.join(' / ')}`, people: qualified },
      { label: 'Everyone else', people: team.filter((u) => !qualified.includes(u)) }
    ]
  }

  const optionLabel = (u: PublicUser) => `${calendarName(u)} · ${u.name}`

  function addRow(section: LineupSection) {
    rows.push({ section, label: '', name: '', custom: true, typing: false })
  }

  async function save() {
    if (saving) return
    saving = true
    error = null

    const after: Lineup = {
      slots: rows
        .filter((r) => r.label.trim())
        .map(({ section, label, name }) => ({ section, label: label.trim(), name: name.trim() })),
      media: mediaText().trim()
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
    <p class="hint">Saves straight to Google Calendar. Choose "— Empty —" to clear a slot.</p>

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

              {#if row.typing || !teamLoaded}
                <div class="typed">
                  <input
                    id="slot-{i}"
                    bind:value={row.name}
                    placeholder="—"
                    maxlength="60"
                    autocomplete="off"
                    disabled={saving}
                  />
                  {#if teamLoaded}
                    <button type="button" class="link" onclick={() => (row.typing = false)} disabled={saving}>List</button>
                  {/if}
                </div>
              {:else}
                {@const value = selectValue(row)}
                <select id="slot-{i}" {value} onchange={(e) => choose(row, e.currentTarget.value)} disabled={saving}>
                  <option value="">— Empty —</option>
                  {#if value === KEEP}
                    <option value={KEEP}>{row.name} (not on team list)</option>
                  {/if}
                  {#each groupsFor(row) as group (group.label)}
                    <optgroup label={group.label}>
                      {#each group.people as person (person.email)}
                        <option value={person.email}>{optionLabel(person)}</option>
                      {/each}
                    </optgroup>
                  {/each}
                  <option value={OTHER}>Someone else (type a name)…</option>
                </select>
              {/if}
            </div>
          {/if}
        {/each}
        <button type="button" class="add" onclick={() => addRow(section.key)} disabled={saving}>{section.addLabel}</button>
      </fieldset>
    {/each}

    <fieldset>
      <legend>📹 Media</legend>
      {#if mediaAsChecklist}
        <div class="chips">
          {#each mediaTeam as member (member.email)}
            {@const name = calendarName(member)}
            <label class="chip" class:on={mediaPicked.includes(name)}>
              <input type="checkbox" checked={mediaPicked.includes(name)} onchange={() => toggleMedia(name)} disabled={saving} />
              {name}
            </label>
          {/each}
        </div>
        <input
          bind:value={mediaOthers}
          oninput={() => (mediaTouched = true)}
          placeholder="Others not listed, e.g. Sam, Pam"
          maxlength="100"
          aria-label="Other media names"
          disabled={saving}
        />
      {:else}
        <input bind:value={mediaFree} placeholder="e.g. Sam and Chan" maxlength="120" aria-label="Media" disabled={saving} />
      {/if}
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
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .label {
    font-size: 14px;
    color: var(--color-text-secondary);
  }

  input,
  select {
    width: 100%;
    min-width: 0;
    font-size: 16px; /* 16px stops iOS Safari zooming on focus */
    padding: 9px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: white;
    color: var(--color-text);
  }

  .typed {
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .link {
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0 4px;
    font-size: 13px;
    color: var(--color-primary);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 12px;
    font-size: 14px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    cursor: pointer;
  }

  .chip.on {
    background: var(--color-bg-active);
    border-color: var(--color-primary);
    color: var(--color-primary);
    font-weight: 600;
  }

  .chip input {
    width: auto;
    margin: 0;
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
