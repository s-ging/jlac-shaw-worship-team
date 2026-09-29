<script lang="ts" generics="T extends string">
  /** A row of mutually exclusive choices: the theme on Me, the range on Analytics. */
  let {
    options,
    value,
    label,
    onchange
  }: {
    options: { value: T; label: string }[]
    value: T
    /** Names the group for screen readers. */
    label: string
    onchange: (value: T) => void
  } = $props()
</script>

<div class="segmented" role="radiogroup" aria-label={label} style:--count={options.length}>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === option.value}
      class:selected={value === option.value}
      onclick={() => onchange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: grid;
    grid-template-columns: repeat(var(--count), 1fr);
    gap: 4px;
    padding: 4px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 10px;
  }

  button {
    min-height: 40px;
    padding: 0 10px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: none;
    border: none;
    border-radius: 7px;
    touch-action: manipulation;
  }

  button:hover:not(.selected) {
    color: var(--color-text);
  }

  button.selected {
    font-weight: 600;
    color: var(--color-on-primary);
    background: var(--color-primary);
  }
</style>
