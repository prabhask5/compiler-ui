<script lang="ts">
  /**
   * Animated recursion tree visualization for step-through and normal execution.
   *
   * Renders function call/return events as a nested tree. During stepping,
   * nodes appear incrementally with animations. Active calls pulse green;
   * return values animate in with a scale transition.
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

  /** A flattened node with depth info for rendering. */
  interface FlatNode {
    node: RecursionNode;
    depth: number;
    hasChildren: boolean;
    isCollapsed: boolean;
    hiddenCount: number;
  }

  /** Flatten tree into a depth-first list, respecting collapsed state and node cap. */
  const flatNodes: FlatNode[] = $derived.by(() => {
    const result: FlatNode[] = [];
    function walk(node: RecursionNode, depth: number) {
      if (result.length >= MAX_VISIBLE_NODES) return;
      const hasChildren = node.children.length > 0;
      const isCollapsed = collapsed.has(node.callId);
      const hiddenCount = isCollapsed && hasChildren ? countNodes(node) - 1 : 0;
      result.push({ node, depth, hasChildren, isCollapsed, hiddenCount });
      if (hasChildren && !isCollapsed) {
        for (const child of node.children) {
          if (result.length >= MAX_VISIBLE_NODES) return;
          walk(child, depth + 1);
        }
      }
    }
    for (const root of nodes) {
      if (result.length >= MAX_VISIBLE_NODES) break;
      walk(root, 0);
    }
    return result;
  });

  const isTruncated = $derived(
    totalCalls > MAX_VISIBLE_NODES && flatNodes.length >= MAX_VISIBLE_NODES
  );

  $effect(() => {
    if (activeCallId !== null && treeEl) {
      const el = treeEl.querySelector('.call-header.active');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
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
  <div class="tree-list" bind:this={treeEl}>
    {#if flatNodes.length === 0}
      <div class="tree-empty">No function calls</div>
    {:else}
      {#each flatNodes as { node, depth, hasChildren, isCollapsed, hiddenCount } (node.callId)}
        {@const clampedDepth = Math.min(depth, MAX_INDENT_DEPTH)}
        {@const isActive = node.active && node.callId === activeCallId}
        <div
          class="call-row"
          class:skip-anim={skipAnimations}
          class:has-children={hasChildren}
          style="padding-left: {clampedDepth * 16 + 4}px"
        >
          {#if hasChildren}
            <button
              class="collapse-toggle"
              onclick={() => toggleCollapse(node.callId)}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              >{isCollapsed ? '\u25B6' : '\u25BC'}</button
            >
          {:else}
            <span class="collapse-spacer"></span>
          {/if}
          <span
            class="call-header"
            class:active={isActive}
            class:returned={node.returnValue !== null && !node.active}
          >
            <span class="call-name">{node.functionName}</span>
            <span class="call-args"
              >({node.args.map((a) => `${a.name}=${a.value}`).join(', ')})</span
            >
            {#if node.returnValue !== null}
              <span class="call-arrow">&rarr;</span>
              <span class="call-return" class:skip-anim={skipAnimations}>{node.returnValue}</span>
            {/if}
            {#if isCollapsed && hiddenCount > 0}
              <span class="collapsed-count">{hiddenCount} call{hiddenCount !== 1 ? 's' : ''}</span>
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

  .call-row {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-top: 1px;
    padding-bottom: 1px;
    white-space: nowrap;
    animation: fadeIn var(--duration) var(--ease) both;
  }

  .call-row.skip-anim {
    animation: none;
  }

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

  @media (max-width: 767px) {
    .tree-list {
      max-height: 180px;
    }

    .call-args {
      max-width: 140px;
    }
  }
</style>
