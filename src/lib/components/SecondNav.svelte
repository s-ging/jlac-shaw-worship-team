<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * The bar that sits on top of BottomNav on phones, for the one thing you're
   * most likely to tap on this page: your RSVP, or Save while editing the
   * lineup. Only one should be docked at a time; the page decides which.
   *
   * On wider screens it stays where it's placed, or sticks to the bottom of
   * the viewport with `sticky`.
   */
  let {
    children,
    label,
    docked = true,
    sticky = false
  }: {
    children: Snippet
    label: string
    /** False renders it in place, even on phones, e.g. while another bar is docked. */
    docked?: boolean
    sticky?: boolean
  } = $props()
</script>

<div class="second-nav" class:docked class:sticky role="group" aria-label={label}>
  {@render children()}
</div>

<style>
  .second-nav.sticky {
    position: sticky;
    bottom: 72px;
    z-index: 5;
    padding: 10px 0;
    background: var(--color-bg);
  }

  @media (max-width: 640px) {
    /* 53px is BottomNav's height: 8px padding + 44px items + 1px border. */
    .second-nav.docked {
      position: fixed;
      left: 0;
      right: 0;
      bottom: calc(53px + env(safe-area-inset-bottom, 0px));
      z-index: 99;
      padding: 8px 12px;
      background: white;
      border-top: 1px solid var(--color-border);
      box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.06);
    }
  }
</style>
