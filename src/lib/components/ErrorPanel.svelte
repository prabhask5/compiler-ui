<script lang="ts">
  import type { CompilerError } from '$lib/compiler/types';
  import type { EnrichedError } from '$lib/utils/error-commentary';

  let {
    errors,
    enrichedErrors = undefined,
    onErrorClick
  }: {
    errors: CompilerError[];
    enrichedErrors?: EnrichedError[];
    onErrorClick: (loc: [number, number, number, number]) => void;
  } = $props();

  // Use enriched errors if available, otherwise wrap raw errors
  const displayErrors = $derived(
    enrichedErrors ?? errors.map((e) => ({ original: e, commentary: null }))
  );

  let expandedIndex: number | null = $state(null);

  function toggleExpand(index: number) {
    expandedIndex = expandedIndex === index ? null : index;
  }
</script>

<div class="error-panel">
  <div class="error-header">
    <span class="error-icon">●</span>
    <span class="error-count">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
  </div>
  <div class="error-list">
    {#each displayErrors as enriched, i}
      <div class="error-entry">
        <div class="error-item-row">
          <button class="error-item" onclick={() => onErrorClick(enriched.original.location)}>
            <span class="error-location">
              {enriched.original.location[0]}:{enriched.original.location[1]}
            </span>
            <span class="error-message">{enriched.original.message}</span>
            {#if enriched.original.syntax}
              <span class="error-badge">syntax</span>
            {/if}
          </button>
          {#if enriched.commentary}
            <button
              class="commentary-toggle"
              onclick={() => toggleExpand(i)}
              title="Show explanation"
            >
              <span class="toggle-chevron" class:open={expandedIndex === i}>▸</span>
            </button>
          {/if}
        </div>
        {#if enriched.commentary && expandedIndex === i}
          <div class="commentary">
            {enriched.commentary}
          </div>
        {/if}
      </div>
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

  .error-entry {
    border-bottom: 1px solid var(--border);
  }

  .error-entry:last-child {
    border-bottom: none;
  }

  .error-item-row {
    display: flex;
    align-items: center;
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

  .commentary-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    margin-right: var(--space-sm);
    color: var(--text-muted);
    font-size: 10px;
    border-radius: var(--radius-sm);
    transition:
      color var(--duration-fast) var(--ease),
      background var(--duration-fast) var(--ease);
  }

  .commentary-toggle:hover {
    background: var(--bg-hover);
    color: var(--text);
  }

  .toggle-chevron {
    display: inline-block;
    transition: transform var(--duration-fast) var(--ease);
  }

  .toggle-chevron.open {
    transform: rotate(90deg);
  }

  .commentary {
    padding: var(--space-xs) var(--space-lg) var(--space-sm);
    padding-left: calc(var(--space-lg) + 48px + var(--space-md));
    font-size: 12px;
    line-height: 1.6;
    color: var(--accent);
    animation: fadeIn 200ms var(--ease) both;
  }
</style>
