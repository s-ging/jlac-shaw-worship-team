<script lang="ts">
  import { onMount } from 'svelte'
  import { format } from 'date-fns'
  import { fetchMonthWeeks } from '$lib/supabase-queries'
  import { fetchMonthEvents, processEvent, extractMonthlyTheme } from '$lib/google-calendar'
  import type { WeekWithDetails } from '$lib/types'
  import { useAuth } from '$lib/auth.svelte'

  import MonthHeader from '$lib/components/MonthHeader.svelte'
  import WeekNavigator from '$lib/components/WeekNavigator.svelte'
  import WeekDetails from '$lib/components/WeekDetails.svelte'
  import AssignmentList from '$lib/components/AssignmentList.svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import LoadingState from '$lib/components/LoadingState.svelte'
  import ErrorState from '$lib/components/ErrorState.svelte'

  const auth = useAuth()

  let loading = $state(true)
  let syncing = $state(false)
  let error = $state<string | null>(null)
  let weeks = $state<WeekWithDetails[]>([])
  let currentDate = $state(new Date(2026, 8, 1))
  let monthName = $state('')
  let monthTheme = $state('')
  let selectedWeekIndex = $state(0)

  let currentWeek = $derived(weeks[selectedWeekIndex] || null)

  // ---- Main load: Supabase first, fallback to Google Calendar (display only) ----
  async function loadMonth() {
    loading = true
    error = null

    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1

      // 1. Try Supabase
      const dbWeeks = await fetchMonthWeeks(year, month)

      if (dbWeeks && dbWeeks.length > 0) {
        weeks = dbWeeks
        monthName = format(currentDate, 'MMM yyyy')
        selectedWeekIndex = 0

        // Extract theme from first week, or fallback to Google Calendar theme extraction
        if (dbWeeks[0]?.theme) {
          monthTheme = dbWeeks[0].theme
        } else {
          // Optionally fetch from Google just for theme
          const events = await fetchMonthEvents(year, month)
          const theme = extractMonthlyTheme(events)
          if (theme) monthTheme = theme
          else monthTheme = 'No theme'
        }
        loading = false
        return
      }

      // 2. No Supabase data → fetch from Google Calendar for preview (display only)
      const events = await fetchMonthEvents(year, month)

      if (events.length === 0) {
        error = 'No events found for this month.'
        loading = false
        return
      }

      // Parse events into weeks (in‑memory, not saved)
      weeks = mapEventsToWeeks(events)
      monthName = format(currentDate, 'MMM yyyy')
      selectedWeekIndex = 0

      const monthlyTheme = extractMonthlyTheme(events)
      if (monthlyTheme) monthTheme = monthlyTheme

      // We do NOT save; user must click sync to persist.
      // Show a hint that this is a preview.
    } catch (err) {
      console.error('Error loading month:', err)
      error = 'Failed to load schedule. Please try again.'
    } finally {
      loading = false
    }
  }

  // Helper: map Google Calendar events to WeekWithDetails (same as before)
  function mapEventsToWeeks(events: any[]): WeekWithDetails[] {
    const weekMap = new Map<string, WeekWithDetails>()
    for (const event of events) {
      const date = event.start?.dateTime || event.start?.date
      if (!date) continue
      const dateStr = date.split('T')[0]
      const start = event.start?.date || event.start?.dateTime
      const end = event.end?.date || event.end?.dateTime
      if (start && end) {
        const duration = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
        if (duration > 7) continue
      }
      if (!weekMap.has(dateStr)) {
        weekMap.set(dateStr, {
          id: `cal-${dateStr}`,
          service_date: dateStr,
          theme: '',
          playlist_url: '',
          worship_leader_id: null,
          is_published: true,
          google_event_id: event.id || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          worship_leader: null,
          assignments: []
        })
      }
      const week = weekMap.get(dateStr)!
      const processed = processEvent(event)
      if (processed.theme) week.theme = processed.theme
      if (processed.playlistUrl) week.playlist_url = processed.playlistUrl
      week.assignments.push(...processed.assignments)
    }
    return Array.from(weekMap.values())
  }

  // ---- Sync: fetch from Google Calendar and save to Supabase ----
  async function syncFromCalendar() {
    if (!auth.isWorshipLeader && !auth.isSuperAdmin) return
    syncing = true
    error = null

    try {
      const { syncCalendarToSupabase } = await import('$lib/supabase-queries')
      const events = await fetchMonthEvents(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      )
      const success = await syncCalendarToSupabase(events)

      if (success) {
        await loadMonth() // reload from DB
      } else {
        error = 'Sync failed. Please try again.'
      }
    } catch (err) {
      console.error('Sync error:', err)
      error = 'Failed to sync from Google Calendar.'
    } finally {
      syncing = false
    }
  }

  // ---- Navigation ----
  function prevMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    loadMonth()
  }
  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    loadMonth()
  }
  function selectWeek(index: number) {
    selectedWeekIndex = index
  }

  onMount(loadMonth)
</script>

{#if loading}
  <LoadingState />
{:else if error}
  <ErrorState message={error} onRetry={loadMonth} />
{:else if weeks.length === 0}
  <div class="container">
    <div class="empty-box">
      <p class="empty-icon">📅</p>
      <p class="empty-message">No events found for {monthName}</p>
      {#if auth.isWorshipLeader || auth.isSuperAdmin}
        <p class="empty-sub">Sync with Google Calendar to load data</p>
        <button class="sync-btn" on:click={syncFromCalendar} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      {/if}
    </div>
  </div>
{:else}
  <div class="container">
    <MonthHeader
      {monthName}
      {monthTheme}
      onPrev={prevMonth}
      onNext={nextMonth}
    />

    <!-- Admin bar with sync button -->
    {#if auth.isWorshipLeader || auth.isSuperAdmin}
      <div class="admin-bar">
        <button class="sync-btn-small" on:click={syncFromCalendar} disabled={syncing}>
          {syncing ? '⏳ Syncing...' : '🔄 Sync from Calendar'}
        </button>
        <!-- Optional: show hint if this is a preview (weeks from Google, not saved) -->
        {#if !weeks[0]?.id?.startsWith('cal-')}
          <span class="preview-hint">(Preview – not saved)</span>
        {/if}
      </div>
    {/if}

    <WeekNavigator
      {weeks}
      selectedIndex={selectedWeekIndex}
      onSelect={selectWeek}
    />

    {#if currentWeek}
      <WeekDetails week={currentWeek} />
      <AssignmentList
        week={currentWeek}
        editable={auth.isWorshipLeader || auth.isSuperAdmin}
        onUpdate={loadMonth}
      />
    {/if}

    <BottomNav active="calendar" />
  </div>
{/if}

<style>
  .container {
    max-width: 480px;
    margin: 0 auto;
    padding: 16px 12px 80px 12px;
    min-height: 100svh;
  }

  .empty-box {
    text-align: center;
    padding: 60px 20px;
  }
  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  .empty-message {
    font-size: 18px;
    color: var(--color-text-secondary, #666);
    margin-bottom: 8px;
  }
  .empty-sub {
    font-size: 14px;
    color: var(--color-text-secondary, #666);
  }
  .sync-btn {
    margin-top: 16px;
    padding: 10px 24px;
    background: var(--color-primary, #2563eb);
    color: white;
    border: none;
    border-radius: var(--radius, 8px);
    font-size: 16px;
    cursor: pointer;
    font-family: inherit;
  }
  .sync-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .admin-bar {
    padding: 8px 16px;
    background: #f0f4ff;
    border-bottom: 1px solid var(--color-border, #e5e5e5);
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
  }
  .sync-btn-small {
    padding: 4px 12px;
    background: transparent;
    color: var(--color-primary, #2563eb);
    border: 1px solid var(--color-primary, #2563eb);
    border-radius: var(--radius, 8px);
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }
  .sync-btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .preview-hint {
    font-size: 12px;
    color: var(--color-text-secondary, #888);
    font-style: italic;
  }
</style>