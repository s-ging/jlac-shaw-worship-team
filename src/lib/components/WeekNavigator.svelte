<script lang="ts">
  import type { WeekWithDetails } from '$lib/types'

  let { weeks, selectedIndex, onSelect } = $props<{
    weeks: WeekWithDetails[]
    selectedIndex: number
    onSelect: (index: number) => void
  }>()

  function getWorshipLeader(week: WeekWithDetails) {
    const leader = week.assignments.find(a => a.instrument_slot === 'Lead Vocal')
    return leader?.profile?.nickname || '—'
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
</script>

<div class="week-list">
  {#each weeks as week, index}
    <button
      class="week-item {index === selectedIndex ? 'active' : ''}"
      onclick={() => onSelect(index)}
    >
      <span class="week-date">{formatDate(week.service_date)}</span>
      <span class="week-leader">{getWorshipLeader(week)}</span>
    </button>
  {/each}
</div>

<style>
  .week-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0 16px 0;
  }

  .week-item {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    background: white;
    cursor: pointer;
    font-size: 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: inherit;
    touch-action: manipulation;
    transition: all 0.15s;
    text-align: left;
  }

  .week-item:hover:not(.active) {
    border-color: #999;
    background: var(--color-bg-hover);
  }

  .week-item.active {
    border-color: var(--color-primary);
    background: var(--color-bg-active);
    border-left: 4px solid var(--color-primary);
  }

  .week-item .week-date {
    font-weight: 600;
    font-size: 15px;
    color: var(--color-text);
  }

  .week-item .week-leader {
    font-size: 14px;
    color: var(--color-text-secondary);
    flex: 0;
    margin: 0 12px;
  }
</style>