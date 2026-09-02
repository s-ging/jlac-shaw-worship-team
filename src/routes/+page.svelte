<script lang="ts">
  import { onMount } from 'svelte'
  import { format } from 'date-fns'
  import { fetchMonthEvents, processEvent, extractMonthlyTheme } from '$lib/google-calendar'
  import type { WeekWithDetails } from '$lib/types'

  // Components
  import MonthHeader from '$lib/components/MonthHeader.svelte'
  import WeekNavigator from '$lib/components/WeekNavigator.svelte'
  import WeekDetails from '$lib/components/WeekDetails.svelte'
  import AssignmentList from '$lib/components/AssignmentList.svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import LoadingState from '$lib/components/LoadingState.svelte'
  import ErrorState from '$lib/components/ErrorState.svelte'

  // State
  let loading = $state(true)
  let error = $state<string | null>(null)
  let weeks = $state<WeekWithDetails[]>([])
  let currentDate = $state(new Date(2026, 8, 1))
  let monthName = $state('')
  let monthTheme = $state('Umani ng Kaluluwa')
  let selectedWeekIndex = $state(0)

  // Derived
  let currentWeek = $derived(weeks[selectedWeekIndex] || null)
  let weekCount = $derived(weeks.length)

  // Lifecycle
  onMount(async () => {
    await loadMonth()
  })

  // Functions
  async function loadMonth() {
    loading = true
    error = null

    try {
      const events = await fetchMonthEvents(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      )

      if (events.length === 0) {
        error = 'No events found for this month.'
        loading = false
        return
      }

      weeks = mapEventsToWeeks(events)
      monthName = format(currentDate, 'MMM yyyy')
      selectedWeekIndex = 0

      const monthlyTheme = extractMonthlyTheme(events)
      if (monthlyTheme) monthTheme = monthlyTheme
    } catch (err) {
      console.error('Error loading month:', err)
      error = 'Failed to load schedule. Please try again.'
    } finally {
      loading = false
    }
  }

  function mapEventsToWeeks(events: any[]): WeekWithDetails[] {
    const weekMap = new Map<string, WeekWithDetails>()

    for (const event of events) {
      const date = event.start?.dateTime || event.start?.date
      if (!date) continue

      const dateStr = date.split('T')[0]

      // Skip month-long events
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

  function prevMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    loadMonth()
  }

  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    loadMonth()
  }

  function prevWeek() {
    if (selectedWeekIndex > 0) selectedWeekIndex--
  }

  function nextWeek() {
    if (selectedWeekIndex < weeks.length - 1) selectedWeekIndex++
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

    <WeekNavigator 
      {weeks}
      selectedIndex={selectedWeekIndex}
      onSelect={selectWeek}
      onPrev={prevWeek}
      onNext={nextWeek}
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
  }
</style>