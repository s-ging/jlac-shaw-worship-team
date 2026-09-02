<div class="container">
  <div class="skeleton-header"></div>
  <div class="skeleton-row"></div>
  <div class="skeleton-row"></div>
  <div class="skeleton-row"></div>
  <div class="skeleton-row"></div>
  <div class="skeleton-divider"></div>
  <div class="skeleton-text"></div>
  <div class="skeleton-text"></div>
  <div class="skeleton-divider"></div>
  <div class="skeleton-row" style="height: 40px;"></div>
  <div class="skeleton-row" style="height: 40px;"></div>
  <div class="skeleton-row" style="height: 40px;"></div>
</div>

<style>
  .container {
    max-width: 100%;
    padding: 16px 12px 80px 12px;
    min-height: 100svh;
  }

  .skeleton-header {
    height: 40px;
    background: #e5e5e5;
    border-radius: var(--radius);
    margin-bottom: 16px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-row {
    height: 50px;
    background: #e5e5e5;
    border-radius: var(--radius);
    margin-bottom: 8px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-divider {
    height: 2px;
    background: #e5e5e5;
    margin: 16px 0;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-text {
    height: 20px;
    background: #e5e5e5;
    border-radius: 4px;
    margin-bottom: 6px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>