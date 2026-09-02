<script lang="ts">
  import AssignmentRow from './AssignmentRow.svelte'
  import type { WeekWithDetails, Assignment } from '$lib/types'
  import { getRoleLabel, getStatusIcon } from '$lib/group-assignments'

  let { week } = $props<{
    week: WeekWithDetails
  }>()

  const vocalSlots = ['Lead Vocal', 'Sub-Lead Vocal', 'Secondary Vocal'] as const

  function getAssignmentsBySlot(slot: string): Assignment[] {
    return week.assignments?.filter((a: Assignment) => a.instrument_slot === slot) || []
  }

  function getMediaMembers(): Assignment[] {
    return week.assignments?.filter((a: Assignment) => a.instrument_slot === 'Media') || []
  }

  function isInstrumentalist(assignment: Assignment): boolean {
    return !vocalSlots.includes(assignment.instrument_slot as any) 
      && assignment.instrument_slot !== 'Media'
  }

  function getProfileName(assignment: Assignment): string {
    return assignment.profile?.nickname || assignment.profile_id || 'Unknown'
  }

  // Compute media members once in the script
  const mediaMembers = getMediaMembers()
</script>

<!-- Vocalists -->
<div class="group">
  <h3 class="group-title">🎤 VOCALISTS</h3>
  {#each vocalSlots as slot}
    {@const assignments = getAssignmentsBySlot(slot)}
    {#each assignments as assignment}
      <AssignmentRow 
        status={getStatusIcon(assignment.confirmed)}
        role={getRoleLabel(assignment.instrument_slot)}
        name={getProfileName(assignment)}
      />
    {/each}
  {/each}
</div>

<!-- Instrumentalists - ANY non-vocal, non-media assignment -->
<div class="group">
  <h3 class="group-title">🎸 INSTRUMENTALISTS</h3>
  {#each week.assignments as assignment}
    {#if isInstrumentalist(assignment)}
      <AssignmentRow 
        status={getStatusIcon(assignment.confirmed)}
        role={getRoleLabel(assignment.instrument_slot)}
        name={getProfileName(assignment)}
      />
    {/if}
  {/each}
  {#if !week.assignments.some((a: Assignment) => isInstrumentalist(a))}
    <AssignmentRow empty={true} role="No instrumentalists assigned" />
  {/if}
</div>

<!-- Media -->
{#if mediaMembers.length > 0}
  <div class="group">
    <h3 class="group-title">📹 MEDIA</h3>
    {#each mediaMembers as assignment}
      <AssignmentRow 
        status={getStatusIcon(assignment.confirmed)}
        role="📹 Media"
        name={getProfileName(assignment)}
      />
    {/each}
  </div>
{/if}

<style>
  .group {
    margin-bottom: 20px;
  }

  .group-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 2px solid var(--color-border);
  }
</style>