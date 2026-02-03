<script lang="ts">
  import type { CompilerError } from '$lib/compiler/types';

  let {
    errors,
    onErrorClick
  }: {
    errors: CompilerError[];
    onErrorClick: (loc: [number, number, number, number]) => void;
  } = $props();
</script>

<div class="error-panel">
  <div class="error-header">
    <span class="error-icon">●</span>
    <span class="error-count">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
  </div>
  <div class="error-list">
    {#each errors as error}
      <button class="error-item" onclick={() => onErrorClick(error.location)}>
        <span class="error-location">
          {error.location[0]}:{error.location[1]}
        </span>
        <span class="error-message">{error.message}</span>
        {#if error.syntax}
          <span class="error-badge">syntax</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .error-panel {
    border-top: 1px solid var(--border);
    background: var(--bg-elevated);
    max-height: var(--error-panel-height);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: slideUp var(--duration-slow) var(--ease);
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-lg);
    font-size: 12px;
    font-weight: 600;
    color: var(--error);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .error-icon {
    font-size: 8px;
  }

  .error-list {
    overflow-y: auto;
    flex: 1;
  }

  .error-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    width: 100%;
    padding: var(--space-sm) var(--space-lg);
    text-align: left;
    font-size: 12px;
    transition: background var(--duration-fast) var(--ease);
  }

  .error-item:hover {
    background: var(--bg-hover);
  }

  .error-location {
    font-family: var(--font-code);
    color: var(--text-muted);
    white-space: nowrap;
    min-width: 48px;
  }

  .error-message {
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .error-badge {
    font-size: 10px;
    padding: 1px 6px;
    background: var(--error-bg);
    color: var(--error);
    border-radius: 3px;
    flex-shrink: 0;
  }
</style>
