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
  <div class="month-info">
      <h1>{monthName}</h1>
      <h2>{monthTheme}</h2>
  </div>
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

  .month-header h2 {
    font-size: clamp(16px, 3vw, 18px);
    font-weight: 400;
    color: var(--color-text-secondary);
    text-align: center;
    flex: 1;
    margin: 0 8px;
  }

  .month-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
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