<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity'
  import UserForm from './UserForm.svelte'
  import { calendarName, inMinistry, MINISTRY_FILTERS, PARTS, primaryRoleLabel, userParts } from '$lib/parts'
  import { tierOf, TIER_LABELS, type Tier } from '$lib/roles'
  import type { PublicUser } from '$lib/types'

  /**
   * The team, for superadmins. Filter by ministry part and by access, sort
   * A–Z, and edit in place. A table on PC; cards on phones. The same state
   * drives both, so switching width keeps your filters.
   */
  let { users, currentEmail, onChanged } = $props<{
    users: PublicUser[]
    currentEmail?: string
    /** After a save. Reload `users`. */
    onChanged: () => void | Promise<void>
  }>()

  const wide = new MediaQuery('min-width: 900px', false)

  type SortKey = 'name' | 'calendar' | 'primary' | 'access'
  const TIER_ORDER: Record<Tier, number> = { superadmin: 0, admin: 1, member: 2 }
  const TIERS: Tier[] = ['member', 'admin', 'superadmin']

  let ministry = $state('')
  let access = $state<Tier | ''>('')
  let showInactive = $state(false)
  let sortKey = $state<SortKey>('name')
  let sortDir = $state<1 | -1>(1)

  /** Email of the person being edited, 'new' while adding someone, or null. */
  let editing = $state<string | null>(null)

  const inactiveCount = $derived(users.filter((u: PublicUser) => !u.active).length)
  const filtering = $derived(Boolean(ministry || access))

  const plays = (u: PublicUser) => {
    const parts = userParts(u)
    return PARTS.filter((p) => parts.has(p.key)).map((p) => p.label)
  }

  /** What each column sorts on. Blank values (no primary role yet) always go last. */
  function sortValue(u: PublicUser, key: SortKey): string | number {
    if (key === 'calendar') return calendarName(u).toLowerCase()
    if (key === 'primary') return primaryRoleLabel(u)?.toLowerCase() ?? ''
    if (key === 'access') return TIER_ORDER[tierOf(u.roles)]
    return u.name.toLowerCase()
  }

  const visible = $derived.by(() => {
    const list = users.filter(
      (u: PublicUser) =>
        (showInactive || u.active) &&
        (!ministry || inMinistry(u, ministry)) &&
        (!access || tierOf(u.roles) === access)
    )
    return list.sort((a: PublicUser, b: PublicUser) => {
      const x = sortValue(a, sortKey)
      const y = sortValue(b, sortKey)
      if (x === '' && y !== '') return 1
      if (y === '' && x !== '') return -1
      const order = typeof x === 'number' ? x - (y as number) : x.localeCompare(y as string)
      return order * sortDir || a.name.localeCompare(b.name)
    })
  })

  function sortBy(key: SortKey) {
    if (sortKey === key) sortDir = sortDir === 1 ? -1 : 1
    else {
      sortKey = key
      sortDir = 1
    }
  }

  function clearFilters() {
    ministry = ''
    access = ''
  }

  async function saved() {
    editing = null
    await onChanged()
  }

  const COLUMNS: { key: SortKey | null; label: string }[] = [
    { key: 'name', label: 'Name' },
    { key: 'calendar', label: 'Calendar name' },
    { key: 'primary', label: 'Primary role' },
    { key: null, label: 'Plays' },
    { key: 'access', label: 'Access' }
  ]
</script>

{#snippet badges(person: PublicUser)}
  {@const tier = tierOf(person.roles)}
  <span class="badges">
    {#if !person.active}<span class="badge off">Inactive</span>{/if}
    <span class="badge {tier}">{TIER_LABELS[tier]}</span>
    {#if person.roles.isMedia}<span class="badge">Media</span>{/if}
  </span>
{/snippet}

<div class="toolbar">
  <div class="filters">
    <select bind:value={ministry} aria-label="Filter by ministry part">
      <option value="">All parts</option>
      {#each MINISTRY_FILTERS as filter (filter.key)}
        <option value={filter.key}>{filter.label}</option>
      {/each}
    </select>
    <select bind:value={access} aria-label="Filter by access">
      <option value="">All access</option>
      {#each TIERS as tier (tier)}
        <option value={tier}>{TIER_LABELS[tier]}</option>
      {/each}
    </select>
    {#if !wide.current}
      <!-- Phones have no column headers to click, so sorting gets its own control. -->
      <select
        value={`${sortKey}:${sortDir}`}
        onchange={(e) => {
          const [key, dir] = e.currentTarget.value.split(':')
          sortKey = key as SortKey
          sortDir = Number(dir) as 1 | -1
        }}
        aria-label="Sort"
      >
        <option value="name:1">Name A–Z</option>
        <option value="name:-1">Name Z–A</option>
        <option value="primary:1">Primary role</option>
        <option value="access:1">Access</option>
      </select>
    {/if}
  </div>
  {#if editing !== 'new'}
    <button class="add" onclick={() => (editing = 'new')}>+ Add person</button>
  {/if}
</div>

<p class="count">
  {visible.length} of {users.length} people
  {#if filtering}· <button class="link" onclick={clearFilters}>Clear filters</button>{/if}
</p>

{#if editing === 'new'}
  <section class="card new">
    <h2>Add a person</h2>
    <UserForm wide={wide.current} onSaved={saved} onCancel={() => (editing = null)} />
  </section>
{/if}

{#if visible.length === 0}
  <p class="empty">Nobody matches these filters.</p>
{:else if wide.current}
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          {#each COLUMNS as column (column.label)}
            <th scope="col" aria-sort={column.key && sortKey === column.key ? (sortDir === 1 ? 'ascending' : 'descending') : undefined}>
              {#if column.key}
                {@const key = column.key}
                <button class="sort" class:active={sortKey === key} onclick={() => sortBy(key)}>
                  {column.label}
                  <span class="arrow" aria-hidden="true">{sortKey === key ? (sortDir === 1 ? '↑' : '↓') : '↕'}</span>
                </button>
              {:else}
                {column.label}
              {/if}
            </th>
          {/each}
          <th scope="col"><span class="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {#each visible as person (person.email)}
          <tr class:inactive={!person.active} class:open={editing === person.email}>
            <td>
              <span class="name">{person.name}</span>
              <span class="email">{person.email}</span>
            </td>
            <td>{calendarName(person)}</td>
            <td>
              {#if primaryRoleLabel(person)}
                <span class="primary">{primaryRoleLabel(person)}</span>
              {:else}
                <span class="unset">Not set</span>
              {/if}
            </td>
            <td class="plays">{plays(person).join(', ') || '—'}</td>
            <td>{@render badges(person)}</td>
            <td class="actions">
              {#if editing !== person.email}
                <button class="edit" onclick={() => (editing = person.email)}>Edit</button>
              {/if}
            </td>
          </tr>
          {#if editing === person.email}
            <tr class="form-row">
              <td colspan="6">
                <UserForm
                  user={person}
                  isSelf={person.email === currentEmail}
                  wide
                  onSaved={saved}
                  onCancel={() => (editing = null)}
                />
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <ul class="cards">
    {#each visible as person (person.email)}
      <li class="card" class:inactive={!person.active}>
        <div class="card-row">
          <div class="who">
            <span class="name">{person.name}</span>
            <span class="meta">
              {primaryRoleLabel(person) ?? 'Primary role not set'}
              {#if plays(person).length}· plays {plays(person).join(', ').toLowerCase()}{/if}
            </span>
          </div>
          {#if editing !== person.email}
            <button class="edit" onclick={() => (editing = person.email)}>Edit</button>
          {/if}
        </div>
        {@render badges(person)}
        {#if editing === person.email}
          <UserForm user={person} isSelf={person.email === currentEmail} onSaved={saved} onCancel={() => (editing = null)} />
        {/if}
      </li>
    {/each}
  </ul>
{/if}

{#if inactiveCount > 0}
  <label class="toggle">
    <input type="checkbox" bind:checked={showInactive} />
    Show {inactiveCount} inactive
  </label>
{/if}

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .filters select {
    font: 500 14px var(--font-family);
    min-height: 40px;
    padding: 0 30px 0 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 11px center;
    appearance: none;
  }

  .add {
    font-size: 14px;
    font-weight: 600;
    color: white;
    background: var(--color-primary);
    border: none;
    border-radius: var(--radius);
    padding: 0 14px;
    min-height: 40px;
  }

  .count {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 4px 0 12px;
  }

  .link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    color: var(--color-primary);
  }

  .empty {
    padding: 32px 0;
    text-align: center;
    color: #999;
    font-style: italic;
  }

  h2 {
    font-size: 16px;
  }

  .card {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 12px 14px;
  }

  .card.new {
    margin-bottom: 12px;
  }

  .inactive {
    opacity: 0.6;
  }

  .name {
    display: block;
    font-weight: 600;
    font-size: 15px;
  }

  .email,
  .meta {
    display: block;
    font-size: 13px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 999px;
    background: #f0f0f0;
    color: #444;
  }

  .badge.member {
    background: none;
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
  }

  .badge.admin {
    background: var(--color-bg-active);
    color: var(--color-primary);
  }

  .badge.superadmin {
    background: var(--color-primary);
    color: white;
  }

  .badge.off {
    background: #fef3f2;
    color: #b42318;
  }

  .edit {
    font-size: 14px;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 0 14px;
    min-height: 36px;
  }

  /* ---- Phones: cards ---- */

  .cards {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .card-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .who {
    flex: 1;
    min-width: 0;
  }

  /* ---- PC: table ---- */

  .table-wrap {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  th {
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    background: #fafafa;
    border-bottom: 1px solid var(--color-border);
    padding: 0 16px;
    height: 42px;
    white-space: nowrap;
  }

  .sort {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
  }

  .sort.active {
    color: var(--color-text);
  }

  .arrow {
    font-size: 11px;
    opacity: 0.5;
  }

  .sort.active .arrow {
    opacity: 1;
    color: var(--color-primary);
  }

  td {
    padding: 12px 16px;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: middle;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr:not(.form-row):hover {
    background: #fcfcfd;
  }

  tr.open td {
    background: var(--color-bg-active);
    border-bottom: none;
  }

  .form-row td {
    background: #fbfcff;
    border-bottom: 1px solid var(--color-border);
    padding: 0 16px 12px;
  }

  .primary {
    font-weight: 600;
  }

  .unset {
    color: #aaa;
    font-style: italic;
  }

  .plays {
    color: var(--color-text-secondary);
    max-width: 240px;
  }

  td.actions {
    text-align: right;
    width: 1%;
    white-space: nowrap;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--color-text-secondary);
    margin-top: 16px;
  }
</style>
