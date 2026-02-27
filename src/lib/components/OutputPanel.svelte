<script lang="ts">
  /**
   * Tabbed output panel container for the right side of the playground.
   *
   * Hosts four tabs:
   * - **AST** -- renders the typed AST tree from the last successful compile.
   * - **ASM** -- displays annotated x86-64 assembly with source line mappings.
   * - **Run** -- slot area where the Console component is mounted by the parent
   *   (the Run tab's content is handled externally so the Console can manage
   *   its own lifecycle independently of tab switches).
   * - **Docs** -- static documentation / reference panel.
   *
   * The active tab is controlled by the parent via the `activeTab` prop and
   * `onTabChange` callback, keeping state management centralized in +page.svelte.
   */
  import type { CompileResult, AssemblyOutput } from '$lib/compiler/types';
  import ASTTree from './ASTTree.svelte';
  import AssemblyPanel from './AssemblyPanel.svelte';
  import DocsPanel from './DocsPanel.svelte';

  let {
    result,
    assembly,
    sourceLines,
    highlightedSourceLine,
    highlightLoc,
    activeTab,
    onTabChange,
    onNodeClick,
    onInstructionClick,
    isExecuting = false
  }: {
    /** The most recent compilation result, or null before first compile. */
    result: CompileResult | null;
    /** The most recent assembly output, or null. */
    assembly: AssemblyOutput | null;
    /** Source code lines for assembly annotations. */
    sourceLines: string[];
    /** Currently highlighted source line (1-based), or null. */
    highlightedSourceLine: number | null;
    /** Source location currently highlighted for AST bidirectional sync. */
    highlightLoc: [number, number, number, number] | null;
    /** Currently selected tab identifier. */
    activeTab: 'ast' | 'asm' | 'run' | 'docs';
    /** Callback when the user clicks a different tab. */
    onTabChange: (tab: 'ast' | 'asm' | 'run' | 'docs') => void;
    /** Callback when the user clicks an AST node to highlight its source location. */
    onNodeClick: (loc: [number, number, number, number]) => void;
    /** Callback when the user clicks an assembly instruction with a source mapping. */
    onInstructionClick: (sourceLine: number) => void;
    /** Whether step-through execution is active (uses green highlight). */
    isExecuting?: boolean;
  } = $props();

  /** Tab definitions rendered in the tab bar. */
  const tabs = [
    { id: 'ast' as const, label: 'AST' },
    { id: 'asm' as const, label: 'ASM' },
    { id: 'run' as const, label: 'Run' },
    { id: 'docs' as const, label: 'Docs' }
  ];
</script>

<div class="output-panel">
  <div class="tab-bar">
    {#each tabs as tab (tab.id)}
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
            <ASTTree ast={result.typedAst} {onNodeClick} {highlightLoc} {isExecuting} />
          {:else}
            <div class="empty-state">Compile to see the AST</div>
          {/if}
        </div>
      {:else if activeTab === 'asm'}
        <div class="content-pane fade-in">
          {#if assembly}
            <AssemblyPanel
              {assembly}
              {sourceLines}
              {highlightedSourceLine}
              {onInstructionClick}
              {isExecuting}
            />
          {:else if result?.hasErrors}
            <div class="empty-state">Fix errors to see assembly</div>
          {:else}
            <div class="empty-state">Compile to see assembly</div>
          {/if}
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
