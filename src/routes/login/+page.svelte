<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation'

  let email = $state('')
  let password = $state('')
  let error = $state<string | null>(null)
  let submitting = $state(false)

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (submitting) return

    submitting = true
    error = null

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        error = body?.message ?? 'Could not sign in. Please try again.'
        return
      }

      // Re-run server loads so the layout picks up the new session.
      await invalidateAll()
      await goto('/')
    } catch {
      error = 'Network error. Check your connection and try again.'
    } finally {
      submitting = false
    }
  }
</script>

<svelte:head><title>Sign in · Praise Team Scheduler</title></svelte:head>

<div class="login-page">
  <form class="card" onsubmit={submit}>
    <h1>Sign in</h1>
    <p class="hint">Use the account your worship leader set up for you.</p>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      bind:value={email}
      autocomplete="username"
      inputmode="email"
      required
      disabled={submitting}
    />

    <label for="password">Password</label>
    <input
      id="password"
      type="password"
      bind:value={password}
      autocomplete="current-password"
      required
      disabled={submitting}
    />

    <button class="submit" type="submit" disabled={submitting || !email || !password}>
      {submitting ? 'Signing in…' : 'Sign in'}
    </button>

    <p class="footnote">Forgot your password? Ask an admin to set a new one.</p>
  </form>
</div>

<style>
  .login-page {
    display: flex;
    justify-content: center;
    padding: 32px 16px 64px;
  }

  .card {
    width: 100%;
    max-width: 380px;
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 24px 20px;
  }

  h1 {
    font-size: 22px;
    margin: 0 0 4px;
  }

  .hint {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin: 0 0 20px;
  }

  label {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
  }

  input {
    font-size: 16px; /* 16px stops iOS Safari zooming on focus */
    padding: 12px;
    margin-bottom: 16px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-surface);
  }

  input:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: -1px;
  }

  .submit {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-on-primary);
    background: var(--color-primary);
    border: none;
    border-radius: 8px;
    padding: 14px;
    cursor: pointer;
    min-height: 48px;
  }

  .submit:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .error {
    font-size: 14px;
    color: var(--color-danger);
    background: var(--color-danger-bg);
    border: 1px solid var(--color-danger-border);
    border-radius: 8px;
    padding: 10px 12px;
    margin: 0 0 16px;
  }

  .footnote {
    font-size: 12px;
    color: var(--color-text-secondary);
    text-align: center;
    margin: 16px 0 0;
  }
</style>
