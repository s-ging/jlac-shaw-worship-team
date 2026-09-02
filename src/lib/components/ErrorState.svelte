<script lang="ts">
  let { message, onRetry } = $props<{
    message: string
    onRetry: () => void
  }>()
</script>

<div class="container">
  <div class="error-box">
    <p class="error-icon">⚠️</p>
    <p class="error-message">{message}</p>
    <button class="retry-btn" onclick={onRetry}>Try Again</button>
  </div>
</div>

<style>
  .container {
    max-width: 100%;
    padding: 16px 12px 80px 12px;
    min-height: 100svh;
  }

  .error-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    min-height: 60svh;
  }

  .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .error-message {
    font-size: 18px;
    color: var(--color-text);
    font-weight: 500;
    margin-bottom: 16px;
  }

  .retry-btn {
    background: var(--color-primary);
    color: white;
    border: none;
    padding: 12px 32px;
    border-radius: var(--radius);
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    touch-action: manipulation;
    min-height: 44px;
  }

  .retry-btn:hover {
    background: var(--color-primary-hover);
  }
</style>