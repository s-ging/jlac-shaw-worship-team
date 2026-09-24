<script lang="ts">
  import { onMount } from 'svelte'
  import { format } from 'date-fns'
  import { fetchMonthEvents, processEvent, extractMonthlyTheme } from '$lib/google-calendar'
  import type { RsvpPerson, RsvpRecord, WeekWithDetails } from '$lib/types'

  import MonthHeader from '$lib/components/MonthHeader.svelte'
  import WeekNavigator from '$lib/components/WeekNavigator.svelte'
  import WeekDetails from '$lib/components/WeekDetails.svelte'
  import AssignmentList from '$lib/components/AssignmentList.svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import LoadingState from '$lib/components/LoadingState.svelte'
  import ErrorState from '$lib/components/ErrorState.svelte'
  import RsvpCard from '$lib/components/RsvpCard.svelte'
  import Lineup from '$lib/components/Lineup.svelte'
  import { extractLineup, isServiceEvent } from '$lib/lineup'
  import { isNamed, lineupNames } from '$lib/parts'
  import { canEditSchedule } from '$lib/roles'

  // Auth state comes from +layout.server.ts, so it is known at first paint.
  let { data } = $props()

  const canEdit = $derived(canEditSchedule(data.user))

  const today = new Date()
  let loading = $state(true)
  let error = $state<string | null>(null)
  let weeks = $state<WeekWithDetails[]>([])
  let currentDate = $state(new Date(today.getFullYear(), today.getMonth(), 1))
  let monthName = $state('')
  let monthTheme = $state('')
  let selectedWeekIndex = $state(0)

  let currentWeek = $derived(weeks[selectedWeekIndex] || null)

  // Filled by RsvpCard; the lineup ticks the names of people who answered.
  // The lineup's Save bar takes the docked spot from the RSVP buttons while editing.
  let editingLineup = $state(false)
  // A different week, or no editor shown for it, means no edit in progress.
  $effect(() => {
    void currentWeek
    editingLineup = false
  })
  let rsvps = $state<Record<string, RsvpRecord>>({})
  let people = $state<Record<string, RsvpPerson>>({})

  /**
   * The lineup is read from the service event, which is also what the editor
   * writes. Weeks without a lineup there fall back to whatever the other events
   * on that date list, unless an editor is about to fill it in.
   */
  /** Whether you're on this week's lineup. Only then does your RSVP dock above the nav. */
  const assigned = $derived.by(() => {
    if (!data.user || !currentWeek) return false
    const names = useServiceLineup
      ? lineupNames(extractLineup(currentWeek.service_description))
      : currentWeek.assignments.map((a) => a.profile?.name ?? '')
    return isNamed(data.user, names)
  })

  const useServiceLineup = $derived.by(() => {
    if (!currentWeek?.google_event_id) return false
    const lineup = extractLineup(currentWeek.service_description)
    return canEdit || lineup.slots.length > 0 || lineup.media.trim() !== ''
  })

  // ---- Main load: fetch from Google Calendar (display only, nothing persisted) ----
  /**
   * `keepDate` reselects that week after the reload, used after a lineup edit so
   * the view doesn't jump. Only the first load shows the spinner, so a refresh
   * doesn't blank the page.
   */
  async function loadMonth(keepDate?: string) {
    if (!keepDate) loading = true
    error = null

    try {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1

      const events = await fetchMonthEvents(year, month)

      if (events.length === 0) {
        error = 'No events found for this month.'
        loading = false
        return
      }

      weeks = mapEventsToWeeks(events)
      monthName = format(currentDate, 'MMM yyyy')
      selectedWeekIndex = pickWeek(keepDate)

      const monthlyTheme = extractMonthlyTheme(events)
      if (monthlyTheme) monthTheme = monthlyTheme
    } catch (err) {
      console.error('Error loading month:', err)
      error = 'Failed to load schedule. Please try again.'
    } finally {
      loading = false
    }
  }

  /** The kept week if given, otherwise the next Sunday that hasn't passed, otherwise the first. */
  function pickWeek(keepDate?: string): number {
    if (keepDate) {
      const kept = weeks.findIndex((w) => w.service_date === keepDate)
      if (kept >= 0) return kept
    }
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const upcoming = weeks.findIndex((w) => w.service_date >= todayStr)
    return upcoming >= 0 ? upcoming : 0
  }

  // Helper: map Google Calendar events to WeekWithDetails
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
          google_event_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          worship_leader: null,
          assignments: []
        })
      }
      const week = weekMap.get(dateStr)!
      // A date can hold several events (a fellowship, Salu-Salo). The editor writes to the service one.
      if (!week.google_event_id && event.id && isServiceEvent(event)) {
        week.google_event_id = event.id
        week.service_description = event.description ?? ''
      }
      const processed = processEvent(event)
      if (processed.theme) week.theme = processed.theme
      if (processed.playlistUrl) week.playlist_url = processed.playlistUrl
      week.assignments.push(...processed.assignments)
    }
    return Array.from(weekMap.values())
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

  onMount(() => loadMonth())
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
  <div class="container" class:docked={assigned || editingLineup}>
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
    />

    {#if currentWeek}
      <WeekDetails week={currentWeek} />
      {#if useServiceLineup && currentWeek.google_event_id}
        <Lineup
          eventId={currentWeek.google_event_id}
          description={currentWeek.service_description ?? ''}
          {canEdit}
          {rsvps}
          {people}
          onSaved={() => loadMonth(currentWeek.service_date)}
          bind:editing={editingLineup}
        />
      {:else}
        <AssignmentList week={currentWeek} />
      {/if}
      <!-- Editing is about who's assigned, not who's coming, so no RSVP while it's open. -->
      {#if !editingLineup}
        <RsvpCard weekId={currentWeek.service_date} user={data.user} bind:rsvps bind:people {assigned} />
      {/if}
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

  /* Clears the docked SecondNav and the bottom nav. */
  @media (max-width: 640px) {
    .container.docked {
      padding-bottom: 150px;
    }
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
</style>
