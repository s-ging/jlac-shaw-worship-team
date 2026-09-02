<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  let status = $state('Processing…');

  onMount(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        status = '✅ Success! Redirecting…';
        setTimeout(() => goto('/'), 500);
      } else {
        status = '❌ Authentication failed. Please try again.';
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      status = '❌ Authentication failed. Please try again.';
    }
  });
</script>

<div class="callback-page">
  <div class="callback-box">
    <p class="status">{status}</p>
    <a href="/" class="link">Return to home</a>
  </div>
</div>

<style>
  .callback-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100svh;
    padding: 20px;
  }
  .callback-box {
    text-align: center;
    padding: 40px;
    background: white;
    border-radius: var(--radius, 8px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  .status { font-size: 18px; margin-bottom: 16px; }
  .link { color: var(--color-primary, #2563eb); text-decoration: underline; }
</style>