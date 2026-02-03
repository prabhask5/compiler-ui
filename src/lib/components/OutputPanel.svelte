<script lang="ts">
  import type { CompileResult } from '$lib/compiler/types';
  import ASTTree from './ASTTree.svelte';
  import AssemblyView from './AssemblyView.svelte';

  let {
    result,
    activeTab,
    onTabChange,
    onNodeClick
  }: {
    result: CompileResult | null;
    activeTab: 'ast' | 'typed' | 'assembly' | 'run';
    onTabChange: (tab: 'ast' | 'typed' | 'assembly' | 'run') => void;
    onNodeClick: (loc: [number, number, number, number]) => void;
  } = $props();

  const tabs = [
    { id: 'ast' as const, label: 'AST' },
    { id: 'typed' as const, label: 'Typed AST' },
    { id: 'assembly' as const, label: 'Assembly' },
    { id: 'run' as const, label: 'Run' }
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

  <div class="tab-content">
    {#if activeTab === 'ast'}
      <div class="content-pane fade-in">
        {#if result}
          <ASTTree ast={result.untypedAst} typed={false} {onNodeClick} />
        {:else}
          <div class="empty-state">Compile to see the AST</div>
        {/if}
      </div>
    {:else if activeTab === 'typed'}
      <div class="content-pane fade-in">
        {#if result}
          <ASTTree ast={result.typedAst} typed={true} {onNodeClick} />
        {:else}
          <div class="empty-state">Compile to see the Typed AST</div>
        {/if}
      </div>
    {:else if activeTab === 'assembly'}
      <div class="content-pane fade-in">
        <AssemblyView />
      </div>
    {:else if activeTab === 'run'}
      <div class="content-pane fade-in">
        <!-- Console is rendered by parent alongside this component -->
      </div>
    {/if}
  </div>
</div>

<style>
  .output-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
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
