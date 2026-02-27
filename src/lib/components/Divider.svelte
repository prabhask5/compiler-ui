<script lang="ts">
  /**
   * Draggable vertical divider for the split-panel layout.
   *
   * Uses pointer events with pointer capture to provide smooth, frame-accurate
   * resizing. The split percentage is clamped between 20% and 80% to prevent
   * either panel from collapsing entirely. The `splitPercent` prop is two-way
   * bound so the parent can read and set the current split position.
   */

  /** Two-way bound percentage (0-100) controlling the left panel width. */
  let { splitPercent = $bindable(50) }: { splitPercent: number } = $props();

  /** True while the user is actively dragging the divider. */
  let dragging = $state(false);

  /**
   * Begin a drag operation. Captures the pointer so move/up events are
   * received even if the cursor leaves the divider element.
   *
   * @param e - The originating pointer event.
   */
  function onPointerDown(e: PointerEvent) {
    dragging = true;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  }

  /**
   * Update the split position during a drag. Converts the pointer's X
   * coordinate into a percentage of the parent container's width.
   *
   * @param e - The pointer move event.
   */
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const parent = (e.currentTarget as HTMLElement).parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    splitPercent = Math.min(80, Math.max(20, pct));
  }

  /** End the drag operation. */
  function onPointerUp() {
    dragging = false;
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="divider"
  class:dragging
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
>
  <div class="divider-line"></div>
</div>

<style>
  .divider {
    width: 8px;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    z-index: 10;
    position: relative;
  }

  .divider-line {
    width: 1px;
    height: 100%;
    background: var(--border);
    transition: background var(--duration-fast) var(--ease);
  }

  .divider:hover .divider-line,
  .divider.dragging .divider-line {
    background: var(--accent);
    width: 2px;
  }
</style>
