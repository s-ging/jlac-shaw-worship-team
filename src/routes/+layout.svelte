<svelte:head>
  <meta name="google-site-verification" content="google6a49a98eb50e8f0b.html" />
</svelte:head>

<script lang="ts">
  import { onMount } from 'svelte';
  import { useAuth } from '$lib/auth.svelte';
  import '../lib/styles/global.css';

  let { children } = $props(); // 👈 Svelte 5 slot declaration

  const auth = useAuth();

  onMount(() => {
    auth.initAuth();
  });
</script>

<div class="layout">
  {#if auth.loading}
    <div class="auth-loading">
      <div class="spinner"></div>
    </div>
  {:else}
    <header class="app-header">
      <a href="/" class="app-title">📅 Praise Team Scheduler</a>
      <div class="user-section">
        {#if auth.isAuthenticated}
          <span class="user-name">{auth.profile?.nickname || auth.user?.email}</span>
          <button class="logout-btn" onclick={auth.signOut}>Logout</button>
        {:else}
          <button class="login-btn" onclick={auth.signInWithGoogle}>
            Sign In with Google
          </button>
        {/if}
      </div>
    </header>
    <main class="app-content">
      {@render children()}
    </main>
  {/if}
</div>

<style>
  .layout {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .auth-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100svh;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--color-border, #e5e5e5);
    border-top-color: var(--color-primary, #2563eb);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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

  .user-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text, #1a1a1a);
  }

  .login-btn,
  .logout-btn {
    padding: 6px 16px;
    border: none;
    border-radius: var(--radius, 8px);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .login-btn {
    background: var(--color-primary, #2563eb);
    color: white;
  }

  .login-btn:hover {
    background: var(--color-primary-hover, #1d4ed8);
  }

  .logout-btn {
    background: transparent;
    color: var(--color-text-secondary, #666);
    border: 1px solid var(--color-border, #e5e5e5);
  }

  .logout-btn:hover {
    background: #fee;
    border-color: #fcc;
    color: #c00;
  }

  .app-content {
    flex: 1;
  }
</style>