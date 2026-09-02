<script lang="ts">
  let { monthName, monthTheme, onPrev, onNext } = $props<{
    monthName: string
    monthTheme: string
    onPrev: () => void
    onNext: () => void
  }>()
</script>

<div class="month-header">
  <button class="nav-btn" onclick={onPrev}>‹</button>
  <h1>{monthName} - {monthTheme}</h1>
  <button class="nav-btn" onclick={onNext}>›</button>
</div>

<style>
  .month-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0 16px 0;
  }

  .month-header h1 {
    font-size: clamp(16px, 4vw, 24px);
    font-weight: 600;
    color: var(--color-text);
    text-align: center;
    flex: 1;
    margin: 0 8px;
  }

  .nav-btn {
    background: none;
    border: none;
    font-size: clamp(20px, 5vw, 32px);
    padding: 4px 12px;
    cursor: pointer;
    color: var(--color-text-secondary);
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }

  .nav-btn:hover {
    color: var(--color-text);
  }
</style>