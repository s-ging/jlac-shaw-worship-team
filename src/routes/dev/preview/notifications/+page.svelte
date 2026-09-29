<script lang="ts">
  import { onMount } from 'svelte'
  import { addDays, format, nextSunday } from 'date-fns'
  import NotificationList from '$lib/components/NotificationList.svelte'
  import { calendarName } from '$lib/parts'
  import type { AssignmentNotice } from '$lib/types'
  import { loadRoster } from '../../roster'

  /**
   * `npm run dev`, then open /dev/preview/notifications. The bell's list as the
   * first person on the roster would see it, with the roster's admins as the
   * ones assigning them. Dates are the coming Sundays.
   */

  type Notice = AssignmentNotice & { unread: boolean }
  let notices = $state<Notice[]>([])
  let loaded = $state(false)
  let empty = $state(false)

  onMount(async () => {
    const roster = await loadRoster()
    loaded = true
    const me = roster[0]
    if (!me) return
    const leaders = roster.filter((u) => u.roles.isWorshipLeader)
    const by = (i: number) => calendarName(leaders[i % Math.max(leaders.length, 1)] ?? me)
    const sunday = (weeks: number) => format(addDays(nextSunday(new Date()), weeks * 7), 'yyyy-MM-dd')
    const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
    const notice = (weeks: number, parts: string[], minutes: number, unread: boolean, i: number): Notice => ({
      email: me.email, date: sunday(weeks), parts, by: by(i), updatedAt: ago(minutes), emailedParts: [], unread
    })
    notices = [notice(2, ['Bass'], 12, true, 0), notice(3, ['Bass', 'Media'], 40, true, 1), notice(0, ['Media'], 60 * 26, false, 0)]
  })
</script>

<div class="page">
  <p class="banner">
    <strong>Dev preview</strong> · Notifications, from scripts/roster.tsv.
    <label><input type="checkbox" bind:checked={empty} /> Show empty</label>
  </p>
  <h1>Notifications</h1>
  {#if !loaded}
    <p>Loading…</p>
  {:else}
    <NotificationList notices={empty ? [] : notices} />
  {/if}
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

  .banner {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: 13px;
    background: var(--color-warning-bg);
    border: 1px solid var(--color-warning-border);
    border-radius: 8px;
    padding: 8px 12px;
    margin-bottom: 16px;
  }
</style>
