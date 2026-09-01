<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  let { children } = $props(); // <-- THIS WAS MISSING

  let user = $state<any>(null);
  let loading = $state(true);

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user ?? null;
    loading = false;

    // Handle OAuth callback
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
      goto('/');
    }
  });

  async function signIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) console.error('Error signing in:', error);
  }

  async function signOut() {
    await supabase.auth.signOut();
    user = null;
  }
</script>

<nav>
  <a href="/">📅 Praise Team Scheduler</a>
  <div>
    {#if loading}
      <span>Loading...</span>
    {:else if user}
      <span>{user.email}</span>
      <button onclick={signOut}>Sign Out</button>
    {:else}
      <button onclick={signIn}>Sign In with Google</button>
    {/if}
  </div>
</nav>

{@render children()}