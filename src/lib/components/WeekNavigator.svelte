<script lang="ts">
  import type { WeekWithDetails } from '$lib/types'

  let { weeks, selectedIndex, onSelect, onPrev, onNext } = $props<{
    weeks: WeekWithDetails[]
    selectedIndex: number
    onSelect: (index: number) => void
    onPrev: () => void
    onNext: () => void
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

<div class="week-nav">
  <button 
    class="week-nav-btn" 
    onclick={onPrev}
    disabled={selectedIndex === 0}
  >‹</button>

  <div class="week-scroll">
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
  </div>

  <button 
    class="week-nav-btn" 
    onclick={onNext}
    disabled={selectedIndex === weeks.length - 1}
  >›</button>
</div>

<style>
  .week-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0 16px 0;
  }

  .week-nav-btn {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    width: 36px;
    height: 36px;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    touch-action: manipulation;
  }

  .week-nav-btn:hover:not(:disabled) {
    background: var(--color-bg-hover);
  }

  .week-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .week-scroll {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .week-scroll::-webkit-scrollbar {
    height: 3px;
  }

  .week-scroll::-webkit-scrollbar-thumb {
    background: #d0d0d0;
    border-radius: 4px;
  }

  .week-list {
    display: flex;
    gap: 8px;
    padding: 4px 0;
  }

  .week-item {
    flex: 0 0 auto;
    padding: 8px 16px;
    border: 2px solid var(--color-border);
    border-radius: 20px;
    background: white;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 70px;
    transition: all 0.15s;
    font-family: inherit;
    touch-action: manipulation;
  }

  .week-item:hover:not(.active) {
    border-color: #999;
  }

  .week-item.active {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: white;
  }

  .week-item .week-date {
    font-weight: 600;
    font-size: 14px;
  }

  .week-item .week-leader {
    font-size: 11px;
    opacity: 0.6;
  }

  .week-item.active .week-leader {
    opacity: 0.9;
  }
</style>