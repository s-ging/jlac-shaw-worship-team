<script lang="ts">
  import { onMount } from 'svelte'
  import { supabase } from '$lib/supabase'
  import type { Profile, Assignment } from '$lib/types'

  let { assignment, onUpdated } = $props<{
    assignment: Assignment
    onUpdated: () => void
  }>()

  let members = $state<Profile[]>([])
  let loading = $state(false)
  let selected = $state(assignment.profile_id)

  onMount(async () => {
    // Fetch all profiles to populate dropdown
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name')
    if (!error) members = data as Profile[]
  })

  async function save() {
    loading = true
    const { error } = await supabase
      .from('assignments')
      .update({ profile_id: selected })
      .eq('id', assignment.id)
    loading = false
    if (!error) onUpdated()
  }
</script>

<div class="edit-wrapper">
  <select bind:value={selected} disabled={loading}>
    {#each members as m}
      <option value={m.id}>{m.name}</option>
    {/each}
  </select>
  <button onclick={save} disabled={loading}>
    {loading ? 'Saving…' : 'Update'}
  </button>
</div>