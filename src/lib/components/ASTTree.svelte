<script lang="ts">
  /**
   * AST tree container with expand/collapse controls.
   *
   * Wraps the recursive ASTNode component and provides a toolbar button to
   * globally expand or collapse every node in the tree. The `forceExpand` prop
   * is propagated down to all ASTNode instances so they react to the toggle
   * in unison.
   */
  import type { Program } from '$lib/compiler/types';
  import { collectTypedNodesBottomUp } from '$lib/utils/format';
  import ASTNode from './ASTNode.svelte';

  let {
    ast,
    onNodeClick,
    highlightLoc,
    isExecuting = false
  }: {
    /** The root Program AST node produced by the compiler. */
    ast: Program;
    /** Callback fired when the user clicks a node, passing its source location. */
    onNodeClick: (loc: [number, number, number, number]) => void;
    /** Source location currently highlighted for bidirectional sync. */
    highlightLoc: [number, number, number, number] | null;
    /** Whether step-through execution is active (uses green highlight). */
    isExecuting?: boolean;
  } = $props();

  /** Whether all tree nodes should currently be expanded. */
  let expandAll = $state(true);

  /** Whether the type propagation animation is currently running. */
  let isAnimatingTypes = $state(false);
  /** Whether type badges should respect the reveal set (true = hide unrevealed badges). */
  let typePropagationActive = $state(false);
  /** Location keys of nodes whose type badges have been revealed so far. */
  let revealedTypes: Set<string> = $state(new Set());
  /** Interval ID for the animation timer, stored for cleanup. */
  let animationIntervalId: ReturnType<typeof setInterval> | undefined;

  /** Toggle the global expand/collapse state for the entire tree. */
  function toggleAll() {
    expandAll = !expandAll;
  }

  /** Stop any running type propagation animation and reset state. */
  function stopAnimation() {
    if (animationIntervalId !== undefined) {
      clearInterval(animationIntervalId);
      animationIntervalId = undefined;
    }
    isAnimatingTypes = false;
    typePropagationActive = false;
    revealedTypes = new Set();
  }

  /**
   * Start the bottom-up type propagation animation.
   * Expands all nodes, hides all type badges, then reveals them one by one
   * from deepest (literals/identifiers) to shallowest (root expressions).
   */
  function startTypePropagation() {
    if (isAnimatingTypes) return;

    const keys = collectTypedNodesBottomUp(ast);
    if (keys.length === 0) return;

    expandAll = true;
    typePropagationActive = true;
    revealedTypes = new Set();
    isAnimatingTypes = true;

    // Scale batch size and interval so the animation completes in ~30s max.
    // Small trees (≤60 nodes): 1 node per 500ms (original behavior).
    // Larger trees: batch multiple nodes per tick at a faster interval.
    const MAX_DURATION_MS = 30_000;
    const TARGET_TICKS = 60;
    const batchSize = Math.max(1, Math.ceil(keys.length / TARGET_TICKS));
    const interval = Math.min(
      500,
      Math.floor(MAX_DURATION_MS / Math.ceil(keys.length / batchSize))
    );

    let index = 0;
    animationIntervalId = setInterval(() => {
      if (index < keys.length) {
        const next = new Set(revealedTypes);
        const end = Math.min(index + batchSize, keys.length);
        for (let i = index; i < end; i++) {
          next.add(keys[i]);
        }
        revealedTypes = next;
        index = end;
      } else {
        clearInterval(animationIntervalId);
        animationIntervalId = undefined;
        isAnimatingTypes = false;
        typePropagationActive = false;
      }
    }, interval);
  }

  // Clean up animation when AST changes or component unmounts
  $effect(() => {
    // Subscribe to ast so this re-runs when ast changes
    void ast;
    return () => stopAnimation();
  });
</script>

<div class="ast-tree">
  <div class="tree-controls">
    <button class="control-btn" onclick={toggleAll}>
      {expandAll ? 'Collapse All' : 'Expand All'}
    </button>
    <button
      class="control-btn type-propagation-btn"
      onclick={startTypePropagation}
      disabled={isAnimatingTypes}
      title="Replay bottom-up type inference: types appear on leaf nodes (literals, identifiers) first, then propagate upward through parent expressions"
    >
      Visualize Type Propagation
    </button>
  </div>
  <div class="tree-content">
    <ASTNode
      node={ast}
      key="Program"
      depth={0}
      {onNodeClick}
      forceExpand={expandAll}
      {highlightLoc}
      {isExecuting}
      {typePropagationActive}
      {revealedTypes}
    />
  </div>
</div>

<style>
  .ast-tree {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .tree-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .control-btn {
    font-size: 11px;
    padding: 3px 8px;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    transition: background var(--duration-fast) var(--ease);
  }

  .control-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text);
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tree-content {
    flex: 1;
    overflow: auto;
    padding: var(--space-sm);
  }

  @media (max-width: 767px) {
    .type-propagation-btn {
      font-size: 10px;
    }
  }
</style>
