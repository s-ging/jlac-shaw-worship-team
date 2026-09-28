<script lang="ts">
  import { onMount } from 'svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import NotificationList from '$lib/components/NotificationList.svelte'
  import { clearBell } from '$lib/bell.svelte'

  let { data } = $props()

  // What was new stays highlighted on this visit; next time it's read.
  onMount(() => {
    clearBell()
    fetch('/api/notifications/seen', { method: 'POST' }).catch(() => {})
  })
</script>

<svelte:head><title>Notifications · Praise Team Scheduler</title></svelte:head>

<div class="page">
  <h1>Notifications</h1>
  <NotificationList notices={data.notices} />
  <p class="help">
    {#if data.emailOn}
      You also get these by email, gathered into one message. <a href="/me">Turn off under Me</a>.
    {:else}
      Lineup emails are off. <a href="/me">Turn them on under Me</a>.
    {/if}
  </p>
  <BottomNav active={null} />
</div>

<style>
  .page {
    max-width: 480px;
    margin: 0 auto;
    padding: 20px 16px 96px;
  }

  h1 {
    font-size: 22px;
    margin-bottom: 14px;
  }

  .help {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-top: 12px;
  }
</style>
