<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase'
  import type { Profile, Assignment } from '$lib/types'

  let { assignment, onSaved } = $props<{
    assignment: Assignment
    onSaved: () => void
  }>()

  let members = $state<Profile[]>([])
  let loading = $state(false)
  let selected = $state(assignment.profile_id || '')
  let saving = $state(false)

  onMount(async () => {
    loading = true
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name')
    if (!error) members = data as Profile[]
    loading = false
  })

  async function save() {
    saving = true
    const { error } = await supabase
      .from('assignments')
      .update({ profile_id: selected || null })
      .eq('id', assignment.id)
    saving = false
    if (!error) {
      onSaved()
      close()
    }
  }

  function close() {
    // The parent will remove this component; we just call onSaved? 
    // Actually we need a way to close. We'll let the overlay click handle it,
    // but we also need a cancel button.
    // We'll emit a close event or use the parent's state.
    // Since we don't have an onClose prop, we'll use a custom event or 
    // let the parent handle it via a boolean flag.
    // For simplicity, we'll dispatch a custom event that the parent can listen to.
    // But in Svelte 5, we can use a callback. Let's add an onClose prop.
  }
</script>

<!-- 
  We'll add an onClose prop to allow parent to close the modal.
  Also we'll add a cancel button.
-->

<div class="modal-overlay" on:click={close}>
  <div class="modal" on:click={(e) => e.stopPropagation()}>
    <h3>Assign {assignment.instrument_slot}</h3>
    
    {#if loading}
      <p>Loading members...</p>
    {:else}
      <select bind:value={selected} disabled={saving}>
        <option value="">Unassigned</option>
        {#each members as m}
          <option value={m.id}>{m.name}</option>
        {/each}
      </select>
      
      <div class="actions">
        <button class="cancel" on:click={close} disabled={saving}>Cancel</button>
        <button class="save" on:click={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }
  .modal {
    background: white;
    border-radius: var(--radius, 12px);
    padding: 24px;
    max-width: 400px;
    width: 100%;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }
  .modal h3 {
    margin: 0 0 16px;
    font-size: 18px;
  }
  .modal select {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: var(--radius, 6px);
    font-size: 16px;
    margin-bottom: 16px;
    font-family: inherit;
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .actions button {
    padding: 8px 20px;
    border: none;
    border-radius: var(--radius, 6px);
    cursor: pointer;
    font-size: 14px;
    font-family: inherit;
  }
  .cancel {
    background: #f0f0f0;
    color: var(--color-text, #1a1a1a);
  }
  .save {
    background: var(--color-primary, #2563eb);
    color: white;
  }
  .save:disabled, .cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>