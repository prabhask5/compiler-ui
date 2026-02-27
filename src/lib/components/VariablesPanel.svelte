<script lang="ts">
  /**
   * Live variables panel for step-through execution.
   *
   * Shows current scope variables with animated value transitions.
   * Changed values flash green; new variables fade in.
   */
  let {
    variables,
    callDepth,
    currentFunction
  }: {
    /** Current variable snapshot: name → display string. */
    variables: Map<string, string>;
    /** Current function call nesting depth. */
    callDepth: number;
    /** Name of the currently executing function, or null for top-level. */
    currentFunction: string | null;
  } = $props();

  /** Previous variable values for change detection. */
  let previousValues: Map<string, string> = $state(new Map());
  /** Set of variable names whose values changed on the latest step. */
  let changedNames: Set<string> = $state(new Set());
  /** Set of variable names that are newly added on the latest step. */
  let newNames: Set<string> = $state(new Set());

  $effect(() => {
    const changed = new Set<string>();
    const added = new Set<string>();
    for (const [name, val] of variables) {
      const prev = previousValues.get(name);
      if (prev === undefined) {
        added.add(name);
      } else if (prev !== val) {
        changed.add(name);
      }
    }
    changedNames = changed;
    newNames = added;
    previousValues = new Map(variables);
  });

  /** Sorted variable entries for stable display order. */
  const entries = $derived([...variables.entries()].sort((a, b) => a[0].localeCompare(b[0])));

  const scopeLabel = $derived(
    currentFunction ? `${currentFunction}() depth:${callDepth}` : 'global'
  );
</script>

<div class="variables-panel">
  <div class="var-header">
    <span class="var-title">Variables</span>
    <span class="var-scope">{scopeLabel}</span>
  </div>
  <div class="var-list">
    {#if entries.length === 0}
      <div class="var-empty">No variables in scope</div>
    {:else}
      {#each entries as [name, value] (name)}
        <div
          class="var-row"
          class:changed={changedNames.has(name)}
          class:new-var={newNames.has(name)}
        >
          <span class="var-name">{name}</span>
          <span class="var-eq">=</span>
          <span class="var-value">{value}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .variables-panel {
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    font-family: var(--font-code);
    font-size: 11px;
  }

  .var-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xs) var(--space-md);
    border-bottom: 1px solid var(--border);
  }

  .var-title {
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 11px;
  }

  .var-scope {
    color: var(--text-muted);
    font-size: 10px;
  }

  .var-list {
    max-height: 200px;
    overflow-y: auto;
    padding: var(--space-xs) var(--space-md);
  }

  .var-empty {
    color: var(--text-muted);
    padding: var(--space-xs) 0;
  }

  .var-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 0;
    transition: background 600ms var(--ease);
  }

  .var-row.new-var {
    animation: fadeIn var(--duration) var(--ease);
  }

  .var-row.changed {
    animation: varFlash 600ms var(--ease);
  }

  @keyframes varFlash {
    0% {
      background: rgba(52, 211, 153, 0.25);
    }
    100% {
      background: transparent;
    }
  }

  .var-name {
    color: var(--syn-variable);
    font-weight: 500;
  }

  .var-eq {
    color: var(--text-muted);
  }

  .var-value {
    color: var(--syn-string);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  @media (max-width: 767px) {
    .var-list {
      max-height: 120px;
    }

    .var-value {
      max-width: 140px;
    }
  }
</style>
