<script lang="ts">
  import { onMount } from 'svelte'
  import { format } from 'date-fns'
  import { fetchMonthEvents, processEvent, extractMonthlyTheme } from '$lib/google-calendar'
  import { getRoleLabel, getStatusIcon } from '$lib/group-assignments'
  import type { WeekWithDetails } from '$lib/types'

  let loading = $state(true)
  let error = $state<string | null>(null)
  let weeks = $state<WeekWithDetails[]>([])
  
  let currentDate = $state(new Date(2026, 8, 1))
  let monthName = $state('')
  let monthTheme = $state('Umani ng Kaluluwa')

  onMount(async () => {
    await loadMonth()
  })

  async function loadMonth() {
    loading = true
    error = null
    
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    
    try {
      const events = await fetchMonthEvents(year, month)
      
      if (events.length === 0) {
        error = 'No events found. Please make sure the calendar is shared with the API key.'
        loading = false
        return
      }
      
      weeks = mapEventsToWeeks(events)
      monthName = format(currentDate, 'MMM yyyy')
      
      // Get monthly theme from month-long event
      const monthlyTheme = extractMonthlyTheme(events)
      if (monthlyTheme) monthTheme = monthlyTheme
      
    } catch (err) {
      console.error('Error loading month:', err)
      error = 'Sorry, there seems to be a problem with the network. Please try again.'
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
      
      // Skip month-long events (duration > 7 days)
      const start = event.start?.date || event.start?.dateTime
      const end = event.end?.date || event.end?.dateTime
      if (start && end) {
        const startDate = new Date(start)
        const endDate = new Date(end)
        const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
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

  function formatDate(dateStr: string) {
    return format(new Date(dateStr), 'MMM d')
  }

  function getWorshipLeader(week: WeekWithDetails) {
    const leader = week.assignments.find(a => a.instrument_slot === 'Lead Vocal')
    return leader?.profile?.nickname || '—'
  }

  function getAssignmentsBySlot(week: WeekWithDetails, slot: string) {
    return week.assignments?.filter(a => a.instrument_slot === slot) || []
  }

  function getMediaMembers(week: WeekWithDetails) {
    return week.assignments?.filter(a => a.instrument_slot === 'Media') || []
  }

  function prevMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    setTimeout(() => loadMonth(), 100)
  }

  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    setTimeout(() => loadMonth(), 100)
  }
</script>

{#if loading}
  <!-- Skeleton Loader -->
  <div class="container">
    <div class="skeleton-header"></div>
    <div class="skeleton-row" style="height: 60px;"></div>
    <div class="skeleton-row" style="height: 60px;"></div>
    <div class="skeleton-row" style="height: 60px;"></div>
    <div class="skeleton-row" style="height: 60px;"></div>
    <div class="skeleton-divider"></div>
    <div class="skeleton-text" style="height: 30px;"></div>
    <div class="skeleton-text" style="height: 20px;"></div>
    <div class="skeleton-divider"></div>
    <div class="skeleton-row" style="height: 40px;"></div>
    <div class="skeleton-row" style="height: 40px;"></div>
    <div class="skeleton-row" style="height: 40px;"></div>
  </div>
{:else if error}
  <!-- Error Fallback -->
  <div class="container">
    <div class="error-box">
      <p class="error-icon">⚠️</p>
      <p class="error-message">{error}</p>
      <button onclick={loadMonth} class="retry-btn">Try Again</button>
    </div>
  </div>
{:else if weeks.length === 0}
  <!-- No Events Found -->
  <div class="container">
    <div class="empty-box">
      <p class="empty-icon">📅</p>
      <p class="empty-message">No events found for {monthName}</p>
      <p class="empty-sub">Check back later or create events in Google Calendar</p>
    </div>
  </div>
{:else}
  <div class="container">
    <!-- Month Header -->
    <div class="month-header">
      <button onclick={prevMonth} class="nav-btn">‹</button>
      <h1>{monthName} - {monthTheme}</h1>
      <button onclick={nextMonth} class="nav-btn">›</button>
    </div>

    <!-- Week Rows -->
    <div class="week-rows">
      {#each weeks as week}
        <div class="week-row">
          <span class="date">{formatDate(week.service_date)}</span>
          <span class="leader">{getWorshipLeader(week)}</span>
        </div>
      {/each}
    </div>

    <hr class="divider" />

    <!-- Theme & Playlist -->
    {#if weeks.length > 0}
      {@const week = weeks[0]}
      <div class="theme-section">
        <span class="theme-label">Theme:</span>
        <span class="theme-value">{week.theme || 'No theme set'}</span>
      </div>
      <div class="playlist-section">
        <span class="playlist-label">🎵</span>
        {#if week.playlist_url}
          <a href={week.playlist_url} target="_blank" class="playlist-link">
            YouTube Playlist
          </a>
        {:else}
          <span class="playlist-empty">No playlist set</span>
        {/if}
      </div>
    {/if}

    <hr class="divider" />

    <!-- Team Grid -->
    {#if weeks.length > 0}
      {@const week = weeks[0]}
      
      <!-- Vocalists -->
      <div class="instrument-group">
        <h3 class="group-title">🎤 VOCALISTS</h3>
        {#each ['Lead Vocal', 'Sub-Lead Vocal', 'Secondary Vocal'] as slot}
          {@const assignments = getAssignmentsBySlot(week, slot)}
          {#each assignments as assignment}
            <div class="member-row">
              <span class="status">{getStatusIcon(assignment.confirmed)}</span>
              <span class="role">{getRoleLabel(assignment.instrument_slot)}</span>
              <span class="name">{assignment.profile.nickname}</span>
            </div>
          {/each}
        {/each}
      </div>

      <!-- Instrumentalists -->
      <div class="instrument-group">
        <h3 class="group-title">🎸 INSTRUMENTALISTS</h3>
        
        <!-- Show all instrumentalists -->
        {#each week.assignments as assignment}
          {#if ['Drums', 'Bass', 'Lead', 'Rhythm', 'Guitar', 'L. Guitar', 'Lead Guitar', 'Rhythm Guitar'].includes(assignment.instrument_slot)}
            <div class="member-row">
              <span class="status">{getStatusIcon(assignment.confirmed)}</span>
              <span class="role">{getRoleLabel(assignment.instrument_slot)}</span>
              <span class="name">{assignment.profile.nickname}</span>
            </div>
          {/if}
        {/each}
        
        <!-- Show message if no instrumentalists -->
        {#if !week.assignments.some(a => ['Drums', 'Bass', 'Lead', 'Rhythm', 'Guitar', 'L. Guitar', 'Lead Guitar', 'Rhythm Guitar'].includes(a.instrument_slot))}
          <div class="member-row">
            <span class="status">➖</span>
            <span class="role">No instrumentalists assigned</span>
            <span class="name">—</span>
          </div>
        {/if}
      </div>

      <!-- Media -->
      {@const mediaMembers = getMediaMembers(week)}
      {#if mediaMembers.length > 0}
        <div class="instrument-group">
          <h3 class="group-title">📹 MEDIA</h3>
          {#each mediaMembers as assignment}
            <div class="member-row">
              <span class="status">{getStatusIcon(assignment.confirmed)}</span>
              <span class="role">📹 Media</span>
              <span class="name">{assignment.profile.nickname}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Bottom Navigation -->
    <nav class="bottom-nav">
      <button class="nav-item active">📅 Calendar</button>
      <button class="nav-item">🎵 Music</button>
      <button class="nav-item">👤 Me</button>
    </nav>
  </div>
{/if}

<style>
  /* ===== RESET ===== */
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  /* ===== CONTAINER ===== */
  .container {
    max-width: 100%;
    padding: 16px 12px 80px 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #fafafa;
    min-height: 100svh;
  }

  /* ===== MONTH HEADER ===== */
  .month-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0 16px 0;
  }

  .month-header h1 {
    font-size: clamp(16px, 4vw, 24px);
    font-weight: 600;
    color: #1a1a1a;
    text-align: center;
    flex: 1;
  }

  .nav-btn {
    background: none;
    border: none;
    font-size: clamp(20px, 5vw, 32px);
    padding: 4px 12px;
    cursor: pointer;
    color: #666;
    touch-action: manipulation;
    min-height: 44px;
    min-width: 44px;
  }

  /* ===== WEEK ROWS ===== */
  .week-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .week-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .date {
    font-size: clamp(14px, 3vw, 18px);
    font-weight: 500;
    color: #1a1a1a;
  }

  .leader {
    font-size: clamp(14px, 3vw, 18px);
    color: #4a4a4a;
  }

  /* ===== DIVIDER ===== */
  .divider {
    border: none;
    border-top: 2px solid #e5e5e5;
    margin: 16px 0;
    opacity: 0.5;
  }

  /* ===== THEME & PLAYLIST ===== */
  .theme-section, .playlist-section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
  }

  .theme-label {
    font-size: clamp(13px, 2.5vw, 16px);
    font-weight: 500;
    color: #666;
  }

  .theme-value {
    font-size: clamp(13px, 2.5vw, 16px);
    color: #1a1a1a;
  }

  .playlist-label {
    font-size: clamp(16px, 3vw, 20px);
  }

  .playlist-link {
    font-size: clamp(13px, 2.5vw, 16px);
    color: #2563eb;
    text-decoration: underline;
    word-break: break-all;
  }

  .playlist-empty {
    font-size: clamp(13px, 2.5vw, 16px);
    color: #999;
  }

  /* ===== TEAM GRID ===== */
  .instrument-group {
    margin-bottom: 20px;
  }

  .group-title {
    font-size: clamp(14px, 3vw, 18px);
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 2px solid #e5e5e5;
  }

  .member-row {
    display: grid;
    grid-template-columns: 28px 1fr 1.2fr;
    align-items: center;
    padding: 8px 4px;
    gap: 4px;
    border-bottom: 1px solid #f0f0f0;
  }

  .member-row:last-child {
    border-bottom: none;
  }

  .status {
    font-size: clamp(14px, 3vw, 18px);
    text-align: center;
  }

  .role {
    font-size: clamp(12px, 2.2vw, 15px);
    color: #666;
    white-space: nowrap;
  }

  .name {
    font-size: clamp(13px, 2.5vw, 16px);
    font-weight: 500;
    color: #1a1a1a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: right;
  }

  /* ===== BOTTOM NAV ===== */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
    align-items: center;
    background: white;
    border-top: 1px solid #e5e5e5;
    padding: 8px 0 env(safe-area-inset-bottom, 8px) 0;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    z-index: 100;
  }

  .nav-item {
    background: none;
    border: none;
    font-size: clamp(12px, 2.5vw, 16px);
    padding: 8px 16px;
    color: #999;
    cursor: pointer;
    touch-action: manipulation;
    min-height: 44px;
    min-width: 44px;
    font-weight: 500;
  }

  .nav-item.active {
    color: #2563eb;
    font-weight: 600;
  }

  /* ===== SKELETON LOADER ===== */
  .skeleton-header {
    height: 40px;
    background: #e5e5e5;
    border-radius: 8px;
    margin-bottom: 16px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-row {
    background: #e5e5e5;
    border-radius: 8px;
    margin-bottom: 8px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-divider {
    height: 2px;
    background: #e5e5e5;
    margin: 16px 0;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-text {
    background: #e5e5e5;
    border-radius: 4px;
    margin-bottom: 4px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* ===== ERROR / EMPTY STATES ===== */
  .error-box, .empty-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    min-height: 60svh;
  }

  .error-icon, .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .error-message, .empty-message {
    font-size: clamp(16px, 3vw, 20px);
    color: #1a1a1a;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .empty-sub {
    font-size: clamp(13px, 2.5vw, 16px);
    color: #999;
  }

  .retry-btn {
    background: #2563eb;
    color: white;
    border: none;
    padding: 12px 32px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    touch-action: manipulation;
    min-height: 44px;
    margin-top: 16px;
  }
</style>