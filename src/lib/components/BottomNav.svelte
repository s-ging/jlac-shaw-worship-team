<script lang="ts">
  let { active = 'calendar' } = $props<{
    active?: 'calendar' | 'music' | 'me'
  }>()
</script>

<nav class="bottom-nav">
  <button class="nav-item {active === 'calendar' ? 'active' : ''}">
    📅 Calendar
  </button>
  <button class="nav-item {active === 'music' ? 'active' : ''}">
    🎵 Music
  </button>
  <button class="nav-item {active === 'me' ? 'active' : ''}">
    👤 Me
  </button>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
    align-items: center;
    background: white;
    border-top: 1px solid var(--color-border);
    padding: 8px 0 env(safe-area-inset-bottom, 8px) 0;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    z-index: 100;
  }

  .nav-item {
    background: none;
    border: none;
    font-size: 14px;
    padding: 8px 16px;
    color: #999;
    cursor: pointer;
    font-weight: 500;
    touch-action: manipulation;
    min-height: 44px;
    min-width: 44px;
  }

  .nav-item.active {
    color: var(--color-primary);
    font-weight: 600;
  }

  .nav-item:hover:not(.active) {
    color: #666;
  }
</style>