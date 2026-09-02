<script lang="ts">
  let { 
    status, 
    role, 
    name, 
    empty = false, 
    editable = false, 
    onEdit 
  } = $props<{
    status?: string
    role: string
    name?: string
    empty?: boolean
    editable?: boolean
    onEdit?: () => void
  }>()
</script>

<div class="member-row {empty ? 'empty' : ''}">
  {#if empty}
    <span class="empty-text">{role}</span>
  {:else}
    <span class="status">{status}</span>
    <span class="role">{role}</span>
    <span class="name-wrapper">
      <span class="name">{name}</span>
      {#if editable}
        <button class="edit-btn" on:click={onEdit}>✏️</button>
      {/if}
    </span>
  {/if}
</div>

<style>
  .member-row {
    display: grid;
    grid-template-columns: 28px 1fr 1fr;
    align-items: center;
    padding: 6px 4px;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
  }

  .member-row:last-child {
    border-bottom: none;
  }

  .member-row.empty {
    grid-template-columns: 1fr;
    text-align: center;
    padding: 8px 4px;
  }

  .empty-text {
    color: #aaa;
    font-style: italic;
  }

  .status {
    text-align: center;
  }

  .role {
    color: var(--color-text-secondary);
  }

  .name-wrapper {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 6px;
  }

  .name {
    font-weight: 500;
    text-align: right;
  }

  .edit-btn {
    background: none;
    border: none;
    padding: 2px 4px;
    cursor: pointer;
    font-size: 14px;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .edit-btn:hover {
    background: #f0f0f0;
  }
</style>