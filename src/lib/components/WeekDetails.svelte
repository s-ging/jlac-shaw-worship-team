<script lang="ts">
  import type { WeekWithDetails } from '$lib/types'

  let { week } = $props<{
    week: WeekWithDetails
  }>()
</script>

<div class="info-section">
  <div class="info-row">
    <span class="info-label">Theme:</span>
    <span class="info-value">{week.theme || 'No theme set'}</span>
  </div>
  <div class="info-row">
    <span class="info-label">🎵</span>
    {#if week.playlist_url}
      <a href={week.playlist_url} target="_blank" rel="noopener" class="playlist-link">
        YouTube Playlist Link
      </a>
    {:else}
      <span class="info-value">No playlist set</span>
    {/if}
  </div>
</div>

<hr class="divider" />

<style>
  .info-section {
    display: flex;
    flex-direction: row;
    gap: 4px;
    padding: 12px 0;
  }

  .info-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    flex: 1;
  }

  .info-label {
    font-weight: 500;
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .info-value {
    color: var(--color-text);
    font-size: 14px;
  }

  .playlist-link {
    color: var(--color-primary);
    text-decoration: underline;
    font-size: 14px;
  }

  .playlist-link:hover {
    color: var(--color-primary-hover);
  }

  .divider {
    border: none;
    border-top: 2px solid var(--color-border);
    margin: 12px 0;
    opacity: 0.5;
  }
</style>