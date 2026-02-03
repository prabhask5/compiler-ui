<script lang="ts">
  let { splitPercent = $bindable(50) }: { splitPercent: number } = $props();

  let dragging = $state(false);

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const parent = (e.currentTarget as HTMLElement).parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    splitPercent = Math.min(80, Math.max(20, pct));
  }

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
