<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation'
  import { page } from '$app/state'
  import '../lib/styles/global.css'

  let { children, data } = $props()

  let signingOut = $state(false)

  async function signOut() {
    signingOut = true
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      await invalidateAll()
      await goto('/')
    } finally {
      signingOut = false
    }
  }

  const displayName = $derived(data.user?.nickname || data.user?.name?.split(' ')[0] || '')
</script>

<svelte:head>
  <meta name="google-site-verification" content="8hpVksQEhGH5FGCx-03VCdN9Upt_OKcLn4cowsuoT4I" />
</svelte:head>

<div class="layout">
  <header class="app-header">
    <a href="/" class="app-title">📅 Praise Team Scheduler</a>

    {#if data.user}
      <div class="account">
        <span class="greeting">{displayName}</span>
        <button class="link-btn" onclick={signOut} disabled={signingOut}>
          {signingOut ? '…' : 'Sign out'}
        </button>
      </div>
    {:else if page.url.pathname !== '/login'}
      <a class="signin-btn" href="/login">Sign in</a>
    {/if}
  </header>

  <main class="app-content">
    {@render children()}
  </main>

  <footer class="app-footer">
    <a href="/privacy">Privacy</a>
    <span aria-hidden="true">·</span>
    <a href="/terms">Terms</a>
  </footer>
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
    gap: 12px;
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

  .account {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
  }

  .greeting {
    font-weight: 600;
    color: var(--color-text, #1a1a1a);
  }

  .link-btn {
    background: none;
    border: none;
    padding: 6px 2px;
    font-size: 14px;
    color: var(--color-text-secondary, #666);
    cursor: pointer;
    text-decoration: underline;
  }

  .link-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .signin-btn {
    font-size: 14px;
    font-weight: 600;
    color: white;
    background: var(--color-primary, #2563eb);
    padding: 8px 14px;
    border-radius: 8px;
    text-decoration: none;
  }

  .app-content {
    flex: 1;
  }

  .app-footer {
    display: flex;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    font-size: 13px;
    color: var(--color-text-secondary, #666);
  }

  .app-footer a {
    color: inherit;
  }
</style>
