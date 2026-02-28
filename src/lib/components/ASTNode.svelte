<script lang="ts">
  /**
   * Recursive AST node renderer with type badges and source-location linking.
   *
   * Each node is displayed as an expandable row showing:
   * - A chevron toggle for nodes with children.
   * - The property key (if different from the node kind).
   * - The AST node kind, color-coded by category (statement, expression, etc.).
   * - A one-line summary (e.g. variable name, literal value).
   * - An inferred-type badge when type information is available.
   *
   * Clicking a node label fires `onNodeClick` with the node's source location
   * tuple, which the parent uses to highlight the corresponding editor range.
   * The component renders itself recursively for child nodes and array elements.
   */
  import { getNodeCategory, getCategoryColor, formatValueType } from '$lib/compiler/types';
  import { getNodeSummary, getNodeChildren } from '$lib/utils/format';
  import ASTNode from './ASTNode.svelte';

  let {
    node,
    key,
    depth,
    onNodeClick,
    forceExpand,
    highlightLoc,
    isExecuting = false,
    autoFollow = true,
    typePropagationActive = false,
    revealedTypes = new Set<string>()
  }: {
    /** The AST node object (or sub-object) to render. */
    node: unknown;
    /** The property name under which this node appears in its parent. */
    key: string;
    /** Current nesting depth; controls indentation and auto-expand behavior. */
    depth: number;
    /** Callback fired with the node's [startRow, startCol, endRow, endCol] location. */
    onNodeClick: (loc: [number, number, number, number]) => void;
    /** When true, all nodes expand; when false, all collapse. Driven by ASTTree. */
    forceExpand: boolean;
    /** Source location currently highlighted; matching nodes get visual emphasis. */
    highlightLoc: [number, number, number, number] | null;
    /** Whether step-through execution is active (uses green highlight instead of blue). */
    isExecuting?: boolean;
    /** Whether auto-follow scrolling is active (false = user scrolled manually). */
    autoFollow?: boolean;
    /** Whether type propagation animation is active (badges hidden until revealed). */
    typePropagationActive?: boolean;
    /** Set of location keys whose type badges have been revealed. */
    revealedTypes?: Set<string>;
  } = $props();

  /** Whether this node's children are currently visible. */
  // eslint-disable-next-line svelte/prefer-writable-derived -- expanded is toggled by user clicks AND synced from forceExpand prop
  let expanded = $state(false);

  // Auto-expand the first two levels on initial render for a useful default view.
  $effect(() => {
    if (depth < 2) expanded = true;
  });

  // Sync with the global expand/collapse toggle from ASTTree.
  $effect(() => {
    expanded = forceExpand;
  });

  // --- Derived node metadata ---
  const obj = $derived(node as Record<string, unknown>);
  /** The AST node's kind string (e.g. "FunctionDef", "BinOp"). */
  const kind = $derived((obj?.kind as string) || '');
  /** Semantic category for color coding (statement, expression, literal, etc.). */
  const category = $derived(getNodeCategory(kind));
  /** CSS color associated with the node's category. */
  const color = $derived(getCategoryColor(category));
  /** Short human-readable summary (variable name, operator, literal value). */
  const summary = $derived(getNodeSummary(obj));
  /** Child properties that should be rendered as nested nodes. */
  const children = $derived(getNodeChildren(obj));
  const hasChildren = $derived(children.length > 0);
  /** Source location tuple, if the AST node carries location info. */
  const location = $derived(obj?.location as [number, number, number, number] | undefined);
  /** Formatted inferred type string for display in the type badge. */
  const inferredType = $derived(
    obj?.inferredType
      ? formatValueType(obj.inferredType as import('$lib/compiler/types').ValueType)
      : ''
  );

  /** Whether this node should be visually highlighted (its location matches the global highlight). */
  const isHighlighted = $derived(
    highlightLoc !== null &&
      location !== undefined &&
      location[0] === highlightLoc[0] &&
      location[1] === highlightLoc[1] &&
      location[2] === highlightLoc[2] &&
      location[3] === highlightLoc[3]
  );

  /** Whether this node should show green execution highlight (step-through mode). */
  const isExecHighlighted = $derived(isExecuting && isHighlighted);

  /** Location key for matching against the revealed set during type propagation. */
  const locationKey = $derived(location ? location.join(',') : '');
  /** Whether the type badge should be visible (always true unless animation is hiding it). */
  const showTypeBadge = $derived(
    inferredType !== '' && (!typePropagationActive || revealedTypes.has(locationKey))
  );
  /** Whether this node's type was just revealed (for scale-in animation). */
  const typeJustRevealed = $derived(typePropagationActive && revealedTypes.has(locationKey));

  /** Ref for the entire node element (header + children) for scroll-into-view. */
  let nodeEl: HTMLDivElement | undefined = $state(undefined);

  // Scroll highlighted node into view with bottom padding
  $effect(() => {
    if (isHighlighted && autoFollow && nodeEl) {
      const container = nodeEl.closest('.tree-content');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const nodeRect = nodeEl.getBoundingClientRect();
        // Check if any part of the node is outside the visible area
        if (nodeRect.top < containerRect.top || nodeRect.bottom > containerRect.bottom - 60) {
          // Scroll so the node top is visible with 60px padding below the node bottom
          const scrollTop = container.scrollTop + nodeRect.top - containerRect.top - 40;
          container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
        }
      }
    }
  });

  // Auto-scroll to center the node when its type is revealed during propagation animation
  $effect(() => {
    if (typeJustRevealed && autoFollow && nodeEl) {
      const container = nodeEl.closest('.tree-content');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const nodeRect = nodeEl.getBoundingClientRect();
        const containerCenter = containerRect.height / 2;
        const nodeCenter = nodeRect.top - containerRect.top + nodeRect.height / 2;
        const scrollTop = container.scrollTop + nodeCenter - containerCenter;
        container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
      }
    }
  });

  /** Toggle this node's expanded/collapsed state. */
  function toggle() {
    expanded = !expanded;
  }

  /**
   * Handle a click on this node's label. Fires `onNodeClick` with the node's
   * source location so the editor can highlight the corresponding range.
   */
  function handleClick() {
    if (location) {
      onNodeClick(location);
    }
  }
</script>

{#if obj && typeof obj === 'object'}
  <div class="ast-node" style="--depth: {depth}; --color: {color}" bind:this={nodeEl}>
    <div
      class="node-header"
      class:expandable={hasChildren}
      class:highlighted={isHighlighted && !isExecHighlighted}
      class:exec-highlighted={isExecHighlighted}
      class:type-highlighted={typeJustRevealed}
    >
      {#if hasChildren}
        <button class="expand-toggle" onclick={toggle}>
          <span class="chevron" class:open={expanded}>▸</span>
        </button>
      {:else}
        <span class="leaf-spacer"></span>
      {/if}

      <button
        class="node-label"
        onclick={handleClick}
        title={location ? `${location[0]}:${location[1]} - ${location[2]}:${location[3]}` : ''}
      >
        {#if key && key !== kind}
          <span class="node-key">{key}:</span>
        {/if}
        {#if kind}
          <span class="node-kind" style="color: {color}">{kind}</span>
        {:else}
          <span class="node-key">{key}</span>
        {/if}
        {#if summary}
          <span class="node-summary">{summary}</span>
        {/if}
        {#if inferredType}
          <span
            class="type-badge"
            class:type-hidden={!showTypeBadge}
            class:type-revealed={typeJustRevealed}
          >
            {inferredType}
          </span>
        {/if}
      </button>
    </div>

    {#if expanded && hasChildren}
      <div class="node-children">
        {#each children as child, i (child.key)}
          <div class="child" style="animation-delay: {i < 10 ? i * 30 : 0}ms">
            {#if Array.isArray(child.value)}
              {@const maxArrayItems = 100}
              {@const items =
                child.value.length > maxArrayItems
                  ? child.value.slice(0, maxArrayItems)
                  : child.value}
              <div class="array-node">
                <div class="array-header">
                  <span class="node-key">{child.key}</span>
                  <span class="array-count">[{child.value.length}]</span>
                </div>
                {#each items as item, j (j)}
                  <ASTNode
                    node={item}
                    key={String(j)}
                    depth={depth + 1}
                    {onNodeClick}
                    {forceExpand}
                    {highlightLoc}
                    {isExecuting}
                    {autoFollow}
                    {typePropagationActive}
                    {revealedTypes}
                  />
                {/each}
                {#if child.value.length > maxArrayItems}
                  <div class="array-truncated">
                    …{child.value.length - maxArrayItems} more item{child.value.length -
                      maxArrayItems !==
                    1
                      ? 's'
                      : ''} not shown
                  </div>
                {/if}
              </div>
            {:else if typeof child.value === 'object' && child.value !== null}
              <ASTNode
                node={child.value}
                key={child.key}
                depth={depth + 1}
                {onNodeClick}
                {forceExpand}
                {highlightLoc}
                {isExecuting}
                {autoFollow}
                {typePropagationActive}
                {revealedTypes}
              />
            {:else}
              <div class="leaf-value">
                <span class="node-key">{child.key}:</span>
                <span class="leaf-text">{JSON.stringify(child.value)}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .ast-node {
    position: relative;
    font-size: 12px;
    font-family: var(--font-code);
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    border-radius: var(--radius-sm);
    transition: background var(--duration-fast) var(--ease);
  }

  .node-header.highlighted {
    background: rgba(99, 102, 241, 0.12);
    box-shadow: inset 2px 0 0 var(--accent);
  }

  .node-header.exec-highlighted {
    background: rgba(52, 211, 153, 0.12);
    box-shadow: inset 2px 0 0 var(--success);
  }

  @media (prefers-reduced-motion: no-preference) {
    .node-header.exec-highlighted {
      animation: execPulse 1.5s ease-in-out infinite;
    }
  }

  .expand-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 10px;
    transition: color var(--duration-fast) var(--ease);
  }

  .expand-toggle:hover {
    color: var(--text);
  }

  .chevron {
    display: inline-block;
    transition: transform var(--duration-fast) var(--ease);
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .leaf-spacer {
    width: 16px;
    flex-shrink: 0;
  }

  .node-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease);
  }

  .node-label:hover {
    background: var(--bg-hover);
  }

  .node-key {
    color: var(--text-muted);
    font-size: 11px;
  }

  .node-kind {
    font-weight: 600;
  }

  .node-summary {
    color: var(--text-secondary);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 300px;
  }

  .type-badge {
    font-size: 10px;
    padding: 0 5px;
    background: rgba(99, 102, 241, 0.15);
    color: var(--accent);
    border-radius: 3px;
    font-weight: 500;
    white-space: nowrap;
    transition:
      opacity var(--duration-fast) var(--ease),
      transform var(--duration-fast) var(--ease);
  }

  .type-badge.type-hidden {
    opacity: 0;
    transform: scale(0.7);
    pointer-events: none;
  }

  @media (prefers-reduced-motion: no-preference) {
    .type-badge.type-revealed {
      animation: typeReveal 400ms var(--ease) both;
    }

    .node-header.type-highlighted {
      animation: typePulse 600ms var(--ease);
    }
  }

  @keyframes typeReveal {
    0% {
      opacity: 0;
      transform: scale(0.5);
    }
    60% {
      opacity: 1;
      transform: scale(1.15);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes typePulse {
    0% {
      background: rgba(99, 102, 241, 0.25);
      box-shadow: inset 2px 0 0 rgb(99, 102, 241);
    }
    100% {
      background: transparent;
      box-shadow: none;
    }
  }

  .node-children {
    padding-left: 16px;
    border-left: 1px solid var(--border);
    margin-left: 7px;
  }

  .child {
    animation: fadeIn var(--duration) var(--ease) both;
  }

  .array-node {
    padding: 1px 0;
  }

  .array-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0 2px 16px;
  }

  .array-count {
    color: var(--text-muted);
    font-size: 10px;
  }

  .array-truncated {
    color: var(--text-muted);
    font-size: 10px;
    font-style: italic;
    padding: 2px 0 2px 22px;
  }

  .leaf-value {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0 2px 22px;
  }

  .leaf-text {
    color: var(--syn-string);
    font-size: 11px;
  }
</style>
