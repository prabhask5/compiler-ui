<script lang="ts">
  import type { Program } from '$lib/compiler/types';
  import type { DeclarationMap, TypeProvenanceInfo } from '$lib/utils/declarations';
  import ASTNode from './ASTNode.svelte';

  let {
    ast,
    onNodeClick,
    onNodeHover = undefined,
    showTypeBadges = true,
    declarationMap = undefined,
    onTypeBadgeHover = undefined
  }: {
    ast: Program;
    onNodeClick: (loc: [number, number, number, number]) => void;
    onNodeHover?: ((loc: [number, number, number, number] | null) => void) | undefined;
    showTypeBadges?: boolean;
    declarationMap?: DeclarationMap;
    onTypeBadgeHover?: ((info: TypeProvenanceInfo | null) => void) | undefined;
  } = $props();

  let expandAll = $state(true);

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
    <ASTNode
      node={ast}
      key="Program"
      depth={0}
      {onNodeClick}
      {onNodeHover}
      forceExpand={expandAll}
      {showTypeBadges}
      {declarationMap}
      {onTypeBadgeHover}
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
