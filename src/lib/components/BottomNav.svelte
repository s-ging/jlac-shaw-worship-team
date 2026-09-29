<script lang="ts">
  import { page } from '$app/state'
  import { canEditSchedule } from '$lib/roles'

  /** null on pages that aren't one of these tabs. */
  let { active = 'calendar' } = $props<{
    active?: 'calendar' | 'admin' | 'me' | null
  }>()

  // Admins (song leaders) get the Log inside; superadmins get People and Analytics too.
  const showAdmin = $derived(canEditSchedule(page.data.user))
</script>

<nav class="bottom-nav">
  <a href="/" class="nav-item {active === 'calendar' ? 'active' : ''}">
    📅 Calendar
  </a>
  {#if showAdmin}
    <a href="/admin" class="nav-item {active === 'admin' ? 'active' : ''}">
      🛠️ Admin
    </a>
  {/if}
  <a href="/me" class="nav-item {active === 'me' ? 'active' : ''}">
    👤 Me
  </a>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
    align-items: center;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    padding: 8px 0 env(safe-area-inset-bottom, 8px) 0;
    box-shadow: 0 -2px 10px var(--color-shadow);
    z-index: 100;
  }

  .nav-item {
    display: flex;
    align-items: center;
    background: none;
    border: none;
    font-size: 14px;
    padding: 8px 16px;
    color: var(--color-text-muted);
    cursor: pointer;
    font-weight: 500;
    text-decoration: none;
    touch-action: manipulation;
    min-height: 44px;
    min-width: 44px;
  }

  .nav-item.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  .nav-item:hover:not(.active) {
    color: var(--color-text-secondary);
  }
</style>
