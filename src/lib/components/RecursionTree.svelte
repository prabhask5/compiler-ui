<script lang="ts">
  /**
   * Animated recursion tree visualization for step-through and normal execution.
   *
   * Renders function call/return events as a nested tree. During stepping,
   * nodes appear incrementally with animations. Active calls pulse green;
   * return values animate in with a scale transition.
   */

  import type { RecursionNode } from '$lib/interpreter/interpreter';

  let {
    nodes,
    activeCallId
  }: {
    nodes: RecursionNode[];
    activeCallId: number | null;
  } = $props();

  let treeEl: HTMLElement | undefined = $state(undefined);

  $effect(() => {
    if (activeCallId !== null && treeEl) {
      const el = treeEl.querySelector('.call-header.active');
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  });
</script>

{#snippet renderNode(node: RecursionNode, depth: number)}
  <div class="call-node">
    <div
      class="call-header"
      class:active={node.active && node.callId === activeCallId}
      class:returned={node.returnValue !== null && !node.active}
      style="padding-left: {depth * 16}px"
    >
      <span class="call-name">{node.functionName}</span>
      <span class="call-args">({node.args.map((a) => `${a.name}=${a.value}`).join(', ')})</span>
      {#if node.returnValue !== null}
        <span class="call-arrow">&rarr;</span>
        <span class="call-return return-revealed">{node.returnValue}</span>
      {/if}
    </div>
    {#if node.children.length > 0}
      <div class="call-children">
        {#each node.children as child (child.callId)}
          {@render renderNode(child, depth + 1)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<div class="recursion-tree">
  <div class="tree-header">
    <span class="tree-title">Call Tree</span>
  </div>
  <div class="tree-list" bind:this={treeEl}>
    {#if nodes.length === 0}
      <div class="tree-empty">No function calls</div>
    {:else}
      {#each nodes as node (node.callId)}
        {@render renderNode(node, 0)}
      {/each}
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
    padding: var(--space-xs) var(--space-md);
    border-bottom: 1px solid var(--border);
  }

  .tree-title {
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 11px;
  }

  .tree-list {
    max-height: 250px;
    overflow-y: auto;
    padding: var(--space-xs) var(--space-md);
  }

  .tree-empty {
    color: var(--text-muted);
    padding: var(--space-xs) 0;
  }

  .call-node {
    animation: fadeIn var(--duration) var(--ease) both;
  }

  .call-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 4px;
    border-radius: var(--radius-sm);
    transition: background 300ms var(--ease);
    white-space: nowrap;
  }

  .call-children {
    border-left: 1px solid var(--border);
    margin-left: 8px;
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
  }

  .call-return.return-revealed {
    animation: returnReveal 400ms var(--ease) both;
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
