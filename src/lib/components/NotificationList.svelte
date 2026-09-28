<script lang="ts">
  import { formatDistanceToNowStrict, parseISO, format } from 'date-fns'
  import { joinNames } from '$lib/parts'
  import type { AssignmentNotice } from '$lib/types'

  /** Your upcoming Sundays, newest change first. Each opens that week on the calendar. */
  let { notices } = $props<{ notices: (AssignmentNotice & { unread: boolean })[] }>()
</script>

{#if notices.length === 0}
  <p class="empty">Nothing yet. When a leader puts you on a Sunday lineup, it shows up here.</p>
{:else}
  <ul class="list">
    {#each notices as notice (notice.date)}
      <li>
        <a class="item" class:unread={notice.unread} href="/?week={notice.date}">
          <span class="dot" aria-hidden="true"></span>
          <span class="body">
            <span class="what">
              <strong>{format(parseISO(notice.date), 'EEEE, MMMM d')}</strong>
              <span class="parts">{joinNames(notice.parts)}</span>
            </span>
            <span class="meta">
              {notice.by} put you on the lineup · {formatDistanceToNowStrict(parseISO(notice.updatedAt), { addSuffix: true })}
              {#if notice.unread}<span class="sr-only">(new)</span>{/if}
            </span>
          </span>
        </a>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .empty {
    font-size: 14px;
    color: var(--color-text-secondary);
    background: white;
    border: 1px dashed var(--color-border);
    border-radius: 12px;
    padding: 20px 16px;
    text-align: center;
  }

  .list {
    list-style: none;
    background: white;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    overflow: hidden;
  }

  li + li {
    border-top: 1px solid var(--color-border);
  }

  .item {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px 16px;
    color: inherit;
    text-decoration: none;
    min-height: 44px;
  }

  .item:hover {
    background: var(--color-bg-hover);
  }

  .item.unread {
    background: var(--color-bg-active);
  }

  .dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    margin-top: 7px;
    border-radius: 50%;
    background: transparent;
  }

  .unread .dot {
    background: var(--color-primary);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .what {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    font-size: 15px;
  }

  .parts {
    color: var(--color-primary);
    font-weight: 600;
  }

  .meta {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
