<script lang="ts">
  import { page } from '$app/state'
  import BottomNav from '$lib/components/BottomNav.svelte'

  let { children, data } = $props()

  const isSuperAdmin = $derived(Boolean(data.user?.roles.isSuperAdmin))

  const tabs = $derived(
    [
      { href: '/admin', label: 'People', superOnly: true },
      { href: '/admin/log', label: 'Log', superOnly: false },
      { href: '/admin/analytics', label: 'Analytics', superOnly: true }
    ].filter((tab) => isSuperAdmin || !tab.superOnly)
  )

  // The data console (/admin/data) belongs with People, where it's linked from.
  const current = $derived(
    page.url.pathname.startsWith('/admin/log')
      ? '/admin/log'
      : page.url.pathname.startsWith('/admin/analytics')
        ? '/admin/analytics'
        : '/admin'
  )
</script>

<!-- One tab isn't a choice: admins see the Log without a tab bar over it. -->
{#if tabs.length > 1}
  <nav class="tabs" aria-label="Admin">
    {#each tabs as tab (tab.href)}
      <a href={tab.href} class:active={current === tab.href} aria-current={current === tab.href ? 'page' : undefined}>
        {tab.label}
      </a>
    {/each}
  </nav>
{/if}

<div class="content">
  {@render children()}
</div>

<BottomNav active="admin" />

<style>
  .tabs {
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 12px 16px 0;
  }

  .tabs a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text-secondary);
    text-decoration: none;
    border-bottom: 2px solid transparent;
  }

  .tabs a:hover:not(.active) {
    color: var(--color-text);
  }

  .tabs a.active {
    font-weight: 600;
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
  }

  /* Room for BottomNav (53px) below the last row. */
  .content {
    padding-bottom: 64px;
  }
</style>
