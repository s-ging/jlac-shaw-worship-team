<script lang="ts">
  import { invalidateAll } from '$app/navigation'
  import People from '$lib/components/admin/People.svelte'

  let { data } = $props()
</script>

<svelte:head><title>Admin · Praise Team Scheduler</title></svelte:head>

<div class="page">
  <div class="heading">
    <h1>People</h1>
    {#if data.canUseDataConsole}<a class="data-link" href="/admin/data">Data</a>{/if}
  </div>

  <People users={data.users} currentEmail={data.user?.email} onChanged={invalidateAll} />
</div>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: 20px 16px 48px;
  }

  /* The table needs the room; see People.svelte for the switch at 900px. */
  @media (min-width: 900px) {
    .page {
      max-width: 1120px;
      padding: 28px 24px 64px;
    }
  }

  .heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }

  h1 {
    font-size: 22px;
  }

  .data-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 10px;
    font-size: 14px;
    color: var(--color-primary);
    text-decoration: none;
  }
</style>
