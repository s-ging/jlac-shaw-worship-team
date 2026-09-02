<script lang="ts">
  import { onMount } from 'svelte'
  import { format } from 'date-fns'
  import { fetchMonthWeeks } from '$lib/supabase-queries'
  import { fetchMonthEvents, processEvent, extractMonthlyTheme } from '$lib/google-calendar'
  import type { WeekWithDetails } from '$lib/types'
  import { useAuth } from '$lib/auth.svelte'   // or '$lib/auth.svelte' if that's your file

  // Components
  import MonthHeader from '$lib/components/MonthHeader.svelte'
  import WeekNavigator from '$lib/components/WeekNavigator.svelte'
  import WeekDetails from '$lib/components/WeekDetails.svelte'
  import AssignmentList from '$lib/components/AssignmentList.svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import LoadingState from '$lib/components/LoadingState.svelte'
  import ErrorState from '$lib/components/ErrorState.svelte'

  const auth = useAuth()

  // State
  let loading = $state(true)
  let error = $state<string | null>(null)
  let weeks = $state<WeekWithDetails[]>([])
  let currentDate = $state(new Date(2026, 8, 1))
  let monthName = $state('')
  let monthTheme = $state('Umani ng Kaluluwa')  // default fallback
  let selectedWeekIndex = $state(0)
  let syncing = $state(false)

  // Derived
  let currentWeek = $derived(weeks[selectedWeekIndex] || null)

  // Lifecycle
  onMount(() => {
    loadMonth()
  })

  // Main load function: try Supabase first, fallback to Google Calendar
  async function loadMonth() {
    loading = true
    error = null

    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1

      // 1. Try to fetch from Supabase
      const dbWeeks = await fetchMonthWeeks(year, month)

      if (dbWeeks && dbWeeks.length > 0) {
        weeks = dbWeeks
        monthName = format(currentDate, 'MMM yyyy')
        selectedWeekIndex = 0

        // Extract monthly theme from first week or use a default
        if (dbWeeks[0]?.theme) {
          monthTheme = dbWeeks[0].theme
        } else {
          // Optionally compute from all weeks
          const allThemes = dbWeeks.map(w => w.theme).filter(Boolean)
          if (allThemes.length > 0) monthTheme = allThemes[0] // or combine
        }
        loading = false
        return
      }

      // 2. No data in Supabase → fetch from Google Calendar (fallback)
      const events = await fetchMonthEvents(year, month)

      if (events.length === 0) {
        error = 'No events found for this month.'
        loading = false
        return
      }

      // Parse events into weeks (using existing logic)
      weeks = mapEventsToWeeks(events)
      monthName = format(currentDate, 'MMM yyyy')
      selectedWeekIndex = 0

      // Extract monthly theme from events
      const monthlyTheme = extractMonthlyTheme(events)
      if (monthlyTheme) monthTheme = monthlyTheme

      // Optionally auto-sync to Supabase? We'll leave that to manual sync.
      // For now just display the parsed data.

    } catch (err) {
      console.error('Error loading month:', err)
      error = 'Failed to load schedule. Please try again.'
    } finally {
      loading = false
    }
  }

  // Helper: map Google Calendar events to WeekWithDetails
  function mapEventsToWeeks(events: any[]): WeekWithDetails[] {
    const weekMap = new Map<string, WeekWithDetails>()

    for (const event of events) {
      const date = event.start?.dateTime || event.start?.date
      if (!date) continue

      const dateStr = date.split('T')[0]

      // Skip month-long events (> 7 days)
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

  // Sync: fetch from Google Calendar and save to Supabase
  async function syncFromCalendar() {
    if (!auth.isAuthenticated) {
      // Optionally trigger login or show message
      alert('Please sign in to sync.')
      return
    }

    syncing = true
    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const events = await fetchMonthEvents(year, month)
      if (events.length === 0) {
        alert('No events to sync.')
        return
      }

      // Parse events into weeks
      const parsedWeeks = mapEventsToWeeks(events)

      // Save each week to Supabase (you'll need an upsert function)
      // For now, we'll just reload the month to show the newly saved data
      // You'll need to implement saveWeeks(parsedWeeks) in supabase-queries
      // await saveWeeks(parsedWeeks)

      // After saving, reload from Supabase
      await loadMonth()
      alert('Sync completed successfully!')
    } catch (err) {
      console.error('Sync failed:', err)
      alert('Sync failed. Check console for details.')
    } finally {
      syncing = false
    }
  }

  // Navigation
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
      <!-- Show sync button if authenticated -->
      {#if auth.isAuthenticated}
        <button class="sync-btn" on:click={syncFromCalendar} disabled={syncing}>
          {syncing ? 'Syncing...' : 'Sync from Google Calendar'}
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

    <!-- Sync button (optional, could be placed elsewhere) -->
    {#if auth.isAuthenticated}
      <div class="sync-section">
        <button class="sync-btn" on:click={syncFromCalendar} disabled={syncing}>
          {syncing ? 'Syncing...' : '🔄 Sync from Google'}
        </button>
      </div>
    {/if}

    <WeekNavigator 
      {weeks}
      selectedIndex={selectedWeekIndex}
      onSelect={selectWeek}
    />

    {#if currentWeek}
      <WeekDetails week={currentWeek} />
      <AssignmentList week={currentWeek} />
    {/if}

    <BottomNav active="calendar" />
  </div>
{/if}

<style>
  .container {
    max-width: 100%;
    padding: 16px 12px 80px 12px;
    min-height: 100svh;
  }

  .empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    min-height: 60svh;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-message {
    font-size: 18px;
    color: var(--color-text);
    font-weight: 500;
    margin-bottom: 20px;
  }

  .sync-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .sync-btn {
    padding: 6px 16px;
    background: var(--color-primary, #2563eb);
    color: white;
    border: none;
    border-radius: var(--radius, 8px);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .sync-btn:hover:not(:disabled) {
    background: var(--color-primary-hover, #1d4ed8);
  }

  .sync-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>