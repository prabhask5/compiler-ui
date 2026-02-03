<script lang="ts">
  import type { Program } from '$lib/compiler/types';
  import type { DeclarationMap, TypeProvenanceInfo } from '$lib/utils/declarations';
  import type { Snapshot } from '$lib/interpreter/snapshot';
  import type { VariableLifetime } from '$lib/utils/lifetimes';
  import ASTTree from './ASTTree.svelte';
  import VariablePanel from './VariablePanel.svelte';

  let {
    snapshots = [],
    untypedAst = undefined,
    typedAst = undefined,
    lifetimes = [],
    snapshotCompleted = false,
    onNodeClick,
    declarationMap = undefined,
    onTypeBadgeHover = undefined,
    onTimelineStep = undefined
  }: {
    snapshots?: Snapshot[];
    untypedAst?: Program;
    typedAst?: Program;
    lifetimes?: VariableLifetime[];
    snapshotCompleted?: boolean;
    onNodeClick: (loc: [number, number, number, number]) => void;
    declarationMap?: DeclarationMap;
    onTypeBadgeHover?: ((info: TypeProvenanceInfo | null) => void) | undefined;
    onTimelineStep?: ((step: number, location?: [number, number, number, number]) => void) | undefined;
  } = $props();

  let phase: 'typecheck' | 'execution' = $state('typecheck');
  let typecheckStep = $state(0); // 0 = untyped, 1 = typed
  let execStep = $state(0);

  const hasSnapshots = $derived(snapshots.length > 0);
  const maxExecStep = $derived(Math.max(0, snapshots.length - 1));
  const currentSnapshot = $derived(hasSnapshots ? snapshots[Math.min(execStep, maxExecStep)] : null);
  const previousSnapshot = $derived(
    hasSnapshots && execStep > 0 ? snapshots[Math.min(execStep - 1, maxExecStep)] : null
  );

  function handleExecStepChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value);
    execStep = val;
    if (onTimelineStep && currentSnapshot) {
      onTimelineStep(val, currentSnapshot.location);
    }
  }

  function handleTypecheckStepChange(e: Event) {
    typecheckStep = parseInt((e.target as HTMLInputElement).value);
  }
</script>

<div class="timeline-panel">
  {#if !snapshotCompleted && snapshots.length === 0}
    <div class="warning-card glass">
      <div class="warning-icon">⚠</div>
      <div class="warning-text">
        {#if !typedAst}
          <p>Compile and run a program to enable time travel.</p>
        {:else}
          <p>Time travel is not available for this program.</p>
          <p class="warning-detail">Programs that use <code>input()</code> or exceed 5,000 execution steps cannot be recorded.</p>
        {/if}
      </div>
    </div>
  {:else}
    <div class="phase-toggle">
      <button
        class="phase-btn"
        class:active={phase === 'typecheck'}
        onclick={() => (phase = 'typecheck')}
      >Type Checking</button>
      <button
        class="phase-btn"
        class:active={phase === 'execution'}
        onclick={() => (phase = 'execution')}
        disabled={!hasSnapshots}
      >Execution</button>
    </div>

    <div class="phase-content">
      {#if phase === 'typecheck'}
        <div class="scrubber-section">
          <div class="scrubber-label">
            <span>Step</span>
            <span class="step-counter">{typecheckStep === 0 ? 'Untyped AST' : 'Typed AST'}</span>
          </div>
          <input
            type="range"
            class="scrubber"
            min="0"
            max="1"
            value={typecheckStep}
            oninput={handleTypecheckStepChange}
          />
        </div>

        <div class="ast-morph-container">
          {#if typecheckStep === 0 && untypedAst}
            <ASTTree
              ast={untypedAst}
              {onNodeClick}
              showTypeBadges={false}
              {declarationMap}
              {onTypeBadgeHover}
            />
          {:else if typecheckStep === 1 && typedAst}
            <ASTTree
              ast={typedAst}
              {onNodeClick}
              showTypeBadges={true}
              {declarationMap}
              {onTypeBadgeHover}
            />
          {:else}
            <div class="empty-state">Compile to see the AST</div>
          {/if}
        </div>
      {:else}
        <div class="scrubber-section">
          <div class="scrubber-label">
            <span>Step</span>
            <span class="step-counter">{execStep + 1} / {snapshots.length}</span>
          </div>
          <input
            type="range"
            class="scrubber"
            min="0"
            max={maxExecStep}
            value={execStep}
            oninput={handleExecStepChange}
          />
        </div>

        {#if currentSnapshot}
          <div class="exec-details">
            <div class="detail-section">
              <h3 class="detail-heading">Variables</h3>
              <VariablePanel
                variables={currentSnapshot.variables}
                previousVariables={previousSnapshot?.variables ?? null}
              />
            </div>

            {#if currentSnapshot.consoleOutput.length > 0}
              <div class="detail-section">
                <h3 class="detail-heading">Console</h3>
                <div class="console-preview">
                  {#each currentSnapshot.consoleOutput as line}
                    <div class="console-line">{line}</div>
                  {/each}
                </div>
              </div>
            {/if}

            {#if currentSnapshot.callStack.length > 1}
              <div class="detail-section">
                <h3 class="detail-heading">Call Stack</h3>
                <div class="call-stack">
                  {#each [...currentSnapshot.callStack].reverse() as frame, i}
                    <div class="stack-frame" class:active={i === 0}>{frame}</div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .timeline-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .warning-card {
    margin: var(--space-xl);
    padding: var(--space-lg);
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    display: flex;
    gap: var(--space-md);
    align-items: flex-start;
  }

  .warning-icon {
    font-size: 18px;
    flex-shrink: 0;
    opacity: 0.7;
  }

  .warning-text p {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  .warning-text p + p {
    margin-top: var(--space-xs);
  }

  .warning-detail {
    font-size: 12px !important;
    color: var(--text-muted) !important;
  }

  .warning-detail code {
    font-family: var(--font-code);
    font-size: 11px;
    padding: 1px 4px;
    background: var(--bg-hover);
    border-radius: 3px;
    color: var(--text);
  }

  .phase-toggle {
    display: flex;
    gap: 2px;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .phase-btn {
    flex: 1;
    padding: var(--space-xs) var(--space-md);
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    transition:
      background 200ms var(--ease),
      color 200ms var(--ease);
  }

  .phase-btn:hover:not(:disabled) {
    color: var(--text-secondary);
    background: var(--bg-hover);
  }

  .phase-btn.active {
    background: var(--bg-hover);
    color: var(--text);
  }

  .phase-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .phase-content {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }

  .scrubber-section {
    padding: var(--space-md);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .scrubber-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
    font-size: 11px;
    color: var(--text-muted);
  }

  .step-counter {
    font-variant-numeric: tabular-nums;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .scrubber {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--border);
    border-radius: 3px;
    outline: none;
    cursor: pointer;
  }

  .scrubber::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    cursor: grab;
    box-shadow: 0 0 6px var(--accent-glow);
    transition: box-shadow 150ms var(--ease);
  }

  .scrubber::-webkit-slider-thumb:active {
    cursor: grabbing;
    box-shadow: 0 0 12px var(--accent-glow-strong);
  }

  .scrubber::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--accent);
    cursor: grab;
    box-shadow: 0 0 6px var(--accent-glow);
    border: none;
  }

  .ast-morph-container {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .exec-details {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .detail-section {
    border-bottom: 1px solid var(--border);
  }

  .detail-heading {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    padding: var(--space-sm) var(--space-md);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .console-preview {
    padding: 0 var(--space-md) var(--space-sm);
    max-height: 120px;
    overflow: auto;
  }

  .console-line {
    font-family: var(--font-code);
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
  }

  .call-stack {
    padding: 0 var(--space-md) var(--space-sm);
  }

  .stack-frame {
    font-family: var(--font-code);
    font-size: 12px;
    color: var(--text-muted);
    padding: 2px 0;
  }

  .stack-frame.active {
    color: var(--text);
    font-weight: 500;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    font-size: 13px;
    padding: var(--space-xl);
  }
</style>
