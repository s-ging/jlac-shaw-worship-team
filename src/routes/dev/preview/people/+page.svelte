<script lang="ts">
  import { onMount } from 'svelte'
  import People from '$lib/components/admin/People.svelte'
  import type { PublicUser } from '$lib/types'
  import { loadRoster } from '../../roster'

  /**
   * `npm run dev`, then open /dev/preview/people. The admin People list with
   * the real roster and no sign-in. Saves change this tab's copy only.
   */

  let users = $state<PublicUser[]>([])
  let loaded = $state(false)

  const realFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    if (!url.pathname.startsWith('/api/users')) return realFetch(input, init)
    const body = JSON.parse(String(init?.body ?? '{}'))
    const { password: _password, ...fields } = body

    if (init?.method === 'POST') {
      users.push({ instruments: [], aliases: [fields.name.split(' ')[0]], createdAt: '', updatedAt: '', active: true, ...fields })
    } else {
      const email = decodeURIComponent(url.pathname.split('/').pop() ?? '')
      const i = users.findIndex((u) => u.email === email)
      if (i >= 0) users[i] = { ...users[i], ...fields, primaryRole: fields.primaryRole || undefined }
    }
    return new Response(JSON.stringify({ user: fields }), { status: 200, headers: { 'content-type': 'application/json' } })
  }

  onMount(async () => {
    users = await loadRoster(realFetch)
    loaded = true
  })
</script>

<div class="page">
  <p class="banner"><strong>Dev preview</strong> · People, from scripts/roster.tsv. Saves stay in this tab.</p>
  <h1>People</h1>
  {#if !loaded}
    <p>Loading…</p>
  {:else if users.length === 0}
    <p>No roster found at scripts/roster.tsv.</p>
  {:else}
    <People {users} currentEmail="" onChanged={() => {}} />
  {/if}
</div>

<style>
  .page {
    max-width: 560px;
    margin: 0 auto;
    padding: 20px 16px 48px;
  }

  @media (min-width: 900px) {
    .page {
      max-width: 1120px;
      padding: 28px 24px 64px;
    }
  }

  h1 {
    font-size: 22px;
    margin-bottom: 14px;
  }

  .banner {
    font-size: 13px;
    padding: 8px 12px;
    margin-bottom: 16px;
    background: #fff7e6;
    border: 1px solid #f5d38a;
    border-radius: 8px;
  }
</style>
