<script lang="ts">
  import { getNodeCategory, getCategoryColor, formatValueType } from '$lib/compiler/types';
  import { getNodeSummary, getNodeChildren } from '$lib/utils/format';
  import ASTNode from './ASTNode.svelte';

  let {
    node,
    key,
    depth,
    onNodeClick,
    forceExpand
  }: {
    node: unknown;
    key: string;
    depth: number;
    onNodeClick: (loc: [number, number, number, number]) => void;
    forceExpand: boolean;
  } = $props();

  let expanded = $state(false);

  // Auto-expand first two levels
  $effect(() => {
    if (depth < 2) expanded = true;
  });

  $effect(() => {
    expanded = forceExpand;
  });

  const obj = $derived(node as Record<string, unknown>);
  const kind = $derived((obj?.kind as string) || '');
  const category = $derived(getNodeCategory(kind));
  const color = $derived(getCategoryColor(category));
  const summary = $derived(getNodeSummary(obj));
  const children = $derived(getNodeChildren(obj));
  const hasChildren = $derived(children.length > 0);
  const location = $derived(obj?.location as [number, number, number, number] | undefined);
  const inferredType = $derived(
    obj?.inferredType
      ? formatValueType(obj.inferredType as import('$lib/compiler/types').ValueType)
      : ''
  );

  function toggle() {
    expanded = !expanded;
  }

  function handleClick() {
    if (location) {
      onNodeClick(location);
    }
  }
</script>

{#if obj && typeof obj === 'object'}
  <div class="ast-node" style="--depth: {depth}; --color: {color}">
    <div class="node-header" class:expandable={hasChildren}>
      {#if hasChildren}
        <button class="expand-toggle" onclick={toggle}>
          <span class="chevron" class:open={expanded}>▸</span>
        </button>
      {:else}
        <span class="leaf-spacer"></span>
      {/if}

      <button
        class="node-label"
        onclick={handleClick}
        title={location ? `${location[0]}:${location[1]} - ${location[2]}:${location[3]}` : ''}
      >
        {#if key && key !== kind}
          <span class="node-key">{key}:</span>
        {/if}
        {#if kind}
          <span class="node-kind" style="color: {color}">{kind}</span>
        {:else}
          <span class="node-key">{key}</span>
        {/if}
        {#if summary}
          <span class="node-summary">{summary}</span>
        {/if}
        {#if inferredType}
          <span class="type-badge">{inferredType}</span>
        {/if}
      </button>
    </div>

    {#if expanded && hasChildren}
      <div class="node-children">
        {#each children as child, i}
          <div class="child" style="animation-delay: {Math.min(i * 30, 300)}ms">
            {#if Array.isArray(child.value)}
              <div class="array-node">
                <div class="array-header">
                  <span class="node-key">{child.key}</span>
                  <span class="array-count">[{child.value.length}]</span>
                </div>
                {#each child.value as item, j}
                  <ASTNode
                    node={item}
                    key={String(j)}
                    depth={depth + 1}
                    {onNodeClick}
                    {forceExpand}
                  />
                {/each}
              </div>
            {:else if typeof child.value === 'object' && child.value !== null}
              <ASTNode
                node={child.value}
                key={child.key}
                depth={depth + 1}
                {onNodeClick}
                {forceExpand}
              />
            {:else}
              <div class="leaf-value">
                <span class="node-key">{child.key}:</span>
                <span class="leaf-text">{JSON.stringify(child.value)}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .ast-node {
    position: relative;
    font-size: 12px;
    font-family: var(--font-code);
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    border-radius: var(--radius-sm);
  }

  .expand-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 10px;
    transition: color var(--duration-fast) var(--ease);
  }

  .expand-toggle:hover {
    color: var(--text);
  }

  .chevron {
    display: inline-block;
    transition: transform var(--duration-fast) var(--ease);
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .leaf-spacer {
    width: 16px;
    flex-shrink: 0;
  }

  .node-label {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--duration-fast) var(--ease);
  }

  .node-label:hover {
    background: var(--bg-hover);
  }

  .node-key {
    color: var(--text-muted);
    font-size: 11px;
  }

  .node-kind {
    font-weight: 600;
  }

  .node-summary {
    color: var(--text-secondary);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 300px;
  }

  .type-badge {
    font-size: 10px;
    padding: 0 5px;
    background: rgba(99, 102, 241, 0.15);
    color: var(--accent);
    border-radius: 3px;
    font-weight: 500;
    white-space: nowrap;
  }

  .node-children {
    padding-left: 16px;
    border-left: 1px solid var(--border);
    margin-left: 7px;
  }

  .child {
    animation: fadeIn var(--duration) var(--ease) both;
  }

  .array-node {
    padding: 1px 0;
  }

  .array-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0 2px 16px;
  }

  .array-count {
    color: var(--text-muted);
    font-size: 10px;
  }

  .leaf-value {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0 2px 22px;
  }

  .leaf-text {
    color: var(--syn-string);
    font-size: 11px;
  }
</style>
