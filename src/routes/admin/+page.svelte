<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import UserForm from '$lib/components/admin/UserForm.svelte'
  import { tierOf, TIER_LABELS } from '$lib/roles'

  let { data } = $props()

  /** Email of the person being edited, 'new' while adding someone, or null. */
  let editing = $state<string | null>(null)
  let showInactive = $state(false)

  const visible = $derived(data.users.filter((u) => showInactive || u.active))
  const inactiveCount = $derived(data.users.filter((u) => !u.active).length)

  async function saved() {
    editing = null
    await invalidateAll()
  }
</script>

<svelte:head><title>Admin · Praise Team Scheduler</title></svelte:head>

<div class="page">
  <div class="heading">
    <h1>People</h1>
    <div class="heading-actions">
      {#if data.canUseDataConsole}<a class="data-link" href="/admin/data">Data</a>{/if}
      {#if editing !== 'new'}
        <button class="add" onclick={() => (editing = 'new')}>+ Add person</button>
      {/if}
    </div>
  </div>

  {#if editing === 'new'}
    <section class="card">
      <h2>Add a person</h2>
      <UserForm onSaved={saved} onCancel={() => (editing = null)} />
    </section>
  {/if}

  <ul class="people">
    {#each visible as person (person.email)}
      {@const tier = tierOf(person.roles)}
      <li class="card" class:inactive={!person.active}>
        <div class="row">
          <div class="who">
            <span class="name">{person.name}</span>
            <span class="email">{person.email}</span>
          </div>
          <div class="badges">
            {#if !person.active}<span class="badge off">Inactive</span>{/if}
            {#if tier !== 'member'}<span class="badge {tier}">{TIER_LABELS[tier]}</span>{/if}
            {#if person.roles.isMedia}<span class="badge">Media</span>{/if}
          </div>
          {#if editing !== person.email}
            <button class="edit" onclick={() => (editing = person.email)}>Edit</button>
          {/if}
        </div>
        {#if editing === person.email}
          <UserForm
            user={person}
            isSelf={person.email === data.user?.email}
            onSaved={saved}
            onCancel={() => (editing = null)}
          />
        {/if}
      </li>
    {/each}
  </ul>

  {#if inactiveCount > 0}
    <label class="toggle">
      <input type="checkbox" bind:checked={showInactive} />
      Show {inactiveCount} inactive
    </label>
  {/if}
</div>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: 20px 16px 48px;
  }

  .heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }

  h1 {
    font-size: 22px;
  }

  .heading-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .data-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 10px;
    font-size: 14px;
    color: var(--color-primary);
    text-decoration: none;
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
  }

  .people {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
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

  .inactive {
    opacity: 0.6;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
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

  .email {
    font-size: 13px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
  }

  .badge {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 7px;
    border-radius: 999px;
    background: #f0f0f0;
    color: #444;
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
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 8px 12px;
    min-height: 40px;
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
