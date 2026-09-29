<script lang="ts">
  import type { Snippet } from 'svelte'

  /**
   * An ⓘ that explains what's next to it.
   *
   * - Phone: tap to open, tap again (or anywhere else) to close.
   * - PC: hover to peek, click to keep it open; Escape closes it.
   *
   * The bubble is a manual popover, so it sits in the top layer and no card's
   * overflow can clip it. It's placed by hand below the ⓘ (above, near the
   * bottom of the screen) and kept inside the viewport.
   */
  let { label, children }: { label: string; children: Snippet } = $props()

  const id = `info-${Math.random().toString(36).slice(2, 9)}`

  let button: HTMLButtonElement
  let bubble: HTMLDivElement
  let open = $state(false)
  /** Opened by a click or tap, so leaving with the mouse doesn't close it. */
  let pinned = false

  const GAP = 8
  const EDGE = 12

  function place() {
    const at = button.getBoundingClientRect()
    const width = Math.min(300, window.innerWidth - EDGE * 2)
    bubble.style.width = `${width}px`
    const left = Math.min(Math.max(at.left + at.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE)
    const height = bubble.offsetHeight
    const below = at.bottom + GAP
    const top = below + height > window.innerHeight - EDGE ? Math.max(at.top - GAP - height, EDGE) : below
    bubble.style.left = `${left}px`
    bubble.style.top = `${top}px`
  }

  function show() {
    if (open) return
    bubble.showPopover()
    place()
    open = true
  }

  function hide() {
    if (!open) return
    bubble.hidePopover()
    open = false
    pinned = false
  }

  function onclick() {
    if (open && pinned) return hide()
    show()
    pinned = true
  }

  // Touch fires pointerenter too; only a mouse hover peeks.
  function onpointerenter(e: PointerEvent) {
    if (e.pointerType === 'mouse') show()
  }

  function onpointerleave(e: PointerEvent) {
    if (e.pointerType === 'mouse' && !pinned) hide()
  }

  $effect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      const target = e.target as Node
      if (!button.contains(target) && !bubble.contains(target)) hide()
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hide()
        button.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('scroll', place, { passive: true, capture: true })
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('scroll', place, { capture: true })
      window.removeEventListener('resize', place)
    }
  })
</script>

<button
  bind:this={button}
  type="button"
  class="info"
  class:open
  aria-label={label}
  aria-expanded={open}
  aria-controls={id}
  {onclick}
  {onpointerenter}
  {onpointerleave}
>
  <span aria-hidden="true">i</span>
</button>

<div bind:this={bubble} {id} popover="manual" role="tooltip" class="bubble">
  {@render children()}
</div>

<style>
  /* 20px to see, 44px to hit: the rest is touch target. */
  .info {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: -12px -10px -12px -6px;
    padding: 0;
    background: none;
    border: none;
    touch-action: manipulation;
  }

  .info span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-text-secondary);
    border: 1.5px solid currentColor;
    border-radius: 50%;
  }

  .info:hover span,
  .info.open span {
    color: var(--color-primary);
  }

  .info:focus-visible {
    outline: none;
  }

  .info:focus-visible span {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .bubble {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 8px 24px var(--color-shadow);
  }
</style>
