<script lang="ts">
  import type { CompileResult, Program } from '$lib/compiler/types';
  import type { DeclarationMap, TypeProvenanceInfo } from '$lib/utils/declarations';
  import type { Snapshot, SnapshotResult } from '$lib/interpreter/snapshot';
  import type { VariableLifetime } from '$lib/utils/lifetimes';
  import ASTTree from './ASTTree.svelte';
  import DocsPanel from './DocsPanel.svelte';
  import TimelinePanel from './TimelinePanel.svelte';

  let {
    result,
    activeTab,
    onTabChange,
    onNodeClick,
    onNodeHover = undefined,
    declarationMap = undefined,
    onTypeBadgeHover = undefined,
    snapshots = [],
    snapshotCompleted = false,
    untypedAst = undefined,
    lifetimes = [],
    onTimelineStep = undefined
  }: {
    result: CompileResult | null;
    activeTab: 'ast' | 'run' | 'timeline' | 'docs';
    onTabChange: (tab: 'ast' | 'run' | 'timeline' | 'docs') => void;
    onNodeClick: (loc: [number, number, number, number]) => void;
    onNodeHover?: ((loc: [number, number, number, number] | null) => void) | undefined;
    declarationMap?: DeclarationMap;
    onTypeBadgeHover?: ((info: TypeProvenanceInfo | null) => void) | undefined;
    snapshots?: Snapshot[];
    snapshotCompleted?: boolean;
    untypedAst?: Program;
    lifetimes?: VariableLifetime[];
    onTimelineStep?: ((step: number, location?: [number, number, number, number]) => void) | undefined;
  } = $props();

  const tabs = [
    { id: 'ast' as const, label: 'AST' },
    { id: 'run' as const, label: 'Run' },
    { id: 'timeline' as const, label: 'Timeline' },
    { id: 'docs' as const, label: 'Docs' }
  ];
</script>

<div class="output-panel">
  <div class="tab-bar">
    {#each tabs as tab}
      <button class="tab" class:active={activeTab === tab.id} onclick={() => onTabChange(tab.id)}>
        {tab.label}
      </button>
    {/each}
  </div>

  {#if activeTab !== 'run'}
    <div class="tab-content">
      {#if activeTab === 'ast'}
        <div class="content-pane fade-in">
          {#if result}
            <ASTTree
              ast={result.typedAst}
              {onNodeClick}
              {onNodeHover}
              {declarationMap}
              {onTypeBadgeHover}
            />
          {:else}
            <div class="empty-state">Compile to see the AST</div>
          {/if}
        </div>
      {:else if activeTab === 'timeline'}
        <div class="content-pane fade-in">
          <TimelinePanel
            {snapshots}
            {untypedAst}
            typedAst={result?.typedAst}
            {lifetimes}
            {snapshotCompleted}
            {onNodeClick}
            {onNodeHover}
            {declarationMap}
            {onTypeBadgeHover}
            {onTimelineStep}
          />
        </div>
      {:else if activeTab === 'docs'}
        <div class="content-pane fade-in">
          <DocsPanel />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .output-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 0 var(--space-md);
    height: var(--tab-height);
    align-items: stretch;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow-x: auto;
  }

  .tab {
    padding: 0 var(--space-md);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    transition:
      color var(--duration-fast) var(--ease),
      border-color var(--duration-fast) var(--ease);
    white-space: nowrap;
  }

  .tab:hover {
    color: var(--text-secondary);
  }

  .tab.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .tab-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .content-pane {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
