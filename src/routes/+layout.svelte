<script lang="ts">
  let { children } = $props()
</script>

<nav>
  <a href="/">📅 Praise Team Scheduler</a>
</nav>

{@render children()}

<style>
  /* Simple nav styles */
  nav {
    padding: 16px 20px;
    background: white;
    border-bottom: 1px solid #e5e5e5;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  nav a {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
    text-decoration: none;
  }
</style>