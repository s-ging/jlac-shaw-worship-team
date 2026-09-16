<svelte:head>
  <meta name="google-site-verification" content="8hpVksQEhGH5FGCx-03VCdN9Upt_OKcLn4cowsuoT4I" />
</svelte:head>

<script lang="ts">
  import '../lib/styles/global.css';

  let { children } = $props(); // 👈 Svelte 5 slot declaration
</script>

<div class="layout">
  <header class="app-header">
    <a href="/" class="app-title">📅 Praise Team Scheduler</a>
  </header>
  <main class="app-content">
    {@render children()}
  </main>
</div>

<style>
  .layout {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: white;
    border-bottom: 1px solid var(--color-border, #e5e5e5);
    flex-shrink: 0;
  }

  .app-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text, #1a1a1a);
    text-decoration: none;
  }

  .app-title:hover {
    text-decoration: underline;
  }

  .app-content {
    flex: 1;
  }
</style>