<script lang="ts">
  import type { PublicUser, RsvpRecord, RsvpStatus } from '$lib/types'

  let { weekId, user } = $props<{
    weekId: string
    user: PublicUser | null
  }>()

  const OPTIONS: { status: RsvpStatus; label: string; icon: string }[] = [
    { status: 'yes', label: 'Yes', icon: '✅' },
    { status: 'maybe', label: 'Maybe', icon: '🤔' },
    { status: 'no', label: "Can't", icon: '❌' }
  ]

  let rsvps = $state<Record<string, RsvpRecord>>({})
  let loading = $state(false)
  let saving = $state<RsvpStatus | null>(null)
  let error = $state<string | null>(null)

  const myStatus = $derived(user ? (rsvps[user.email]?.status ?? null) : null)
  const responses = $derived(Object.values(rsvps).sort((a, b) => a.email.localeCompare(b.email)))

  // Refetch whenever the selected week changes.
  $effect(() => {
    const id = weekId
    if (!user || !id) {
      rsvps = {}
      return
    }

    let cancelled = false
    loading = true
    error = null

    fetch(`/api/weeks/${encodeURIComponent(id)}/rsvp`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => {
        if (!cancelled) rsvps = body.rsvps ?? {}
      })
      .catch(() => {
        if (!cancelled) error = 'Could not load responses.'
      })
      .finally(() => {
        if (!cancelled) loading = false
      })

    return () => {
      cancelled = true
    }
  })

  async function setStatus(status: RsvpStatus) {
    if (!user || saving) return

    saving = status
    error = null

    // Optimistic, so a tap feels instant on a phone; rolled back on failure.
    const previous = rsvps
    rsvps = {
      ...rsvps,
      [user.email]: {
        weekId,
        email: user.email,
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email
      }
    }

    try {
      const res = await fetch(`/api/weeks/${encodeURIComponent(weekId)}/rsvp`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (!res.ok) throw new Error(String(res.status))
      const body = await res.json()
      rsvps = { ...rsvps, [body.rsvp.email]: body.rsvp }
    } catch {
      rsvps = previous
      error = 'Could not save. Please try again.'
    } finally {
      saving = null
    }
  }

  function iconFor(status: RsvpStatus): string {
    return OPTIONS.find((o) => o.status === status)?.icon ?? ''
  }

  function nameFor(email: string): string {
    return email === user?.email ? 'You' : email.split('@')[0]
  }
</script>

<section class="rsvp">
  <h3 class="title">Can you make it?</h3>

  {#if !user}
    <p class="signed-out">
      <a href="/login">Sign in</a> to RSVP for this week.
    </p>
  {:else}
    <div class="options" role="group" aria-label="Your RSVP">
      {#each OPTIONS as option}
        <button
          class="option"
          class:selected={myStatus === option.status}
          disabled={saving !== null}
          aria-pressed={myStatus === option.status}
          onclick={() => setStatus(option.status)}
        >
          <span aria-hidden="true">{option.icon}</span>
          {option.label}
        </button>
      {/each}
    </div>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    {#if loading && responses.length === 0}
      <p class="muted">Loading responses…</p>
    {:else if responses.length > 0}
      <ul class="responses">
        {#each responses as response}
          <li>
            <span aria-hidden="true">{iconFor(response.status)}</span>
            <span class="who">{nameFor(response.email)}</span>
            <span class="status">{response.status}</span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">No responses yet. Be the first.</p>
    {/if}
  {/if}
</section>

<style>
  .rsvp {
    margin: 20px 0;
    padding: 16px;
    background: white;
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: 12px;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 12px;
  }

  .options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    /* 48px keeps these comfortably tappable one-handed */
    min-height: 48px;
    padding: 10px 4px;
    font-size: 14px;
    font-weight: 600;
    background: #fafafa;
    border: 1px solid var(--color-border, #e5e5e5);
    border-radius: 10px;
    cursor: pointer;
  }

  .option.selected {
    background: var(--color-primary, #2563eb);
    border-color: var(--color-primary, #2563eb);
    color: white;
  }

  .option:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .responses {
    list-style: none;
    margin: 14px 0 0;
    padding: 12px 0 0;
    border-top: 1px solid #f0f0f0;
  }

  .responses li {
    display: grid;
    grid-template-columns: 22px 1fr auto;
    align-items: center;
    padding: 5px 0;
    font-size: 14px;
  }

  .who {
    font-weight: 500;
  }

  .status {
    color: var(--color-text-secondary, #666);
    text-transform: capitalize;
    font-size: 13px;
  }

  .muted,
  .signed-out {
    font-size: 14px;
    color: var(--color-text-secondary, #666);
    margin: 12px 0 0;
  }

  .error {
    font-size: 13px;
    color: #b42318;
    margin: 10px 0 0;
  }
</style>
