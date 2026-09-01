<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
      goto('/');
    }
  });
</script>

<p>Authenticating...</p>