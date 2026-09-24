<script lang="ts">
  import { partOf, PARTS, primaryChoices, userParts } from '$lib/parts'
  import { rolesForTier, tierOf, TIER_LABELS, type Tier } from '$lib/roles'
  import type { PublicUser } from '$lib/types'

  /** Without `user` this creates someone; with it, it edits them. */
  let { user = null, isSelf = false, wide = false, onSaved, onCancel } = $props<{
    user?: PublicUser | null
    isSelf?: boolean
    /** Two columns, for the full-width row under a table entry on PC. */
    wide?: boolean
    onSaved: () => void | Promise<void>
    onCancel: () => void
  }>()

  const TIERS: { tier: Tier; hint: string }[] = [
    { tier: 'member', hint: 'Sees the schedule, RSVPs for themselves' },
    { tier: 'admin', hint: 'Song leader: edits lineups, RSVPs for others, sees the log' },
    { tier: 'superadmin', hint: 'Everything, plus adding people and changing access' }
  ]

  // The form edits a copy. `user` is only read once, when the form opens.
  // svelte-ignore state_referenced_locally
  const initial = user
  const creating = !initial

  let email = $state('')
  let name = $state(initial?.name ?? '')
  let nickname = $state(initial?.nickname ?? '')
  let calendarNames = $state(initial?.aliases.join(', ') ?? '')
  let tier = $state<Tier>(initial ? tierOf(initial.roles) : 'member')
  let isMedia = $state(initial?.roles.isMedia ?? false)

  // Parts decide who the lineup editor lists first for each slot.
  const initialParts = initial ? [...userParts(initial)] : []
  let parts = $state<string[]>(initialParts)
  // Instrument text that isn't a known part ("media", a typo) is kept as-is.
  const otherInstruments = initial?.instruments.filter((i: string) => !partOf(i)) ?? []
  let primaryRole = $state(initial?.primaryRole ?? '')
  // Primary is one of the things they do, so it follows the ticks above it.
  const choices = $derived(primaryChoices(parts, isMedia))
  $effect(() => {
    if (primaryRole && !choices.some((c) => c.key === primaryRole)) primaryRole = ''
  })
  let password = $state('')
  let active = $state(initial?.active ?? true)

  let saving = $state(false)
  let error = $state<string | null>(null)

  const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (saving) return
    saving = true
    error = null

    const aliases = splitList(calendarNames)
    const payload: Record<string, unknown> = {
      name,
      nickname,
      roles: rolesForTier(tier, isMedia),
      primaryRole
    }
    // Left blank on create, the server uses their first name.
    if (aliases.length || !creating) payload.aliases = aliases
    // Only rewrite instruments when the ticked parts changed, so saving an
    // unrelated field doesn't churn the roster's original wording.
    const partsChanged = [...parts].sort().join() !== [...initialParts].sort().join()
    if (creating || partsChanged) {
      payload.instruments = [...PARTS.filter((p) => parts.includes(p.key)).map((p) => p.label), ...otherInstruments]
    }
    if (password) payload.password = password
    if (creating) payload.email = email
    else payload.active = active

    try {
      const res = await fetch(creating ? '/api/users' : `/api/users/${encodeURIComponent(initial!.email)}`, {
        method: creating ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        error = body?.message ?? 'Could not save. Please try again.'
        return
      }
      await onSaved()
    } catch {
      error = 'Network error. Check your connection and try again.'
    } finally {
      saving = false
    }
  }
</script>

<form class="user-form" class:wide onsubmit={submit}>
  {#if creating}
    <label>
      Email
      <input type="email" bind:value={email} required inputmode="email" autocomplete="off" disabled={saving} />
    </label>
  {/if}

  <label>
    Full name
    <input bind:value={name} required autocomplete="off" disabled={saving} />
  </label>

  <label>
    Nickname <span class="optional">(optional)</span>
    <input bind:value={nickname} autocomplete="off" disabled={saving} />
  </label>

  <label>
    Name in the calendar
    <input bind:value={calendarNames} placeholder="e.g. Kevin, Koya Kevin" autocomplete="off" disabled={saving} />
    <span class="help">How the schedule writes their name. Separate several with commas.</span>
  </label>

  <fieldset>
    <legend>Plays</legend>
    <div class="parts">
      {#each PARTS as part (part.key)}
        <label class="choice part">
          <input type="checkbox" value={part.key} bind:group={parts} disabled={saving} />
          <span>{part.label}</span>
        </label>
      {/each}
    </div>
    <span class="help">The lineup editor lists them for these slots.</span>
  </fieldset>

  <fieldset>
    <legend>Access</legend>
    {#each TIERS as option (option.tier)}
      <label class="choice">
        <input
          type="radio"
          name="tier"
          value={option.tier}
          bind:group={tier}
          disabled={saving || (isSelf && option.tier !== 'superadmin')}
        />
        <span>
          <strong>{TIER_LABELS[option.tier]}</strong>
          <span class="help">{option.hint}</span>
        </span>
      </label>
    {/each}
    <label class="choice">
      <input type="checkbox" bind:checked={isMedia} disabled={saving} />
      <span><strong>Media team</strong></span>
    </label>
  </fieldset>

  <label>
    Primary role
    <select bind:value={primaryRole} disabled={saving || choices.length === 0}>
      <option value="">{choices.length ? 'Not set' : 'Tick what they play, or Media, first'}</option>
      {#each choices as choice (choice.key)}
        <option value={choice.key}>{choice.label}</option>
      {/each}
    </select>
    <span class="help">What they mainly do in the ministry. Shown on the People list.</span>
  </label>

  <label>
    {creating ? 'Temporary password' : 'New password'}
    {#if !creating}<span class="optional">(leave blank to keep)</span>{/if}
    <input
      type="text"
      bind:value={password}
      required={creating}
      minlength="8"
      autocomplete="off"
      disabled={saving}
    />
    <span class="help">At least 8 characters. Send it to them yourself; they'll choose their own the first time they sign in.</span>
  </label>

  {#if !creating}
    <label class="choice">
      <input type="checkbox" bind:checked={active} disabled={saving || isSelf} />
      <span>
        <strong>Active</strong>
        <span class="help">Unchecking signs them out and stops them signing in.</span>
      </span>
    </label>
  {/if}

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  <div class="actions">
    <button type="button" class="cancel" onclick={onCancel} disabled={saving}>Cancel</button>
    <button type="submit" class="save" disabled={saving}>{saving ? 'Saving…' : creating ? 'Add person' : 'Save'}</button>
  </div>
</form>

<style>
  .user-form {
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

  .user-form.wide {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px 28px;
    padding: 16px 4px 8px;
  }

  .user-form.wide fieldset,
  .user-form.wide .error,
  .user-form.wide .actions {
    grid-column: 1 / -1;
  }

  .user-form.wide .parts {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .user-form.wide .actions {
    justify-content: flex-end;
  }

  .user-form.wide .actions button {
    flex: 0 0 160px;
  }

  select,
  input:not([type='radio']):not([type='checkbox']) {
    font-size: 16px; /* 16px stops iOS Safari zooming on focus */
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: white;
  }

  fieldset {
    border: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  legend {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  .choice {
    flex-direction: row;
    align-items: flex-start;
    gap: 10px;
    font-weight: 400;
    font-size: 14px;
  }

  .choice > span {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .parts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .choice.part {
    align-items: center;
  }

  .choice input {
    margin-top: 3px;
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
