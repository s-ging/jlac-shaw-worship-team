<script lang="ts">
  import { editorSlots, extractLineup, labelKey, missingParts, PRESET_SLOTS, type Requirement, type Lineup, type LineupSection, type LineupSlot } from '$lib/lineup'
  import { calendarName, joinNames, matchByNames, matchUser, PARTS, slotParts, splitNames, userParts } from '$lib/parts'
  import type { PublicUser, RsvpPerson, RsvpRecord, RsvpStatus } from '$lib/types'
  import { extractPlaylist, extractTheme, isPlaylistUrl, type WeekInfo } from '$lib/week-info'
  import SecondNav from './SecondNav.svelte'

  /**
   * The week's lineup, read from the service event's description. For editors
   * the same rows turn into dropdowns in place, with the week's theme and
   * playlist above them (the page hides WeekDetails meanwhile, so they take its
   * place); saving writes back to Calendar.
   * Each name carries its person's RSVP when they have answered.
   */
  let {
    eventId,
    description,
    summary,
    canEdit,
    rsvps,
    people,
    onSaved,
    editing = $bindable(false)
  }: {
    eventId: string
    description: string
    /** The event's title, which holds the week's theme. */
    summary: string
    canEdit: boolean
    rsvps: Record<string, RsvpRecord>
    people: Record<string, RsvpPerson>
    onSaved: () => void | Promise<void>
    /** Bindable so the page can hand the docked bar (SecondNav) from RSVP to Save. */
    editing?: boolean
  } = $props()

  const SECTIONS: { key: LineupSection | 'media'; title: string; addLabel: string }[] = [
    { key: 'vocalists', title: '🎤 Vocalists', addLabel: 'Add vocal part' },
    { key: 'instrumentalists', title: '🎸 Instrumentalists', addLabel: 'Add instrument' },
    { key: 'media', title: '📹 Media', addLabel: 'Add media team' }
  ]

  /** The emoji a new part can carry. Always one of these, so every label starts with one. */
  const EMOJIS: Record<LineupSection, string[]> = {
    vocalists: ['4️⃣', '5️⃣', '6️⃣', '7️⃣', '🎤', '🎵'],
    instrumentalists: ['🎹', '🎸', '🥁', '🎺', '🎷', '🎻', '🪕', '🪘', '🎵']
  }

  const STATUS_ICON: Record<RsvpStatus, { icon: string; text: string }> = {
    yes: { icon: '✅', text: 'Confirmed' },
    maybe: { icon: '🤔', text: 'Maybe' },
    no: { icon: '❌', text: "Can't make it" }
  }

  // Special dropdown values; real options are team members' emails.
  const KEEP = '__keep'
  const OTHER = '__other'
  const NEW_PART = '__new'

  /** One name being picked: a lineup slot or a media spot. */
  type Pick = {
    name: string
    /** Showing a text box instead of the dropdown, for someone not on the team list. */
    typing: boolean
  }

  type Row = LineupSlot &
    Pick & {
      /** A new part added in this edit: its emoji and name are chosen separately, then joined into the label. */
      custom: boolean
      emoji: string
      part: string
    }

  type Group = { label: string; people: PublicUser[] }

  const lineup = $derived(extractLineup(description))
  const shown = $derived(lineup.slots.filter((s) => s.name.trim()))
  const mediaNames = $derived(splitNames(lineup.media))

  let saving = $state(false)
  let error = $state<string | null>(null)

  /** The lineup as it was when editing started. Sent back so the server can spot a conflicting edit. */
  let original: Lineup = { slots: [], media: '' }
  let rows = $state<Row[]>([])

  /** Theme and playlist as they were when editing started, and as being edited. */
  let originalInfo: WeekInfo = { theme: '', playlist: '' }
  let theme = $state('')
  let playlist = $state('')
  const playlistOk = $derived(!playlist.trim() || isPlaylistUrl(playlist.trim()))

  /** Active team members. Until they load (or if loading fails) every slot is a plain text box. */
  let team = $state<PublicUser[]>([])
  let teamLoaded = $state(false)

  /** One dropdown per media person. */
  let mediaRows = $state<Pick[]>([])
  let mediaTouched = $state(false)

  // An open editor belongs to one week. If the selected week changes, drop it.
  $effect(() => {
    void eventId
    editing = false
  })

  // ---- RSVP ticks ----

  const responders = $derived(
    Object.entries(people).map(([email, person]) => ({ ...(person as RsvpPerson), status: rsvps[email]?.status }))
  )

  function statusOf(name: string): RsvpStatus | null {
    return matchByNames(name, responders, (r) => r.names)?.status ?? null
  }

  // ---- Editing ----

  function start() {
    original = extractLineup(description)
    rows = editorSlots(original).map((slot) => ({ ...slot, custom: false, typing: false, emoji: '', part: '' }))
    mediaRows = splitNames(original.media).map((name) => ({ name, typing: false }))
    if (mediaRows.length === 0) mediaRows.push({ name: '', typing: false })
    mediaTouched = false
    originalInfo = { theme: extractTheme(summary), playlist: extractPlaylist(description) }
    theme = originalInfo.theme
    playlist = originalInfo.playlist
    error = null
    editing = true
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
    } catch {
      // Text boxes still work without the list.
    }
  }

  function mediaText(): string {
    // Untouched keeps the calendar's own wording ("Sam and Chan") exactly.
    if (!mediaTouched) return original.media
    return joinNames(mediaRows.map((p) => p.name.trim()).filter(Boolean))
  }

  function selectValue(pick: Pick): string {
    if (!pick.name.trim()) return ''
    return matchUser(pick.name, team)?.email ?? KEEP
  }

  function choose(pick: Pick, value: string) {
    if (value === OTHER) pick.typing = true
    else if (value === '') pick.name = ''
    else if (value !== KEEP) {
      const member = team.find((u) => u.email === value)
      if (!member) return
      pick.name = calendarName(member)
      // Picking someone who is on the other side (band vs media) moves them here.
      for (const other of [...rows, ...mediaRows]) {
        if (other !== pick && matchUser(other.name, team) === member) {
          other.name = ''
          if (mediaRows.includes(other)) mediaTouched = true
        }
      }
    }
  }

  const labelOf = (row: Row) => (row.custom ? `${row.emoji} ${row.part.trim()}` : row.label)

  /**
   * Emails to hide from this dropdown. One person, one spot: within the band,
   * or within media, someone already placed is hidden. Across the two they stay
   * listed, and picking them moves them (`choose`): Chan can go from Media to Bass.
   */
  function hiddenFor(pick: Pick): Set<string> {
    const side = mediaRows.includes(pick) ? mediaRows : rows
    const hidden = new Set<string>()
    for (const other of side) {
      const member = other === pick ? null : matchUser(other.name, team)
      if (member) hidden.add(member.email)
    }
    return hidden
  }

  // ---- What a week needs before it can be saved ----

  /** The lineup as it would be saved right now. */
  function draft(): Lineup {
    return {
      slots: rows
        .filter((r) => (r.custom ? r.part.trim() : r.label.trim()))
        .map((r) => ({ section: r.section, label: labelOf(r).trim(), name: r.name.trim() })),
      media: mediaText().trim()
    }
  }

  const missing = $derived(editing ? missingParts(draft()) : [])
  const needs = $derived(new Set<Requirement>(missing.map((m) => m.key)))

  /** Highlights the empty rows that could fill what's holding up saving. */
  function isMissing(row: Row): boolean {
    if (row.name.trim()) return false
    const key = labelKey(labelOf(row))
    if (key === 'praiseleader') return needs.has('praiseleader')
    if (row.section === 'vocalists') return needs.has('secondvocal')
    if (key === 'drums') return needs.has('drums')
    return (key === 'lguitar' || key === 'rguitar') && needs.has('guitar')
  }

  /**
   * Only people who play this slot's part, under a heading naming it. Whoever
   * holds the slot now stays listed even if their parts say otherwise, and
   * "Someone else…" covers the rest. A part no one is marked for lists everyone.
   */
  function groupsFor(row: Row): Group[] {
    const wanted = slotParts(labelOf(row))
    const qualified = team.filter((u) => wanted.some((p) => userParts(u).has(p)))
    if (qualified.length === 0) return [{ label: 'Team', people: team }]

    const heading = PARTS.filter((p) => wanted.includes(p.key)).map((p) => p.label).join(' / ')
    const current = matchUser(row.name, team)
    const groups = [{ label: heading, people: qualified }]
    if (current && !qualified.includes(current)) groups.unshift({ label: 'Assigned now', people: [current] })
    return groups
  }

  /** The media team, plus whoever holds the spot now if they aren't on it. */
  function mediaGroupsFor(pick: Pick): Group[] {
    const media = team.filter((u) => u.roles.isMedia)
    if (media.length === 0) return [{ label: 'Team', people: team }]
    const current = matchUser(pick.name, team)
    const groups = [{ label: 'Media team', people: media }]
    if (current && !media.includes(current)) groups.unshift({ label: 'Assigned now', people: [current] })
    return groups
  }

  /** The calendar name, unless two people share it. The closed dropdown shows this, so keep it short. */
  function optionLabel(u: PublicUser): string {
    const name = calendarName(u)
    return team.filter((t) => calendarName(t) === name).length > 1 ? `${name} (${u.name})` : name
  }

  /** Presets this section can still take: Keys, unless the week already has it. */
  function presetsFor(section: LineupSection) {
    return PRESET_SLOTS.filter(
      (p) => p.section === section && !rows.some((r) => r.section === section && labelKey(labelOf(r)) === labelKey(p.label))
    )
  }

  function addPart(section: LineupSection, choice: string) {
    const preset = presetsFor(section).find((p) => p.label === choice)
    if (preset) {
      rows.push({ ...preset, name: '', typing: false, custom: false, emoji: '', part: '' })
      return
    }
    // Vocal parts carry on the numbering: a fourth singer gets 4️⃣.
    const count = rows.filter((r) => r.section === section).length
    const emoji = section === 'vocalists' ? (EMOJIS.vocalists[count - 3] ?? '🎤') : EMOJIS.instrumentalists[0]
    rows.push({ section, label: '', name: '', typing: false, custom: true, emoji, part: '' })
  }

  function addMedia() {
    mediaTouched = true
    mediaRows.push({ name: '', typing: false })
  }

  async function save() {
    if (saving || missing.length > 0 || !playlistOk) return
    saving = true
    error = null

    const after = draft()

    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/lineup`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          before: original,
          after,
          info: { before: originalInfo, after: { theme: theme.trim(), playlist: playlist.trim() } }
        })
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        error = body?.message ?? 'Could not save the lineup. Please try again.'
        return
      }
      await onSaved()
      editing = false
    } catch {
      error = 'Network error. Check your connection and try again.'
    } finally {
      saving = false
    }
  }
</script>

{#snippet picker(pick: Pick, id: string, groups: Group[], touch?: () => void)}
  {#if pick.typing || !teamLoaded}
    <span class="typed">
      <input
        {id}
        class="pick"
        bind:value={pick.name}
        oninput={touch}
        placeholder="Empty"
        maxlength="60"
        autocomplete="off"
        disabled={saving}
      />
      {#if teamLoaded}
        <button type="button" class="back" onclick={() => (pick.typing = false)} disabled={saving} aria-label="Pick from the team list">×</button>
      {/if}
    </span>
  {:else}
    {@const value = selectValue(pick)}
    {@const hidden = hiddenFor(pick)}
    <select
      {id}
      class="pick"
      class:blank={!value}
      {value}
      onchange={(e) => {
        choose(pick, e.currentTarget.value)
        touch?.()
      }}
      disabled={saving}
    >
      <option value="">Empty</option>
      {#if value === KEEP}
        <option value={KEEP}>{pick.name}</option>
      {/if}
      {#each groups as group (group.label)}
        {@const free = group.people.filter((u) => !hidden.has(u.email))}
        {#if free.length > 0}
          <optgroup label={group.label}>
            {#each free as person (person.email)}
              <option value={person.email}>{optionLabel(person)}</option>
            {/each}
          </optgroup>
        {/if}
      {/each}
      <option value={OTHER}>Someone else…</option>
    </select>
  {/if}
{/snippet}

{#snippet status(name: string)}
  {@const s = name.trim() ? statusOf(name) : null}
  {#if s}
    <span class="status" title={STATUS_ICON[s].text} aria-label={STATUS_ICON[s].text}>{STATUS_ICON[s].icon}</span>
  {:else}
    <span class="status none" title="No response yet" aria-label="No response yet"></span>
  {/if}
{/snippet}

<form
  class="lineup"
  class:editing
  onsubmit={(e) => {
    e.preventDefault()
    save()
  }}
>
  {#if editing}
    <section class="info">
      <label class="field">
        <span class="field-label">Theme</span>
        <input class="field-input" bind:value={theme} placeholder="No theme set" maxlength="120" autocomplete="off" disabled={saving} />
      </label>
      <label class="field">
        <span class="field-label">🎵 YouTube playlist</span>
        <input
          class="field-input"
          class:invalid={!playlistOk}
          type="url"
          inputmode="url"
          bind:value={playlist}
          placeholder="https://youtube.com/playlist?list=…"
          maxlength="300"
          autocomplete="off"
          disabled={saving}
        />
        {#if !playlistOk}
          <span class="field-hint">Paste a YouTube link</span>
        {/if}
      </label>
    </section>
    <hr class="divider" />
  {/if}

  {#each SECTIONS as section (section.key)}
    <section class="group">
      <h3 class="group-title">{section.title}</h3>

      {#if section.key === 'media'}
        {#if !editing}
          {#each mediaNames as name, i (i)}
            <div class="row">
              {@render status(name)}
              <span class="role">📹 Media</span>
              <span class="name">{name}</span>
            </div>
          {:else}
            <p class="empty">No media assigned</p>
          {/each}
        {:else}
          {#each mediaRows as pick, i (i)}
            <div class="row" class:missing={i === 0 && needs.has('media')}>
              <label class="role" for="media-{i}">📹 Media</label>
              {@render picker(pick, `media-${i}`, mediaGroupsFor(pick), () => (mediaTouched = true))}
            </div>
          {/each}
          <button type="button" class="add" onclick={addMedia} disabled={saving}>+ {section.addLabel}</button>
        {/if}
      {:else if !editing}
        {#each shown.filter((s) => s.section === section.key) as slot, i (i)}
          <div class="row">
            {@render status(slot.name)}
            <span class="role">{slot.label}</span>
            <span class="name">{slot.name}</span>
          </div>
        {:else}
          <p class="empty">Nobody assigned yet</p>
        {/each}
      {:else}
        {#each rows as row, i (i)}
          {#if row.section === section.key}
            <div class="row" class:missing={isMissing(row)}>
              {#if row.custom}
                <span class="custom-part">
                  <select class="emoji" bind:value={row.emoji} aria-label="Emoji" disabled={saving}>
                    {#each EMOJIS[row.section] as emoji (emoji)}
                      <option value={emoji}>{emoji}</option>
                    {/each}
                  </select>
                  <input
                    class="role-input"
                    bind:value={row.part}
                    placeholder={row.section === 'vocalists' ? 'Part' : 'Instrument'}
                    maxlength="36"
                    aria-label="Part name"
                    disabled={saving}
                  />
                </span>
              {:else}
                <label class="role" for="slot-{i}">{row.label}</label>
              {/if}
              {@render picker(row, `slot-${i}`, groupsFor(row))}
            </div>
          {/if}
        {/each}
        {@const key = section.key as LineupSection}
        {@const presets = presetsFor(key)}
        {#if presets.length > 0}
          <select
            class="add"
            value=""
            aria-label={section.addLabel}
            onchange={(e) => {
              addPart(key, e.currentTarget.value)
              e.currentTarget.value = ''
            }}
            disabled={saving}
          >
            <option value="" hidden>+ {section.addLabel}</option>
            {#each presets as preset (preset.label)}
              <option value={preset.label}>{preset.label}</option>
            {/each}
            <option value={NEW_PART}>New {key === 'vocalists' ? 'part' : 'instrument'}…</option>
          </select>
        {:else}
          <button type="button" class="add" onclick={() => addPart(key, NEW_PART)} disabled={saving}>+ {section.addLabel}</button>
        {/if}
      {/if}
    </section>
  {/each}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if canEdit}
    {#if editing}
      <SecondNav label="Save week" sticky>
        <div class="actions">
          {#if missing.length > 0}
            <p class="needed">Still needed: {missing.map((m) => m.text).join(', ')}</p>
          {:else if !playlistOk}
            <p class="needed">The playlist needs to be a YouTube link</p>
          {/if}
          <button type="button" class="cancel" onclick={() => (editing = false)} disabled={saving}>Cancel</button>
          <button type="submit" class="save" disabled={saving || missing.length > 0 || !playlistOk}>{saving ? 'Saving…' : 'Save to calendar'}</button>
        </div>
      </SecondNav>
    {:else}
      <button type="button" class="edit" onclick={start}>Edit week</button>
    {/if}
  {/if}
</form>

<style>
  .lineup {
    margin-bottom: 20px;
  }

  .group {
    margin-bottom: 20px;
  }

  /* ---- Edit mode: theme and playlist, where WeekDetails shows them ---- */

  .info {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .field-input {
    width: 100%;
    min-width: 0;
    /* 16px stops iOS Safari zooming on focus */
    font: 16px/1.2 var(--font-family);
    color: var(--color-text);
    padding: 9px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: white;
  }

  .field-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-bg-active);
  }

  .field-input::placeholder {
    color: #aaa;
  }

  .field-input.invalid {
    border-color: #fdb022;
    background-color: #fffaeb;
  }

  .field-hint {
    font-size: 13px;
    color: #b54708;
  }

  .divider {
    border: none;
    border-top: 2px solid var(--color-border);
    margin: 12px 0 20px;
    opacity: 0.5;
  }

  .group-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-text);
    margin-bottom: 4px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--color-border);
  }

  .row {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 2px 4px;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
  }

  /* Editing is about who's assigned, not who's coming: no RSVP column. */
  .editing .row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }

  .row:last-of-type {
    border-bottom: none;
  }

  .status {
    text-align: center;
    font-size: 14px;
  }

  /* No answer yet: a quiet dash, not an emoji competing with the ticks. */
  .status.none::before {
    content: '';
    display: inline-block;
    width: 10px;
    height: 2px;
    border-radius: 1px;
    background: #cfcfcf;
    vertical-align: middle;
  }

  .role {
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name {
    font-weight: 600;
    text-align: right;
  }

  .empty {
    font-size: 14px;
    color: #aaa;
    font-style: italic;
    padding: 10px 4px;
  }

  /* ---- Edit mode: same rows, the name becomes a dropdown ---- */

  .pick {
    justify-self: end;
    width: 100%;
    min-width: 0;
    /* 16px stops iOS Safari zooming on focus */
    font: 600 16px/1.2 var(--font-family);
    color: var(--color-text);
    text-align: right;
    text-align-last: right;
    padding: 7px 26px 7px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center;
    appearance: none;
  }

  .pick:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-bg-active);
  }

  .pick.blank,
  .pick::placeholder {
    color: #aaa;
    font-weight: 400;
  }

  input.pick {
    background-image: none;
    padding-right: 10px;
  }

  .typed {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .back {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    background: none;
    border: none;
    font-size: 18px;
    line-height: 1;
    color: var(--color-text-secondary);
  }

  .custom-part {
    display: flex;
    gap: 4px;
    min-width: 0;
  }

  .emoji {
    flex-shrink: 0;
    width: 44px;
    font-size: 16px;
    padding: 6px 0;
    text-align: center;
    text-align-last: center;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: white;
    appearance: none;
  }

  .role-input {
    width: 100%;
    min-width: 0;
    font: 16px var(--font-family);
    padding: 7px 10px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: white;
    color: var(--color-text);
  }


  .add {
    display: block;
    background: none;
    border: none;
    padding: 10px 4px 2px;
    font: 500 13px var(--font-family);
    color: var(--color-primary);
    cursor: pointer;
  }

  select.add {
    appearance: none;
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

  .edit,
  .actions button {
    min-height: 44px;
    font-size: 15px;
    font-weight: 600;
    border-radius: var(--radius);
  }

  .edit {
    width: 100%;
    color: var(--color-primary);
    background: white;
    border: 1px solid var(--color-border);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .actions button {
    flex: 1;
  }

  .needed {
    flex-basis: 100%;
    font-size: 13px;
    color: #b54708;
  }

  /* Required and still empty: the reason Save is off. */
  .row.missing .role {
    color: #b54708;
    font-weight: 600;
  }

  .row.missing .pick {
    border-color: #fdb022;
    background-color: #fffaeb;
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
