<script lang="ts">
  import type { Program } from '$lib/compiler/types';
  import ASTNode from './ASTNode.svelte';

  let {
    ast,
    typed,
    onNodeClick
  }: {
    ast: Program;
    typed: boolean;
    onNodeClick: (loc: [number, number, number, number]) => void;
  } = $props();

  let expandAll = $state(false);

  function toggleAll() {
    expandAll = !expandAll;
  }
</script>

<div class="ast-tree">
  <div class="tree-controls">
    <button class="control-btn" onclick={toggleAll}>
      {expandAll ? 'Collapse All' : 'Expand All'}
    </button>
  </div>
  <div class="tree-content">
    <ASTNode node={ast} key="Program" depth={0} {typed} {onNodeClick} forceExpand={expandAll} />
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

  .control-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .tree-content {
    flex: 1;
    overflow: auto;
    padding: var(--space-sm);
  }
</style>
