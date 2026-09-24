<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation'
  import BottomNav from '$lib/components/BottomNav.svelte'
  import { tierOf, TIER_LABELS } from '$lib/roles'

  let { data } = $props()

  // Signed in is guaranteed by +page.server.ts.
  const user = $derived(data.user!)
  const mustChange = $derived(Boolean(data.user?.mustChangePassword))

  // svelte-ignore state_referenced_locally
  let nickname = $state(data.user?.nickname ?? '')
  let savingNickname = $state(false)
  let nicknameMessage = $state<{ ok: boolean; text: string } | null>(null)

  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let savingPassword = $state(false)
  let passwordMessage = $state<{ ok: boolean; text: string } | null>(null)

  async function patchMe(payload: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) return null
      const body = await res.json().catch(() => null)
      return body?.message ?? 'Could not save. Please try again.'
    } catch {
      return 'Network error. Check your connection and try again.'
    }
  }

  async function saveNickname(e: SubmitEvent) {
    e.preventDefault()
    savingNickname = true
    nicknameMessage = null
    const failure = await patchMe({ nickname })
    savingNickname = false
    nicknameMessage = failure ? { ok: false, text: failure } : { ok: true, text: 'Saved.' }
    if (!failure) await invalidateAll()
  }

  async function savePassword(e: SubmitEvent) {
    e.preventDefault()
    passwordMessage = null
    if (newPassword !== confirmPassword) {
      passwordMessage = { ok: false, text: "The new passwords don't match." }
      return
    }

    savingPassword = true
    const failure = await patchMe({ currentPassword, newPassword })
    savingPassword = false

    if (failure) {
      passwordMessage = { ok: false, text: failure }
      return
    }

    const wasFirstSignIn = mustChange
    currentPassword = newPassword = confirmPassword = ''
    passwordMessage = { ok: true, text: 'Password changed.' }
    await invalidateAll()
    if (wasFirstSignIn) await goto('/')
  }
</script>

<svelte:head><title>Me · Praise Team Scheduler</title></svelte:head>

<div class="page">
  {#if mustChange}
    <div class="welcome" role="status">
      <strong>Welcome, {user.nickname || user.name.split(' ')[0]}!</strong>
      Before you start, choose your own password. Your current password is the starting one you were given.
    </div>
  {/if}

  <h1>{user.name}</h1>
  <dl class="facts">
    <dt>Email</dt>
    <dd>{user.email}</dd>
    <dt>Access</dt>
    <dd>{TIER_LABELS[tierOf(user.roles)]}{user.roles.isMedia ? ' · Media' : ''}</dd>
    {#if user.aliases.length}
      <dt>Name in the calendar</dt>
      <dd>{user.aliases.join(', ')}</dd>
    {/if}
  </dl>
  <p class="help">To change your email, access or calendar name, ask a superadmin.</p>

  <form class="card" onsubmit={savePassword}>
    <h2>{mustChange ? 'Choose your password' : 'Change password'}</h2>

    <label>
      Current password
      <input type="password" bind:value={currentPassword} autocomplete="current-password" required disabled={savingPassword} />
    </label>
    <label>
      New password
      <input type="password" bind:value={newPassword} autocomplete="new-password" minlength="8" required disabled={savingPassword} />
      <span class="help">At least 8 characters.</span>
    </label>
    <label>
      New password again
      <input type="password" bind:value={confirmPassword} autocomplete="new-password" required disabled={savingPassword} />
    </label>

    {#if passwordMessage}
      <p class={passwordMessage.ok ? 'ok' : 'error'} role="alert">{passwordMessage.text}</p>
    {/if}

    <button type="submit" disabled={savingPassword}>{savingPassword ? 'Saving…' : 'Save password'}</button>
  </form>

  {#if !mustChange}
    <form class="card" onsubmit={saveNickname}>
      <h2>Nickname</h2>
      <label>
        What the app calls you
        <input bind:value={nickname} maxlength="40" placeholder={user.name.split(' ')[0]} disabled={savingNickname} />
      </label>

      {#if nicknameMessage}
        <p class={nicknameMessage.ok ? 'ok' : 'error'} role="alert">{nicknameMessage.text}</p>
      {/if}

      <button type="submit" disabled={savingNickname}>{savingNickname ? 'Saving…' : 'Save nickname'}</button>
    </form>
  {/if}

  {#if !mustChange}
    <BottomNav active="me" />
  {/if}
</div>

<style>
  .page {
    max-width: 480px;
    margin: 0 auto;
    padding: 20px 16px 96px;
  }

  .welcome {
    font-size: 14px;
    line-height: 1.45;
    background: var(--color-bg-active);
    border: 1px solid #c7d4fe;
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 18px;
  }

  .welcome strong {
    display: block;
    margin-bottom: 2px;
  }

  h1 {
    font-size: 22px;
    margin-bottom: 10px;
  }

  h2 {
    font-size: 16px;
  }

  .facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 14px;
  }

  dt {
    color: var(--color-text-secondary);
  }

  dd {
    overflow-wrap: anywhere;
  }

  .help {
    font-size: 12px;
    font-weight: 400;
    color: var(--color-text-secondary);
    margin: 8px 0 18px;
  }

  label .help {
    margin: 0;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 14px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 13px;
    font-weight: 600;
  }

  input {
    font-size: 16px; /* 16px stops iOS Safari zooming on focus */
    padding: 11px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: white;
  }

  button {
    min-height: 46px;
    font-size: 15px;
    font-weight: 600;
    color: white;
    background: var(--color-primary);
    border: none;
    border-radius: var(--radius);
  }

  button:disabled {
    opacity: 0.55;
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
