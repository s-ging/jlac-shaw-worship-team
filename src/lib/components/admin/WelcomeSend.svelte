<script lang="ts">
  import { onMount } from 'svelte'
  import { format, parseISO } from 'date-fns'
  import type { WelcomeCandidate } from '$lib/types'

  /**
   * The team send: one button that emails everyone who hasn't had their sign-in
   * yet. Asks once in place before sending, then says how it went. People
   * already emailed are skipped, so it can't email anyone twice.
   */

  let people = $state<WelcomeCandidate[]>([])
  let ready = $state(false)
  let loaded = $state(false)
  let loadError = $state('')
  let confirming = $state(false)
  let sending = $state(false)
  let result = $state<{ ok: boolean; text: string } | null>(null)
  let showWho = $state(false)

  const due = $derived(people.filter((p) => !p.welcomedAt))
  const withPassword = $derived(due.filter((p) => p.withPassword).length)
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

  async function load() {
    try {
      const res = await fetch('/api/admin/welcome')
      if (!res.ok) throw new Error()
      const body = (await res.json()) as { people: WelcomeCandidate[]; ready: boolean }
      people = body.people
      ready = body.ready
    } catch {
      loadError = "Couldn't check who has been emailed. Reload to try again."
    }
    loaded = true
  }

  async function send() {
    sending = true
    result = null
    try {
      const res = await fetch('/api/admin/welcome', { method: 'POST' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        result = { ok: false, text: body?.message ?? 'Could not send. Please try again.' }
      } else {
        const { sent, failed } = body as { sent: string[]; failed: string[] }
        result = failed.length
          ? { ok: false, text: `Sent ${plural(sent.length, 'email')}. These didn't go out: ${failed.join(', ')}. Press again to retry them.` }
          : { ok: true, text: `Sent ${plural(sent.length, 'email')}.` }
      }
    } catch {
      result = { ok: false, text: 'Network error. Nobody new was marked as emailed; press again to retry.' }
    }
    sending = false
    confirming = false
    await load()
  }

  onMount(load)
</script>

<section class="card">
  <div class="row">
    <div class="text">
      <h2>Sign-in email</h2>
      {#if !loaded}
        <p class="sub">Checking…</p>
      {:else if loadError}
        <p class="sub">{loadError}</p>
      {:else if due.length === 0}
        <p class="sub">Everyone on the team has their link and sign-in.</p>
      {:else}
        <p class="sub">
          {plural(due.length, 'person', 'people')} {due.length === 1 ? "hasn't" : "haven't"} been emailed the link to the app yet.
        </p>
      {/if}
    </div>

    {#if loaded && !loadError && due.length > 0 && !confirming}
      <button class="primary" onclick={() => ((confirming = true), (result = null))} disabled={!ready}>
        Email {plural(due.length, 'person', 'people')}
      </button>
    {/if}
  </div>

  {#if loaded && !ready && due.length > 0}
    <p class="note">The mailer isn't set up on this deploy yet (README, "Email"), so this is off.</p>
  {/if}

  {#if confirming}
    <div class="confirm">
      <p>
        Send to {plural(due.length, 'person', 'people')}?
        {#if withPassword === due.length}
          Each gets the link, their email and the starting password.
        {:else}
          {withPassword} get the starting password; {due.length - withPassword} already chose their own and get just the link.
        {/if}
      </p>
      <div class="actions">
        <button class="secondary" onclick={() => (confirming = false)} disabled={sending}>Cancel</button>
        <button class="primary" onclick={send} disabled={sending}>
          {sending ? 'Sending…' : `Send ${plural(due.length, 'email')}`}
        </button>
      </div>
    </div>
  {/if}

  {#if result}
    <p class={result.ok ? 'ok' : 'error'} role="status">{result.text}</p>
  {/if}

  {#if loaded && people.length > 0}
    <button class="link" onclick={() => (showWho = !showWho)} aria-expanded={showWho}>
      {showWho ? 'Hide' : 'Show'} who
    </button>
    {#if showWho}
      <ul class="who">
        {#each people as p (p.email)}
          <li>
            <span class="name">{p.name}</span>
            <span class="tag" class:done={p.welcomedAt}>
              {#if p.welcomedAt}
                Emailed {format(parseISO(p.welcomedAt), 'MMM d')}
              {:else if p.withPassword}
                Will get starting password
              {:else}
                Will get link only
              {/if}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 18px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
  }

  h2 {
    font-size: 15px;
  }

  .sub,
  .note {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin-top: 2px;
  }

  button {
    font-size: 14px;
    font-weight: 600;
    border-radius: var(--radius);
    padding: 0 14px;
    min-height: 40px;
  }

  .primary {
    color: white;
    background: var(--color-primary);
    border: none;
  }

  .secondary {
    background: white;
    border: 1px solid var(--color-border);
  }

  button:disabled {
    opacity: 0.55;
  }

  .confirm {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 14px;
    background: var(--color-bg-active);
    border-radius: var(--radius);
    padding: 12px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .link {
    align-self: flex-start;
    min-height: 32px;
    padding: 0;
    font-weight: 500;
    font-size: 13px;
    color: var(--color-primary);
    background: none;
    border: none;
  }

  .who {
    list-style: none;
    font-size: 13px;
    columns: 2 220px;
    column-gap: 24px;
  }

  .who li {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 0;
    break-inside: avoid;
    border-bottom: 1px solid var(--color-border);
  }

  .tag {
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .tag.done {
    color: #067647;
  }

  .ok,
  .error {
    font-size: 14px;
    border-radius: var(--radius);
    padding: 9px 12px;
  }

  .ok {
    color: #067647;
    background: #ecfdf3;
    border: 1px solid #abefc6;
  }

  .error {
    color: #b42318;
    background: #fef3f2;
    border: 1px solid #fecdca;
  }
</style>
