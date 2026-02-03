<script lang="ts">
  import type { Value } from '$lib/interpreter/values';
  import { displayValue } from '$lib/interpreter/values';

  let {
    variables,
    previousVariables = null
  }: {
    variables: Map<string, Value> | null;
    previousVariables?: Map<string, Value> | null;
  } = $props();

  const sortedEntries = $derived(
    variables ? [...variables.entries()].sort(([a], [b]) => a.localeCompare(b)) : []
  );

  function isChanged(name: string): boolean {
    if (!previousVariables || !variables) return false;
    const prev = previousVariables.get(name);
    const curr = variables.get(name);
    if (!prev && curr) return true;
    if (!prev || !curr) return false;
    return displayValue(prev) !== displayValue(curr);
  }

  function isNew(name: string): boolean {
    if (!previousVariables) return false;
    return !previousVariables.has(name);
  }
</script>

<div class="variable-panel">
  {#if !variables || sortedEntries.length === 0}
    <div class="empty">No variables in scope</div>
  {:else}
    <table class="var-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedEntries as [name, value] (name)}
          <tr
            class="var-row"
            class:changed={isChanged(name)}
            class:new-var={isNew(name)}
          >
            <td class="var-name">{name}</td>
            <td class="var-value">{displayValue(value)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .variable-panel {
    will-change: transform;
  }

  .empty {
    padding: var(--space-lg);
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
  }

  .var-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    font-family: var(--font-code);
  }

  .var-table th {
    text-align: left;
    padding: var(--space-xs) var(--space-md);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
    font-family: var(--font-ui);
  }

  .var-row td {
    padding: var(--space-xs) var(--space-md);
    border-bottom: 1px solid var(--border);
    transition: background 200ms var(--ease);
  }

  .var-name {
    color: var(--text);
    font-weight: 500;
    white-space: nowrap;
  }

  .var-value {
    color: var(--text-secondary);
    word-break: break-all;
  }

  @media (prefers-reduced-motion: no-preference) {
    .var-row.changed td {
      background: rgba(99, 102, 241, 0.1);
    }

    .var-row.new-var {
      animation: fadeIn 200ms var(--ease) both;
    }
  }
</style>
