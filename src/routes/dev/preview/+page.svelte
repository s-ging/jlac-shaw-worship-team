<script lang="ts">
  import { onMount } from 'svelte'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import Lineup from '$lib/components/Lineup.svelte'
  import RsvpCard from '$lib/components/RsvpCard.svelte'
  import { fetchMonthEvents } from '$lib/google-calendar'
  import { extractLineup, isServiceEvent, writeLineup, type Lineup as LineupData } from '$lib/lineup'
  import { calendarName, isNamed, lineupNames, namesOf } from '$lib/parts'
  import { canEditSchedule, rolesForTier, type Tier } from '$lib/roles'
  import type { PublicUser, RsvpPerson, RsvpRecord } from '$lib/types'

  /**
   * `npm run dev`, then open /dev/preview. The real lineup and RSVP components
   * with the calls they make to our API answered here, so no sign-in, KV or
   * Google write access is needed.
   *
   * - Team: scripts/roster.tsv, the same file import-users.mjs loads into KV.
   *   It's gitignored and served by the dev server only (vite.config.ts), so
   *   it never lands in a build.
   * - Lineup: the real next service from the public calendar. Saving rewrites
   *   it here only; nothing is written to Calendar.
   * - RSVPs: start empty. Switch "Viewing as" and answer as different people.
   */

  function parseRoster(text: string): PublicUser[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'))
    const header = (lines.shift() ?? '').split('\t').map((h) => h.trim().toLowerCase())
    return lines.map((line) => {
      const cells = line.split('\t')
      const get = (col: string) => (cells[header.indexOf(col)] ?? '').trim()
      const access = (get('access').toLowerCase() || 'member') as Tier
      return {
        email: get('email').toLowerCase(),
        name: get('name'),
        nickname: get('nickname') || undefined,
        aliases: get('calendar_names').split(';').map((s) => s.trim()).filter(Boolean),
        roles: rolesForTier(access, /^(yes|y|true)$/i.test(get('media'))),
        instruments: get('instruments').split(',').map((s) => s.trim()).filter(Boolean),
        createdAt: '',
        updatedAt: '',
        active: true
      }
    })
  }

  let TEAM = $state<PublicUser[]>([])
  let rosterLoaded = $state(false)

  let viewerEmail = $state('')
  const viewer = $derived(TEAM.find((u) => u.email === viewerEmail) ?? null)

  let serviceDate = $state('')
  let description = $state('')
  const assigned = $derived(viewer ? isNamed(viewer, lineupNames(extractLineup(description))) : false)
  let loadError = $state<string | null>(null)

  onMount(async () => {
    const roster = await realFetch('/__dev/roster')
    TEAM = roster.ok ? parseRoster(await roster.text()) : []
    viewerEmail = TEAM.find((u) => u.roles.isWorshipLeader)?.email ?? TEAM[0]?.email ?? ''
    rosterLoaded = true

    // The next service on or after today, looking up to two months ahead.
    const today = new Date().toISOString().slice(0, 10)
    const now = new Date()
    for (let ahead = 0; ahead < 3; ahead++) {
      const month = new Date(now.getFullYear(), now.getMonth() + ahead, 1)
      const events = await fetchMonthEvents(month.getFullYear(), month.getMonth() + 1)
      const next = events.find((e: any) => {
        const date = (e.start?.dateTime || e.start?.date || '').slice(0, 10)
        return date >= today && isServiceEvent(e)
      })
      if (next) {
        serviceDate = (next.start?.dateTime || next.start?.date).slice(0, 10)
        description = next.description ?? ''
        return
      }
    }
    loadError = 'Could not find an upcoming service in the calendar.'
  })

  // Answers given in this tab, as the server would store them.
  const store: Record<string, RsvpRecord> = {}

  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init)
    await new Promise((r) => setTimeout(r, 200)) // feel the loading states

    if (url.pathname === '/api/users') return reply({ users: TEAM })

    if (url.pathname.startsWith('/api/weeks/')) {
      if (method === 'PATCH' && viewer) {
        const { status } = JSON.parse(String(init?.body))
        store[viewer.email] = { weekId: serviceDate, email: viewer.email, status, updatedAt: new Date().toISOString(), updatedBy: viewer.email }
        return reply({ rsvp: store[viewer.email] })
      }
      const people: Record<string, RsvpPerson> = {}
      for (const u of TEAM) if (store[u.email]) people[u.email] = { name: calendarName(u), names: namesOf(u) }
      return reply({ rsvps: { ...store }, people })
    }

    if (url.pathname.startsWith('/api/events/')) {
      const { after } = JSON.parse(String(init?.body)) as { after: LineupData }
      description = writeLineup(description, after)
      return reply({ changes: [] })
    }

    return reply({ message: 'Not faked in the preview' }, 404)
  }

  // The lineup's Save bar takes the docked spot from the RSVP buttons while editing.
  let editingLineup = $state(false)
  // Switching who you're viewing as remounts the lineup, closing any edit.
  $effect(() => {
    void viewerEmail
    editingLineup = false
  })
  let rsvps = $state<Record<string, RsvpRecord>>({})
  let people = $state<Record<string, RsvpPerson>>({})
</script>

<div class="container" class:docked={assigned || editingLineup}>
  <div class="banner">
    <strong>Dev preview</strong>
    {#if rosterLoaded && TEAM.length === 0}
      <span>No roster found at scripts/roster.tsv.</span>
    {:else}
      <label>
        Viewing as
        <select bind:value={viewerEmail}>
          {#each TEAM as u (u.email)}
            <option value={u.email}>{u.name}{canEditSchedule(u) ? ' (admin)' : ''}{isNamed(u, lineupNames(extractLineup(description))) ? ' · on lineup' : ''}</option>
          {/each}
        </select>
      </label>
    {/if}
    <span class="muted">Saves stay in this tab. {serviceDate ? `Service: ${serviceDate}` : ''}</span>
  </div>

  {#if loadError}
    <p>{loadError}</p>
  {:else if !serviceDate}
    <p class="muted">Loading the next service…</p>
  {:else}
    {#key viewerEmail}
      <Lineup eventId={serviceDate} {description} canEdit={canEditSchedule(viewer)} {rsvps} {people} onSaved={() => {}} bind:editing={editingLineup} />
    {/key}
    {#if !editingLineup}
      <RsvpCard weekId={serviceDate} user={viewer} bind:rsvps bind:people {assigned} />
    {/if}

    <details>
      <summary>Calendar description</summary>
      <pre>{description}</pre>
    </details>
  {/if}

  <BottomNav active="calendar" />
</div>

<style>
  .container {
    max-width: 480px;
    margin: 0 auto;
    padding: 16px 12px 80px;
  }

  @media (max-width: 640px) {
    .container.docked {
      padding-bottom: 150px;
    }
  }

  .banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    font-size: 13px;
    padding: 8px 12px;
    margin-bottom: 16px;
    background: #fff7e6;
    border: 1px solid #f5d38a;
    border-radius: 8px;
  }

  .banner select {
    font-size: 13px;
    margin-left: 4px;
  }

  .muted {
    color: var(--color-text-secondary);
  }

  details {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  pre {
    white-space: pre-wrap;
    margin-top: 8px;
    font-size: 12px;
  }
</style>
