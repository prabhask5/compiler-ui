<script lang="ts">
  /**
   * Animated recursion tree visualization for step-through and normal execution.
   *
   * Renders function call/return events as a flat list with tree-line indent
   * guides (like VS Code's file explorer). During stepping, nodes appear
   * incrementally with animations. Active calls pulse green; return values
   * animate in with a scale transition.
   *
   * Graceful handling for large trees:
   * - Node count capped at MAX_VISIBLE_NODES with a truncation notice
   * - Indentation clamped at MAX_INDENT_DEPTH to prevent horizontal blowout
   * - Per-node animations disabled when the tree exceeds ANIMATE_THRESHOLD
   * - Collapsible subtrees for completed calls
   */

  import type { RecursionNode } from '$lib/interpreter/interpreter';

  /** Maximum nodes rendered before truncation. */
  const MAX_VISIBLE_NODES = 200;
  /** Maximum indentation depth (visual only). */
  const MAX_INDENT_DEPTH = 12;
  /** Disable per-node animations above this count for performance. */
  const ANIMATE_THRESHOLD = 80;
  /** Width of each indent level in pixels. */
  const INDENT_PX = 18;

  let {
    nodes,
    activeCallId,
    totalCalls
  }: {
    nodes: RecursionNode[];
    activeCallId: number | null;
    totalCalls: number;
  } = $props();

  let treeEl: HTMLElement | undefined = $state(undefined);

  /** Whether auto-follow scrolling is active. Paused when user manually scrolls. */
  let autoFollow = $state(true);

  /** Pause auto-follow on direct user input. No-op when idle. */
  function pauseFollow() {
    if (activeCallId === null) return;
    autoFollow = false;
    // Stop any in-progress smooth scroll dead in its tracks
    if (treeEl) {
      treeEl.scrollTop = treeEl.scrollTop;
    }
  }

  // Attach touchstart + pointerdown via $effect to avoid a11y warnings on static elements.
  $effect(() => {
    const el = treeEl;
    if (!el) return;
    const onTouch = () => pauseFollow();
    const onPointer = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (e.clientX > rect.left + el.clientWidth || e.clientY > rect.top + el.clientHeight) {
        pauseFollow();
      }
    };
    el.addEventListener('touchstart', onTouch, { passive: true });
    el.addEventListener('pointerdown', onPointer);
    return () => {
      el.removeEventListener('touchstart', onTouch);
      el.removeEventListener('pointerdown', onPointer);
    };
  });

  /** Resume auto-follow and scroll to the active call node. */
  function resumeFollow() {
    autoFollow = true;
    scrollToActive();
  }

  function scrollToActive() {
    if (!treeEl) return;
    const el = treeEl.querySelector('.call-header.active');
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // Reset autoFollow when stepping stops (activeCallId clears)
  $effect(() => {
    if (activeCallId === null) {
      autoFollow = true;
    }
  });

  /** Whether the tree is large enough to skip per-node entry animations. */
  const skipAnimations = $derived(totalCalls > ANIMATE_THRESHOLD);

  /** Set of collapsed callIds (user-toggled). */
  let collapsed: Set<number> = $state(new Set());

  function toggleCollapse(callId: number) {
    const next = new Set(collapsed);
    if (next.has(callId)) {
      next.delete(callId);
    } else {
      next.add(callId);
    }
    collapsed = next;
  }

  /** Count nodes in a subtree. */
  function countNodes(node: RecursionNode): number {
    let c = 1;
    for (const child of node.children) c += countNodes(child);
    return c;
  }

  /** A flattened node with depth and tree-line metadata for rendering. */
  interface FlatNode {
    node: RecursionNode;
    depth: number;
    hasChildren: boolean;
    isCollapsed: boolean;
    hiddenCount: number;
    /** Whether this node is the last sibling at its depth. */
    isLastChild: boolean;
    /**
     * For each depth level 0..depth-1, true if there are more siblings
     * below at that level (i.e. draw a continuing vertical line).
     */
    guideActive: boolean[];
  }

  /** Flatten tree into a depth-first list with tree-line metadata. */
  const flatNodes: FlatNode[] = $derived.by(() => {
    const result: FlatNode[] = [];
    // Track which depths have continuing siblings (ancestors that aren't last children).
    const activeGuides: boolean[] = [];

    function walk(node: RecursionNode, depth: number, isLast: boolean) {
      if (result.length >= MAX_VISIBLE_NODES) return;
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsed.has(node.callId);
      const hiddenCount = isCollapsed && hasChildren ? countNodes(node) - 1 : 0;

      result.push({
        node,
        depth,
        hasChildren,
        isCollapsed,
        hiddenCount,
        isLastChild: isLast,
        guideActive: activeGuides.slice(0, depth)
      });

      if (hasChildren && !isCollapsed) {
        const children = node.children;
        for (let i = 0; i < children.length; i++) {
          if (result.length >= MAX_VISIBLE_NODES) return;
          const childIsLast = i === children.length - 1;
          // Before recursing, mark whether this depth has more siblings after
          activeGuides[depth] = !childIsLast;
          walk(children[i], depth + 1, childIsLast);
        }
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      if (result.length >= MAX_VISIBLE_NODES) break;
      walk(nodes[i], 0, i === nodes.length - 1);
    }
    return result;
  });

  const isTruncated = $derived(
    totalCalls > MAX_VISIBLE_NODES && flatNodes.length >= MAX_VISIBLE_NODES
  );

  $effect(() => {
    if (activeCallId !== null && autoFollow && treeEl) {
      scrollToActive();
    }
  });
</script>

<div class="recursion-tree">
  <div class="tree-header">
    <span class="tree-title">Call Tree</span>
    {#if totalCalls > 0}
      <span class="tree-count">{totalCalls} call{totalCalls !== 1 ? 's' : ''}</span>
    {/if}
  </div>
  <div class="tree-list" bind:this={treeEl} onwheel={pauseFollow}>
    {#if flatNodes.length === 0}
      <div class="tree-empty">No function calls</div>
    {:else}
      {#each flatNodes as flat (flat.node.callId)}
        {@const clampedDepth = Math.min(flat.depth, MAX_INDENT_DEPTH)}
        {@const isActive = flat.node.active && flat.node.callId === activeCallId}
        <div class="call-row" class:skip-anim={skipAnimations} style="--indent: {clampedDepth}">
          <!-- Tree guide lines -->
          <div class="guides" style="width: {clampedDepth * INDENT_PX}px">
            {#each { length: clampedDepth } as _, level (level)}
              {#if level === clampedDepth - 1}
                <!-- This node's own connector (L-corner or T-tee) -->
                <span
                  class="guide"
                  class:guide-corner={flat.isLastChild}
                  class:guide-tee={!flat.isLastChild}
                  style="left: {level * INDENT_PX + 6}px"
                ></span>
              {:else if flat.guideActive[level]}
                <!-- Ancestor with more siblings below — vertical pass-through -->
                <span class="guide guide-active" style="left: {level * INDENT_PX + 6}px"></span>
              {/if}
            {/each}
          </div>

          {#if flat.hasChildren}
            <button
              class="collapse-toggle"
              onclick={() => toggleCollapse(flat.node.callId)}
              aria-label={flat.isCollapsed ? 'Expand' : 'Collapse'}
              >{flat.isCollapsed ? '\u25B6' : '\u25BC'}</button
            >
          {:else}
            <span class="collapse-spacer"></span>
          {/if}
          <span
            class="call-header"
            class:active={isActive}
            class:returned={flat.node.returnValue !== null && !flat.node.active}
          >
            <span class="call-name">{flat.node.functionName}</span>
            <span class="call-args"
              >({flat.node.args.map((a) => `${a.name}=${a.value}`).join(', ')})</span
            >
            {#if flat.node.returnValue !== null}
              <span class="call-arrow">&rarr;</span>
              <span class="call-return" class:skip-anim={skipAnimations}
                >{flat.node.returnValue}</span
              >
            {/if}
            {#if flat.isCollapsed && flat.hiddenCount > 0}
              <span class="collapsed-count"
                >{flat.hiddenCount} call{flat.hiddenCount !== 1 ? 's' : ''}</span
              >
            {/if}
          </span>
        </div>
      {/each}
      {#if isTruncated}
        <div class="tree-truncated">
          Showing first {MAX_VISIBLE_NODES} of {totalCalls} calls
        </div>
      {/if}
    {/if}
    {#if !autoFollow && activeCallId !== null}
      <button class="follow-btn" onclick={resumeFollow}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 2v8M6 10l3-3M6 10L3 7"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Follow
      </button>
    {/if}
  </div>
</div>

<style>
  .recursion-tree {
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    font-family: var(--font-code);
    font-size: 11px;
  }

  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xs) var(--space-md);
    border-bottom: 1px solid var(--border);
  }

  .tree-title {
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 11px;
  }

  .tree-count {
    color: var(--text-muted);
    font-size: 10px;
    font-variant-numeric: tabular-nums;
  }

  .tree-list {
    max-height: 250px;
    overflow-y: auto;
    overflow-x: auto;
    padding: var(--space-xs) var(--space-md);
  }

  .tree-empty {
    color: var(--text-muted);
    padding: var(--space-xs) 0;
  }

  .tree-truncated {
    color: var(--text-muted);
    font-size: 10px;
    padding: var(--space-sm) 0;
    font-style: italic;
  }

  /* --- Row layout --- */

  .call-row {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 20px;
    white-space: nowrap;
    animation: fadeIn var(--duration) var(--ease) both;
  }

  .call-row.skip-anim {
    animation: none;
  }

  /* --- Tree guide lines --- */

  .guides {
    position: relative;
    flex-shrink: 0;
    height: 100%;
  }

  .guide {
    position: absolute;
    top: 0;
    width: 1px;
    height: 100%;
    background: var(--border);
  }

  /* Vertical line continues downward (more siblings below at this depth). */
  .guide.guide-active {
    height: 100%;
  }

  /* T-connector: vertical line continues + horizontal branch to this node. */
  .guide.guide-tee {
    height: 100%;
  }

  .guide.guide-tee::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: 12px;
    height: 1px;
    background: var(--border);
  }

  /* L-connector (last child): vertical line stops at midpoint + horizontal branch. */
  .guide.guide-corner {
    height: 50%;
  }

  .guide.guide-corner::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 12px;
    height: 1px;
    background: var(--border);
  }

  /* Animate guide lines growing during step-through */
  @media (prefers-reduced-motion: no-preference) {
    .call-row:not(.skip-anim) .guide {
      animation: guideGrow var(--duration) var(--ease) both;
      transform-origin: top;
    }

    .call-row:not(.skip-anim) .guide::after {
      animation: guideBranch var(--duration) var(--ease) both;
      animation-delay: 80ms;
      transform-origin: left;
    }
  }

  @keyframes guideGrow {
    from {
      transform: scaleY(0);
    }
    to {
      transform: scaleY(1);
    }
  }

  @keyframes guideBranch {
    from {
      transform: scaleX(0);
    }
    to {
      transform: scaleX(1);
    }
  }

  /* --- Controls --- */

  .collapse-toggle {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    color: var(--text-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: 0;
    line-height: 1;
  }

  .collapse-toggle:hover {
    color: var(--text-secondary);
    background: rgba(255, 255, 255, 0.06);
  }

  .collapse-spacer {
    width: 14px;
    flex-shrink: 0;
  }

  /* --- Node content --- */

  .call-header {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 4px;
    border-radius: var(--radius-sm);
    transition: background 300ms var(--ease);
  }

  .call-name {
    color: var(--syn-function);
    font-weight: 500;
  }

  .call-args {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
  }

  .call-arrow {
    color: var(--text-muted);
    margin: 0 2px;
  }

  .call-return {
    color: var(--accent-light, var(--accent));
    font-weight: 600;
    background: rgba(99, 102, 241, 0.12);
    padding: 0 4px;
    border-radius: var(--radius-sm);
    animation: returnReveal 400ms var(--ease) both;
  }

  .call-return.skip-anim {
    animation: none;
  }

  .collapsed-count {
    color: var(--text-muted);
    font-size: 10px;
    font-style: italic;
    margin-left: 4px;
  }

  .call-header.returned {
    opacity: 0.7;
  }

  @media (prefers-reduced-motion: no-preference) {
    .call-header.active {
      animation: execPulse 1.5s ease-in-out infinite;
    }
  }

  @keyframes returnReveal {
    0% {
      opacity: 0;
      transform: scale(0.5);
    }
    60% {
      transform: scale(1.15);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  .follow-btn {
    position: sticky;
    bottom: var(--space-sm);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 999px;
    box-shadow: var(--shadow-md);
    z-index: 10;
    cursor: pointer;
    /* no animation — button must appear instantly */
  }

  .follow-btn:hover {
    color: var(--text);
    background: var(--bg-hover);
  }

  @media (max-width: 767px) {
    .tree-list {
      max-height: 180px;
    }

    .call-args {
      max-width: 140px;
    }
  }
</style>
